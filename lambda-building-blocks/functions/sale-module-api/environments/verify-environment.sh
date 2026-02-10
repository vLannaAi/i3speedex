#!/bin/bash
set -e

# Environment Verification Script
# Verifies all deployed resources are working correctly

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

ENVIRONMENT=""

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --environment|-e)
            ENVIRONMENT="$2"
            shift 2
            ;;
        --help|-h)
            echo "Usage: $0 --environment ENV"
            echo ""
            echo "Verifies deployed infrastructure for the specified environment"
            echo ""
            echo "Options:"
            echo "  --environment, -e ENV   Environment to verify (dev|staging|production)"
            echo "  --help, -h              Show this help"
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            exit 1
            ;;
    esac
done

if [ -z "$ENVIRONMENT" ]; then
    echo -e "${RED}Error: --environment is required${NC}"
    exit 1
fi

CONFIG_FILE="$SCRIPT_DIR/config/${ENVIRONMENT}.json"
if [ ! -f "$CONFIG_FILE" ]; then
    echo -e "${RED}Error: Configuration file not found: $CONFIG_FILE${NC}"
    exit 1
fi

AWS_REGION=$(jq -r '.region' "$CONFIG_FILE")
CHECKS_PASSED=0
CHECKS_FAILED=0

echo "=========================================="
echo "Environment Verification: $ENVIRONMENT"
echo "=========================================="
echo ""

# Check DynamoDB tables
echo -e "${BLUE}Checking DynamoDB tables...${NC}"
TABLES=(
    "$(jq -r '.dynamodb.salesTable' "$CONFIG_FILE")"
    "$(jq -r '.dynamodb.buyersTable' "$CONFIG_FILE")"
    "$(jq -r '.dynamodb.producersTable' "$CONFIG_FILE")"
)

for TABLE in "${TABLES[@]}"; do
    echo -n "  $TABLE... "
    STATUS=$(aws dynamodb describe-table \
        --table-name "$TABLE" \
        --region "$AWS_REGION" \
        --query 'Table.TableStatus' \
        --output text 2>/dev/null || echo "NOT_FOUND")

    if [ "$STATUS" == "ACTIVE" ]; then
        echo -e "${GREEN}✓ Active${NC}"
        CHECKS_PASSED=$((CHECKS_PASSED + 1))
    else
        echo -e "${RED}✗ $STATUS${NC}"
        CHECKS_FAILED=$((CHECKS_FAILED + 1))
    fi
done

echo ""

# Check S3 buckets
echo -e "${BLUE}Checking S3 buckets...${NC}"
BUCKETS=(
    "$(jq -r '.s3.attachmentsBucket' "$CONFIG_FILE")"
    "$(jq -r '.s3.invoicesBucket' "$CONFIG_FILE")"
)

for BUCKET in "${BUCKETS[@]}"; do
    echo -n "  $BUCKET... "
    if aws s3 ls "s3://$BUCKET" --region "$AWS_REGION" &> /dev/null; then
        echo -e "${GREEN}✓ Exists${NC}"
        CHECKS_PASSED=$((CHECKS_PASSED + 1))
    else
        echo -e "${RED}✗ Not found${NC}"
        CHECKS_FAILED=$((CHECKS_FAILED + 1))
    fi
done

echo ""

# Check Cognito User Pool
echo -e "${BLUE}Checking Cognito User Pool...${NC}"
USER_POOL_NAME=$(jq -r '.cognito.userPoolName' "$CONFIG_FILE")
echo -n "  $USER_POOL_NAME... "

USER_POOL_ID=$(aws cognito-idp list-user-pools \
    --max-results 60 \
    --region "$AWS_REGION" \
    --query "UserPools[?Name=='$USER_POOL_NAME'].Id" \
    --output text 2>/dev/null || echo "")

if [ -n "$USER_POOL_ID" ]; then
    echo -e "${GREEN}✓ $USER_POOL_ID${NC}"
    CHECKS_PASSED=$((CHECKS_PASSED + 1))
else
    echo -e "${RED}✗ Not found${NC}"
    CHECKS_FAILED=$((CHECKS_FAILED + 1))
fi

echo ""

# Check API Gateway
echo -e "${BLUE}Checking API Gateway...${NC}"
echo -n "  sale-module-api-$ENVIRONMENT... "

API_ID=$(aws apigateway get-rest-apis \
    --query "items[?name=='sale-module-api-${ENVIRONMENT}'].id" \
    --output text \
    --region "$AWS_REGION" 2>/dev/null || echo "")

if [ -n "$API_ID" ]; then
    echo -e "${GREEN}✓ $API_ID${NC}"
    CHECKS_PASSED=$((CHECKS_PASSED + 1))

    # Test health endpoint if available
    STAGE_NAME=$(jq -r '.apiGateway.stageName' "$CONFIG_FILE")
    HEALTH_URL="https://${API_ID}.execute-api.${AWS_REGION}.amazonaws.com/${STAGE_NAME}/api/health"

    echo -n "  Health endpoint... "
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$HEALTH_URL" 2>/dev/null || echo "000")

    if [ "$HTTP_CODE" == "200" ]; then
        echo -e "${GREEN}✓ 200 OK${NC}"
        CHECKS_PASSED=$((CHECKS_PASSED + 1))
    else
        echo -e "${YELLOW}⚠ HTTP $HTTP_CODE (may not be implemented yet)${NC}"
    fi
else
    echo -e "${YELLOW}⊘ Not found (may be deployed via SAM)${NC}"
fi

echo ""

# Check CloudFront if enabled
CLOUDFRONT_ENABLED=$(jq -r '.cloudfront.enabled' "$CONFIG_FILE")
if [ "$CLOUDFRONT_ENABLED" == "true" ]; then
    echo -e "${BLUE}Checking CloudFront distribution...${NC}"
    echo -n "  sale-module-cloudfront-$ENVIRONMENT... "

    DIST_DOMAIN=$(aws cloudformation describe-stacks \
        --stack-name "sale-module-cloudfront-${ENVIRONMENT}" \
        --region us-east-1 \
        --query 'Stacks[0].Outputs[?OutputKey==`DistributionDomainName`].OutputValue' \
        --output text 2>/dev/null || echo "")

    if [ -n "$DIST_DOMAIN" ]; then
        echo -e "${GREEN}✓ $DIST_DOMAIN${NC}"
        CHECKS_PASSED=$((CHECKS_PASSED + 1))
    else
        echo -e "${RED}✗ Not found${NC}"
        CHECKS_FAILED=$((CHECKS_FAILED + 1))
    fi

    echo ""
fi

# Summary
echo "=========================================="
TOTAL_CHECKS=$((CHECKS_PASSED + CHECKS_FAILED))
SUCCESS_RATE=$((CHECKS_PASSED * 100 / TOTAL_CHECKS))

if [ $CHECKS_FAILED -eq 0 ]; then
    echo -e "${GREEN}All Checks Passed!${NC}"
else
    echo -e "${YELLOW}Some Checks Failed${NC}"
fi

echo ""
echo "Results:"
echo "  Passed: $CHECKS_PASSED / $TOTAL_CHECKS ($SUCCESS_RATE%)"
echo "  Failed: $CHECKS_FAILED / $TOTAL_CHECKS"
echo ""

if [ $CHECKS_FAILED -eq 0 ]; then
    echo -e "${GREEN}Environment $ENVIRONMENT is healthy!${NC}"
    exit 0
else
    echo -e "${YELLOW}Some resources are missing or unhealthy${NC}"
    exit 1
fi
