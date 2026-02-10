#!/bin/bash
set -e

# Environment Teardown Script
# Deletes all resources for an environment

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

ENVIRONMENT=""
SKIP_CONFIRMATION=false

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --environment|-e)
            ENVIRONMENT="$2"
            shift 2
            ;;
        --skip-confirmation|-y)
            SKIP_CONFIRMATION=true
            shift
            ;;
        --help|-h)
            echo "Usage: $0 --environment ENV [OPTIONS]"
            echo ""
            echo "Tears down all infrastructure for the specified environment"
            echo ""
            echo "Options:"
            echo "  --environment, -e ENV   Environment to tear down (dev|staging|production)"
            echo "  --skip-confirmation, -y Skip confirmation prompts"
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

echo "=========================================="
echo "Environment Teardown: $ENVIRONMENT"
echo "=========================================="
echo ""

# Confirmation
if [ "$SKIP_CONFIRMATION" = false ]; then
    echo -e "${RED}WARNING: This will delete ALL resources in the $ENVIRONMENT environment!${NC}"
    echo ""
    echo "This includes:"
    echo "  - All DynamoDB tables and their data"
    echo "  - All S3 buckets and their contents"
    echo "  - Cognito User Pool and all users"
    echo "  - Lambda functions"
    echo "  - API Gateway"
    echo "  - CloudFront distribution"
    echo "  - Backup plans and backups"
    echo ""
    read -p "Type 'DELETE $ENVIRONMENT' to confirm: " CONFIRM

    if [ "$CONFIRM" != "DELETE $ENVIRONMENT" ]; then
        echo "Aborted"
        exit 0
    fi
    echo ""
fi

# Delete CloudFront distribution (if exists)
echo "Deleting CloudFront distribution..."
CLOUDFRONT_SCRIPT="$PROJECT_ROOT/cloudfront/deploy.sh"
if [ -f "$CLOUDFRONT_SCRIPT" ]; then
    bash "$CLOUDFRONT_SCRIPT" "$ENVIRONMENT" delete || echo "CloudFront stack not found or already deleted"
else
    echo "CloudFront script not found, skipping"
fi

echo ""

# Delete backup plan (if exists)
echo "Deleting backup plan..."
aws cloudformation delete-stack \
    --stack-name "sale-module-backup-plan-${ENVIRONMENT}" \
    --region "$AWS_REGION" 2>/dev/null || echo "Backup stack not found or already deleted"

echo ""

# Delete Lambda/API Gateway stack (if exists)
echo "Deleting Lambda and API Gateway stack..."
aws cloudformation delete-stack \
    --stack-name "sale-module-api-lambda-${ENVIRONMENT}" \
    --region "$AWS_REGION" 2>/dev/null || echo "Lambda stack not found or already deleted"

# Or SAM stack
aws cloudformation delete-stack \
    --stack-name "sale-module-api-${ENVIRONMENT}" \
    --region "$AWS_REGION" 2>/dev/null || echo "SAM stack not found or already deleted"

echo ""

# Empty and delete S3 buckets
echo "Deleting S3 buckets..."
BUCKETS=(
    "$(jq -r '.s3.attachmentsBucket' "$CONFIG_FILE")"
    "$(jq -r '.s3.invoicesBucket' "$CONFIG_FILE")"
)

for BUCKET in "${BUCKETS[@]}"; do
    echo "  Processing $BUCKET..."

    # Check if bucket exists
    if aws s3 ls "s3://$BUCKET" --region "$AWS_REGION" &> /dev/null; then
        # Empty bucket (including all versions)
        echo "    Emptying bucket..."
        aws s3 rm "s3://$BUCKET" --recursive --region "$AWS_REGION" 2>/dev/null || true

        # Delete all versions if versioning enabled
        aws s3api delete-objects \
            --bucket "$BUCKET" \
            --delete "$(aws s3api list-object-versions \
                --bucket "$BUCKET" \
                --output=json \
                --query='{Objects: Versions[].{Key:Key,VersionId:VersionId}}' \
                --region "$AWS_REGION")" \
            --region "$AWS_REGION" 2>/dev/null || true

        # Delete bucket
        echo "    Deleting bucket..."
        aws s3api delete-bucket \
            --bucket "$BUCKET" \
            --region "$AWS_REGION" 2>/dev/null || echo "    Could not delete bucket (may have dependencies)"
    else
        echo "    Bucket not found, skipping"
    fi
done

echo ""

# Delete DynamoDB tables
echo "Deleting DynamoDB tables..."
TABLES=(
    "$(jq -r '.dynamodb.salesTable' "$CONFIG_FILE")"
    "$(jq -r '.dynamodb.buyersTable' "$CONFIG_FILE")"
    "$(jq -r '.dynamodb.producersTable' "$CONFIG_FILE")"
)

for TABLE in "${TABLES[@]}"; do
    echo "  Deleting $TABLE..."

    if aws dynamodb describe-table --table-name "$TABLE" --region "$AWS_REGION" &> /dev/null; then
        # Disable deletion protection if enabled
        aws dynamodb update-table \
            --table-name "$TABLE" \
            --no-deletion-protection-enabled \
            --region "$AWS_REGION" 2>/dev/null || true

        # Delete table
        aws dynamodb delete-table \
            --table-name "$TABLE" \
            --region "$AWS_REGION" 2>/dev/null || echo "    Could not delete table"
    else
        echo "    Table not found, skipping"
    fi
done

echo ""

# Delete Cognito User Pool
echo "Deleting Cognito User Pool..."
USER_POOL_NAME=$(jq -r '.cognito.userPoolName' "$CONFIG_FILE")
USER_POOL_ID=$(aws cognito-idp list-user-pools \
    --max-results 60 \
    --region "$AWS_REGION" \
    --query "UserPools[?Name=='$USER_POOL_NAME'].Id" \
    --output text 2>/dev/null || echo "")

if [ -n "$USER_POOL_ID" ]; then
    echo "  Deleting $USER_POOL_NAME ($USER_POOL_ID)..."
    aws cognito-idp delete-user-pool \
        --user-pool-id "$USER_POOL_ID" \
        --region "$AWS_REGION" 2>/dev/null || echo "  Could not delete user pool"
else
    echo "  User pool not found, skipping"
fi

echo ""

# Wait for CloudFormation stacks to delete
echo "Waiting for CloudFormation stacks to delete..."
echo "(This may take several minutes)"

STACKS=(
    "sale-module-cloudfront-${ENVIRONMENT}"
    "sale-module-backup-plan-${ENVIRONMENT}"
    "sale-module-api-lambda-${ENVIRONMENT}"
    "sale-module-api-${ENVIRONMENT}"
)

for STACK in "${STACKS[@]}"; do
    if aws cloudformation describe-stacks --stack-name "$STACK" --region "$AWS_REGION" &> /dev/null || \
       aws cloudformation describe-stacks --stack-name "$STACK" --region us-east-1 &> /dev/null 2>&1; then
        echo "  Waiting for $STACK..."
        # We won't actually wait as it can take a long time
        # User can check status manually
    fi
done

echo ""
echo "=========================================="
echo -e "${GREEN}Teardown initiated for $ENVIRONMENT${NC}"
echo "=========================================="
echo ""
echo "Note: Some resources may take several minutes to fully delete"
echo ""
echo "To check deletion status:"
echo "  aws cloudformation describe-stacks --region $AWS_REGION"
echo ""
echo "To verify teardown:"
echo "  ./verify-environment.sh --environment $ENVIRONMENT"
echo ""
