# Migration Quick Start Guide

## Setup (5 minutes)

```bash
# Navigate to migration directory
cd lambda-building-blocks/functions/sale-module-api/migration

# Install Python dependencies
pip install -r requirements.txt

# Configure
cp config.json.example config.json
# Edit config.json with your database credentials and AWS settings

# Set database password (don't commit!)
export DB_PASSWORD='your-password-here'
```

## Usage

### Test Migration (Dry Run)

```bash
# Simulate migration without making changes
python migrate.py --dry-run
```

### Extract Data from S9

```bash
# Extract all entities
python migrate.py --phase extract

# Extract specific entity only
python migrate.py --phase extract --entity buyers
python migrate.py --phase extract --entity producers
python migrate.py --phase extract --entity sales
```

**Output**: `data/extracted/{entity}.json`

### Transform to DynamoDB Schema

```bash
# Transform all entities
python migrate.py --phase transform

# Transform specific entity
python migrate.py --phase transform --entity buyers
```

**Output**: `data/transformed/{entity}.json`

### Validate Data

```bash
# Validate all transformed data
python migrate.py --phase validate
```

**Output**: `data/reports/validation_report.json`

### Load to DynamoDB

```bash
# Load all entities
python migrate.py --phase load

# Load specific entity
python migrate.py --phase load --entity buyers
```

### Complete Migration (All Phases)

```bash
# Run end-to-end migration
python migrate.py --full
```

### Resume from Failure

```bash
# Continue from last checkpoint
python migrate.py --resume
```

## Common Options

```bash
--config FILE      # Use custom config file
--dry-run          # Simulate without changes
--verbose          # Detailed logging
--entity NAME      # Process only buyers/producers/sales
```

## Directory Structure After Migration

```
data/
├── extracted/                  # Raw S9 data
│   ├── buyers.json
│   ├── producers.json
│   └── sales.json
│
├── transformed/                # DynamoDB format
│   ├── buyers.json
│   ├── producers.json
│   └── sales.json
│
├── reports/                    # Migration reports
│   ├── migration.log
│   ├── validation_report.json
│   └── verification_report.json
│
└── backups/                    # Pre-migration backups
    └── BuyersTable-dev-20260130-150000.json
```

## Troubleshooting

### Connection Error

```bash
# Check database connectivity
psql -h $DB_HOST -U $DB_USER -d $DB_NAME
```

### Permission Error

```bash
# Verify AWS credentials
aws sts get-caller-identity

# Check DynamoDB access
aws dynamodb list-tables
```

### Out of Memory

```bash
# Reduce batch size in config.json
"migration": {
  "batchSize": 10  // Lower from 25
}
```

### Validation Failures

```bash
# Run with verbose output
python migrate.py --phase validate --verbose

# Check validation report
cat data/reports/validation_report.json
```

## Need Help?

- **Full Documentation**: See `README.md`
- **Implementation Guide**: See `../MIGRATION_SUMMARY.md`
- **Configuration**: See `config.json.example`
- **Logs**: Check `data/reports/migration.log`

## Development Workflow

1. **Implement Extract**: Start with `extract/extract_buyers.py` (working example)
2. **Implement Transform**: Map S9 → DynamoDB schema in `transform/`
3. **Implement Load**: Write to DynamoDB in `load/`
4. **Add Validation**: Business rules in `validate/`
5. **Test**: `python migrate.py --full --config config-dev.json`

## Safety Checklist

- [ ] Tested on dev environment first
- [ ] Reviewed configuration settings
- [ ] Database backup created
- [ ] AWS credentials configured correctly
- [ ] Dry run completed successfully
- [ ] Validation passed
- [ ] Rollback plan documented
