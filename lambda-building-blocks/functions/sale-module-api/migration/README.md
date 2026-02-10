# Data Migration Guide

## Overview

This directory contains scripts and tools for migrating data from the legacy S9 system to the new AWS-based Sale Module API.

## Migration Strategy

The migration follows a phased approach:

1. **Extract** - Pull data from S9 database
2. **Transform** - Convert to new DynamoDB schema
3. **Validate** - Verify data integrity
4. **Load** - Import into DynamoDB
5. **Verify** - Confirm successful migration

## Prerequisites

### Software Requirements

- **Node.js** 18.x or higher
- **Python** 3.9 or higher
- **AWS CLI** 2.x configured with appropriate credentials
- **Database Access** to legacy S9 system

### Python Dependencies

```bash
cd migration
pip install -r requirements.txt
```

### AWS Permissions

Required IAM permissions:
- DynamoDB: PutItem, BatchWriteItem, Scan, Query
- S3: PutObject, GetObject (for migration artifacts)
- CloudWatch Logs: CreateLogGroup, PutLogEvents

## Directory Structure

```
migration/
├── README.md                    # This file
├── requirements.txt             # Python dependencies
├── config.json.example          # Configuration template
├── extract/                     # Extract data from S9
│   ├── extract_buyers.py
│   ├── extract_producers.py
│   ├── extract_sales.py
│   └── database.py             # Database connection utilities
├── transform/                   # Transform to new schema
│   ├── transform_buyers.py
│   ├── transform_producers.py
│   ├── transform_sales.py
│   └── schema_mapping.py       # Field mappings
├── load/                        # Load into DynamoDB
│   ├── load_buyers.py
│   ├── load_producers.py
│   ├── load_sales.py
│   └── dynamodb_client.py      # DynamoDB utilities
├── validate/                    # Validation scripts
│   ├── validate_data.py
│   ├── compare_counts.py
│   └── integrity_checks.py
├── utils/                       # Shared utilities
│   ├── logger.py
│   ├── progress.py
│   └── error_handler.py
├── data/                        # Extracted/transformed data
│   ├── extracted/              # Raw S9 data (gitignored)
│   ├── transformed/            # Transformed data (gitignored)
│   └── reports/                # Migration reports
└── migrate.py                   # Main migration orchestrator
```

## Quick Start

### 1. Configuration

Copy and configure the migration settings:

```bash
cd migration
cp config.json.example config.json
# Edit config.json with your settings
```

### 2. Dry Run

Test the migration without making changes:

```bash
python migrate.py --dry-run
```

### 3. Extract Phase

Extract data from S9 database:

```bash
python migrate.py --phase extract
```

### 4. Transform Phase

Transform extracted data to new schema:

```bash
python migrate.py --phase transform
```

### 5. Validate Phase

Validate transformed data:

```bash
python migrate.py --phase validate
```

### 6. Load Phase

Load data into DynamoDB:

```bash
python migrate.py --phase load
```

### 7. Full Migration

Run complete migration end-to-end:

```bash
python migrate.py --full
```

## Configuration

Edit `config.json` with your environment settings:

```json
{
  "source": {
    "type": "postgresql",
    "host": "s9-database.internal",
    "port": 5432,
    "database": "s9_production",
    "username": "migration_user",
    "password": "${DB_PASSWORD}",
    "ssl": true
  },
  "target": {
    "region": "us-east-1",
    "salesTable": "SalesTable-dev",
    "buyersTable": "BuyersTable-dev",
    "producersTable": "ProducersTable-dev"
  },
  "migration": {
    "batchSize": 25,
    "maxRetries": 3,
    "continueOnError": false,
    "backupBeforeLoad": true
  }
}
```

## Migration Phases

### Phase 1: Extract

Extracts data from S9 database and saves to JSON files:

```bash
python migrate.py --phase extract [--entity buyers|producers|sales]
```

**Output**: `data/extracted/buyers.json`, `producers.json`, `sales.json`

**Features**:
- Progress tracking
- Error handling
- Incremental extraction
- Data validation

### Phase 2: Transform

Transforms extracted data to match new DynamoDB schema:

```bash
python migrate.py --phase transform [--entity buyers|producers|sales]
```

**Output**: `data/transformed/buyers.json`, `producers.json`, `sales.json`

**Features**:
- Field mapping
- Data type conversion
- Default value assignment
- ID generation
- Timestamp formatting

### Phase 3: Validate

Validates transformed data before loading:

```bash
python migrate.py --phase validate
```

**Checks**:
- Required fields present
- Data type correctness
- Foreign key references
- Business rule validation
- Duplicate detection

**Output**: `data/reports/validation_report.json`

### Phase 4: Load

Loads transformed data into DynamoDB:

```bash
python migrate.py --phase load [--entity buyers|producers|sales]
```

**Features**:
- Batch writing for performance
- Retry logic for failures
- Progress tracking
- Rollback on critical errors
- Backup creation

**Output**: `data/reports/load_report.json`

## Command Reference

### Main Orchestrator

```bash
# Full migration
python migrate.py --full

# Single phase
python migrate.py --phase extract|transform|validate|load

# Specific entity
python migrate.py --phase extract --entity buyers

# Dry run mode
python migrate.py --dry-run

# With custom config
python migrate.py --config custom-config.json

# Verbose output
python migrate.py --verbose

# Resume from checkpoint
python migrate.py --resume
```

### Individual Scripts

```bash
# Extract buyers
python extract/extract_buyers.py --output data/extracted/buyers.json

# Transform producers
python transform/transform_producers.py \
  --input data/extracted/producers.json \
  --output data/transformed/producers.json

# Load sales
python load/load_sales.py \
  --input data/transformed/sales.json \
  --table SalesTable-dev

# Validate all data
python validate/validate_data.py --input data/transformed/
```

## Error Handling

### Automatic Retry

Failed operations are automatically retried based on configuration:

```json
{
  "migration": {
    "maxRetries": 3,
    "retryDelay": 5,
    "exponentialBackoff": true
  }
}
```

### Error Logs

Errors are logged to:
- Console (with colors)
- `data/reports/migration_errors.log`
- CloudWatch Logs (if configured)

### Resume Capability

If migration fails, resume from last checkpoint:

```bash
python migrate.py --resume
```

Checkpoint file: `data/.checkpoint.json`

## Data Backup

### Automatic Backup

Before loading, DynamoDB tables are automatically backed up:

```bash
# Backup created at
data/backups/SalesTable-dev-20260130-150000.json
```

### Manual Backup

```bash
python utils/backup.py --table SalesTable-dev
```

### Restore from Backup

```bash
python utils/restore.py --backup data/backups/SalesTable-dev-20260130-150000.json
```

## Validation Reports

After migration, review validation reports:

### Data Count Report

```bash
cat data/reports/count_comparison.json
```

```json
{
  "buyers": {
    "source": 1250,
    "target": 1250,
    "match": true
  },
  "producers": {
    "source": 430,
    "target": 430,
    "match": true
  },
  "sales": {
    "source": 8542,
    "target": 8542,
    "match": true
  }
}
```

### Data Integrity Report

```bash
cat data/reports/integrity_report.json
```

Checks:
- Foreign key references
- Required fields
- Data type consistency
- Business rule compliance

## Incremental Migration

For large datasets, migrate in batches:

```bash
# Migrate buyers in batches of 100
python migrate.py --entity buyers --batch-size 100 --offset 0

# Continue with next batch
python migrate.py --entity buyers --batch-size 100 --offset 100
```

## Monitoring

### Progress Tracking

Real-time progress displayed during migration:

```
[Extract] Buyers:     ████████████████████ 100% (1250/1250)
[Extract] Producers:  ████████████████████ 100% (430/430)
[Extract] Sales:      ████████░░░░░░░░░░░░  45% (3844/8542)
```

### CloudWatch Metrics

If enabled, migration metrics are sent to CloudWatch:

- `Migration/RecordsProcessed`
- `Migration/Errors`
- `Migration/Duration`

## Rollback

If migration needs to be rolled back:

```bash
# Restore from backup
python utils/restore.py --backup data/backups/SalesTable-dev-20260130-150000.json

# Or use AWS DynamoDB point-in-time recovery
aws dynamodb restore-table-to-point-in-time \
  --source-table-name SalesTable-dev \
  --target-table-name SalesTable-dev \
  --restore-date-time 2026-01-30T15:00:00
```

## Best Practices

1. **Always run dry-run first**
   ```bash
   python migrate.py --dry-run
   ```

2. **Test on dev environment**
   ```bash
   python migrate.py --config config-dev.json
   ```

3. **Backup before loading**
   ```bash
   # Automatic in default config
   "backupBeforeLoad": true
   ```

4. **Validate after migration**
   ```bash
   python migrate.py --phase validate --target
   ```

5. **Monitor during migration**
   - Watch CloudWatch Logs
   - Monitor DynamoDB metrics
   - Check error logs

6. **Keep migration artifacts**
   - Don't delete `data/` directory
   - Archive migration reports
   - Document issues encountered

## Troubleshooting

### Connection Timeout

```bash
# Increase timeout in config.json
"source": {
  "connectionTimeout": 30000
}
```

### Out of Memory

```bash
# Reduce batch size
"migration": {
  "batchSize": 10
}
```

### Rate Limiting

```bash
# Add delay between batches
"migration": {
  "batchDelay": 1000
}
```

### Data Mismatch

```bash
# Run validation with verbose output
python validate/validate_data.py --verbose --strict
```

## FAQ

**Q: How long does migration take?**
A: Depends on data volume. Estimate: ~1000 records per minute.

**Q: Can I migrate while S9 is running?**
A: Yes, but use read-only database connection.

**Q: What if migration fails halfway?**
A: Use `--resume` flag to continue from checkpoint.

**Q: Can I migrate specific records?**
A: Yes, use filters in extract phase:
```bash
python extract/extract_sales.py --filter "created_date >= '2024-01-01'"
```

**Q: How do I verify migration success?**
A: Run validation phase and review reports:
```bash
python migrate.py --phase validate --target
cat data/reports/validation_report.json
```

## Support

For issues or questions:
- Check migration logs: `data/reports/migration.log`
- Review error details: `data/reports/migration_errors.log`
- Contact: migration-support@i2speedex.com
