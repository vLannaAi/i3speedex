#!/bin/bash
set -e

# Get Endpoints Script
# Displays all API endpoints and URLs for an environment

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# Color codes
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

ENVIRONMENT=""
FORMAT="text"  # text or json

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --environment|-e)
            ENVIRONMENT="$2"
            shift 2
            ;;
        --format|-f)
            FORMAT="$2"
            shift 2
            ;;
        --help|-h)
            echo "Usage: $0 --environment ENV [OPTIONS]"
            echo ""
            echo "Displays all endpoints and URLs for the specified environment"
            echo ""
            echo "Options:"
            echo "  --environment, -e ENV   Environment (dev|staging|production)"
            echo "  --format, -f FORMAT     Output format (text|json)"
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
    echo "Error: --environment is required"
    exit 1
fi

CONFIG_FILE="$SCRIPT_DIR/config/${ENVIRONMENT}.json"
if [ ! -f "$CONFIG_FILE" ]; then
    echo "Error: Configuration file not found: $CONFIG_FILE"
    exit 1
fi

AWS_REGION=$(jq -r '.region' "$CONFIG_FILE")

# Gather endpoints
API_ID=$(aws apigateway get-rest-apis \
    --query "items[?name=='sale-module-api-${ENVIRONMENT}'].id" \
    --output text \
    --region "$AWS_REGION" 2>/dev/null || echo "")

STAGE_NAME=$(jq -r '.apiGateway.stageName' "$CONFIG_FILE")

if [ -n "$API_ID" ]; then
    API_ENDPOINT="https://${API_ID}.execute-api.${AWS_REGION}.amazonaws.com/${STAGE_NAME}"
else
    API_ENDPOINT=""
fi

CLOUDFRONT_DOMAIN=$(aws cloudformation describe-stacks \
    --stack-name "sale-module-cloudfront-${ENVIRONMENT}" \
    --region us-east-1 \
    --query 'Stacks[0].Outputs[?OutputKey==`DistributionDomainName`].OutputValue' \
    --output text 2>/dev/null || echo "")

if [ -n "$CLOUDFRONT_DOMAIN" ]; then
    CLOUDFRONT_URL="https://$CLOUDFRONT_DOMAIN"
else
    CLOUDFRONT_URL=""
fi

CUSTOM_DOMAIN=$(jq -r '.apiGateway.customDomain.domainName' "$CONFIG_FILE")
if [ "$CUSTOM_DOMAIN" != "null" ] && [ -n "$CUSTOM_DOMAIN" ]; then
    CUSTOM_URL="https://$CUSTOM_DOMAIN"
else
    CUSTOM_URL=""
fi

USER_POOL_NAME=$(jq -r '.cognito.userPoolName' "$CONFIG_FILE")
USER_POOL_ID=$(aws cognito-idp list-user-pools \
    --max-results 60 \
    --region "$AWS_REGION" \
    --query "UserPools[?Name=='$USER_POOL_NAME'].Id" \
    --output text 2>/dev/null || echo "")

# Output
if [ "$FORMAT" == "json" ]; then
    # JSON output
    cat <<EOF
{
  "environment": "$ENVIRONMENT",
  "region": "$AWS_REGION",
  "endpoints": {
    "apiGateway": "$API_ENDPOINT",
    "cloudfront": "$CLOUDFRONT_URL",
    "customDomain": "$CUSTOM_URL"
  },
  "cognito": {
    "userPoolId": "$USER_POOL_ID",
    "region": "$AWS_REGION"
  },
  "apiRoutes": {
    "health": "${API_ENDPOINT}/api/health",
    "sales": "${API_ENDPOINT}/api/sales",
    "buyers": "${API_ENDPOINT}/api/buyers",
    "producers": "${API_ENDPOINT}/api/producers",
    "invoices": "${API_ENDPOINT}/api/invoices"
  }
}
EOF
else
    # Text output
    echo "=========================================="
    echo "Endpoints for $ENVIRONMENT Environment"
    echo "=========================================="
    echo ""

    echo -e "${BLUE}Primary Endpoints:${NC}"
    echo ""

    if [ -n "$CUSTOM_URL" ]; then
        echo -e "${GREEN}Custom Domain:${NC}"
        echo "  $CUSTOM_URL"
        echo ""
    fi

    if [ -n "$CLOUDFRONT_URL" ]; then
        echo -e "${GREEN}CloudFront CDN:${NC}"
        echo "  $CLOUDFRONT_URL"
        echo ""
    fi

    if [ -n "$API_ENDPOINT" ]; then
        echo -e "${GREEN}API Gateway (Direct):${NC}"
        echo "  $API_ENDPOINT"
        echo ""
    fi

    echo -e "${BLUE}API Routes:${NC}"
    echo ""

    BASE_URL="$CUSTOM_URL"
    if [ -z "$BASE_URL" ]; then
        BASE_URL="$CLOUDFRONT_URL"
    fi
    if [ -z "$BASE_URL" ]; then
        BASE_URL="$API_ENDPOINT"
    fi

    if [ -n "$BASE_URL" ]; then
        echo "  Health:      ${BASE_URL}/api/health"
        echo "  Sales:       ${BASE_URL}/api/sales"
        echo "  Buyers:      ${BASE_URL}/api/buyers"
        echo "  Producers:   ${BASE_URL}/api/producers"
        echo "  Invoices:    ${BASE_URL}/api/invoices"
        echo "  Attachments: ${BASE_URL}/attachments/*"
    else
        echo "  No endpoints found"
    fi

    echo ""
    echo -e "${BLUE}Authentication:${NC}"
    echo ""

    if [ -n "$USER_POOL_ID" ]; then
        echo "  Cognito User Pool ID: $USER_POOL_ID"
        echo "  Cognito Region: $AWS_REGION"
    else
        echo "  User pool not found"
    fi

    echo ""
    echo -e "${BLUE}Test Commands:${NC}"
    echo ""

    if [ -n "$BASE_URL" ]; then
        echo "  # Health check"
        echo "  curl $BASE_URL/api/health"
        echo ""
        echo "  # Get all sales (requires authentication)"
        echo "  curl -H \"Authorization: Bearer \$TOKEN\" $BASE_URL/api/sales"
    fi

    echo ""
fi
