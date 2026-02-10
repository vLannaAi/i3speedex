#!/bin/bash
set -e

# Backup Infrastructure Deployment Script

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
ENV_DIR="$(dirname "$SCRIPT_DIR")"
PROJECT_ROOT="$(dirname "$ENV_DIR")"

# Color codes
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
BACKUP_ENABLED=$(jq -r '.backup.enabled' "$CONFIG_FILE")

echo -e "${BLUE}Deploying backup infrastructure for $ENVIRONMENT...${NC}"
echo ""

if [ "$BACKUP_ENABLED" != "true" ]; then
    echo -e "${YELLOW}Backup not enabled for $ENVIRONMENT environment${NC}"
    echo "Skipping backup deployment"
    exit 0
fi

# Deploy backup plan
BACKUP_DIR="$PROJECT_ROOT/backup"
if [ -f "$BACKUP_DIR/backup-plan.yaml" ]; then
    echo "Deploying AWS Backup plan..."

    SALES_TABLE=$(jq -r '.dynamodb.salesTable' "$CONFIG_FILE")
    BUYERS_TABLE=$(jq -r '.dynamodb.buyersTable' "$CONFIG_FILE")
    PRODUCERS_TABLE=$(jq -r '.dynamodb.producersTable' "$CONFIG_FILE")
    RETENTION_DAYS=$(jq -r '.backup.retentionDays // 30' "$CONFIG_FILE")
    NOTIFICATION_EMAIL=$(jq -r '.monitoring.alarmEmail' "$CONFIG_FILE")

    aws cloudformation deploy \
        --template-file "$BACKUP_DIR/backup-plan.yaml" \
        --stack-name "sale-module-backup-plan-${ENVIRONMENT}" \
        --parameter-overrides \
            Environment="$ENVIRONMENT" \
            SalesTableName="$SALES_TABLE" \
            BuyersTableName="$BUYERS_TABLE" \
            ProducersTableName="$PRODUCERS_TABLE" \
            BackupRetentionDays="$RETENTION_DAYS" \
            NotificationEmail="$NOTIFICATION_EMAIL" \
        --capabilities CAPABILITY_IAM \
        --no-fail-on-empty-changeset

    echo -e "${GREEN}✓ Backup plan deployed${NC}"
else
    echo -e "${YELLOW}Backup plan template not found${NC}"
fi

# Enable PITR if configured
PITR_ENABLED=$(jq -r '.backup.pitr' "$CONFIG_FILE")
if [ "$PITR_ENABLED" == "true" ]; then
    echo ""
    echo "Enabling Point-in-Time Recovery..."

    if [ -f "$BACKUP_DIR/backup-enable-pitr.sh" ]; then
        bash "$BACKUP_DIR/backup-enable-pitr.sh" --environment "$ENVIRONMENT"
    else
        echo -e "${YELLOW}PITR script not found, skipping${NC}"
    fi
fi

# Enable S3 versioning if configured
S3_VERSIONING=$(jq -r '.backup.s3Versioning' "$CONFIG_FILE")
if [ "$S3_VERSIONING" == "true" ]; then
    echo ""
    echo "Enabling S3 versioning..."

    if [ -f "$BACKUP_DIR/backup-enable-s3-versioning.sh" ]; then
        bash "$BACKUP_DIR/backup-enable-s3-versioning.sh" --environment "$ENVIRONMENT"
    else
        echo -e "${YELLOW}S3 versioning script not found, skipping${NC}"
    fi
fi

echo ""
echo -e "${GREEN}✓ Backup infrastructure deployment complete${NC}"
echo ""
