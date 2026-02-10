#!/bin/bash
set -e

# Sale Module API Deployment Script
# Usage: ./scripts/deploy.sh [environment]
# Example: ./scripts/deploy.sh dev

ENVIRONMENT=${1:-dev}
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_DIR="$( cd "$SCRIPT_DIR/.." && pwd )"

echo "=========================================="
echo "Sale Module API Deployment"
echo "=========================================="
echo "Environment: $ENVIRONMENT"
echo "Project Dir: $PROJECT_DIR"
echo ""

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Validate environment
if [[ ! "$ENVIRONMENT" =~ ^(dev|staging|production)$ ]]; then
    echo -e "${RED}Error: Invalid environment '$ENVIRONMENT'${NC}"
    echo "Valid environments: dev, staging, production"
    exit 1
fi

# Load environment-specific configuration
CONFIG_FILE="$PROJECT_DIR/config/$ENVIRONMENT.env"
if [ -f "$CONFIG_FILE" ]; then
    echo -e "${GREEN}Loading configuration from $CONFIG_FILE${NC}"
    source "$CONFIG_FILE"
else
    echo -e "${YELLOW}Warning: Configuration file not found at $CONFIG_FILE${NC}"
    echo "Using default/environment variables"
fi

# Check for required tools
command -v aws >/dev/null 2>&1 || { echo -e "${RED}Error: AWS CLI is not installed${NC}"; exit 1; }
command -v sam >/dev/null 2>&1 || { echo -e "${RED}Error: AWS SAM CLI is not installed${NC}"; exit 1; }
command -v node >/dev/null 2>&1 || { echo -e "${RED}Error: Node.js is not installed${NC}"; exit 1; }

# Check AWS credentials
aws sts get-caller-identity >/dev/null 2>&1 || {
    echo -e "${RED}Error: AWS credentials not configured${NC}"
    exit 1
}

ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
AWS_REGION=${AWS_REGION:-us-east-1}
echo -e "${GREEN}AWS Account: $ACCOUNT_ID${NC}"
echo -e "${GREEN}AWS Region: $AWS_REGION${NC}"
echo ""

# Navigate to project directory
cd "$PROJECT_DIR"

# Step 1: Install dependencies
echo -e "${YELLOW}[1/7] Installing dependencies...${NC}"
npm ci

# Step 2: Run tests
echo -e "${YELLOW}[2/7] Running tests...${NC}"
npm test

# Step 3: Build TypeScript
echo -e "${YELLOW}[3/7] Building TypeScript...${NC}"
npm run build

# Step 4: Validate SAM template
echo -e "${YELLOW}[4/7] Validating SAM template...${NC}"
sam validate --template-file template.yaml --region $AWS_REGION

# Step 5: Build SAM application
echo -e "${YELLOW}[5/7] Building SAM application...${NC}"
sam build --template-file template.yaml --use-container

# Step 6: Deploy to AWS
echo -e "${YELLOW}[6/7] Deploying to AWS...${NC}"

# Set default values if not provided
COGNITO_USER_POOL_ID=${COGNITO_USER_POOL_ID:-""}
DYNAMODB_SALES_TABLE=${DYNAMODB_SALES_TABLE:-"SalesTable-$ENVIRONMENT"}
DYNAMODB_BUYERS_TABLE=${DYNAMODB_BUYERS_TABLE:-"BuyersTable-$ENVIRONMENT"}
DYNAMODB_PRODUCERS_TABLE=${DYNAMODB_PRODUCERS_TABLE:-"ProducersTable-$ENVIRONMENT"}
S3_ATTACHMENTS_BUCKET=${S3_ATTACHMENTS_BUCKET:-"sale-module-attachments-$ENVIRONMENT"}
S3_INVOICES_BUCKET=${S3_INVOICES_BUCKET:-"sale-module-invoices-$ENVIRONMENT"}

sam deploy \
    --template-file .aws-sam/build/template.yaml \
    --stack-name "sale-module-api-$ENVIRONMENT" \
    --capabilities CAPABILITY_IAM \
    --parameter-overrides \
        Environment=$ENVIRONMENT \
        CognitoUserPoolId=$COGNITO_USER_POOL_ID \
        SalesTableName=$DYNAMODB_SALES_TABLE \
        BuyersTableName=$DYNAMODB_BUYERS_TABLE \
        ProducersTableName=$DYNAMODB_PRODUCERS_TABLE \
        AttachmentsBucket=$S3_ATTACHMENTS_BUCKET \
        InvoicesBucket=$S3_INVOICES_BUCKET \
    --region $AWS_REGION \
    --no-fail-on-empty-changeset \
    --no-confirm-changeset

# Step 7: Get stack outputs
echo -e "${YELLOW}[7/7] Retrieving deployment information...${NC}"

API_URL=$(aws cloudformation describe-stacks \
    --stack-name "sale-module-api-$ENVIRONMENT" \
    --query 'Stacks[0].Outputs[?OutputKey==`ApiUrl`].OutputValue' \
    --output text \
    --region $AWS_REGION)

API_ID=$(aws cloudformation describe-stacks \
    --stack-name "sale-module-api-$ENVIRONMENT" \
    --query 'Stacks[0].Outputs[?OutputKey==`ApiId`].OutputValue' \
    --output text \
    --region $AWS_REGION)

echo ""
echo "=========================================="
echo -e "${GREEN}Deployment Successful!${NC}"
echo "=========================================="
echo "Environment: $ENVIRONMENT"
echo "API URL: $API_URL"
echo "API ID: $API_ID"
echo "Region: $AWS_REGION"
echo ""
echo "Next steps:"
echo "1. Test API: curl -f $API_URL/health"
echo "2. View logs: sam logs --stack-name sale-module-api-$ENVIRONMENT --tail"
echo "3. Monitor: https://console.aws.amazon.com/cloudwatch"
echo "=========================================="
