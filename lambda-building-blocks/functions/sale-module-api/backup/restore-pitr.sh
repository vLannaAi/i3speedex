#!/bin/bash
set -e

# Sale Module API - Point-in-Time Recovery Restore Script
# Restores DynamoDB tables from Point-in-Time Recovery

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Default values
ENVIRONMENT="dev"
HOURS_AGO=""
TIMESTAMP=""
TARGET_TABLE=""
SOURCE_TABLE=""

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --environment|-e)
            ENVIRONMENT="$2"
            shift 2
            ;;
        --table)
            SOURCE_TABLE="$2"
            shift 2
            ;;
        --target-table)
            TARGET_TABLE="$2"
            shift 2
            ;;
        --timestamp)
            TIMESTAMP="$2"
            shift 2
            ;;
        --hours-ago)
            HOURS_AGO="$2"
            shift 2
            ;;
        --help|-h)
            echo "Usage: $0 [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  --environment, -e ENV   Environment (dev|staging|production)"
            echo "  --table TABLE           Source table name"
            echo "  --target-table TABLE    Target table name for restored data"
            echo "  --timestamp TIME        Restore to specific timestamp (ISO 8601)"
            echo "  --hours-ago N           Restore to N hours ago"
            echo "  --help, -h              Show this help"
            echo ""
            echo "Examples:"
            echo "  $0 --table SalesTable-production --timestamp 2026-01-30T14:30:00Z --target-table SalesTable-restored"
            echo "  $0 --table SalesTable-production --hours-ago 2 --target-table SalesTable-temp"
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            exit 1
            ;;
    esac
done

# Validation
if [ -z "$SOURCE_TABLE" ]; then
    echo -e "${RED}Error: --table is required${NC}"
    exit 1
fi

if [ -z "$TARGET_TABLE" ]; then
    echo -e "${RED}Error: --target-table is required${NC}"
    exit 1
fi

# Calculate timestamp
if [ -n "$HOURS_AGO" ]; then
    if [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS
        RESTORE_TIME=$(date -u -v-${HOURS_AGO}H +"%Y-%m-%dT%H:%M:%SZ")
    else
        # Linux
        RESTORE_TIME=$(date -u -d "$HOURS_AGO hours ago" +"%Y-%m-%dT%H:%M:%SZ")
    fi
elif [ -n "$TIMESTAMP" ]; then
    RESTORE_TIME="$TIMESTAMP"
else
    echo -e "${RED}Error: Either --timestamp or --hours-ago is required${NC}"
    exit 1
fi

echo "=========================================="
echo "Point-in-Time Recovery Restore"
echo "=========================================="
echo "Source Table: $SOURCE_TABLE"
echo "Target Table: $TARGET_TABLE"
echo "Restore Time: $RESTORE_TIME"
echo ""

# Check if PITR is enabled
echo -e "${YELLOW}Checking Point-in-Time Recovery status...${NC}"
PITR_STATUS=$(aws dynamodb describe-continuous-backups \
    --table-name "$SOURCE_TABLE" \
    --region ${AWS_REGION:-us-east-1} \
    --query 'ContinuousBackupsDescription.PointInTimeRecoveryDescription.PointInTimeRecoveryStatus' \
    --output text)

if [ "$PITR_STATUS" != "ENABLED" ]; then
    echo -e "${RED}Error: Point-in-Time Recovery is not enabled on $SOURCE_TABLE${NC}"
    echo "Enable it with: aws dynamodb update-continuous-backups --table-name $SOURCE_TABLE --point-in-time-recovery-specification PointInTimeRecoveryEnabled=true"
    exit 1
fi

echo -e "${GREEN}✓ PITR is enabled${NC}"

# Check if target table already exists
echo -e "${YELLOW}Checking if target table exists...${NC}"
if aws dynamodb describe-table --table-name "$TARGET_TABLE" --region ${AWS_REGION:-us-east-1} &>/dev/null; then
    echo -e "${RED}Error: Target table $TARGET_TABLE already exists${NC}"
    echo "Please delete it first or use a different target table name"
    exit 1
fi

echo -e "${GREEN}✓ Target table does not exist${NC}"

# Restore table
echo -e "${YELLOW}Restoring table to $RESTORE_TIME...${NC}"
echo "This may take several minutes depending on table size..."

RESTORE_OUTPUT=$(aws dynamodb restore-table-to-point-in-time \
    --source-table-name "$SOURCE_TABLE" \
    --target-table-name "$TARGET_TABLE" \
    --restore-date-time "$RESTORE_TIME" \
    --region ${AWS_REGION:-us-east-1} \
    --output json)

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

# Get table details
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
echo "1. Validate the restored data"
echo "2. Compare with source table if needed"
echo "3. If validation passes, optionally swap with production table"
echo ""
echo "To swap tables (use with caution!):"
echo "  ./swap-tables.sh --old $SOURCE_TABLE --new $TARGET_TABLE"
echo ""
