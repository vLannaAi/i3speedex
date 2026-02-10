#!/bin/bash
set -e

# Sale Module API - Snapshot Restore Script
# Restores DynamoDB tables from backup snapshots

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Default values
BACKUP_ARN=""
BACKUP_NAME=""
TARGET_TABLE=""

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --backup-arn)
            BACKUP_ARN="$2"
            shift 2
            ;;
        --backup-name)
            BACKUP_NAME="$2"
            shift 2
            ;;
        --target-table)
            TARGET_TABLE="$2"
            shift 2
            ;;
        --help|-h)
            echo "Usage: $0 [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  --backup-arn ARN        Backup ARN to restore from"
            echo "  --backup-name NAME      Backup name to restore from"
            echo "  --target-table TABLE    Target table name for restored data"
            echo "  --help, -h              Show this help"
            echo ""
            echo "Examples:"
            echo "  $0 --backup-name SalesTable-daily-20260130 --target-table SalesTable-restored"
            echo "  $0 --backup-arn arn:aws:backup:us-east-1:123:recovery-point:abc --target-table SalesTable-restored"
            echo ""
            echo "To list available backups:"
            echo "  ./list-backups.sh"
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            exit 1
            ;;
    esac
done

# Validation
if [ -z "$TARGET_TABLE" ]; then
    echo -e "${RED}Error: --target-table is required${NC}"
    exit 1
fi

if [ -z "$BACKUP_ARN" ] && [ -z "$BACKUP_NAME" ]; then
    echo -e "${RED}Error: Either --backup-arn or --backup-name is required${NC}"
    exit 1
fi

echo "=========================================="
echo "Snapshot Restore"
echo "=========================================="
echo "Target Table: $TARGET_TABLE"
echo ""

# If backup name provided, get the ARN
if [ -n "$BACKUP_NAME" ]; then
    echo -e "${YELLOW}Looking up backup ARN from name...${NC}"

    BACKUP_ARN=$(aws dynamodb list-backups \
        --region ${AWS_REGION:-us-east-1} \
        --output json | \
        jq -r ".BackupSummaries[] | select(.BackupName == \"$BACKUP_NAME\") | .BackupArn" | \
        head -1)

    if [ -z "$BACKUP_ARN" ] || [ "$BACKUP_ARN" == "null" ]; then
        echo -e "${RED}Error: Backup not found with name: $BACKUP_NAME${NC}"
        echo "Run './list-backups.sh' to see available backups"
        exit 1
    fi

    echo -e "${GREEN}✓ Found backup: $BACKUP_ARN${NC}"
fi

echo "Backup ARN: $BACKUP_ARN"

# Check if target table already exists
echo -e "${YELLOW}Checking if target table exists...${NC}"
if aws dynamodb describe-table --table-name "$TARGET_TABLE" --region ${AWS_REGION:-us-east-1} &>/dev/null; then
    echo -e "${RED}Error: Target table $TARGET_TABLE already exists${NC}"
    echo "Please delete it first or use a different target table name"
    exit 1
fi

echo -e "${GREEN}✓ Target table does not exist${NC}"

# Get backup details
echo -e "${YELLOW}Getting backup details...${NC}"
BACKUP_DETAILS=$(aws dynamodb describe-backup \
    --backup-arn "$BACKUP_ARN" \
    --region ${AWS_REGION:-us-east-1} \
    --output json)

SOURCE_TABLE=$(echo "$BACKUP_DETAILS" | jq -r '.BackupDescription.SourceTableDetails.TableName')
BACKUP_SIZE=$(echo "$BACKUP_DETAILS" | jq -r '.BackupDescription.SourceTableDetails.TableSizeBytes')
BACKUP_DATE=$(echo "$BACKUP_DETAILS" | jq -r '.BackupDescription.BackupDetails.BackupCreationDateTime')

BACKUP_SIZE_MB=$(echo "scale=2; $BACKUP_SIZE / 1024 / 1024" | bc)

echo "  Source Table: $SOURCE_TABLE"
echo "  Backup Size: ${BACKUP_SIZE_MB} MB"
echo "  Backup Date: $BACKUP_DATE"

# Confirm restore
echo ""
echo -e "${YELLOW}Ready to restore backup to $TARGET_TABLE${NC}"
echo "This operation may take several minutes..."
echo ""

# Restore from backup
echo -e "${YELLOW}Restoring from backup...${NC}"

aws dynamodb restore-table-from-backup \
    --target-table-name "$TARGET_TABLE" \
    --backup-arn "$BACKUP_ARN" \
    --region ${AWS_REGION:-us-east-1}

echo -e "${GREEN}✓ Restore initiated${NC}"

# Wait for restore to complete
echo -e "${YELLOW}Waiting for restore to complete...${NC}"
while true; do
    TABLE_STATUS=$(aws dynamodb describe-table \
        --table-name "$TARGET_TABLE" \
        --region ${AWS_REGION:-us-east-1} \
        --query 'Table.TableStatus' \
        --output text 2>/dev/null || echo "NOT_FOUND")

    if [ "$TABLE_STATUS" == "ACTIVE" ]; then
        echo -e "${GREEN}✓ Restore completed successfully!${NC}"
        break
    elif [ "$TABLE_STATUS" == "CREATING" ]; then
        echo -n "."
        sleep 10
    else
        echo -e "${RED}Error: Unexpected table status: $TABLE_STATUS${NC}"
        exit 1
    fi
done

echo ""

# Get restored table details
echo -e "${YELLOW}Restored table details:${NC}"
ITEM_COUNT=$(aws dynamodb describe-table \
    --table-name "$TARGET_TABLE" \
    --region ${AWS_REGION:-us-east-1} \
    --query 'Table.ItemCount' \
    --output text)

TABLE_SIZE=$(aws dynamodb describe-table \
    --table-name "$TARGET_TABLE" \
    --region ${AWS_REGION:-us-east-1} \
    --query 'Table.TableSizeBytes' \
    --output text)

TABLE_SIZE_MB=$(echo "scale=2; $TABLE_SIZE / 1024 / 1024" | bc)

echo "  Table Name: $TARGET_TABLE"
echo "  Item Count: $ITEM_COUNT"
echo "  Table Size: ${TABLE_SIZE_MB} MB"

echo ""
echo "=========================================="
echo -e "${GREEN}Restore completed successfully!${NC}"
echo "=========================================="
echo ""
echo "Next steps:"
echo "1. Validate the restored data: ./validate-table.sh --table $TARGET_TABLE"
echo "2. Compare with source table if needed"
echo "3. If validation passes, optionally swap with production table"
echo ""
