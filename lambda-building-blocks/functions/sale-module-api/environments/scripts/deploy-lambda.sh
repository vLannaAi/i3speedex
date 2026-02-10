#!/bin/bash
set -e

# Lambda Functions Deployment Script
# Deploys all Lambda functions using SAM or CloudFormation

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

echo -e "${BLUE}Deploying Lambda functions for $ENVIRONMENT...${NC}"
echo ""

# Check if SAM template exists
SAM_TEMPLATE="$PROJECT_ROOT/template.yaml"

if [ -f "$SAM_TEMPLATE" ]; then
    echo "Using SAM template: $SAM_TEMPLATE"
    echo ""

    # Build SAM application
    echo "Building Lambda functions..."
    cd "$PROJECT_ROOT"
    sam build

    echo -e "${GREEN}✓ Build complete${NC}"
    echo ""

    # Deploy using SAM
    echo "Deploying Lambda functions..."
    sam deploy \
        --stack-name "sale-module-api-lambda-${ENVIRONMENT}" \
        --capabilities CAPABILITY_IAM \
        --parameter-overrides Environment="$ENVIRONMENT" \
        --no-confirm-changeset \
        --no-fail-on-empty-changeset

    echo -e "${GREEN}✓ Lambda functions deployed${NC}"
else
    echo -e "${YELLOW}SAM template not found: $SAM_TEMPLATE${NC}"
    echo "Skipping Lambda deployment"
    echo "Note: Lambda functions can be deployed separately using the template.yaml"
fi

echo ""
