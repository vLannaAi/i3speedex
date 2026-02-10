#!/bin/bash
set -e

# Monitor Certificate and Auto-Deploy Script
# Monitors ACM certificate validation and automatically deploys CloudFront + DNS when ready

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
CERT_ARN="arn:aws:acm:us-east-1:827562051115:certificate/9757409f-c0d3-48e9-95a5-225bfd767f4e"
ENVIRONMENT="production"
REGION="us-east-1"
MAX_WAIT=60  # Maximum wait time in minutes
CHECK_INTERVAL=60  # Check every 60 seconds

echo "=========================================="
echo "Certificate Validation Monitor"
echo "=========================================="
echo "Environment: $ENVIRONMENT"
echo "Certificate: $CERT_ARN"
echo "Max Wait Time: $MAX_WAIT minutes"
echo ""

# Check certificate status
ELAPSED=0
while [ $ELAPSED -lt $((MAX_WAIT * 60)) ]; do
    MINUTES=$((ELAPSED / 60))
    echo -e "${BLUE}[$MINUTES min] Checking certificate status...${NC}"

    STATUS=$(aws acm describe-certificate \
        --certificate-arn "$CERT_ARN" \
        --region "$REGION" \
        --query 'Certificate.Status' \
        --output text 2>/dev/null || echo "ERROR")

    if [ "$STATUS" == "ISSUED" ]; then
        echo -e "${GREEN}✓ Certificate validated!${NC}"
        echo ""
        break
    elif [ "$STATUS" == "PENDING_VALIDATION" ]; then
        echo "  Status: PENDING_VALIDATION (waiting...)"
    elif [ "$STATUS" == "ERROR" ]; then
        echo -e "${RED}✗ Error checking certificate status${NC}"
        exit 1
    else
        echo -e "${YELLOW}⚠ Unexpected status: $STATUS${NC}"
    fi

    sleep $CHECK_INTERVAL
    ELAPSED=$((ELAPSED + CHECK_INTERVAL))
done

if [ "$STATUS" != "ISSUED" ]; then
    echo -e "${YELLOW}⚠ Certificate still not validated after $MAX_WAIT minutes${NC}"
    echo ""
    echo "You can:"
    echo "1. Wait longer (validation can take up to 30 minutes)"
    echo "2. Check DNS validation record:"
    echo "   dig _759b2141df9305e403825e82a91d62c9.speedex.it CNAME"
    echo "3. Re-run this script: ./monitor-and-deploy.sh"
    echo "4. Deploy manually once certificate is validated"
    exit 1
fi

# Certificate is validated, proceed with CloudFront deployment
echo "=========================================="
echo "Step 1: Deploy CloudFront Distribution"
echo "=========================================="
echo ""

cd "$SCRIPT_DIR/cloudfront"
./deploy.sh $ENVIRONMENT deploy

if [ $? -ne 0 ]; then
    echo -e "${RED}✗ CloudFront deployment failed${NC}"
    exit 1
fi

echo -e "${GREEN}✓ CloudFront deployed successfully${NC}"
echo ""

# Wait for CloudFront stack to be ready
echo "Waiting for CloudFront stack to complete..."
aws cloudformation wait stack-create-complete \
    --stack-name "sale-module-cloudfront-${ENVIRONMENT}" \
    --region "$REGION" 2>/dev/null || \
aws cloudformation wait stack-update-complete \
    --stack-name "sale-module-cloudfront-${ENVIRONMENT}" \
    --region "$REGION"

echo ""

# Get CloudFront distribution domain
echo "=========================================="
echo "Step 2: Create DNS CNAME Record"
echo "=========================================="
echo ""

DIST_DOMAIN=$(aws cloudformation describe-stacks \
    --stack-name "sale-module-cloudfront-${ENVIRONMENT}" \
    --region "$REGION" \
    --query 'Stacks[0].Outputs[?OutputKey==`DistributionDomainName`].OutputValue' \
    --output text)

if [ -z "$DIST_DOMAIN" ]; then
    echo -e "${RED}✗ Could not get CloudFront distribution domain${NC}"
    exit 1
fi

echo "CloudFront Domain: $DIST_DOMAIN"
echo ""

# Create CNAME record
cd "$SCRIPT_DIR"
./create-cname.sh --environment $ENVIRONMENT --cloudfront-domain $DIST_DOMAIN

if [ $? -ne 0 ]; then
    echo -e "${RED}✗ CNAME creation failed${NC}"
    exit 1
fi

echo -e "${GREEN}✓ DNS CNAME created successfully${NC}"
echo ""

# Test the custom domain
echo "=========================================="
echo "Step 3: Testing Custom Domain"
echo "=========================================="
echo ""

echo "Waiting 60 seconds for DNS propagation..."
sleep 60

echo "Testing DNS resolution..."
DNS_RESULT=$(dig +short app.speedex.it @8.8.8.8 | head -1)

if [ -n "$DNS_RESULT" ]; then
    echo -e "${GREEN}✓ DNS resolves to: $DNS_RESULT${NC}"
else
    echo -e "${YELLOW}⚠ DNS not yet propagated (may take a few more minutes)${NC}"
fi

echo ""
echo "Testing HTTPS endpoint..."
HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" https://app.speedex.it/api/health 2>/dev/null || echo "000")

if [ "$HTTP_STATUS" == "200" ]; then
    echo -e "${GREEN}✓ HTTPS endpoint responding (HTTP $HTTP_STATUS)${NC}"
elif [ "$HTTP_STATUS" == "000" ]; then
    echo -e "${YELLOW}⚠ Could not connect (DNS may still be propagating)${NC}"
else
    echo -e "${YELLOW}⚠ Received HTTP $HTTP_STATUS (API may not be deployed yet)${NC}"
fi

echo ""
echo "=========================================="
echo -e "${GREEN}Custom Domain Setup Complete!${NC}"
echo "=========================================="
echo ""
echo "Domain: https://app.speedex.it"
echo "CloudFront: $DIST_DOMAIN"
echo "Certificate: Validated and in use"
echo ""
echo "Next steps:"
echo "1. Deploy Lambda functions and API Gateway"
echo "2. Test API endpoints: curl https://app.speedex.it/api/health"
echo "3. Configure application to use custom domain"
echo ""
echo "Note: Full DNS propagation can take 5-10 minutes"
echo ""
