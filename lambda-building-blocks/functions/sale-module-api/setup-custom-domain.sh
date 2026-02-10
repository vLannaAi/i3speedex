#!/bin/bash
set -e

# Custom Domain Setup Script for app.speedex.it
# Sets up ACM certificate, Route 53 DNS, and CloudFront configuration

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
DOMAIN="app.speedex.it"
WILDCARD_DOMAIN="*.speedex.it"
HOSTED_ZONE_NAME="speedex.it"
REGION="us-east-1"  # ACM certificates for CloudFront must be in us-east-1
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
            echo "Sets up custom domain app.speedex.it for CloudFront"
            echo ""
            echo "Options:"
            echo "  --environment, -e ENV   Environment (dev|staging|production)"
            echo "  --help, -h              Show this help"
            echo ""
            echo "Steps performed:"
            echo "  1. Check for existing ACM certificate (*.speedex.it)"
            echo "  2. Create new certificate if needed"
            echo "  3. Validate certificate via DNS"
            echo "  4. Get/create Route 53 hosted zone"
            echo "  5. Update CloudFront configuration"
            echo "  6. Create CNAME record in Route 53"
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

echo "=========================================="
echo "Custom Domain Setup: $DOMAIN"
echo "=========================================="
echo "Environment: $ENVIRONMENT"
echo "Domain: $DOMAIN"
echo "Wildcard: $WILDCARD_DOMAIN"
echo "Region: $REGION (required for CloudFront)"
echo ""

# Step 1: Check for existing ACM certificate
echo -e "${BLUE}[Step 1/6] Checking for existing ACM certificate...${NC}"

CERT_ARN=$(aws acm list-certificates \
    --region "$REGION" \
    --query "CertificateSummaryList[?DomainName=='$WILDCARD_DOMAIN'].CertificateArn" \
    --output text 2>/dev/null || echo "")

if [ -n "$CERT_ARN" ]; then
    echo -e "${GREEN}✓ Found existing certificate: $CERT_ARN${NC}"

    # Check certificate status
    CERT_STATUS=$(aws acm describe-certificate \
        --certificate-arn "$CERT_ARN" \
        --region "$REGION" \
        --query 'Certificate.Status' \
        --output text)

    echo "  Status: $CERT_STATUS"

    if [ "$CERT_STATUS" != "ISSUED" ]; then
        echo -e "${YELLOW}  ⚠ Certificate is not issued yet. Status: $CERT_STATUS${NC}"
        echo "  You may need to complete DNS validation."
    fi
else
    echo -e "${YELLOW}⚠ No existing certificate found for $WILDCARD_DOMAIN${NC}"
    echo ""

    # Step 2: Create new ACM certificate
    echo -e "${BLUE}[Step 2/6] Creating new ACM certificate...${NC}"

    echo "Requesting certificate for $WILDCARD_DOMAIN..."

    CERT_ARN=$(aws acm request-certificate \
        --domain-name "$WILDCARD_DOMAIN" \
        --subject-alternative-names "$HOSTED_ZONE_NAME" "$DOMAIN" \
        --validation-method DNS \
        --region "$REGION" \
        --query 'CertificateArn' \
        --output text)

    echo -e "${GREEN}✓ Certificate requested: $CERT_ARN${NC}"
    echo ""

    # Wait a moment for certificate details to be available
    echo "Waiting for certificate details..."
    sleep 5

    # Get DNS validation records
    echo -e "${BLUE}[Step 3/6] Getting DNS validation records...${NC}"

    VALIDATION_RECORDS=$(aws acm describe-certificate \
        --certificate-arn "$CERT_ARN" \
        --region "$REGION" \
        --query 'Certificate.DomainValidationOptions[0].ResourceRecord' \
        --output json)

    VALIDATION_NAME=$(echo "$VALIDATION_RECORDS" | jq -r '.Name')
    VALIDATION_VALUE=$(echo "$VALIDATION_RECORDS" | jq -r '.Value')

    echo "DNS Validation Record:"
    echo "  Name: $VALIDATION_NAME"
    echo "  Type: CNAME"
    echo "  Value: $VALIDATION_VALUE"
    echo ""

    # Check if Route 53 hosted zone exists
    echo -e "${BLUE}[Step 4/6] Checking Route 53 hosted zone...${NC}"

    HOSTED_ZONE_ID=$(aws route53 list-hosted-zones \
        --query "HostedZones[?Name=='${HOSTED_ZONE_NAME}.'].Id" \
        --output text 2>/dev/null | cut -d'/' -f3 || echo "")

    if [ -n "$HOSTED_ZONE_ID" ]; then
        echo -e "${GREEN}✓ Found hosted zone: $HOSTED_ZONE_ID${NC}"

        # Automatically add DNS validation record
        echo "Adding DNS validation record to Route 53..."

        cat > /tmp/dns-validation-change.json <<EOF
{
  "Changes": [
    {
      "Action": "UPSERT",
      "ResourceRecordSet": {
        "Name": "$VALIDATION_NAME",
        "Type": "CNAME",
        "TTL": 300,
        "ResourceRecords": [
          {
            "Value": "$VALIDATION_VALUE"
          }
        ]
      }
    }
  ]
}
EOF

        aws route53 change-resource-record-sets \
            --hosted-zone-id "$HOSTED_ZONE_ID" \
            --change-batch file:///tmp/dns-validation-change.json \
            --output json > /dev/null

        rm /tmp/dns-validation-change.json

        echo -e "${GREEN}✓ DNS validation record added${NC}"
        echo ""
        echo "Waiting for certificate validation (this may take 5-10 minutes)..."

        # Wait for certificate validation
        for i in {1..30}; do
            CERT_STATUS=$(aws acm describe-certificate \
                --certificate-arn "$CERT_ARN" \
                --region "$REGION" \
                --query 'Certificate.Status' \
                --output text)

            if [ "$CERT_STATUS" == "ISSUED" ]; then
                echo -e "${GREEN}✓ Certificate validated and issued!${NC}"
                break
            elif [ "$CERT_STATUS" == "PENDING_VALIDATION" ]; then
                echo -n "."
                sleep 20
            else
                echo -e "${RED}✗ Unexpected status: $CERT_STATUS${NC}"
                exit 1
            fi
        done

        if [ "$CERT_STATUS" != "ISSUED" ]; then
            echo -e "${YELLOW}⚠ Certificate still pending validation${NC}"
            echo "You can check status with:"
            echo "  aws acm describe-certificate --certificate-arn $CERT_ARN --region $REGION"
        fi
    else
        echo -e "${YELLOW}⚠ Hosted zone not found for $HOSTED_ZONE_NAME${NC}"
        echo ""
        echo "You need to:"
        echo "1. Create a Route 53 hosted zone for $HOSTED_ZONE_NAME"
        echo "2. Add the DNS validation record manually:"
        echo "   Name: $VALIDATION_NAME"
        echo "   Type: CNAME"
        echo "   Value: $VALIDATION_VALUE"
        echo ""
        echo "Or run this command to create the hosted zone:"
        echo "  aws route53 create-hosted-zone --name $HOSTED_ZONE_NAME --caller-reference $(date +%s)"
        exit 1
    fi
fi

echo ""

# Step 5: Update CloudFront configuration
echo -e "${BLUE}[Step 5/6] Updating CloudFront configuration...${NC}"

CONFIG_FILE="$SCRIPT_DIR/cloudfront/config/${ENVIRONMENT}.json"

if [ -f "$CONFIG_FILE" ]; then
    # Update configuration with certificate ARN and custom domain
    jq --arg cert "$CERT_ARN" --arg domain "$DOMAIN" \
        '.Parameters.ACMCertificateArn = $cert | .Parameters.CustomDomainName = $domain' \
        "$CONFIG_FILE" > "${CONFIG_FILE}.tmp" && mv "${CONFIG_FILE}.tmp" "$CONFIG_FILE"

    echo -e "${GREEN}✓ Updated $CONFIG_FILE${NC}"
    echo "  ACMCertificateArn: $CERT_ARN"
    echo "  CustomDomainName: $DOMAIN"
else
    echo -e "${YELLOW}⚠ Configuration file not found: $CONFIG_FILE${NC}"
fi

echo ""

# Step 6: Deploy/update CloudFront distribution
echo -e "${BLUE}[Step 6/6] CloudFront distribution setup...${NC}"

echo "To deploy CloudFront with the custom domain, run:"
echo "  cd cloudfront"
echo "  ./deploy.sh $ENVIRONMENT deploy"
echo ""

# After CloudFront is deployed, create CNAME record
echo "After CloudFront deployment completes, you'll need to:"
echo "1. Get the CloudFront distribution domain:"
echo "   DIST_DOMAIN=\$(aws cloudformation describe-stacks \\"
echo "     --stack-name sale-module-cloudfront-${ENVIRONMENT} \\"
echo "     --region us-east-1 \\"
echo "     --query 'Stacks[0].Outputs[?OutputKey==\`DistributionDomainName\`].OutputValue' \\"
echo "     --output text)"
echo ""
echo "2. Create CNAME record in Route 53:"
echo "   Run: ./create-cname.sh --environment $ENVIRONMENT --cloudfront-domain \$DIST_DOMAIN"
echo ""

# Save configuration for next steps
cat > /tmp/custom-domain-setup.env <<EOF
CERT_ARN=$CERT_ARN
DOMAIN=$DOMAIN
ENVIRONMENT=$ENVIRONMENT
HOSTED_ZONE_ID=$HOSTED_ZONE_ID
EOF

echo "Configuration saved to: /tmp/custom-domain-setup.env"
echo ""

echo "=========================================="
echo -e "${GREEN}Custom Domain Setup Complete!${NC}"
echo "=========================================="
echo ""
echo "Summary:"
echo "  Certificate ARN: $CERT_ARN"
echo "  Domain: $DOMAIN"
echo "  Environment: $ENVIRONMENT"
echo ""
echo "Next steps:"
echo "1. Deploy CloudFront: cd cloudfront && ./deploy.sh $ENVIRONMENT deploy"
echo "2. Create DNS CNAME record (after CloudFront deployment)"
echo "3. Test: curl -I https://$DOMAIN/api/health"
echo ""
