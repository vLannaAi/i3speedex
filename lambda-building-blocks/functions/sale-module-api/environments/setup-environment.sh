#!/bin/bash
set -e

# Sale Module API - Environment Setup Script
# Deploys complete infrastructure for dev, staging, or production

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
MAGENTA='\033[0;35m'
NC='\033[0m'

# Default values
ENVIRONMENT=""
SKIP_CONFIRMATION=false
DRY_RUN=false
COMPONENTS="all"  # all, core, cdn, backup

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --environment|-e)
            ENVIRONMENT="$2"
            shift 2
            ;;
        --components|-c)
            COMPONENTS="$2"
            shift 2
            ;;
        --skip-confirmation|-y)
            SKIP_CONFIRMATION=true
            shift
            ;;
        --dry-run)
            DRY_RUN=true
            shift
            ;;
        --help|-h)
            echo "Usage: $0 --environment ENV [OPTIONS]"
            echo ""
            echo "Required:"
            echo "  --environment, -e ENV   Environment to set up (dev|staging|production)"
            echo ""
            echo "Options:"
            echo "  --components, -c TYPE   Components to deploy (all|core|cdn|backup)"
            echo "  --skip-confirmation, -y Skip confirmation prompts"
            echo "  --dry-run               Show what would be deployed without deploying"
            echo "  --help, -h              Show this help"
            echo ""
            echo "Examples:"
            echo "  $0 --environment dev"
            echo "  $0 --environment production --components core"
            echo "  $0 --environment staging --dry-run"
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            exit 1
            ;;
    esac
done

# Validation
if [ -z "$ENVIRONMENT" ]; then
    echo -e "${RED}Error: --environment is required${NC}"
    exit 1
fi

if [[ ! "$ENVIRONMENT" =~ ^(dev|staging|production)$ ]]; then
    echo -e "${RED}Error: Environment must be dev, staging, or production${NC}"
    exit 1
fi

# Load environment configuration
CONFIG_FILE="$SCRIPT_DIR/config/${ENVIRONMENT}.json"
if [ ! -f "$CONFIG_FILE" ]; then
    echo -e "${RED}Error: Configuration file not found: $CONFIG_FILE${NC}"
    exit 1
fi

echo "=========================================="
echo "Sale Module API - Environment Setup"
echo "=========================================="
echo "Environment: $ENVIRONMENT"
echo "Components: $COMPONENTS"
if [ "$DRY_RUN" = true ]; then
    echo "Mode: DRY RUN"
fi
echo ""

# Extract configuration values
AWS_REGION=$(jq -r '.region // "us-east-1"' "$CONFIG_FILE")
AWS_ACCOUNT_ID=$(jq -r '.accountId' "$CONFIG_FILE")
PROJECT_NAME=$(jq -r '.projectName // "sale-module-api"' "$CONFIG_FILE")

echo "Configuration:"
echo "  AWS Region: $AWS_REGION"
echo "  AWS Account: $AWS_ACCOUNT_ID"
echo "  Project Name: $PROJECT_NAME"
echo ""

# Validate AWS credentials
echo -e "${BLUE}Validating AWS credentials...${NC}"
CURRENT_ACCOUNT=$(aws sts get-caller-identity --query Account --output text 2>/dev/null || echo "")
if [ -z "$CURRENT_ACCOUNT" ]; then
    echo -e "${RED}Error: AWS credentials not configured or invalid${NC}"
    echo "Run: aws configure"
    exit 1
fi

if [ "$CURRENT_ACCOUNT" != "$AWS_ACCOUNT_ID" ]; then
    echo -e "${YELLOW}Warning: Current AWS account ($CURRENT_ACCOUNT) doesn't match config ($AWS_ACCOUNT_ID)${NC}"
    read -p "Continue anyway? (yes/no): " CONTINUE
    if [ "$CONTINUE" != "yes" ]; then
        exit 0
    fi
fi

echo -e "${GREEN}✓ AWS credentials valid${NC}"
echo ""

# Confirmation
if [ "$SKIP_CONFIRMATION" = false ] && [ "$DRY_RUN" = false ]; then
    echo -e "${YELLOW}This will deploy infrastructure to AWS${NC}"
    echo "Environment: $ENVIRONMENT"
    echo "Region: $AWS_REGION"
    echo "Account: $CURRENT_ACCOUNT"
    echo ""
    read -p "Are you sure you want to proceed? (yes/no): " CONFIRM
    if [ "$CONFIRM" != "yes" ]; then
        echo "Aborted"
        exit 0
    fi
    echo ""
fi

# Deployment phases
PHASE=0
TOTAL_PHASES=7

# Helper function to run deployment steps
deploy_step() {
    local step_name=$1
    local step_script=$2
    shift 2
    local step_args=("$@")

    PHASE=$((PHASE + 1))
    echo ""
    echo "=========================================="
    echo -e "${MAGENTA}[Phase $PHASE/$TOTAL_PHASES] $step_name${NC}"
    echo "=========================================="
    echo ""

    if [ "$DRY_RUN" = true ]; then
        echo -e "${YELLOW}DRY RUN: Would execute: $step_script ${step_args[*]}${NC}"
        return 0
    fi

    # Execute step
    if [ -f "$step_script" ]; then
        bash "$step_script" "${step_args[@]}"
        if [ $? -ne 0 ]; then
            echo ""
            echo -e "${RED}✗ Phase $PHASE failed: $step_name${NC}"
            echo "See error messages above for details"
            exit 1
        fi
    else
        echo -e "${YELLOW}⊘ Script not found: $step_script (skipping)${NC}"
    fi

    echo ""
    echo -e "${GREEN}✓ Phase $PHASE complete: $step_name${NC}"
}

# Phase 1: Prerequisites Check
deploy_step "Prerequisites Check" "$SCRIPT_DIR/scripts/check-prerequisites.sh" "$ENVIRONMENT"

# Phase 2: Core Infrastructure (DynamoDB, S3, Cognito)
if [[ "$COMPONENTS" == "all" ]] || [[ "$COMPONENTS" == "core" ]]; then
    deploy_step "Core Infrastructure" "$SCRIPT_DIR/scripts/deploy-core.sh" "$ENVIRONMENT"
fi

# Phase 3: Lambda Functions
if [[ "$COMPONENTS" == "all" ]] || [[ "$COMPONENTS" == "core" ]]; then
    deploy_step "Lambda Functions" "$SCRIPT_DIR/scripts/deploy-lambda.sh" "$ENVIRONMENT"
fi

# Phase 4: API Gateway
if [[ "$COMPONENTS" == "all" ]] || [[ "$COMPONENTS" == "core" ]]; then
    deploy_step "API Gateway" "$SCRIPT_DIR/scripts/deploy-api-gateway.sh" "$ENVIRONMENT"
fi

# Phase 5: CloudFront CDN
if [[ "$COMPONENTS" == "all" ]] || [[ "$COMPONENTS" == "cdn" ]]; then
    deploy_step "CloudFront CDN" "$PROJECT_ROOT/cloudfront/deploy.sh" "$ENVIRONMENT" "deploy"
fi

# Phase 6: Backup Infrastructure
if [[ "$COMPONENTS" == "all" ]] || [[ "$COMPONENTS" == "backup" ]]; then
    deploy_step "Backup Infrastructure" "$SCRIPT_DIR/scripts/deploy-backup.sh" "$ENVIRONMENT"
fi

# Phase 7: Post-Deployment Configuration
deploy_step "Post-Deployment Configuration" "$SCRIPT_DIR/scripts/post-deploy.sh" "$ENVIRONMENT"

# Summary
echo ""
echo "=========================================="
echo -e "${GREEN}Environment Setup Complete!${NC}"
echo "=========================================="
echo ""

if [ "$DRY_RUN" = false ]; then
    echo "Environment: $ENVIRONMENT"
    echo "Region: $AWS_REGION"
    echo ""
    echo "Next steps:"
    echo "1. Verify deployment: ./verify-environment.sh --environment $ENVIRONMENT"
    echo "2. Run smoke tests: npm run test:integration:$ENVIRONMENT"
    echo "3. Check CloudWatch logs for any errors"
    echo "4. Update DNS if using custom domain"
    echo ""
    echo "To get API endpoint:"
    echo "  ./get-endpoints.sh --environment $ENVIRONMENT"
    echo ""
    echo "To tear down environment:"
    echo "  ./teardown-environment.sh --environment $ENVIRONMENT"
else
    echo "DRY RUN completed - no changes made"
fi

echo ""
