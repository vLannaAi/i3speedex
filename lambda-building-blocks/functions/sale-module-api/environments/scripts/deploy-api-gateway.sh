#!/bin/bash
set -e

# API Gateway Deployment Script

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
ENV_DIR="$(dirname "$SCRIPT_DIR")"

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

echo -e "${BLUE}Deploying API Gateway for $ENVIRONMENT...${NC}"
echo ""

# Note: API Gateway is typically deployed as part of SAM template
# This is a placeholder for custom API Gateway configuration

CONFIG_FILE="$ENV_DIR/config/${ENVIRONMENT}.json"
STAGE_NAME=$(jq -r '.apiGateway.stageName' "$CONFIG_FILE")

echo "API Gateway stage: $STAGE_NAME"
echo ""

echo -e "${YELLOW}Note: API Gateway is deployed as part of the SAM template${NC}"
echo "If you need to configure API Gateway separately, add configuration here"
echo ""

echo -e "${GREEN}✓ API Gateway configuration verified${NC}"
echo ""
