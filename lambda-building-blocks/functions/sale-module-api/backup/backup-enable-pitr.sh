#!/bin/bash
set -e

# Sale Module API - Enable Point-in-Time Recovery
# Enables PITR on all DynamoDB tables

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Default values
ENVIRONMENT="dev"
TABLE_NAME=""

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --environment|-e)
            ENVIRONMENT="$2"
            shift 2
            ;;
        --table)
            TABLE_NAME="$2"
            shift 2
            ;;
        --help|-h)
            echo "Usage: $0 [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  --environment, -e ENV   Environment (dev|staging|production)"
            echo "  --table TABLE           Enable PITR for specific table only"
            echo "  --help, -h              Show this help"
            echo ""
            echo "Examples:"
            echo "  $0 --environment production"
            echo "  $0 --table SalesTable-production"
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            exit 1
            ;;
    esac
done

echo "=========================================="
echo "Enable Point-in-Time Recovery"
echo "=========================================="
echo "Environment: $ENVIRONMENT"
echo ""

# Define tables to enable PITR
if [ -n "$TABLE_NAME" ]; then
    TABLES=("$TABLE_NAME")
else
    TABLES=(
        "SalesTable-${ENVIRONMENT}"
        "BuyersTable-${ENVIRONMENT}"
        "ProducersTable-${ENVIRONMENT}"
    )
fi

echo "Tables to enable PITR:"
for TABLE in "${TABLES[@]}"; do
    echo "  - $TABLE"
done
echo ""

# Enable PITR for each table
for TABLE in "${TABLES[@]}"; do
    echo -e "${YELLOW}Processing: $TABLE${NC}"

    # Check if table exists
    if ! aws dynamodb describe-table --table-name "$TABLE" --region ${AWS_REGION:-us-east-1} &>/dev/null; then
        echo -e "${RED}  ✗ Table does not exist, skipping${NC}"
        continue
    fi

    # Check current PITR status
    PITR_STATUS=$(aws dynamodb describe-continuous-backups \
        --table-name "$TABLE" \
        --region ${AWS_REGION:-us-east-1} \
        --query 'ContinuousBackupsDescription.PointInTimeRecoveryDescription.PointInTimeRecoveryStatus' \
        --output text 2>/dev/null || echo "UNKNOWN")

    if [ "$PITR_STATUS" == "ENABLED" ]; then
        echo -e "${GREEN}  ✓ PITR already enabled${NC}"

        # Get earliest restore time
        EARLIEST_TIME=$(aws dynamodb describe-continuous-backups \
            --table-name "$TABLE" \
            --region ${AWS_REGION:-us-east-1} \
            --query 'ContinuousBackupsDescription.PointInTimeRecoveryDescription.EarliestRestorableDateTime' \
            --output text 2>/dev/null || echo "N/A")

        LATEST_TIME=$(aws dynamodb describe-continuous-backups \
            --table-name "$TABLE" \
            --region ${AWS_REGION:-us-east-1} \
            --query 'ContinuousBackupsDescription.PointInTimeRecoveryDescription.LatestRestorableDateTime' \
            --output text 2>/dev/null || echo "N/A")

        echo "    Earliest restore: $EARLIEST_TIME"
        echo "    Latest restore: $LATEST_TIME"
    else
        echo -e "${YELLOW}  ⟳ Enabling PITR...${NC}"

        aws dynamodb update-continuous-backups \
            --table-name "$TABLE" \
            --point-in-time-recovery-specification PointInTimeRecoveryEnabled=true \
            --region ${AWS_REGION:-us-east-1} \
            --output json > /dev/null

        echo -e "${GREEN}  ✓ PITR enabled${NC}"
        echo "    Note: It may take a few minutes for PITR to become fully available"
    fi

    echo ""
done

echo "=========================================="
echo -e "${GREEN}PITR Configuration Complete${NC}"
echo "=========================================="
echo ""
echo "Important Notes:"
echo "1. PITR provides continuous backups for 35 days"
echo "2. Restore granularity: 1-second precision"
echo "3. Cost: ~$0.20 per GB per month"
echo "4. No performance impact on table operations"
echo ""
echo "To restore from PITR:"
echo "  ./restore-pitr.sh --table TABLE_NAME --timestamp TIMESTAMP --target-table TARGET_NAME"
echo ""
echo "To check PITR status:"
echo "  aws dynamodb describe-continuous-backups --table-name TABLE_NAME"
echo ""
