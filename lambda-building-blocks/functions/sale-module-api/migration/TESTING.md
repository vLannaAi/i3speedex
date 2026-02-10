# Migration Testing Guide

## Overview

This guide covers testing the data migration from S9 PostgreSQL to DynamoDB using sample data and validation scripts.

---

## Quick Start

```bash
cd migration

# Run complete migration test
./test-migration.sh

# Dry run (no actual migration)
./test-migration.sh --dry-run

# Validate transformed data
./validate-migration.py test-output/transformed/
```

---

## Test Data

### Sample Data Overview

**File**: `test-data/s9-sample-data.sql`

**Contents**:
- **3 Buyers** (ACME, Tech Solutions, Global Imports)
- **2 Producers** (Farm Industries, Green Valley)
- **6 Sales** (various statuses: DRAFT, CONFIRMED, INVOICED, SHIPPED, DELIVERED)
- **7 Sale Lines** (linked to sales)
- **3 Certifications** (organic, fair trade)

**Status Distribution**:
- 1 Draft sale
- 2 Confirmed sales
- 1 Invoiced sale
- 1 Shipped sale
- 1 Delivered sale

**Buyer Status**:
- 2 Active buyers
- 1 Inactive buyer

### Loading Sample Data (Optional)

If testing with local PostgreSQL:

```bash
# Create test database
createdb sale_module_test

# Load sample data
psql sale_module_test < test-data/s9-sample-data.sql

# Verify
psql sale_module_test -c "SELECT COUNT(*) FROM vendas;"
```

---

## Test Script

### test-migration.sh

Automated test script that runs the complete ETL pipeline.

**Features**:
- Prerequisites checking
- Data extraction
- Data transformation
- Validation
- JSON test report generation
- Detailed logging

**Usage**:
```bash
# Full test
./test-migration.sh

# Dry run
./test-migration.sh --dry-run

# Help
./test-migration.sh --help
```

**Test Phases**:

1. **Prerequisites Check** (~1s)
   - Python 3 availability
   - Required packages (psycopg2, boto3)
   - Sample data file existence

2. **Setup Test Database** (~2s)
   - PostgreSQL availability check
   - Database connection verification

3. **Extract Data** (~5-10s)
   - Run extraction scripts
   - Count extracted records
   - Generate extract.log

4. **Transform Data** (~5-10s)
   - Run transformation scripts
   - Apply schema mapping
   - Generate transform.log

5. **Validate Data** (~2-5s)
   - Schema validation
   - Business rule validation
   - Generate validate.log

6. **Load Data** (skipped in test)
   - Would load to DynamoDB test environment
   - Skipped to avoid AWS charges

**Total Duration**: ~15-30 seconds

### Output Files

**Directory**: `migration/test-output/`

```
test-output/
├── buyers.json                    # Extracted buyers
├── producers.json                 # Extracted producers
├── sales.json                     # Extracted sales
├── extract.log                    # Extraction log
├── transform.log                  # Transformation log
├── validate.log                   # Validation log
├── test-report-YYYYMMDD-HHMMSS.json  # Test report
│
└── transformed/                   # Transformed data
    ├── buyers.json               # DynamoDB format
    ├── producers.json            # DynamoDB format
    ├── sales.json                # DynamoDB format
    └── validation-report.json    # Validation results
```

### Test Report Format

```json
{
  "testId": "migration-test-20260130-150000",
  "timestamp": "2026-01-30T15:00:00Z",
  "dryRun": false,
  "status": "PASSED",
  "phases": {
    "prerequisites": { "duration": 1, "status": "completed" },
    "setup": { "duration": 2, "status": "completed" },
    "extract": {
      "duration": 8,
      "status": "completed",
      "records": {
        "buyers": 3,
        "producers": 2,
        "sales": 6
      }
    },
    "transform": { "duration": 7, "status": "completed" },
    "validate": {
      "duration": 3,
      "status": "completed",
      "errors": 0
    },
    "load": { "duration": 0, "status": "skipped" }
  },
  "metrics": {
    "totalRecords": 11,
    "successfulRecords": 11,
    "failedRecords": 0,
    "duration": 21
  }
}
```

---

## Validation Script

### validate-migration.py

Python script for comprehensive data validation.

**Features**:
- Schema validation
- Business rule validation
- Format validation
- Detailed error reporting
- JSON validation report

**Usage**:
```bash
# Validate transformed data
./validate-migration.py test-output/transformed/

# Output validation report
cat test-output/transformed/validation-report.json | jq .
```

**Validation Checks**:

#### Sale Validation
- ✅ Required fields present
- ✅ PK format (`SALE#[ID]`)
- ✅ SK value (`#METADATA#sale`)
- ✅ Status enum validation
- ✅ Numeric field types and values
- ✅ Date format (ISO 8601)
- ✅ GSI key formats
- ⚠️ Total calculation (Subtotal - Discount + Tax)

#### Buyer Validation
- ✅ Required fields present
- ✅ PK format (`BUYER#[ID]`)
- ✅ SK value (`#METADATA#buyer`)
- ✅ Status enum validation
- ✅ GSI1PK value (`BUYERS`)
- ✅ GSI1SK format

#### Producer Validation
- ✅ Required fields present
- ✅ PK format (`PRODUCER#[ID]`)
- ✅ SK value (`#METADATA#producer`)
- ✅ Status enum validation
- ✅ GSI1PK value (`PRODUCERS`)
- ✅ GSI1SK format

### Validation Report Format

```json
{
  "timestamp": "2026-01-30T15:00:00Z",
  "summary": {
    "totalRecords": 11,
    "validRecords": 11,
    "invalidRecords": 0,
    "errorCount": 0,
    "warningCount": 1
  },
  "statistics": {
    "buyers": { "count": 3, "valid": 3, "invalid": 0 },
    "producers": { "count": 2, "valid": 2, "invalid": 0 },
    "sales": { "count": 6, "valid": 6, "invalid": 0 }
  },
  "errors": [],
  "warnings": [
    "Sale SALE001: Total mismatch. Expected 27550.0, got 27550.0"
  ]
}
```

---

## Manual Testing

### Step-by-Step Manual Test

#### 1. Extract Phase

```bash
# Run extraction
python3 migrate.py extract --config config.json --output test-output

# Verify extracted files
ls -lh test-output/

# Check record counts
jq '. | length' test-output/buyers.json
jq '. | length' test-output/producers.json
jq '. | length' test-output/sales.json

# Inspect sample record
jq '.[0]' test-output/buyers.json
```

#### 2. Transform Phase

```bash
# Run transformation
python3 migrate.py transform \
  --config config.json \
  --input test-output \
  --output test-output/transformed

# Verify transformed files
ls -lh test-output/transformed/

# Check schema compliance
jq '.[0]' test-output/transformed/sales.json

# Verify keys
jq '.[0] | {PK, SK, GSI1PK, GSI1SK, GSI2PK, GSI2SK, GSI3PK, GSI3SK}' test-output/transformed/sales.json
```

#### 3. Validate Phase

```bash
# Run validation
python3 validate-migration.py test-output/transformed/

# Check validation report
cat test-output/transformed/validation-report.json | jq .

# Check for errors
jq '.errors' test-output/transformed/validation-report.json

# Check statistics
jq '.statistics' test-output/transformed/validation-report.json
```

#### 4. Load Phase (Manual)

```bash
# Load to DynamoDB (requires AWS credentials)
python3 migrate.py load \
  --config config.json \
  --input test-output/transformed \
  --table SalesTable-dev

# Verify in DynamoDB
aws dynamodb scan --table-name SalesTable-dev --max-items 10

# Count records
aws dynamodb scan --table-name SalesTable-dev \
  --select COUNT \
  --filter-expression "EntityType = :type" \
  --expression-attribute-values '{":type":{"S":"Sale"}}'
```

---

## Test Scenarios

### Scenario 1: Happy Path

**Description**: All data valid, no errors

**Steps**:
1. Run `./test-migration.sh`
2. Verify all phases complete successfully
3. Check validation report shows 0 errors
4. Inspect transformed data

**Expected Result**:
- ✅ All 11 records extracted
- ✅ All 11 records transformed
- ✅ 0 validation errors
- ✅ Test status: PASSED

### Scenario 2: Invalid Status

**Description**: Test with invalid sale status

**Steps**:
1. Modify S9 data to include invalid status
2. Run extraction and transformation
3. Run validation
4. Check validation report

**Expected Result**:
- ✅ Extraction succeeds
- ✅ Transformation succeeds (with warning)
- ❌ Validation fails with error
- ❌ Test status: FAILED

### Scenario 3: Missing Required Field

**Description**: Test with missing required field

**Steps**:
1. Modify extracted data to remove required field
2. Run transformation
3. Run validation

**Expected Result**:
- ❌ Validation fails
- ❌ Error: "Missing required field"
- ❌ Test status: FAILED

### Scenario 4: Date Format Validation

**Description**: Test date format handling

**Steps**:
1. Check various date formats in source
2. Run transformation
3. Verify ISO 8601 format in output

**Expected Result**:
- ✅ All dates converted to ISO 8601
- ✅ Dates sortable in DynamoDB
- ✅ Validation passes

### Scenario 5: GSI Key Generation

**Description**: Verify GSI keys generated correctly

**Steps**:
1. Run transformation
2. Check GSI keys in output
3. Verify key patterns

**Expected Result**:
- ✅ GSI1PK: `BUYER#{id}` or `BUYERS`
- ✅ GSI1SK: `SALE#{date}` or `BUYER#{name}`
- ✅ GSI2PK: `PRODUCER#{id}` or `PRODUCERS`
- ✅ GSI2SK: `SALE#{date}` or `PRODUCER#{name}`
- ✅ GSI3PK: `STATUS#{status}`
- ✅ GSI3SK: `SALE#{date}`

---

## Performance Testing

### Load Test Parameters

**Objective**: Verify migration can handle production volumes

**Test Data**:
- 10,000 sales
- 500 buyers
- 200 producers

**Performance Targets**:
- Extraction: < 60 seconds
- Transformation: < 120 seconds
- Validation: < 30 seconds
- Load: < 180 seconds
- **Total**: < 6 minutes

### Running Load Test

```bash
# Generate large test dataset
python3 generate-test-data.py --sales 10000 --output test-data/large-dataset.sql

# Load to test database
psql sale_module_test < test-data/large-dataset.sql

# Run migration with timing
time ./test-migration.sh

# Check performance metrics
jq '.metrics.duration' test-output/test-report-*.json
```

---

## Troubleshooting

### Common Issues

#### 1. Python Package Missing

**Error**: `ModuleNotFoundError: No module named 'psycopg2'`

**Solution**:
```bash
pip3 install psycopg2-binary boto3
```

#### 2. PostgreSQL Connection Failed

**Error**: `psycopg2.OperationalError: could not connect to server`

**Solution**:
- Check PostgreSQL is running
- Verify connection parameters in config.json
- Test connection: `psql -h localhost -U postgres`

#### 3. File Not Found

**Error**: `FileNotFoundError: buyers.json`

**Solution**:
- Run extraction phase first
- Check output directory exists
- Verify extraction completed successfully

#### 4. Validation Errors

**Error**: `Validation FAILED: 10 errors`

**Solution**:
- Check validation-report.json for details
- Review transformation logic
- Fix data issues in source or transformer

#### 5. AWS Credentials Not Found

**Error**: `NoCredentialsError: Unable to locate credentials`

**Solution**:
```bash
# Configure AWS credentials
aws configure

# Or set environment variables
export AWS_ACCESS_KEY_ID=your_key
export AWS_SECRET_ACCESS_KEY=your_secret
export AWS_DEFAULT_REGION=us-east-1
```

---

## Best Practices

### Testing Workflow

1. **Start Small**: Test with sample data first
2. **Validate Early**: Run validation after each phase
3. **Check Logs**: Review logs for warnings
4. **Incremental**: Test one entity type at a time
5. **Automate**: Use test scripts for consistency

### Data Quality

1. **Review Source Data**: Check S9 data quality before migration
2. **Handle Nulls**: Test with null values in optional fields
3. **Edge Cases**: Test boundary values (zero, negative, very large)
4. **Special Characters**: Test with special characters in strings
5. **Date Ranges**: Test with various date formats and timezones

### Performance

1. **Batch Size**: Test different batch sizes for optimal performance
2. **Parallel Processing**: Enable parallel processing for large datasets
3. **Memory Usage**: Monitor memory during large migrations
4. **Network**: Test with production-like network conditions
5. **Checkpoints**: Use checkpoints for resumable migrations

---

## CI/CD Integration

### GitHub Actions Example

```yaml
name: Migration Test

on:
  pull_request:
    paths:
      - 'migration/**'

jobs:
  test:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v2

      - name: Set up Python
        uses: actions/setup-python@v2
        with:
          python-version: '3.9'

      - name: Install dependencies
        run: |
          pip install psycopg2-binary boto3

      - name: Run migration test
        run: |
          cd migration
          ./test-migration.sh

      - name: Upload test report
        if: always()
        uses: actions/upload-artifact@v2
        with:
          name: migration-test-report
          path: migration/test-output/
```

---

## Success Criteria

### Test Pass Criteria

✅ All phases complete without errors
✅ All extracted records match source count
✅ All transformed records validate successfully
✅ Schema compliance: 100%
✅ Business rule compliance: 100%
✅ No validation errors
✅ Performance within targets

### Production Readiness Checklist

- [ ] Sample data test passed
- [ ] Load test passed (10K+ records)
- [ ] All entity types tested
- [ ] All status values tested
- [ ] Date format validation passed
- [ ] GSI key generation validated
- [ ] Business rules validated
- [ ] Performance targets met
- [ ] Error handling tested
- [ ] Rollback procedure tested
- [ ] Documentation updated
- [ ] Team training completed

---

## Next Steps

1. **Run Sample Test**
   ```bash
   ./test-migration.sh
   ```

2. **Review Results**
   - Check test report
   - Inspect transformed data
   - Review validation report

3. **Fix Issues**
   - Address validation errors
   - Optimize transformation logic
   - Update documentation

4. **Run Full Test**
   - Test with production-like data volume
   - Measure performance
   - Verify all edge cases

5. **Production Migration**
   - Schedule maintenance window
   - Run migration to staging first
   - Verify and test
   - Deploy to production
   - Monitor and validate

---

## Support

For issues or questions:
- **Migration Issues**: #data-migration Slack channel
- **DynamoDB Schema**: See schema/dynamodb-schema.md
- **Test Scripts**: See migration/README.md
- **AWS Issues**: #infrastructure Slack channel
