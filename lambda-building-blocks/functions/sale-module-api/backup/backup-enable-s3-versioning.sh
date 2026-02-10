#!/bin/bash
set -e

# Sale Module API - Enable S3 Versioning
# Enables versioning on S3 buckets for file recovery

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Default values
ENVIRONMENT="dev"
BUCKET_NAME=""

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --environment|-e)
            ENVIRONMENT="$2"
            shift 2
            ;;
        --bucket)
            BUCKET_NAME="$2"
            shift 2
            ;;
        --help|-h)
            echo "Usage: $0 [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  --environment, -e ENV   Environment (dev|staging|production)"
            echo "  --bucket BUCKET         Enable versioning for specific bucket only"
            echo "  --help, -h              Show this help"
            echo ""
            echo "Examples:"
            echo "  $0 --environment production"
            echo "  $0 --bucket sale-module-attachments-production"
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            exit 1
            ;;
    esac
done

echo "=========================================="
echo "Enable S3 Versioning"
echo "=========================================="
echo "Environment: $ENVIRONMENT"
echo ""

# Define buckets to enable versioning
if [ -n "$BUCKET_NAME" ]; then
    BUCKETS=("$BUCKET_NAME")
else
    BUCKETS=(
        "sale-module-attachments-${ENVIRONMENT}"
        "sale-module-invoices-${ENVIRONMENT}"
    )
fi

echo "Buckets to enable versioning:"
for BUCKET in "${BUCKETS[@]}"; do
    echo "  - $BUCKET"
done
echo ""

# Enable versioning for each bucket
for BUCKET in "${BUCKETS[@]}"; do
    echo -e "${YELLOW}Processing: $BUCKET${NC}"

    # Check if bucket exists
    if ! aws s3api head-bucket --bucket "$BUCKET" --region ${AWS_REGION:-us-east-1} 2>/dev/null; then
        echo -e "${RED}  ✗ Bucket does not exist, skipping${NC}"
        echo ""
        continue
    fi

    # Check current versioning status
    VERSIONING_STATUS=$(aws s3api get-bucket-versioning \
        --bucket "$BUCKET" \
        --region ${AWS_REGION:-us-east-1} \
        --query 'Status' \
        --output text 2>/dev/null || echo "NONE")

    if [ "$VERSIONING_STATUS" == "Enabled" ]; then
        echo -e "${GREEN}  ✓ Versioning already enabled${NC}"
    else
        echo -e "${YELLOW}  ⟳ Enabling versioning...${NC}"

        aws s3api put-bucket-versioning \
            --bucket "$BUCKET" \
            --versioning-configuration Status=Enabled \
            --region ${AWS_REGION:-us-east-1}

        echo -e "${GREEN}  ✓ Versioning enabled${NC}"
    fi

    # Configure lifecycle policy for old versions
    echo -e "${YELLOW}  ⟳ Configuring lifecycle policy...${NC}"

    cat > /tmp/lifecycle-policy-${BUCKET}.json <<EOF
{
    "Rules": [
        {
            "Id": "DeleteOldVersions",
            "Status": "Enabled",
            "NoncurrentVersionExpiration": {
                "NoncurrentDays": 90
            },
            "NoncurrentVersionTransitions": [
                {
                    "NoncurrentDays": 30,
                    "StorageClass": "STANDARD_IA"
                }
            ]
        },
        {
            "Id": "DeleteIncompleteMultipartUploads",
            "Status": "Enabled",
            "AbortIncompleteMultipartUpload": {
                "DaysAfterInitiation": 7
            }
        }
    ]
}
EOF

    aws s3api put-bucket-lifecycle-configuration \
        --bucket "$BUCKET" \
        --lifecycle-configuration file:///tmp/lifecycle-policy-${BUCKET}.json \
        --region ${AWS_REGION:-us-east-1}

    rm /tmp/lifecycle-policy-${BUCKET}.json

    echo -e "${GREEN}  ✓ Lifecycle policy configured${NC}"
    echo "    - Old versions deleted after 90 days"
    echo "    - Old versions moved to Standard-IA after 30 days"
    echo "    - Incomplete multipart uploads deleted after 7 days"

    # Get bucket statistics
    echo -e "${YELLOW}  ⟳ Getting bucket statistics...${NC}"

    BUCKET_SIZE=$(aws s3 ls "s3://${BUCKET}" --recursive --summarize --region ${AWS_REGION:-us-east-1} 2>&1 | \
        grep "Total Size:" | awk '{print $3}')

    if [ -n "$BUCKET_SIZE" ] && [ "$BUCKET_SIZE" != "0" ]; then
        BUCKET_SIZE_MB=$(echo "scale=2; $BUCKET_SIZE / 1024 / 1024" | bc)
        echo "    Current size: ${BUCKET_SIZE_MB} MB"
    else
        echo "    Current size: Empty or inaccessible"
    fi

    echo ""
done

echo "=========================================="
echo -e "${GREEN}S3 Versioning Configuration Complete${NC}"
echo "=========================================="
echo ""
echo "Important Notes:"
echo "1. Versioning keeps all versions of objects"
echo "2. Old versions cost storage space"
echo "3. Lifecycle policies will manage old versions automatically"
echo "4. Deleted objects can be recovered from versions"
echo ""
echo "To restore a specific version:"
echo "  ./restore-s3.sh --source s3://BUCKET/KEY --target OUTPUT --version-id VERSION_ID"
echo ""
echo "To list versions of a file:"
echo "  aws s3api list-object-versions --bucket BUCKET --prefix KEY"
echo ""
echo "To check versioning status:"
echo "  aws s3api get-bucket-versioning --bucket BUCKET"
echo ""
