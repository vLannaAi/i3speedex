#!/bin/bash
set -e

# Core Infrastructure Deployment Script
# Deploys DynamoDB tables, S3 buckets, and Cognito user pool

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
ENV_DIR="$(dirname "$SCRIPT_DIR")"

# Color codes
RED='\033[0;31m'
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

echo "Deploying core infrastructure for $ENVIRONMENT..."
echo ""

# Load configuration
AWS_REGION=$(jq -r '.region' "$CONFIG_FILE")
PROJECT_NAME=$(jq -r '.projectName' "$CONFIG_FILE")

# Create DynamoDB tables
echo -e "${BLUE}Creating DynamoDB tables...${NC}"
echo ""

TABLES=(
    "salesTable:$(jq -r '.dynamodb.salesTable' "$CONFIG_FILE")"
    "buyersTable:$(jq -r '.dynamodb.buyersTable' "$CONFIG_FILE")"
    "producersTable:$(jq -r '.dynamodb.producersTable' "$CONFIG_FILE")"
)

BILLING_MODE=$(jq -r '.dynamodb.billingMode' "$CONFIG_FILE")
PITR=$(jq -r '.dynamodb.pointInTimeRecovery' "$CONFIG_FILE")
DELETION_PROTECTION=$(jq -r '.dynamodb.deletionProtection' "$CONFIG_FILE")

for table_entry in "${TABLES[@]}"; do
    TABLE_KEY=$(echo "$table_entry" | cut -d: -f1)
    TABLE_NAME=$(echo "$table_entry" | cut -d: -f2)

    echo "Creating table: $TABLE_NAME"

    # Check if table exists
    if aws dynamodb describe-table --table-name "$TABLE_NAME" --region "$AWS_REGION" &> /dev/null; then
        echo -e "${YELLOW}  ⚠ Table already exists, skipping${NC}"
        continue
    fi

    # Create table (simplified schema - adjust based on actual requirements)
    CREATE_TABLE_CMD="aws dynamodb create-table \
        --table-name \"$TABLE_NAME\" \
        --attribute-definitions \
            AttributeName=PK,AttributeType=S \
            AttributeName=SK,AttributeType=S \
        --key-schema \
            AttributeName=PK,KeyType=HASH \
            AttributeName=SK,KeyType=RANGE \
        --billing-mode \"$BILLING_MODE\" \
        --region \"$AWS_REGION\" \
        --tags \
            Key=Environment,Value=\"$ENVIRONMENT\" \
            Key=Project,Value=\"$PROJECT_NAME\""

    # Add deletion protection flag if enabled
    if [ "$DELETION_PROTECTION" == "true" ]; then
        CREATE_TABLE_CMD="$CREATE_TABLE_CMD --deletion-protection-enabled"
    else
        CREATE_TABLE_CMD="$CREATE_TABLE_CMD --no-deletion-protection-enabled"
    fi

    CREATE_TABLE_CMD="$CREATE_TABLE_CMD --output json > /dev/null"

    eval "$CREATE_TABLE_CMD"

    echo -e "${GREEN}  ✓ Table created${NC}"

    # Enable Point-in-Time Recovery if configured
    if [ "$PITR" == "true" ]; then
        echo "  Enabling Point-in-Time Recovery..."

        # Retry PITR enablement (table needs to be fully active)
        MAX_RETRIES=5
        RETRY_COUNT=0
        while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
            if aws dynamodb update-continuous-backups \
                --table-name "$TABLE_NAME" \
                --point-in-time-recovery-specification PointInTimeRecoveryEnabled=true \
                --region "$AWS_REGION" \
                --output json > /dev/null 2>&1; then
                echo -e "${GREEN}  ✓ PITR enabled${NC}"
                break
            else
                RETRY_COUNT=$((RETRY_COUNT + 1))
                if [ $RETRY_COUNT -lt $MAX_RETRIES ]; then
                    echo "    Waiting for table to be ready (attempt $RETRY_COUNT/$MAX_RETRIES)..."
                    sleep 10
                else
                    echo -e "${YELLOW}  ⚠ PITR enablement failed, will retry later${NC}"
                fi
            fi
        done
    fi

    # Wait for table to be active
    echo "  Waiting for table to become active..."
    aws dynamodb wait table-exists --table-name "$TABLE_NAME" --region "$AWS_REGION"
    echo -e "${GREEN}  ✓ Table active${NC}"

    echo ""
done

# Create S3 buckets
echo -e "${BLUE}Creating S3 buckets...${NC}"
echo ""

BUCKETS=(
    "attachmentsBucket:$(jq -r '.s3.attachmentsBucket' "$CONFIG_FILE")"
    "invoicesBucket:$(jq -r '.s3.invoicesBucket' "$CONFIG_FILE")"
)

VERSIONING=$(jq -r '.s3.versioning' "$CONFIG_FILE")

for bucket_entry in "${BUCKETS[@]}"; do
    BUCKET_KEY=$(echo "$bucket_entry" | cut -d: -f1)
    BUCKET_NAME=$(echo "$bucket_entry" | cut -d: -f2)

    echo "Creating bucket: $BUCKET_NAME"

    # Check if bucket exists
    if aws s3 ls "s3://$BUCKET_NAME" --region "$AWS_REGION" &> /dev/null; then
        echo -e "${YELLOW}  ⚠ Bucket already exists, skipping${NC}"
        continue
    fi

    # Create bucket
    if [ "$AWS_REGION" == "us-east-1" ]; then
        aws s3api create-bucket \
            --bucket "$BUCKET_NAME" \
            --region "$AWS_REGION" \
            --output json > /dev/null
    else
        aws s3api create-bucket \
            --bucket "$BUCKET_NAME" \
            --region "$AWS_REGION" \
            --create-bucket-configuration LocationConstraint="$AWS_REGION" \
            --output json > /dev/null
    fi

    echo -e "${GREEN}  ✓ Bucket created${NC}"

    # Enable encryption
    echo "  Enabling encryption..."
    aws s3api put-bucket-encryption \
        --bucket "$BUCKET_NAME" \
        --server-side-encryption-configuration '{
            "Rules": [{
                "ApplyServerSideEncryptionByDefault": {
                    "SSEAlgorithm": "AES256"
                }
            }]
        }' \
        --region "$AWS_REGION"
    echo -e "${GREEN}  ✓ Encryption enabled${NC}"

    # Block public access
    echo "  Blocking public access..."
    aws s3api put-public-access-block \
        --bucket "$BUCKET_NAME" \
        --public-access-block-configuration \
            BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true \
        --region "$AWS_REGION"
    echo -e "${GREEN}  ✓ Public access blocked${NC}"

    # Enable versioning if configured
    if [ "$VERSIONING" == "true" ]; then
        echo "  Enabling versioning..."
        aws s3api put-bucket-versioning \
            --bucket "$BUCKET_NAME" \
            --versioning-configuration Status=Enabled \
            --region "$AWS_REGION"
        echo -e "${GREEN}  ✓ Versioning enabled${NC}"
    fi

    # Apply lifecycle rules
    echo "  Configuring lifecycle rules..."

    if [ "$BUCKET_KEY" == "attachmentsBucket" ]; then
        TRANSITION_IA=$(jq -r '.s3.lifecycleRules.attachments.transitionToIA' "$CONFIG_FILE")
        TRANSITION_GLACIER=$(jq -r '.s3.lifecycleRules.attachments.transitionToGlacier' "$CONFIG_FILE")
        EXPIRATION=$(jq -r '.s3.lifecycleRules.attachments.expiration' "$CONFIG_FILE")
    else
        TRANSITION_IA=$(jq -r '.s3.lifecycleRules.invoices.transitionToIA' "$CONFIG_FILE")
        TRANSITION_GLACIER=$(jq -r '.s3.lifecycleRules.invoices.transitionToGlacier' "$CONFIG_FILE")
        EXPIRATION=$(jq -r '.s3.lifecycleRules.invoices.expiration' "$CONFIG_FILE")
    fi

    cat > /tmp/lifecycle-${BUCKET_NAME}.json <<EOF
{
    "Rules": [
        {
            "ID": "TransitionToIA",
            "Status": "Enabled",
            "Filter": {},
            "Transitions": [
                {
                    "Days": ${TRANSITION_IA},
                    "StorageClass": "STANDARD_IA"
                }
            ]
        },
        {
            "ID": "TransitionToGlacier",
            "Status": "Enabled",
            "Filter": {},
            "Transitions": [
                {
                    "Days": ${TRANSITION_GLACIER},
                    "StorageClass": "GLACIER"
                }
            ]
        },
        {
            "ID": "ExpireOldObjects",
            "Status": "Enabled",
            "Filter": {},
            "Expiration": {
                "Days": ${EXPIRATION}
            }
        }
    ]
}
EOF

    if aws s3api put-bucket-lifecycle-configuration \
        --bucket "$BUCKET_NAME" \
        --lifecycle-configuration file:///tmp/lifecycle-${BUCKET_NAME}.json \
        --region "$AWS_REGION" 2>&1; then
        echo -e "${GREEN}  ✓ Lifecycle rules configured${NC}"
    else
        echo -e "${YELLOW}  ⚠ Lifecycle rules configuration failed (can be configured manually later)${NC}"
    fi

    rm -f /tmp/lifecycle-${BUCKET_NAME}.json

    # Add tags
    aws s3api put-bucket-tagging \
        --bucket "$BUCKET_NAME" \
        --tagging "TagSet=[{Key=Environment,Value=$ENVIRONMENT},{Key=Project,Value=$PROJECT_NAME}]" \
        --region "$AWS_REGION"

    echo ""
done

# Create Cognito User Pool
echo -e "${BLUE}Creating Cognito User Pool...${NC}"
echo ""

USER_POOL_NAME=$(jq -r '.cognito.userPoolName' "$CONFIG_FILE")
MFA_CONFIG=$(jq -r '.cognito.mfaConfiguration' "$CONFIG_FILE")
MIN_PASSWORD_LENGTH=$(jq -r '.cognito.passwordPolicy.minimumLength' "$CONFIG_FILE")
REQUIRE_UPPERCASE=$(jq -r '.cognito.passwordPolicy.requireUppercase' "$CONFIG_FILE")
REQUIRE_LOWERCASE=$(jq -r '.cognito.passwordPolicy.requireLowercase' "$CONFIG_FILE")
REQUIRE_NUMBERS=$(jq -r '.cognito.passwordPolicy.requireNumbers' "$CONFIG_FILE")
REQUIRE_SYMBOLS=$(jq -r '.cognito.passwordPolicy.requireSymbols' "$CONFIG_FILE")

echo "Creating user pool: $USER_POOL_NAME"

# Check if user pool exists
EXISTING_POOLS=$(aws cognito-idp list-user-pools --max-results 60 --region "$AWS_REGION" --query "UserPools[?Name=='$USER_POOL_NAME'].Id" --output text)

if [ -n "$EXISTING_POOLS" ]; then
    echo -e "${YELLOW}  ⚠ User pool already exists, skipping${NC}"
    USER_POOL_ID="$EXISTING_POOLS"
else
    # Create user pool
    USER_POOL_ID=$(aws cognito-idp create-user-pool \
        --pool-name "$USER_POOL_NAME" \
        --policies "PasswordPolicy={MinimumLength=$MIN_PASSWORD_LENGTH,RequireUppercase=$REQUIRE_UPPERCASE,RequireLowercase=$REQUIRE_LOWERCASE,RequireNumbers=$REQUIRE_NUMBERS,RequireSymbols=$REQUIRE_SYMBOLS}" \
        --mfa-configuration "$MFA_CONFIG" \
        --auto-verified-attributes email \
        --user-attribute-update-settings "AttributesRequireVerificationBeforeUpdate=[email]" \
        --region "$AWS_REGION" \
        --query 'UserPool.Id' \
        --output text)

    echo -e "${GREEN}  ✓ User pool created: $USER_POOL_ID${NC}"

    # Tag user pool
    USER_POOL_ARN=$(aws cognito-idp describe-user-pool --user-pool-id "$USER_POOL_ID" --region "$AWS_REGION" --query 'UserPool.Arn' --output text)

    aws cognito-idp tag-resource \
        --resource-arn "$USER_POOL_ARN" \
        --tags Environment="$ENVIRONMENT" Project="$PROJECT_NAME" \
        --region "$AWS_REGION"

    echo -e "${GREEN}  ✓ User pool tagged${NC}"
fi

# Create user pool client
CLIENT_NAME=$(jq -r '.cognito.userPoolClientName' "$CONFIG_FILE")

echo "Creating user pool client: $CLIENT_NAME"

CLIENT_ID=$(aws cognito-idp create-user-pool-client \
    --user-pool-id "$USER_POOL_ID" \
    --client-name "$CLIENT_NAME" \
    --generate-secret \
    --explicit-auth-flows ALLOW_USER_PASSWORD_AUTH ALLOW_REFRESH_TOKEN_AUTH \
    --region "$AWS_REGION" \
    --query 'UserPoolClient.ClientId' \
    --output text 2>/dev/null || echo "")

if [ -n "$CLIENT_ID" ]; then
    echo -e "${GREEN}  ✓ User pool client created: $CLIENT_ID${NC}"
else
    echo -e "${YELLOW}  ⚠ User pool client may already exist or creation failed${NC}"
fi

echo ""
echo -e "${GREEN}Core infrastructure deployment complete!${NC}"
echo ""
echo "Resources created:"
echo "  DynamoDB Tables: ${#TABLES[@]}"
echo "  S3 Buckets: ${#BUCKETS[@]}"
echo "  Cognito User Pool: $USER_POOL_ID"
if [ -n "$CLIENT_ID" ]; then
    echo "  Cognito Client: $CLIENT_ID"
fi
echo ""
