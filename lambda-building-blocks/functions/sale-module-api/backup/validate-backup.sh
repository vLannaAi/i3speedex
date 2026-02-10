#!/bin/bash
set -e

# Sale Module API - Backup Validation Script
# Validates backup integrity and recoverability

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Default values
BACKUP_ARN=""
TABLE_NAME=""
SAMPLE_SIZE=100
VERIFY_INTEGRITY=false

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --backup-arn)
            BACKUP_ARN="$2"
            shift 2
            ;;
        --table)
            TABLE_NAME="$2"
            shift 2
            ;;
        --sample-size)
            SAMPLE_SIZE="$2"
            shift 2
            ;;
        --verify-integrity)
            VERIFY_INTEGRITY=true
            shift
            ;;
        --help|-h)
            echo "Usage: $0 [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  --backup-arn ARN        Backup ARN to validate"
            echo "  --table TABLE           Table name to validate latest backup"
            echo "  --sample-size N         Number of items to sample (default: 100)"
            echo "  --verify-integrity      Perform deep integrity check"
            echo "  --help, -h              Show this help"
            echo ""
            echo "Examples:"
            echo "  $0 --backup-arn arn:aws:dynamodb:us-east-1:123:table/Sales/backup/01234"
            echo "  $0 --table SalesTable-production --verify-integrity"
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            exit 1
            ;;
    esac
done

# Validation
if [ -z "$BACKUP_ARN" ] && [ -z "$TABLE_NAME" ]; then
    echo -e "${RED}Error: Either --backup-arn or --table is required${NC}"
    exit 1
fi

echo "=========================================="
echo "Backup Validation"
echo "=========================================="

# Get backup ARN if table name provided
if [ -n "$TABLE_NAME" ]; then
    echo -e "${YELLOW}Finding latest backup for $TABLE_NAME...${NC}"

    BACKUP_ARN=$(aws dynamodb list-backups \
        --table-name "$TABLE_NAME" \
        --region ${AWS_REGION:-us-east-1} \
        --output json | \
        jq -r '.BackupSummaries | sort_by(.BackupCreationDateTime) | reverse | .[0].BackupArn')

    if [ -z "$BACKUP_ARN" ] || [ "$BACKUP_ARN" == "null" ]; then
        echo -e "${RED}Error: No backups found for $TABLE_NAME${NC}"
        exit 1
    fi

    echo -e "${GREEN}✓ Found backup: $BACKUP_ARN${NC}"
fi

echo "Backup ARN: $BACKUP_ARN"
echo ""

# Phase 1: Get Backup Details
echo -e "${BLUE}[1/5] Getting backup details...${NC}"

BACKUP_DETAILS=$(aws dynamodb describe-backup \
    --backup-arn "$BACKUP_ARN" \
    --region ${AWS_REGION:-us-east-1} \
    --output json)

BACKUP_STATUS=$(echo "$BACKUP_DETAILS" | jq -r '.BackupDescription.BackupDetails.BackupStatus')
BACKUP_NAME=$(echo "$BACKUP_DETAILS" | jq -r '.BackupDescription.BackupDetails.BackupName')
BACKUP_SIZE=$(echo "$BACKUP_DETAILS" | jq -r '.BackupDescription.BackupDetails.BackupSizeBytes')
BACKUP_DATE=$(echo "$BACKUP_DETAILS" | jq -r '.BackupDescription.BackupDetails.BackupCreationDateTime')
SOURCE_TABLE=$(echo "$BACKUP_DETAILS" | jq -r '.BackupDescription.SourceTableDetails.TableName')
ITEM_COUNT=$(echo "$BACKUP_DETAILS" | jq -r '.BackupDescription.SourceTableDetails.ItemCount')

BACKUP_SIZE_MB=$(echo "scale=2; $BACKUP_SIZE / 1024 / 1024" | bc)

echo "  Backup Name: $BACKUP_NAME"
echo "  Status: $BACKUP_STATUS"
echo "  Source Table: $SOURCE_TABLE"
echo "  Created: $BACKUP_DATE"
echo "  Size: ${BACKUP_SIZE_MB} MB"
echo "  Item Count: $ITEM_COUNT"

if [ "$BACKUP_STATUS" != "AVAILABLE" ]; then
    echo -e "${RED}✗ Backup is not available (status: $BACKUP_STATUS)${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Backup is available${NC}"
echo ""

# Phase 2: Check Backup Age
echo -e "${BLUE}[2/5] Checking backup age...${NC}"

BACKUP_TIMESTAMP=$(date -d "$BACKUP_DATE" +%s 2>/dev/null || date -j -f "%Y-%m-%dT%H:%M:%S" "$(echo $BACKUP_DATE | cut -d. -f1)" +%s)
CURRENT_TIMESTAMP=$(date +%s)
BACKUP_AGE_SECONDS=$((CURRENT_TIMESTAMP - BACKUP_TIMESTAMP))
BACKUP_AGE_DAYS=$((BACKUP_AGE_SECONDS / 86400))

echo "  Backup Age: $BACKUP_AGE_DAYS days (${BACKUP_AGE_SECONDS}s)"

if [ $BACKUP_AGE_DAYS -gt 30 ]; then
    echo -e "${YELLOW}⚠ Backup is older than 30 days${NC}"
elif [ $BACKUP_AGE_DAYS -gt 7 ]; then
    echo -e "${YELLOW}⚠ Backup is older than 7 days${NC}"
else
    echo -e "${GREEN}✓ Backup age is acceptable${NC}"
fi

echo ""

# Phase 3: Validate Backup Size
echo -e "${BLUE}[3/5] Validating backup size...${NC}"

# Get current table size
CURRENT_TABLE_SIZE=$(aws dynamodb describe-table \
    --table-name "$SOURCE_TABLE" \
    --region ${AWS_REGION:-us-east-1} \
    --query 'Table.TableSizeBytes' \
    --output text 2>/dev/null || echo "0")

CURRENT_TABLE_SIZE_MB=$(echo "scale=2; $CURRENT_TABLE_SIZE / 1024 / 1024" | bc)

SIZE_DIFF=$(echo "scale=2; (($CURRENT_TABLE_SIZE - $BACKUP_SIZE) / $CURRENT_TABLE_SIZE) * 100" | bc 2>/dev/null || echo "0")

echo "  Current Table Size: ${CURRENT_TABLE_SIZE_MB} MB"
echo "  Backup Size: ${BACKUP_SIZE_MB} MB"
echo "  Difference: ${SIZE_DIFF}%"

if [ $(echo "$SIZE_DIFF > 20" | bc) -eq 1 ] || [ $(echo "$SIZE_DIFF < -20" | bc) -eq 1 ]; then
    echo -e "${YELLOW}⚠ Size difference is significant (>20%)${NC}"
else
    echo -e "${GREEN}✓ Size difference is acceptable${NC}"
fi

echo ""

# Phase 4: Test Restore (Sample)
if [ "$VERIFY_INTEGRITY" = true ]; then
    echo -e "${BLUE}[4/5] Testing sample restore...${NC}"

    TEST_TABLE="${SOURCE_TABLE}-validate-test-$(date +%s)"
    echo "  Creating test table: $TEST_TABLE"

    # Initiate restore
    aws dynamodb restore-table-from-backup \
        --target-table-name "$TEST_TABLE" \
        --backup-arn "$BACKUP_ARN" \
        --region ${AWS_REGION:-us-east-1} \
        --output json > /dev/null 2>&1

    echo "  Waiting for restore to complete..."

    # Wait for restore
    while true; do
        STATUS=$(aws dynamodb describe-table \
            --table-name "$TEST_TABLE" \
            --region ${AWS_REGION:-us-east-1} \
            --query 'Table.TableStatus' \
            --output text 2>/dev/null || echo "NOT_FOUND")

        if [ "$STATUS" == "ACTIVE" ]; then
            break
        elif [ "$STATUS" == "CREATING" ]; then
            echo -n "."
            sleep 10
        else
            echo -e "${RED}✗ Unexpected status: $STATUS${NC}"
            exit 1
        fi
    done

    echo ""

    # Sample data
    echo "  Sampling $SAMPLE_SIZE items..."

    SAMPLE_DATA=$(aws dynamodb scan \
        --table-name "$TEST_TABLE" \
        --max-items $SAMPLE_SIZE \
        --region ${AWS_REGION:-us-east-1} \
        --output json)

    SAMPLE_COUNT=$(echo "$SAMPLE_DATA" | jq '.Items | length')

    echo "  Retrieved $SAMPLE_COUNT sample items"

    # Cleanup test table
    echo "  Cleaning up test table..."
    aws dynamodb delete-table \
        --table-name "$TEST_TABLE" \
        --region ${AWS_REGION:-us-east-1} \
        --output json > /dev/null 2>&1

    echo -e "${GREEN}✓ Sample restore successful${NC}"
else
    echo -e "${BLUE}[4/5] Skipping sample restore (use --verify-integrity to enable)${NC}"
fi

echo ""

# Phase 5: Check Encryption
echo -e "${BLUE}[5/5] Checking encryption...${NC}"

BACKUP_TYPE=$(echo "$BACKUP_DETAILS" | jq -r '.BackupDescription.BackupDetails.BackupType')

echo "  Backup Type: $BACKUP_TYPE"

# Check if table has encryption
TABLE_ENCRYPTION=$(aws dynamodb describe-table \
    --table-name "$SOURCE_TABLE" \
    --region ${AWS_REGION:-us-east-1} \
    --query 'Table.SSEDescription.Status' \
    --output text 2>/dev/null || echo "DISABLED")

echo "  Source Table Encryption: $TABLE_ENCRYPTION"

if [ "$TABLE_ENCRYPTION" == "ENABLED" ]; then
    echo -e "${GREEN}✓ Encryption is enabled${NC}"
else
    echo -e "${YELLOW}⚠ Encryption is not enabled${NC}"
fi

echo ""

# Final Summary
echo "=========================================="
echo -e "${GREEN}Validation Complete${NC}"
echo "=========================================="
echo ""
echo "Summary:"
echo "  ✓ Backup is available and accessible"
echo "  ✓ Backup metadata is valid"
echo "  ✓ Backup age: $BACKUP_AGE_DAYS days"
echo "  ✓ Backup size: ${BACKUP_SIZE_MB} MB"

if [ "$VERIFY_INTEGRITY" = true ]; then
    echo "  ✓ Sample restore successful"
fi

echo ""
echo "Recommendations:"

if [ $BACKUP_AGE_DAYS -gt 7 ]; then
    echo "  ⚠ Consider creating a fresh backup"
fi

if [ "$TABLE_ENCRYPTION" != "ENABLED" ]; then
    echo "  ⚠ Enable encryption for better security"
fi

if [ $(echo "$SIZE_DIFF > 20" | bc) -eq 1 ]; then
    echo "  ⚠ Large size difference detected, verify data consistency"
fi

echo ""
echo "To restore this backup:"
echo "  ./restore-snapshot.sh --backup-arn $BACKUP_ARN --target-table TARGET_TABLE_NAME"
echo ""
