#!/bin/bash
set -e

# CloudFront Distribution Deployment Script

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Default values
ENVIRONMENT=${1:-dev}
ACTION=${2:-deploy}  # deploy, delete, update, status
CONFIG_FILE="$SCRIPT_DIR/config/${ENVIRONMENT}.json"

# Functions
usage() {
    echo "Usage: $0 [ENVIRONMENT] [ACTION]"
    echo ""
    echo "ENVIRONMENT:"
    echo "  dev         Development environment (default)"
    echo "  staging     Staging environment"
    echo "  production  Production environment"
    echo ""
    echo "ACTION:"
    echo "  deploy      Deploy or update distribution (default)"
    echo "  delete      Delete distribution"
    echo "  update      Update existing distribution"
    echo "  status      Show distribution status"
    echo "  invalidate  Invalidate CloudFront cache"
    echo ""
    echo "Examples:"
    echo "  $0 dev deploy"
    echo "  $0 production status"
    echo "  $0 staging invalidate"
    exit 0
}

# Parse help flag
if [[ "$1" == "--help" ]] || [[ "$1" == "-h" ]]; then
    usage
fi

echo "=========================================="
echo "CloudFront Distribution Management"
echo "=========================================="
echo "Environment: $ENVIRONMENT"
echo "Action: $ACTION"
echo ""

# Validate config file
if [ ! -f "$CONFIG_FILE" ]; then
    echo -e "${RED}Error: Configuration file not found: $CONFIG_FILE${NC}"
    exit 1
fi

# Load configuration
STACK_NAME=$(jq -r '.StackName' "$CONFIG_FILE")
API_GATEWAY_DOMAIN=$(jq -r '.Parameters.ApiGatewayDomainName' "$CONFIG_FILE")

echo "Stack Name: $STACK_NAME"
echo ""

# Execute action
case $ACTION in
    deploy|update)
        echo -e "${BLUE}Deploying CloudFront distribution...${NC}"
        echo ""

        # Convert JSON config to parameter overrides
        PARAMS=$(jq -r '.Parameters | to_entries | map("\(.key)=\(.value)") | join(" ")' "$CONFIG_FILE")

        # Convert tags
        TAGS=$(jq -r '.Tags | map("\(.Key)=\(.Value)") | join(" ")' "$CONFIG_FILE")

        echo "Parameters:"
        echo "$PARAMS" | tr ' ' '\n' | sed 's/^/  /'
        echo ""

        # Deploy CloudFormation stack
        echo -e "${YELLOW}Creating/updating CloudFormation stack...${NC}"

        aws cloudformation deploy \
            --template-file "$SCRIPT_DIR/cloudfront.yaml" \
            --stack-name "$STACK_NAME" \
            --parameter-overrides $PARAMS \
            --tags $TAGS \
            --capabilities CAPABILITY_IAM \
            --region us-east-1 \
            --no-fail-on-empty-changeset

        if [ $? -eq 0 ]; then
            echo ""
            echo -e "${GREEN}✓ Stack deployed successfully${NC}"
        else
            echo ""
            echo -e "${RED}✗ Stack deployment failed${NC}"
            exit 1
        fi

        # Get outputs
        echo ""
        echo -e "${BLUE}Distribution Details:${NC}"

        DISTRIBUTION_ID=$(aws cloudformation describe-stacks \
            --stack-name "$STACK_NAME" \
            --region us-east-1 \
            --query 'Stacks[0].Outputs[?OutputKey==`DistributionId`].OutputValue' \
            --output text)

        DISTRIBUTION_DOMAIN=$(aws cloudformation describe-stacks \
            --stack-name "$STACK_NAME" \
            --region us-east-1 \
            --query 'Stacks[0].Outputs[?OutputKey==`DistributionDomainName`].OutputValue' \
            --output text)

        DISTRIBUTION_URL=$(aws cloudformation describe-stacks \
            --stack-name "$STACK_NAME" \
            --region us-east-1 \
            --query 'Stacks[0].Outputs[?OutputKey==`DistributionURL`].OutputValue' \
            --output text)

        echo "  Distribution ID: $DISTRIBUTION_ID"
        echo "  Domain Name: $DISTRIBUTION_DOMAIN"
        echo "  URL: $DISTRIBUTION_URL"

        # Check if custom domain exists
        CUSTOM_URL=$(aws cloudformation describe-stacks \
            --stack-name "$STACK_NAME" \
            --region us-east-1 \
            --query 'Stacks[0].Outputs[?OutputKey==`CustomDomainURL`].OutputValue' \
            --output text 2>/dev/null || echo "")

        if [ -n "$CUSTOM_URL" ]; then
            echo "  Custom URL: $CUSTOM_URL"
        fi

        echo ""
        echo -e "${YELLOW}⚠ CloudFront distribution may take 15-20 minutes to fully deploy${NC}"
        echo ""
        echo "To check deployment status:"
        echo "  $0 $ENVIRONMENT status"
        echo ""
        echo "To invalidate cache after deployment:"
        echo "  $0 $ENVIRONMENT invalidate"
        ;;

    delete)
        echo -e "${RED}Deleting CloudFront distribution...${NC}"
        echo ""
        echo -e "${YELLOW}WARNING: This will delete the CloudFront distribution and all associated resources${NC}"
        echo ""
        read -p "Are you sure you want to delete $STACK_NAME? (yes/no): " CONFIRM

        if [ "$CONFIRM" != "yes" ]; then
            echo "Aborted"
            exit 0
        fi

        # Get distribution ID before deletion
        DISTRIBUTION_ID=$(aws cloudformation describe-stacks \
            --stack-name "$STACK_NAME" \
            --region us-east-1 \
            --query 'Stacks[0].Outputs[?OutputKey==`DistributionId`].OutputValue' \
            --output text 2>/dev/null || echo "")

        if [ -n "$DISTRIBUTION_ID" ]; then
            echo "Disabling distribution first..."

            # Get current config
            ETAG=$(aws cloudfront get-distribution-config \
                --id "$DISTRIBUTION_ID" \
                --query 'ETag' \
                --output text)

            aws cloudfront get-distribution-config \
                --id "$DISTRIBUTION_ID" \
                --query 'DistributionConfig' > /tmp/dist-config.json

            # Disable distribution
            jq '.Enabled = false' /tmp/dist-config.json > /tmp/dist-config-disabled.json

            aws cloudfront update-distribution \
                --id "$DISTRIBUTION_ID" \
                --distribution-config file:///tmp/dist-config-disabled.json \
                --if-match "$ETAG" > /dev/null

            rm /tmp/dist-config.json /tmp/dist-config-disabled.json

            echo "Waiting for distribution to be disabled (this may take several minutes)..."

            while true; do
                STATUS=$(aws cloudfront get-distribution \
                    --id "$DISTRIBUTION_ID" \
                    --query 'Distribution.Status' \
                    --output text)

                if [ "$STATUS" == "Deployed" ]; then
                    ENABLED=$(aws cloudfront get-distribution \
                        --id "$DISTRIBUTION_ID" \
                        --query 'Distribution.DistributionConfig.Enabled' \
                        --output text)

                    if [ "$ENABLED" == "False" ]; then
                        break
                    fi
                fi

                echo -n "."
                sleep 30
            done

            echo ""
            echo "Distribution disabled"
        fi

        # Delete CloudFormation stack
        echo "Deleting CloudFormation stack..."

        aws cloudformation delete-stack \
            --stack-name "$STACK_NAME" \
            --region us-east-1

        echo ""
        echo -e "${GREEN}✓ Stack deletion initiated${NC}"
        echo ""
        echo "To monitor deletion:"
        echo "  aws cloudformation describe-stacks --stack-name $STACK_NAME --region us-east-1"
        ;;

    status)
        echo -e "${BLUE}Getting distribution status...${NC}"
        echo ""

        # Check if stack exists
        STACK_STATUS=$(aws cloudformation describe-stacks \
            --stack-name "$STACK_NAME" \
            --region us-east-1 \
            --query 'Stacks[0].StackStatus' \
            --output text 2>/dev/null || echo "NOT_FOUND")

        if [ "$STACK_STATUS" == "NOT_FOUND" ]; then
            echo -e "${YELLOW}Stack not found: $STACK_NAME${NC}"
            exit 1
        fi

        echo "Stack Status: $STACK_STATUS"

        # Get distribution details
        DISTRIBUTION_ID=$(aws cloudformation describe-stacks \
            --stack-name "$STACK_NAME" \
            --region us-east-1 \
            --query 'Stacks[0].Outputs[?OutputKey==`DistributionId`].OutputValue' \
            --output text 2>/dev/null || echo "")

        if [ -z "$DISTRIBUTION_ID" ]; then
            echo "Distribution ID not available yet"
            exit 0
        fi

        echo "Distribution ID: $DISTRIBUTION_ID"
        echo ""

        # Get distribution status
        DIST_STATUS=$(aws cloudfront get-distribution \
            --id "$DISTRIBUTION_ID" \
            --query 'Distribution.Status' \
            --output text)

        DIST_ENABLED=$(aws cloudfront get-distribution \
            --id "$DISTRIBUTION_ID" \
            --query 'Distribution.DistributionConfig.Enabled' \
            --output text)

        DIST_DOMAIN=$(aws cloudfront get-distribution \
            --id "$DISTRIBUTION_ID" \
            --query 'Distribution.DomainName' \
            --output text)

        echo "Distribution Status: $DIST_STATUS"
        echo "Enabled: $DIST_ENABLED"
        echo "Domain: $DIST_DOMAIN"
        echo ""

        # Get cache statistics
        echo -e "${BLUE}Cache Statistics (last hour):${NC}"

        END_TIME=$(date -u +"%Y-%m-%dT%H:%M:%S")
        START_TIME=$(date -u -d '1 hour ago' +"%Y-%m-%dT%H:%M:%S" 2>/dev/null || date -u -v-1H +"%Y-%m-%dT%H:%M:%S")

        REQUESTS=$(aws cloudwatch get-metric-statistics \
            --namespace AWS/CloudFront \
            --metric-name Requests \
            --dimensions Name=DistributionId,Value=$DISTRIBUTION_ID \
            --start-time "$START_TIME" \
            --end-time "$END_TIME" \
            --period 3600 \
            --statistics Sum \
            --query 'Datapoints[0].Sum' \
            --output text 2>/dev/null || echo "0")

        BYTES_DOWNLOADED=$(aws cloudwatch get-metric-statistics \
            --namespace AWS/CloudFront \
            --metric-name BytesDownloaded \
            --dimensions Name=DistributionId,Value=$DISTRIBUTION_ID \
            --start-time "$START_TIME" \
            --end-time "$END_TIME" \
            --period 3600 \
            --statistics Sum \
            --query 'Datapoints[0].Sum' \
            --output text 2>/dev/null || echo "0")

        ERROR_RATE=$(aws cloudwatch get-metric-statistics \
            --namespace AWS/CloudFront \
            --metric-name 5xxErrorRate \
            --dimensions Name=DistributionId,Value=$DISTRIBUTION_ID \
            --start-time "$START_TIME" \
            --end-time "$END_TIME" \
            --period 3600 \
            --statistics Average \
            --query 'Datapoints[0].Average' \
            --output text 2>/dev/null || echo "0")

        BYTES_MB=$(echo "scale=2; $BYTES_DOWNLOADED / 1024 / 1024" | bc 2>/dev/null || echo "0")

        echo "  Requests: ${REQUESTS:-0}"
        echo "  Data Downloaded: ${BYTES_MB} MB"
        echo "  5xx Error Rate: ${ERROR_RATE:-0}%"
        ;;

    invalidate)
        echo -e "${BLUE}Invalidating CloudFront cache...${NC}"
        echo ""

        # Get distribution ID
        DISTRIBUTION_ID=$(aws cloudformation describe-stacks \
            --stack-name "$STACK_NAME" \
            --region us-east-1 \
            --query 'Stacks[0].Outputs[?OutputKey==`DistributionId`].OutputValue' \
            --output text 2>/dev/null || echo "")

        if [ -z "$DISTRIBUTION_ID" ]; then
            echo -e "${RED}Error: Distribution ID not found${NC}"
            exit 1
        fi

        echo "Distribution ID: $DISTRIBUTION_ID"
        echo ""

        # Invalidate all paths
        echo "Creating invalidation for all paths (/*) ..."

        INVALIDATION_ID=$(aws cloudfront create-invalidation \
            --distribution-id "$DISTRIBUTION_ID" \
            --paths "/*" \
            --query 'Invalidation.Id' \
            --output text)

        echo ""
        echo -e "${GREEN}✓ Invalidation created${NC}"
        echo "  Invalidation ID: $INVALIDATION_ID"
        echo ""
        echo "To check invalidation status:"
        echo "  aws cloudfront get-invalidation --distribution-id $DISTRIBUTION_ID --id $INVALIDATION_ID"
        ;;

    *)
        echo -e "${RED}Error: Unknown action: $ACTION${NC}"
        echo ""
        usage
        ;;
esac

echo ""
echo "=========================================="
echo -e "${GREEN}Operation Complete${NC}"
echo "=========================================="
echo ""
