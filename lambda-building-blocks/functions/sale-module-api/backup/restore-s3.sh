#!/bin/bash
set -e

# Sale Module API - S3 Restore Script
# Restores S3 files from backups or previous versions

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Default values
SOURCE=""
TARGET=""
VERSION_ID=""
DRY_RUN=false

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --source|-s)
            SOURCE="$2"
            shift 2
            ;;
        --target|-t)
            TARGET="$2"
            shift 2
            ;;
        --version-id)
            VERSION_ID="$2"
            shift 2
            ;;
        --dry-run)
            DRY_RUN=true
            shift
            ;;
        --help|-h)
            echo "Usage: $0 [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  --source, -s PATH       Source S3 path (s3://bucket/prefix)"
            echo "  --target, -t PATH       Target S3 path or local path"
            echo "  --version-id ID         Restore specific version (for single file)"
            echo "  --dry-run               Show what would be restored without doing it"
            echo "  --help, -h              Show this help"
            echo ""
            echo "Examples:"
            echo "  # Restore entire bucket from backup"
            echo "  $0 --source s3://backups/attachments/20260130/ --target s3://attachments-prod/"
            echo ""
            echo "  # Restore specific file version"
            echo "  $0 --source s3://attachments/doc.pdf --target ./doc-restored.pdf --version-id abc123"
            echo ""
            echo "  # Dry run"
            echo "  $0 --source s3://backups/invoices/ --target s3://invoices-prod/ --dry-run"
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            exit 1
            ;;
    esac
done

# Validation
if [ -z "$SOURCE" ]; then
    echo -e "${RED}Error: --source is required${NC}"
    exit 1
fi

if [ -z "$TARGET" ]; then
    echo -e "${RED}Error: --target is required${NC}"
    exit 1
fi

echo "=========================================="
echo "S3 Restore"
echo "=========================================="
echo "Source: $SOURCE"
echo "Target: $TARGET"
if [ "$DRY_RUN" = true ]; then
    echo "Mode: DRY RUN (no changes will be made)"
fi
echo ""

# Check if restoring specific version
if [ -n "$VERSION_ID" ]; then
    echo -e "${YELLOW}Restoring specific version: $VERSION_ID${NC}"

    # Extract bucket and key from source
    SOURCE_BUCKET=$(echo "$SOURCE" | sed 's|s3://||' | cut -d/ -f1)
    SOURCE_KEY=$(echo "$SOURCE" | sed 's|s3://||' | cut -d/ -f2-)

    if [[ "$TARGET" == s3://* ]]; then
        # Restore to S3
        TARGET_BUCKET=$(echo "$TARGET" | sed 's|s3://||' | cut -d/ -f1)
        TARGET_KEY=$(echo "$TARGET" | sed 's|s3://||' | cut -d/ -f2-)

        if [ "$DRY_RUN" = false ]; then
            echo -e "${YELLOW}Copying versioned object...${NC}"
            aws s3api copy-object \
                --copy-source "${SOURCE_BUCKET}/${SOURCE_KEY}?versionId=${VERSION_ID}" \
                --bucket "$TARGET_BUCKET" \
                --key "$TARGET_KEY" \
                --region ${AWS_REGION:-us-east-1}
            echo -e "${GREEN}✓ Version restored to S3${NC}"
        else
            echo "Would copy: s3://${SOURCE_BUCKET}/${SOURCE_KEY}?versionId=${VERSION_ID} -> s3://${TARGET_BUCKET}/${TARGET_KEY}"
        fi
    else
        # Restore to local file
        if [ "$DRY_RUN" = false ]; then
            echo -e "${YELLOW}Downloading versioned object...${NC}"
            aws s3api get-object \
                --bucket "$SOURCE_BUCKET" \
                --key "$SOURCE_KEY" \
                --version-id "$VERSION_ID" \
                "$TARGET" \
                --region ${AWS_REGION:-us-east-1}
            echo -e "${GREEN}✓ Version restored to $TARGET${NC}"
        else
            echo "Would download: s3://${SOURCE_BUCKET}/${SOURCE_KEY}?versionId=${VERSION_ID} -> $TARGET"
        fi
    fi

else
    # Sync/restore entire prefix
    echo -e "${YELLOW}Calculating restore size...${NC}"

    SIZE_OUTPUT=$(aws s3 ls "$SOURCE" --recursive --summarize --region ${AWS_REGION:-us-east-1} 2>&1 | tail -2)
    TOTAL_OBJECTS=$(echo "$SIZE_OUTPUT" | grep "Total Objects:" | awk '{print $3}')
    TOTAL_SIZE=$(echo "$SIZE_OUTPUT" | grep "Total Size:" | awk '{print $3}')

    if [ -n "$TOTAL_SIZE" ] && [ "$TOTAL_SIZE" != "0" ]; then
        TOTAL_SIZE_MB=$(echo "scale=2; $TOTAL_SIZE / 1024 / 1024" | bc)
        echo "  Objects: $TOTAL_OBJECTS"
        echo "  Size: ${TOTAL_SIZE_MB} MB"
    else
        echo -e "${YELLOW}Warning: Could not calculate size or source is empty${NC}"
    fi

    echo ""

    # Build sync command
    SYNC_CMD="aws s3 sync \"$SOURCE\" \"$TARGET\" --region ${AWS_REGION:-us-east-1}"

    if [ "$DRY_RUN" = true ]; then
        SYNC_CMD="$SYNC_CMD --dryrun"
    fi

    echo -e "${YELLOW}Starting restore...${NC}"
    if [ "$DRY_RUN" = false ]; then
        echo "This may take several minutes depending on data size..."
    fi
    echo ""

    # Execute sync
    eval $SYNC_CMD

    if [ "$DRY_RUN" = false ]; then
        echo ""
        echo -e "${GREEN}✓ Restore completed${NC}"
    else
        echo ""
        echo -e "${YELLOW}Dry run completed (no changes made)${NC}"
    fi
fi

echo ""
echo "=========================================="
if [ "$DRY_RUN" = true ]; then
    echo -e "${YELLOW}Dry Run Complete${NC}"
    echo "=========================================="
    echo "Remove --dry-run flag to perform actual restore"
else
    echo -e "${GREEN}Restore Completed Successfully!${NC}"
    echo "=========================================="
    echo ""
    echo "Next steps:"
    echo "1. Verify restored files"
    echo "2. Check file permissions and metadata"
    echo "3. Test application access to restored files"
fi
echo ""
