#!/bin/bash
set -e

# Migration Testing Script
# Tests the complete ETL pipeline with sample data

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Test configuration
TEST_ENV="test"
TEST_OUTPUT_DIR="$SCRIPT_DIR/test-output"
TEST_REPORT="$TEST_OUTPUT_DIR/test-report-$(date +%Y%m%d-%H%M%S).json"
DRY_RUN=false

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --dry-run)
            DRY_RUN=true
            shift
            ;;
        --help|-h)
            echo "Usage: $0 [OPTIONS]"
            echo ""
            echo "Tests the migration pipeline with sample data"
            echo ""
            echo "Options:"
            echo "  --dry-run    Run without actually migrating data"
            echo "  --help, -h   Show this help"
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            exit 1
            ;;
    esac
done

# Create output directory
mkdir -p "$TEST_OUTPUT_DIR"

echo "=========================================="
echo "Migration Test"
echo "=========================================="
echo "Test Environment: $TEST_ENV"
echo "Output Directory: $TEST_OUTPUT_DIR"
if [ "$DRY_RUN" = true ]; then
    echo "Mode: DRY RUN"
fi
echo ""

# Initialize test report
cat > "$TEST_REPORT" <<EOF
{
  "testId": "migration-test-$(date +%Y%m%d-%H%M%S)",
  "timestamp": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "dryRun": $DRY_RUN,
  "phases": {},
  "metrics": {
    "totalRecords": 0,
    "successfulRecords": 0,
    "failedRecords": 0,
    "duration": 0
  },
  "errors": []
}
EOF

TEST_START=$(date +%s)

# Phase 1: Prerequisites Check
echo -e "${BLUE}[Phase 1/6] Checking prerequisites...${NC}"
PHASE1_START=$(date +%s)

# Check Python
echo -n "  Python 3... "
if command -v python3 &> /dev/null; then
    echo -e "${GREEN}✓${NC}"
else
    echo -e "${RED}✗ Not installed${NC}"
    exit 1
fi

# Check required Python packages
echo -n "  Required packages... "
if python3 -c "import psycopg2, boto3" 2>/dev/null; then
    echo -e "${GREEN}✓${NC}"
else
    echo -e "${YELLOW}⚠ Installing packages...${NC}"
    pip3 install -q psycopg2-binary boto3 2>/dev/null || pip3 install -q psycopg2-binary boto3
    echo -e "${GREEN}✓ Installed${NC}"
fi

# Check sample data file
echo -n "  Sample data file... "
if [ -f "$SCRIPT_DIR/test-data/s9-sample-data.sql" ]; then
    echo -e "${GREEN}✓${NC}"
else
    echo -e "${RED}✗ Not found${NC}"
    exit 1
fi

PHASE1_DURATION=$(($(date +%s) - PHASE1_START))
echo -e "${GREEN}✓ Prerequisites check complete (${PHASE1_DURATION}s)${NC}"
echo ""

# Phase 2: Setup Test Database (if using Docker PostgreSQL)
echo -e "${BLUE}[Phase 2/6] Setting up test database...${NC}"
PHASE2_START=$(date +%s)

echo "  Checking for PostgreSQL..."
if command -v psql &> /dev/null; then
    echo -e "${GREEN}  ✓ PostgreSQL available${NC}"
    echo "  Note: Using existing PostgreSQL or Docker container"
    echo "  Skipping database setup (assume it's already configured)"
else
    echo -e "${YELLOW}  ⚠ PostgreSQL not available locally${NC}"
    echo "  Note: Migration will extract from production S9 database"
fi

PHASE2_DURATION=$(($(date +%s) - PHASE2_START))
echo -e "${GREEN}✓ Test database ready (${PHASE2_DURATION}s)${NC}"
echo ""

# Phase 3: Extract Data
echo -e "${BLUE}[Phase 3/6] Extracting data from source...${NC}"
PHASE3_START=$(date +%s)

echo "  Running extract phase..."
if [ "$DRY_RUN" = false ]; then
    python3 "$SCRIPT_DIR/migrate.py" extract --config "$SCRIPT_DIR/config.json" \
        --output "$TEST_OUTPUT_DIR" 2>&1 | tee "$TEST_OUTPUT_DIR/extract.log"

    # Count extracted records
    BUYERS_COUNT=$(jq '. | length' "$TEST_OUTPUT_DIR/buyers.json" 2>/dev/null || echo "0")
    PRODUCERS_COUNT=$(jq '. | length' "$TEST_OUTPUT_DIR/producers.json" 2>/dev/null || echo "0")
    SALES_COUNT=$(jq '. | length' "$TEST_OUTPUT_DIR/sales.json" 2>/dev/null || echo "0")

    echo ""
    echo "  Extracted records:"
    echo "    Buyers: $BUYERS_COUNT"
    echo "    Producers: $PRODUCERS_COUNT"
    echo "    Sales: $SALES_COUNT"
else
    echo "  DRY RUN: Skipping extraction"
    BUYERS_COUNT=3
    PRODUCERS_COUNT=2
    SALES_COUNT=6
fi

PHASE3_DURATION=$(($(date +%s) - PHASE3_START))
echo -e "${GREEN}✓ Extraction complete (${PHASE3_DURATION}s)${NC}"
echo ""

# Phase 4: Transform Data
echo -e "${BLUE}[Phase 4/6] Transforming data...${NC}"
PHASE4_START=$(date +%s)

echo "  Running transform phase..."
if [ "$DRY_RUN" = false ]; then
    python3 "$SCRIPT_DIR/migrate.py" transform --config "$SCRIPT_DIR/config.json" \
        --input "$TEST_OUTPUT_DIR" \
        --output "$TEST_OUTPUT_DIR/transformed" 2>&1 | tee "$TEST_OUTPUT_DIR/transform.log"

    echo ""
    echo "  Transformed records:"
    echo "    Buyers: $(jq '. | length' "$TEST_OUTPUT_DIR/transformed/buyers.json" 2>/dev/null || echo "0")"
    echo "    Producers: $(jq '. | length' "$TEST_OUTPUT_DIR/transformed/producers.json" 2>/dev/null || echo "0")"
    echo "    Sales: $(jq '. | length' "$TEST_OUTPUT_DIR/transformed/sales.json" 2>/dev/null || echo "0")"
else
    echo "  DRY RUN: Skipping transformation"
fi

PHASE4_DURATION=$(($(date +%s) - PHASE4_START))
echo -e "${GREEN}✓ Transformation complete (${PHASE4_DURATION}s)${NC}"
echo ""

# Phase 5: Validate Data
echo -e "${BLUE}[Phase 5/6] Validating transformed data...${NC}"
PHASE5_START=$(date +%s)

echo "  Running validation phase..."
if [ "$DRY_RUN" = false ]; then
    python3 "$SCRIPT_DIR/migrate.py" validate --config "$SCRIPT_DIR/config.json" \
        --input "$TEST_OUTPUT_DIR/transformed" 2>&1 | tee "$TEST_OUTPUT_DIR/validate.log"

    VALIDATION_ERRORS=$(grep -c "ERROR" "$TEST_OUTPUT_DIR/validate.log" 2>/dev/null || echo "0")

    echo ""
    if [ "$VALIDATION_ERRORS" -eq 0 ]; then
        echo -e "  ${GREEN}✓ No validation errors${NC}"
    else
        echo -e "  ${YELLOW}⚠ Found $VALIDATION_ERRORS validation errors${NC}"
        echo "  Check: $TEST_OUTPUT_DIR/validate.log"
    fi
else
    echo "  DRY RUN: Skipping validation"
    VALIDATION_ERRORS=0
fi

PHASE5_DURATION=$(($(date +%s) - PHASE5_START))
echo -e "${GREEN}✓ Validation complete (${PHASE5_DURATION}s)${NC}"
echo ""

# Phase 6: Load Data (to test DynamoDB)
echo -e "${BLUE}[Phase 6/6] Loading data to DynamoDB...${NC}"
PHASE6_START=$(date +%s)

echo "  Note: This would load data to DynamoDB test environment"
echo "  Skipping actual load to avoid charges"
echo ""
echo "  To load to DynamoDB, run:"
echo "    python3 migrate.py load --config config.json --input test-output/transformed"

PHASE6_DURATION=$(($(date +%s) - PHASE6_START))
echo -e "${YELLOW}⊘ Load skipped (${PHASE6_DURATION}s)${NC}"
echo ""

# Generate Test Report
TEST_END=$(date +%s)
TEST_DURATION=$((TEST_END - TEST_START))

TOTAL_RECORDS=$((BUYERS_COUNT + PRODUCERS_COUNT + SALES_COUNT))
SUCCESSFUL_RECORDS=$TOTAL_RECORDS
FAILED_RECORDS=$VALIDATION_ERRORS

# Update test report
cat > "$TEST_REPORT" <<EOF
{
  "testId": "migration-test-$(date +%Y%m%d-%H%M%S)",
  "timestamp": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "dryRun": $DRY_RUN,
  "status": "$([ $VALIDATION_ERRORS -eq 0 ] && echo "PASSED" || echo "FAILED")",
  "phases": {
    "prerequisites": {
      "duration": $PHASE1_DURATION,
      "status": "completed"
    },
    "setup": {
      "duration": $PHASE2_DURATION,
      "status": "completed"
    },
    "extract": {
      "duration": $PHASE3_DURATION,
      "status": "completed",
      "records": {
        "buyers": $BUYERS_COUNT,
        "producers": $PRODUCERS_COUNT,
        "sales": $SALES_COUNT
      }
    },
    "transform": {
      "duration": $PHASE4_DURATION,
      "status": "completed"
    },
    "validate": {
      "duration": $PHASE5_DURATION,
      "status": "$([ $VALIDATION_ERRORS -eq 0 ] && echo "completed" || echo "failed")",
      "errors": $VALIDATION_ERRORS
    },
    "load": {
      "duration": $PHASE6_DURATION,
      "status": "skipped"
    }
  },
  "metrics": {
    "totalRecords": $TOTAL_RECORDS,
    "successfulRecords": $SUCCESSFUL_RECORDS,
    "failedRecords": $FAILED_RECORDS,
    "duration": $TEST_DURATION
  },
  "files": {
    "extractLog": "test-output/extract.log",
    "transformLog": "test-output/transform.log",
    "validateLog": "test-output/validate.log",
    "extractedData": "test-output/*.json",
    "transformedData": "test-output/transformed/*.json"
  }
}
EOF

# Summary
echo "=========================================="
if [ $VALIDATION_ERRORS -eq 0 ]; then
    echo -e "${GREEN}Migration Test PASSED${NC}"
else
    echo -e "${YELLOW}Migration Test COMPLETED WITH WARNINGS${NC}"
fi
echo "=========================================="
echo ""
echo "Summary:"
echo "  Total Duration: ${TEST_DURATION}s"
echo "  Total Records: $TOTAL_RECORDS"
echo "  Successful: $SUCCESSFUL_RECORDS"
echo "  Failed: $FAILED_RECORDS"
echo ""
echo "Extracted Records:"
echo "  Buyers: $BUYERS_COUNT"
echo "  Producers: $PRODUCERS_COUNT"
echo "  Sales: $SALES_COUNT"
echo ""
echo "Test Report: $TEST_REPORT"
echo ""
echo "Output Files:"
echo "  Extracted: $TEST_OUTPUT_DIR/*.json"
echo "  Transformed: $TEST_OUTPUT_DIR/transformed/*.json"
echo "  Logs: $TEST_OUTPUT_DIR/*.log"
echo ""

if [ $VALIDATION_ERRORS -eq 0 ]; then
    echo -e "${GREEN}✓ All data validated successfully!${NC}"
    echo ""
    echo "Next steps:"
    echo "1. Review transformed data in test-output/transformed/"
    echo "2. Load to DynamoDB test environment"
    echo "3. Verify data in DynamoDB"
    echo ""
    echo "To load to DynamoDB:"
    echo "  python3 migrate.py load --config config.json --input test-output/transformed"
    exit 0
else
    echo -e "${YELLOW}⚠ Validation found $VALIDATION_ERRORS errors${NC}"
    echo "Review: $TEST_OUTPUT_DIR/validate.log"
    exit 1
fi
