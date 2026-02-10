#!/bin/bash
set -e

# Post-Deployment Configuration Script

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
ENV_DIR="$(dirname "$SCRIPT_DIR")"

# Color codes
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

ENVIRONMENT=$1

if [ -z "$ENVIRONMENT" ]; then
    echo "Usage: $0 <environment>"
    exit 1
fi

CONFIG_FILE="$ENV_DIR/config/${ENVIRONMENT}.json"
AWS_REGION=$(jq -r '.region' "$CONFIG_FILE")

echo -e "${BLUE}Running post-deployment configuration for $ENVIRONMENT...${NC}"
echo ""

# Output endpoints and important information
echo "Gathering deployment information..."
echo ""

# Get API Gateway endpoint
echo "API Gateway Endpoint:"
API_ID=$(aws apigateway get-rest-apis \
    --query "items[?name=='sale-module-api-${ENVIRONMENT}'].id" \
    --output text \
    --region "$AWS_REGION" 2>/dev/null || echo "")

if [ -n "$API_ID" ]; then
    STAGE_NAME=$(jq -r '.apiGateway.stageName' "$CONFIG_FILE")
    API_ENDPOINT="https://${API_ID}.execute-api.${AWS_REGION}.amazonaws.com/${STAGE_NAME}"
    echo "  $API_ENDPOINT"
else
    echo -e "  ${YELLOW}Not found (may be deployed via SAM)${NC}"
fi

echo ""

# Get CloudFront distribution
echo "CloudFront Distribution:"
CLOUDFRONT_DIST=$(aws cloudformation describe-stacks \
    --stack-name "sale-module-cloudfront-${ENVIRONMENT}" \
    --region us-east-1 \
    --query 'Stacks[0].Outputs[?OutputKey==`DistributionDomainName`].OutputValue' \
    --output text 2>/dev/null || echo "")

if [ -n "$CLOUDFRONT_DIST" ]; then
    echo "  https://$CLOUDFRONT_DIST"
else
    echo -e "  ${YELLOW}Not deployed${NC}"
fi

echo ""

# Get Cognito User Pool details
echo "Cognito User Pool:"
USER_POOL_NAME=$(jq -r '.cognito.userPoolName' "$CONFIG_FILE")
USER_POOL_ID=$(aws cognito-idp list-user-pools \
    --max-results 60 \
    --region "$AWS_REGION" \
    --query "UserPools[?Name=='$USER_POOL_NAME'].Id" \
    --output text 2>/dev/null || echo "")

if [ -n "$USER_POOL_ID" ]; then
    echo "  Pool ID: $USER_POOL_ID"
    echo "  Region: $AWS_REGION"
else
    echo -e "  ${YELLOW}Not found${NC}"
fi

echo ""

# Get DynamoDB table names
echo "DynamoDB Tables:"
SALES_TABLE=$(jq -r '.dynamodb.salesTable' "$CONFIG_FILE")
BUYERS_TABLE=$(jq -r '.dynamodb.buyersTable' "$CONFIG_FILE")
PRODUCERS_TABLE=$(jq -r '.dynamodb.producersTable' "$CONFIG_FILE")

echo "  - $SALES_TABLE"
echo "  - $BUYERS_TABLE"
echo "  - $PRODUCERS_TABLE"

echo ""

# Get S3 buckets
echo "S3 Buckets:"
ATTACHMENTS_BUCKET=$(jq -r '.s3.attachmentsBucket' "$CONFIG_FILE")
INVOICES_BUCKET=$(jq -r '.s3.invoicesBucket' "$CONFIG_FILE")

echo "  - s3://$ATTACHMENTS_BUCKET"
echo "  - s3://$INVOICES_BUCKET"

echo ""

# Save outputs to file
OUTPUT_FILE="$ENV_DIR/outputs/${ENVIRONMENT}-outputs.json"
mkdir -p "$ENV_DIR/outputs"

cat > "$OUTPUT_FILE" <<EOF
{
  "environment": "$ENVIRONMENT",
  "region": "$AWS_REGION",
  "timestamp": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "apiGateway": {
    "id": "$API_ID",
    "endpoint": "$API_ENDPOINT"
  },
  "cloudfront": {
    "domain": "$CLOUDFRONT_DIST"
  },
  "cognito": {
    "userPoolId": "$USER_POOL_ID",
    "userPoolName": "$USER_POOL_NAME"
  },
  "dynamodb": {
    "salesTable": "$SALES_TABLE",
    "buyersTable": "$BUYERS_TABLE",
    "producersTable": "$PRODUCERS_TABLE"
  },
  "s3": {
    "attachmentsBucket": "$ATTACHMENTS_BUCKET",
    "invoicesBucket": "$INVOICES_BUCKET"
  }
}
EOF

echo "Deployment outputs saved to: $OUTPUT_FILE"
echo ""

# Create sample .env file for local development
ENV_FILE="$ENV_DIR/outputs/${ENVIRONMENT}.env"
cat > "$ENV_FILE" <<EOF
# Sale Module API - $ENVIRONMENT Environment
# Generated: $(date)

ENVIRONMENT=$ENVIRONMENT
AWS_REGION=$AWS_REGION

# API Gateway
API_ENDPOINT=$API_ENDPOINT

# Cognito
COGNITO_USER_POOL_ID=$USER_POOL_ID
COGNITO_REGION=$AWS_REGION

# DynamoDB
DYNAMODB_SALES_TABLE=$SALES_TABLE
DYNAMODB_BUYERS_TABLE=$BUYERS_TABLE
DYNAMODB_PRODUCERS_TABLE=$PRODUCERS_TABLE

# S3
S3_ATTACHMENTS_BUCKET=$ATTACHMENTS_BUCKET
S3_INVOICES_BUCKET=$INVOICES_BUCKET

# CloudFront
CLOUDFRONT_DOMAIN=$CLOUDFRONT_DIST
EOF

echo "Environment variables saved to: $ENV_FILE"
echo ""

echo -e "${GREEN}✓ Post-deployment configuration complete${NC}"
echo ""
