#!/bin/bash
set -e

# Sale Module API - Backup Script
# Creates on-demand backups of DynamoDB tables and S3 buckets

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Default values
ENVIRONMENT="dev"
BACKUP_TYPE="full"
OUTPUT_DIR="$SCRIPT_DIR/backups"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --environment|-e)
            ENVIRONMENT="$2"
            shift 2
            ;;
        --type|-t)
            BACKUP_TYPE="$2"
            shift 2
            ;;
        --table)
            TABLE_NAME="$2"
            shift 2
            ;;
        --output|-o)
            OUTPUT_DIR="$2"
            shift 2
            ;;
        --help|-h)
            echo "Usage: $0 [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  --environment, -e ENV   Environment (dev|staging|production)"
            echo "  --type, -t TYPE         Backup type (full|tables|s3)"
            echo "  --table TABLE           Backup specific table only"
            echo "  --output, -o DIR        Output directory"
            echo "  --help, -h              Show this help"
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            exit 1
            ;;
    esac
done

echo "=========================================="
echo "Sale Module API - Backup"
echo "=========================================="
echo "Environment: $ENVIRONMENT"
echo "Backup Type: $BACKUP_TYPE"
echo "Timestamp: $TIMESTAMP"
echo ""

# Create output directory
mkdir -p "$OUTPUT_DIR"

# Backup DynamoDB tables
backup_dynamodb_tables() {
    echo -e "${YELLOW}Backing up DynamoDB tables...${NC}"

    TABLES=(
        "SalesTable-${ENVIRONMENT}"
        "BuyersTable-${ENVIRONMENT}"
        "ProducersTable-${ENVIRONMENT}"
    )

    for TABLE in "${TABLES[@]}"; do
        if [ -n "$TABLE_NAME" ] && [ "$TABLE" != "$TABLE_NAME" ]; then
            continue
        fi

        echo -e "${GREEN}Creating backup for $TABLE...${NC}"

        BACKUP_NAME="${TABLE}-manual-${TIMESTAMP}"

        aws dynamodb create-backup \
            --table-name "$TABLE" \
            --backup-name "$BACKUP_NAME" \
            --region ${AWS_REGION:-us-east-1}

        echo -e "${GREEN}✓ Backup created: $BACKUP_NAME${NC}"
    done
}

# Export DynamoDB tables to JSON
export_dynamodb_tables() {
    echo -e "${YELLOW}Exporting DynamoDB tables to JSON...${NC}"

    TABLES=(
        "SalesTable-${ENVIRONMENT}"
        "BuyersTable-${ENVIRONMENT}"
        "ProducersTable-${ENVIRONMENT}"
    )

    for TABLE in "${TABLES[@]}"; do
        if [ -n "$TABLE_NAME" ] && [ "$TABLE" != "$TABLE_NAME" ]; then
            continue
        fi

        echo -e "${GREEN}Exporting $TABLE...${NC}"

        OUTPUT_FILE="$OUTPUT_DIR/${TABLE}-${TIMESTAMP}.json"

        aws dynamodb scan \
            --table-name "$TABLE" \
            --region ${AWS_REGION:-us-east-1} \
            --output json > "$OUTPUT_FILE"

        # Compress
        gzip "$OUTPUT_FILE"

        echo -e "${GREEN}✓ Exported: ${OUTPUT_FILE}.gz${NC}"
    done
}

# Backup S3 buckets
backup_s3_buckets() {
    echo -e "${YELLOW}Backing up S3 buckets...${NC}"

    BUCKETS=(
        "sale-module-attachments-${ENVIRONMENT}"
        "sale-module-invoices-${ENVIRONMENT}"
    )

    for BUCKET in "${BUCKETS[@]}"; do
        echo -e "${GREEN}Syncing $BUCKET...${NC}"

        BACKUP_BUCKET="sale-module-backups-${ENVIRONMENT}"
        BACKUP_PREFIX="s3-backups/${TIMESTAMP}/${BUCKET}/"

        aws s3 sync \
            "s3://${BUCKET}" \
            "s3://${BACKUP_BUCKET}/${BACKUP_PREFIX}" \
            --region ${AWS_REGION:-us-east-1}

        echo -e "${GREEN}✓ Synced to: s3://${BACKUP_BUCKET}/${BACKUP_PREFIX}${NC}"
    done
}

# Create full backup archive
create_full_backup() {
    echo -e "${YELLOW}Creating full backup archive...${NC}"

    # Export tables to JSON
    export_dynamodb_tables

    # Create metadata file
    cat > "$OUTPUT_DIR/backup-metadata.json" <<EOF
{
  "timestamp": "$TIMESTAMP",
  "environment": "$ENVIRONMENT",
  "type": "full",
  "tables": [
    "SalesTable-${ENVIRONMENT}",
    "BuyersTable-${ENVIRONMENT}",
    "ProducersTable-${ENVIRONMENT}"
  ],
  "created_by": "$(whoami)",
  "aws_account": "$(aws sts get-caller-identity --query Account --output text)"
}
EOF

    # Create tarball
    ARCHIVE_NAME="${ENVIRONMENT}-full-${TIMESTAMP}.tar.gz"
    tar -czf "$OUTPUT_DIR/$ARCHIVE_NAME" \
        -C "$OUTPUT_DIR" \
        *.json.gz backup-metadata.json

    # Clean up individual files
    rm "$OUTPUT_DIR"/*.json.gz "$OUTPUT_DIR"/backup-metadata.json

    echo -e "${GREEN}✓ Full backup created: $ARCHIVE_NAME${NC}"
    echo -e "${GREEN}  Size: $(du -h "$OUTPUT_DIR/$ARCHIVE_NAME" | cut -f1)${NC}"
}

# Main execution
case $BACKUP_TYPE in
    full)
        backup_dynamodb_tables
        create_full_backup
        backup_s3_buckets
        ;;
    tables)
        backup_dynamodb_tables
        export_dynamodb_tables
        ;;
    s3)
        backup_s3_buckets
        ;;
    *)
        echo -e "${RED}Invalid backup type: $BACKUP_TYPE${NC}"
        exit 1
        ;;
esac

echo ""
echo "=========================================="
echo -e "${GREEN}Backup completed successfully!${NC}"
echo "=========================================="
echo "Output: $OUTPUT_DIR"
echo ""
