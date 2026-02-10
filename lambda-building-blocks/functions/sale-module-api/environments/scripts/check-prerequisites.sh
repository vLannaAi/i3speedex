#!/bin/bash
set -e

# Prerequisites Check Script
# Validates all requirements before deployment

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
ENV_DIR="$(dirname "$SCRIPT_DIR")"

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

ENVIRONMENT=$1
ERRORS=0
WARNINGS=0

echo "Checking prerequisites for $ENVIRONMENT environment..."
echo ""

# Check AWS CLI
echo -n "AWS CLI... "
if command -v aws &> /dev/null; then
    AWS_VERSION=$(aws --version 2>&1 | awk '{print $1}' | cut -d/ -f2)
    echo -e "${GREEN}✓${NC} (v$AWS_VERSION)"
else
    echo -e "${RED}✗ Not installed${NC}"
    ERRORS=$((ERRORS + 1))
fi

# Check Node.js
echo -n "Node.js... "
if command -v node &> /dev/null; then
    NODE_VERSION=$(node --version)
    echo -e "${GREEN}✓${NC} ($NODE_VERSION)"
else
    echo -e "${RED}✗ Not installed${NC}"
    ERRORS=$((ERRORS + 1))
fi

# Check npm
echo -n "npm... "
if command -v npm &> /dev/null; then
    NPM_VERSION=$(npm --version)
    echo -e "${GREEN}✓${NC} (v$NPM_VERSION)"
else
    echo -e "${RED}✗ Not installed${NC}"
    ERRORS=$((ERRORS + 1))
fi

# Check jq
echo -n "jq... "
if command -v jq &> /dev/null; then
    JQ_VERSION=$(jq --version)
    echo -e "${GREEN}✓${NC} ($JQ_VERSION)"
else
    echo -e "${RED}✗ Not installed${NC}"
    ERRORS=$((ERRORS + 1))
fi

# Check SAM CLI (optional but recommended)
echo -n "AWS SAM CLI... "
if command -v sam &> /dev/null; then
    SAM_VERSION=$(sam --version 2>&1 | awk '{print $4}')
    echo -e "${GREEN}✓${NC} (v$SAM_VERSION)"
else
    echo -e "${YELLOW}⚠ Not installed (optional)${NC}"
    WARNINGS=$((WARNINGS + 1))
fi

# Check Python (for migration scripts)
echo -n "Python 3... "
if command -v python3 &> /dev/null; then
    PYTHON_VERSION=$(python3 --version | awk '{print $2}')
    echo -e "${GREEN}✓${NC} (v$PYTHON_VERSION)"
else
    echo -e "${YELLOW}⚠ Not installed (required for migration)${NC}"
    WARNINGS=$((WARNINGS + 1))
fi

echo ""
echo "Checking AWS credentials..."
echo ""

# Check AWS credentials
echo -n "AWS credentials configured... "
if aws sts get-caller-identity &> /dev/null; then
    echo -e "${GREEN}✓${NC}"

    ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
    USER_ARN=$(aws sts get-caller-identity --query Arn --output text)

    echo "  Account ID: $ACCOUNT_ID"
    echo "  Identity: $USER_ARN"
else
    echo -e "${RED}✗ Not configured${NC}"
    echo "  Run: aws configure"
    ERRORS=$((ERRORS + 1))
fi

echo ""
echo "Checking AWS permissions..."
echo ""

# Check required AWS permissions
check_permission() {
    local service=$1
    local action=$2
    echo -n "  $service:$action... "

    # This is a simplified check - in reality you'd use IAM policy simulator
    echo -e "${YELLOW}⚠ Cannot verify (manual check required)${NC}"
}

echo "Required permissions (verify manually):"
check_permission "dynamodb" "CreateTable"
check_permission "s3" "CreateBucket"
check_permission "cognito-idp" "CreateUserPool"
check_permission "lambda" "CreateFunction"
check_permission "apigateway" "CreateRestApi"
check_permission "cloudformation" "CreateStack"
check_permission "iam" "CreateRole"

echo ""
echo "Checking configuration files..."
echo ""

# Check environment config exists
CONFIG_FILE="$ENV_DIR/config/${ENVIRONMENT}.json"
echo -n "Environment config ($ENVIRONMENT.json)... "
if [ -f "$CONFIG_FILE" ]; then
    echo -e "${GREEN}✓${NC}"

    # Validate JSON
    if jq empty "$CONFIG_FILE" 2>/dev/null; then
        echo "  Valid JSON"
    else
        echo -e "${RED}  Invalid JSON${NC}"
        ERRORS=$((ERRORS + 1))
    fi

    # Check required fields
    REQUIRED_FIELDS=("region" "accountId" "projectName" "dynamodb" "s3" "cognito")
    for field in "${REQUIRED_FIELDS[@]}"; do
        VALUE=$(jq -r ".$field // empty" "$CONFIG_FILE")
        if [ -z "$VALUE" ]; then
            echo -e "${RED}  Missing field: $field${NC}"
            ERRORS=$((ERRORS + 1))
        fi
    done
else
    echo -e "${RED}✗ Not found${NC}"
    ERRORS=$((ERRORS + 1))
fi

echo ""
echo "Checking project dependencies..."
echo ""

# Check if node_modules exists
echo -n "Node dependencies installed... "
if [ -d "$ENV_DIR/../node_modules" ]; then
    echo -e "${GREEN}✓${NC}"
else
    echo -e "${YELLOW}⚠ Run: npm install${NC}"
    WARNINGS=$((WARNINGS + 1))
fi

# Check if tests pass
echo -n "Unit tests... "
if [ -d "$ENV_DIR/../node_modules" ]; then
    if npm test --prefix "$ENV_DIR/.." &> /dev/null; then
        echo -e "${GREEN}✓ Passing${NC}"
    else
        echo -e "${YELLOW}⚠ Some tests failing${NC}"
        WARNINGS=$((WARNINGS + 1))
    fi
else
    echo -e "${YELLOW}⊘ Skipped (dependencies not installed)${NC}"
fi

echo ""
echo "Checking AWS resources..."
echo ""

# Check if CloudFormation stacks already exist
STACK_NAME="sale-module-api-${ENVIRONMENT}"
echo -n "CloudFormation stack ($STACK_NAME)... "
STACK_STATUS=$(aws cloudformation describe-stacks \
    --stack-name "$STACK_NAME" \
    --query 'Stacks[0].StackStatus' \
    --output text 2>/dev/null || echo "NOT_FOUND")

if [ "$STACK_STATUS" == "NOT_FOUND" ]; then
    echo -e "${GREEN}✓ Does not exist (ready for deployment)${NC}"
elif [[ "$STACK_STATUS" =~ ^(CREATE_COMPLETE|UPDATE_COMPLETE)$ ]]; then
    echo -e "${YELLOW}⚠ Already exists ($STACK_STATUS)${NC}"
    WARNINGS=$((WARNINGS + 1))
else
    echo -e "${RED}✗ Exists in bad state: $STACK_STATUS${NC}"
    ERRORS=$((ERRORS + 1))
fi

# Check if S3 buckets already exist
ATTACHMENTS_BUCKET=$(jq -r '.s3.attachmentsBucket' "$CONFIG_FILE")
echo -n "S3 bucket ($ATTACHMENTS_BUCKET)... "
if aws s3 ls "s3://$ATTACHMENTS_BUCKET" &> /dev/null; then
    echo -e "${YELLOW}⚠ Already exists${NC}"
    WARNINGS=$((WARNINGS + 1))
else
    echo -e "${GREEN}✓ Does not exist (ready for creation)${NC}"
fi

# Check if DynamoDB tables already exist
SALES_TABLE=$(jq -r '.dynamodb.salesTable' "$CONFIG_FILE")
echo -n "DynamoDB table ($SALES_TABLE)... "
if aws dynamodb describe-table --table-name "$SALES_TABLE" &> /dev/null 2>&1; then
    echo -e "${YELLOW}⚠ Already exists${NC}"
    WARNINGS=$((WARNINGS + 1))
else
    echo -e "${GREEN}✓ Does not exist (ready for creation)${NC}"
fi

# Summary
echo ""
echo "=========================================="
if [ $ERRORS -eq 0 ]; then
    echo -e "${GREEN}Prerequisites Check Complete${NC}"
    echo "Errors: $ERRORS"
    echo "Warnings: $WARNINGS"
    echo ""
    if [ $WARNINGS -gt 0 ]; then
        echo -e "${YELLOW}Some warnings were found but deployment can proceed${NC}"
    else
        echo -e "${GREEN}All checks passed! Ready to deploy${NC}"
    fi
    exit 0
else
    echo -e "${RED}Prerequisites Check Failed${NC}"
    echo "Errors: $ERRORS"
    echo "Warnings: $WARNINGS"
    echo ""
    echo -e "${RED}Please fix errors before deploying${NC}"
    exit 1
fi
