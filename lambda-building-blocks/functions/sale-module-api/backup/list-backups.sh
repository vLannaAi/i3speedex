#!/bin/bash
set -e

# Sale Module API - List Backups Script
# Lists all available backups for DynamoDB tables

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Default values
ENVIRONMENT=""
TABLE_NAME=""
FORMAT="table"  # table or json

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
        --format|-f)
            FORMAT="$2"
            shift 2
            ;;
        --help|-h)
            echo "Usage: $0 [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  --environment, -e ENV   Filter by environment (dev|staging|production)"
            echo "  --table TABLE           Filter by table name"
            echo "  --format, -f FORMAT     Output format (table|json)"
            echo "  --help, -h              Show this help"
            echo ""
            echo "Examples:"
            echo "  $0 --environment production"
            echo "  $0 --table SalesTable-production"
            echo "  $0 --format json"
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            exit 1
            ;;
    esac
done

echo "=========================================="
echo "Available Backups"
echo "=========================================="

# Build filter
FILTER_ARGS=""
if [ -n "$TABLE_NAME" ]; then
    FILTER_ARGS="--table-name $TABLE_NAME"
    echo "Table: $TABLE_NAME"
elif [ -n "$ENVIRONMENT" ]; then
    echo "Environment: $ENVIRONMENT"
fi

echo ""

# Get backups
BACKUPS=$(aws dynamodb list-backups \
    $FILTER_ARGS \
    --region ${AWS_REGION:-us-east-1} \
    --output json)

BACKUP_COUNT=$(echo "$BACKUPS" | jq '.BackupSummaries | length')

if [ "$BACKUP_COUNT" -eq 0 ]; then
    echo -e "${YELLOW}No backups found${NC}"
    exit 0
fi

echo "Found $BACKUP_COUNT backup(s)"
echo ""

if [ "$FORMAT" == "json" ]; then
    # JSON output
    echo "$BACKUPS" | jq '.BackupSummaries'
else
    # Table output
    echo "┌────────────────────────────────────────────────────────────────────────────────┐"
    printf "│ %-30s │ %-20s │ %-12s │ %-8s │\n" "Backup Name" "Table Name" "Created" "Status"
    echo "├────────────────────────────────────────────────────────────────────────────────┤"

    echo "$BACKUPS" | jq -r '.BackupSummaries[] |
        [.BackupName, .TableName, .BackupCreationDateTime, .BackupStatus] |
        @tsv' | \
    while IFS=$'\t' read -r name table created status; do
        # Truncate long names
        name_short="${name:0:28}"
        table_short="${table:0:18}"
        created_short=$(echo "$created" | cut -d'T' -f1)

        # Color code status
        if [ "$status" == "AVAILABLE" ]; then
            status_colored="${GREEN}AVAILABLE${NC}"
        elif [ "$status" == "CREATING" ]; then
            status_colored="${YELLOW}CREATING${NC}"
        else
            status_colored="${RED}$status${NC}"
        fi

        printf "│ %-30s │ %-20s │ %-12s │ " "$name_short" "$table_short" "$created_short"
        echo -ne "$status_colored"
        printf " │\n"
    done

    echo "└────────────────────────────────────────────────────────────────────────────────┘"
fi

echo ""

# Summary by table
echo "Summary by table:"
echo "$BACKUPS" | jq -r '.BackupSummaries | group_by(.TableName) | .[] |
    "\(.  | length) backups: \(.[0].TableName)"'

echo ""

# Storage used
TOTAL_SIZE=$(echo "$BACKUPS" | jq '[.BackupSummaries[].BackupSizeBytes] | add')
if [ -n "$TOTAL_SIZE" ] && [ "$TOTAL_SIZE" != "null" ]; then
    TOTAL_SIZE_GB=$(echo "scale=2; $TOTAL_SIZE / 1024 / 1024 / 1024" | bc)
    echo "Total backup storage: ${TOTAL_SIZE_GB} GB"
else
    echo "Total backup storage: Unknown"
fi

echo ""
echo "To restore a backup:"
echo "  ./restore-snapshot.sh --backup-name BACKUP_NAME --target-table TARGET_TABLE"
echo ""
echo "To validate a backup:"
echo "  ./validate-backup.sh --backup-arn BACKUP_ARN --verify-integrity"
echo ""
