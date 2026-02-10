#!/bin/bash
set -e

# Create CNAME Record Script for app.speedex.it
# Creates Route 53 CNAME record pointing to CloudFront distribution

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
DOMAIN="app.speedex.it"
HOSTED_ZONE_NAME="speedex.it"
ENVIRONMENT=""
CLOUDFRONT_DOMAIN=""

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --environment|-e)
            ENVIRONMENT="$2"
            shift 2
            ;;
        --cloudfront-domain|-d)
            CLOUDFRONT_DOMAIN="$2"
            shift 2
            ;;
        --help|-h)
            echo "Usage: $0 --environment ENV --cloudfront-domain DOMAIN"
            echo ""
            echo "Creates Route 53 CNAME record for app.speedex.it"
            echo ""
            echo "Options:"
            echo "  --environment, -e ENV          Environment (dev|staging|production)"
            echo "  --cloudfront-domain, -d DOMAIN CloudFront distribution domain"
            echo "  --help, -h                     Show this help"
            echo ""
            echo "Example:"
            echo "  $0 --environment production --cloudfront-domain d1234567890.cloudfront.net"
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

if [ -z "$CLOUDFRONT_DOMAIN" ]; then
    echo -e "${RED}Error: --cloudfront-domain is required${NC}"
    exit 1
fi

echo "=========================================="
echo "Create CNAME Record: $DOMAIN"
echo "=========================================="
echo "Environment: $ENVIRONMENT"
echo "Domain: $DOMAIN"
echo "Target: $CLOUDFRONT_DOMAIN"
echo ""

# Step 1: Get Route 53 hosted zone ID
echo -e "${BLUE}[Step 1/4] Looking up Route 53 hosted zone...${NC}"

HOSTED_ZONE_ID=$(aws route53 list-hosted-zones \
    --query "HostedZones[?Name=='${HOSTED_ZONE_NAME}.'].Id" \
    --output text 2>/dev/null | cut -d'/' -f3 || echo "")

if [ -z "$HOSTED_ZONE_ID" ]; then
    echo -e "${RED}✗ Hosted zone not found for $HOSTED_ZONE_NAME${NC}"
    echo ""
    echo "You need to create a Route 53 hosted zone first:"
    echo "  aws route53 create-hosted-zone --name $HOSTED_ZONE_NAME --caller-reference $(date +%s)"
    exit 1
fi

echo -e "${GREEN}✓ Found hosted zone: $HOSTED_ZONE_ID${NC}"
echo ""

# Step 2: Check for existing CNAME record
echo -e "${BLUE}[Step 2/4] Checking for existing CNAME record...${NC}"

EXISTING_RECORD=$(aws route53 list-resource-record-sets \
    --hosted-zone-id "$HOSTED_ZONE_ID" \
    --query "ResourceRecordSets[?Name=='${DOMAIN}.'].ResourceRecords[0].Value" \
    --output text 2>/dev/null || echo "")

if [ -n "$EXISTING_RECORD" ]; then
    echo -e "${YELLOW}⚠ Existing CNAME record found: $EXISTING_RECORD${NC}"
    echo "  This record will be updated to point to: $CLOUDFRONT_DOMAIN"
else
    echo "No existing record found. A new CNAME will be created."
fi
echo ""

# Step 3: Create/update CNAME record
echo -e "${BLUE}[Step 3/4] Creating CNAME record in Route 53...${NC}"

# Create change batch JSON
cat > /tmp/cname-change-batch.json <<EOF
{
  "Changes": [
    {
      "Action": "UPSERT",
      "ResourceRecordSet": {
        "Name": "$DOMAIN",
        "Type": "CNAME",
        "TTL": 300,
        "ResourceRecords": [
          {
            "Value": "$CLOUDFRONT_DOMAIN"
          }
        ]
      }
    }
  ]
}
EOF

# Apply the change
CHANGE_INFO=$(aws route53 change-resource-record-sets \
    --hosted-zone-id "$HOSTED_ZONE_ID" \
    --change-batch file:///tmp/cname-change-batch.json \
    --output json)

CHANGE_ID=$(echo "$CHANGE_INFO" | jq -r '.ChangeInfo.Id' | cut -d'/' -f3)

rm /tmp/cname-change-batch.json

echo -e "${GREEN}✓ CNAME record created/updated${NC}"
echo "  Change ID: $CHANGE_ID"
echo ""

# Step 4: Wait for DNS propagation
echo -e "${BLUE}[Step 4/4] Waiting for DNS propagation...${NC}"
echo "This may take 1-2 minutes..."

for i in {1..12}; do
    CHANGE_STATUS=$(aws route53 get-change \
        --id "$CHANGE_ID" \
        --query 'ChangeInfo.Status' \
        --output text)

    if [ "$CHANGE_STATUS" == "INSYNC" ]; then
        echo -e "${GREEN}✓ DNS change propagated!${NC}"
        break
    else
        echo -n "."
        sleep 10
    fi
done

if [ "$CHANGE_STATUS" != "INSYNC" ]; then
    echo -e "${YELLOW}⚠ DNS change still pending${NC}"
    echo "You can check status with:"
    echo "  aws route53 get-change --id $CHANGE_ID"
fi

echo ""

# Verify DNS resolution
echo "Verifying DNS resolution..."
sleep 5  # Give DNS a moment

DNS_RESULT=$(dig +short "$DOMAIN" @8.8.8.8 2>/dev/null || echo "")

if [ -n "$DNS_RESULT" ]; then
    echo -e "${GREEN}✓ DNS resolves to: $DNS_RESULT${NC}"
else
    echo -e "${YELLOW}⚠ DNS not yet resolving (may take a few minutes)${NC}"
fi

echo ""
echo "=========================================="
echo -e "${GREEN}CNAME Record Created!${NC}"
echo "=========================================="
echo ""
echo "Summary:"
echo "  Domain: $DOMAIN"
echo "  Target: $CLOUDFRONT_DOMAIN"
echo "  Hosted Zone: $HOSTED_ZONE_ID"
echo "  Change ID: $CHANGE_ID"
echo ""
echo "Next steps:"
echo "1. Wait 5-10 minutes for full DNS propagation"
echo "2. Test the domain:"
echo "   curl -I https://$DOMAIN/api/health"
echo "3. Verify SSL certificate:"
echo "   openssl s_client -connect $DOMAIN:443 -servername $DOMAIN < /dev/null"
echo "4. Check CloudFront distribution:"
echo "   aws cloudformation describe-stacks \\"
echo "     --stack-name sale-module-cloudfront-${ENVIRONMENT} \\"
echo "     --region us-east-1 \\"
echo "     --query 'Stacks[0].Outputs'"
echo ""
echo "Troubleshooting:"
echo "- Check DNS: dig $DOMAIN"
echo "- Check CNAME: dig $DOMAIN CNAME"
echo "- Check from different DNS: dig @8.8.8.8 $DOMAIN"
echo "- CloudFront logs: Check S3 bucket sale-module-logs-*"
echo ""
