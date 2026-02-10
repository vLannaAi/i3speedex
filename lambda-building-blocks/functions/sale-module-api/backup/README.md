# Backup and Restore Procedures

## Overview

This directory contains scripts and procedures for backing up and restoring the Sale Module API data, ensuring business continuity and disaster recovery capabilities.

## Table of Contents

- [Backup Strategy](#backup-strategy)
- [Automated Backups](#automated-backups)
- [Manual Backup](#manual-backup)
- [Restore Procedures](#restore-procedures)
- [Disaster Recovery](#disaster-recovery)
- [Testing Backups](#testing-backups)
- [Retention Policies](#retention-policies)

---

## Backup Strategy

### What Gets Backed Up

1. **DynamoDB Tables**
   - SalesTable (sales and sale lines)
   - BuyersTable
   - ProducersTable
   - Point-in-Time Recovery enabled
   - Daily snapshots

2. **S3 Buckets**
   - Attachments bucket (versioning enabled)
   - Invoices bucket (versioning enabled)
   - Cross-region replication

3. **Configuration**
   - Lambda function code
   - API Gateway configuration
   - Cognito user pool settings
   - CloudFormation templates

### Backup Types

#### 1. Continuous Backups (Point-in-Time Recovery)
- **DynamoDB**: Enabled for all tables
- **Retention**: 35 days
- **Granularity**: 1-second precision
- **Cost**: ~$0.20/GB/month

#### 2. On-Demand Snapshots
- **Frequency**: Daily at 2:00 AM UTC
- **Retention**: 30 days
- **Purpose**: Long-term archival
- **Format**: Native DynamoDB backup

#### 3. Exported Backups
- **Frequency**: Weekly on Sunday
- **Retention**: 90 days
- **Format**: JSON (S3)
- **Purpose**: Cross-region DR, compliance

#### 4. S3 Versioning
- **Status**: Enabled
- **Retention**: 90 days
- **Purpose**: File recovery

---

## Automated Backups

### Setup Automated Backups

#### 1. Enable Point-in-Time Recovery

```bash
# Enable PITR for all tables
./backup-enable-pitr.sh --environment production
```

This enables continuous backups for:
- SalesTable-production
- BuyersTable-production
- ProducersTable-production

#### 2. Configure Daily Snapshots

AWS Backup plan automatically creates daily snapshots:

```bash
# Deploy backup plan
aws cloudformation deploy \
  --template-file backup-plan.yaml \
  --stack-name sale-module-backup-plan \
  --parameter-overrides Environment=production
```

**Backup Schedule**:
- **Daily**: 2:00 AM UTC
- **Weekly**: Sunday 3:00 AM UTC
- **Monthly**: 1st of month, 4:00 AM UTC

#### 3. Enable S3 Versioning

```bash
# Enable versioning on S3 buckets
./backup-enable-s3-versioning.sh --environment production
```

### Monitoring Automated Backups

#### CloudWatch Alarms

Monitors backup completion and failures:

```bash
# View backup status
aws backup list-backup-jobs \
  --by-state COMPLETED \
  --max-results 10

# Check for failures
aws backup list-backup-jobs \
  --by-state FAILED \
  --max-results 10
```

#### Backup Reports

Daily backup reports sent to:
- Email: ops@i2speedex.com
- Slack: #infrastructure-alerts

---

## Manual Backup

### Create On-Demand Backup

#### Full System Backup

```bash
# Backup all components
./backup.sh --environment production --type full
```

**Includes**:
- All DynamoDB tables
- S3 bucket snapshots
- Lambda function code
- Configuration export

**Output**: `backups/production-full-20260130-150000.tar.gz`

#### Single Table Backup

```bash
# Backup specific table
./backup.sh --table SalesTable-production --format json

# Or using AWS CLI
aws dynamodb create-backup \
  --table-name SalesTable-production \
  --backup-name SalesTable-manual-20260130
```

#### S3 Bucket Backup

```bash
# Sync S3 bucket to backup location
./backup-s3.sh --bucket sale-module-attachments-production \
  --destination s3://sale-module-backups/attachments/20260130/
```

### Export to JSON (for external storage)

```bash
# Export table to JSON
./export-table.sh --table SalesTable-production \
  --output backups/sales-export-20260130.json

# Compress and encrypt
gzip backups/sales-export-20260130.json
gpg --encrypt --recipient ops@i2speedex.com \
  backups/sales-export-20260130.json.gz
```

---

## Restore Procedures

### Restore from Point-in-Time

#### Restore to Specific Time

```bash
# Restore table to specific timestamp
./restore-pitr.sh \
  --table SalesTable-production \
  --timestamp "2026-01-30T14:30:00Z" \
  --target-table SalesTable-restored
```

**Process**:
1. Creates new table with restored data
2. Verifies data integrity
3. Optionally swaps with production table
4. Archives old table

#### Quick Restore (Last Good State)

```bash
# Restore to 1 hour ago
./restore-pitr.sh \
  --table SalesTable-production \
  --hours-ago 1 \
  --target-table SalesTable-production-temp
```

### Restore from Snapshot

#### Restore DynamoDB Snapshot

```bash
# List available backups
aws backup list-recovery-points-by-backup-vault \
  --backup-vault-name Default \
  --max-results 20

# Restore from backup
./restore-snapshot.sh \
  --backup-arn arn:aws:backup:us-east-1:123456789012:recovery-point:abc-123 \
  --target-table SalesTable-restored
```

#### Restore S3 Files

```bash
# Restore specific file version
aws s3api get-object \
  --bucket sale-module-attachments-production \
  --key attachments/2026/SALE001/document.pdf \
  --version-id abc123 \
  document-restored.pdf

# Restore entire bucket from backup
./restore-s3.sh \
  --source s3://sale-module-backups/attachments/20260130/ \
  --target s3://sale-module-attachments-production/
```

### Restore from Exported JSON

```bash
# Decrypt and decompress
gpg --decrypt backups/sales-export-20260130.json.gz.gpg > \
  sales-export-20260130.json.gz
gunzip sales-export-20260130.json.gz

# Import to DynamoDB
./import-table.sh \
  --input sales-export-20260130.json \
  --table SalesTable-production
```

---

## Disaster Recovery

### DR Strategy

#### Recovery Time Objective (RTO)
- **Critical Data**: 1 hour
- **Full System**: 4 hours

#### Recovery Point Objective (RPO)
- **DynamoDB**: 1 second (PITR)
- **S3 Files**: Real-time (versioning)

### DR Scenarios

#### Scenario 1: Accidental Data Deletion

**Problem**: User accidentally deleted critical sales records

**Solution**:
```bash
# 1. Identify deletion time
# 2. Restore from PITR to just before deletion
./restore-pitr.sh \
  --table SalesTable-production \
  --timestamp "2026-01-30T14:25:00Z" \
  --target-table SalesTable-recovered

# 3. Extract deleted records
python scripts/extract-differences.py \
  --current SalesTable-production \
  --recovered SalesTable-recovered \
  --output deleted-records.json

# 4. Re-import deleted records
python scripts/import-records.py \
  --input deleted-records.json \
  --table SalesTable-production
```

#### Scenario 2: Table Corruption

**Problem**: Data corruption in DynamoDB table

**Solution**:
```bash
# 1. Stop all writes to table
aws lambda update-function-configuration \
  --function-name sale-module-create-sale-production \
  --environment Variables={READ_ONLY=true}

# 2. Create backup of corrupted table
aws dynamodb create-backup \
  --table-name SalesTable-production \
  --backup-name SalesTable-corrupted-20260130

# 3. Restore from last good snapshot
./restore-snapshot.sh \
  --backup-name SalesTable-daily-20260129 \
  --target-table SalesTable-production-new

# 4. Validate restored data
./validate-table.sh --table SalesTable-production-new

# 5. Swap tables
./swap-tables.sh \
  --old SalesTable-production \
  --new SalesTable-production-new

# 6. Re-enable writes
aws lambda update-function-configuration \
  --function-name sale-module-create-sale-production \
  --environment Variables={READ_ONLY=false}
```

#### Scenario 3: Region Failure

**Problem**: AWS region us-east-1 unavailable

**Solution**:
```bash
# 1. Activate DR region (us-west-2)
./activate-dr-region.sh --region us-west-2

# 2. Update Route53 to point to DR region
aws route53 change-resource-record-sets \
  --hosted-zone-id Z123456 \
  --change-batch file://dns-failover.json

# 3. Restore latest cross-region backup
./restore-cross-region.sh \
  --source-region us-east-1 \
  --target-region us-west-2 \
  --environment production

# 4. Start Lambda functions in DR region
./deploy.sh --region us-west-2 --environment production
```

#### Scenario 4: Complete Data Loss

**Problem**: All data lost (worst case)

**Solution**:
```bash
# 1. Identify latest complete backup set
./list-backups.sh --environment production --type full

# 2. Restore from most recent full backup
./restore-full.sh \
  --backup backups/production-full-20260129-020000.tar.gz \
  --environment production-recovery

# 3. Restore incremental changes from exported backups
./restore-incremental.sh \
  --from-date 2026-01-29 \
  --to-date 2026-01-30 \
  --environment production-recovery

# 4. Validate all data
./validate-restore.sh --environment production-recovery

# 5. Promote to production
./promote-environment.sh \
  --source production-recovery \
  --target production
```

---

## Testing Backups

### Monthly DR Drill

```bash
# Automated DR test (non-destructive)
./test-dr.sh --environment staging
```

**Test Steps**:
1. Create isolated test environment
2. Restore latest production backup
3. Verify data integrity
4. Test application functionality
5. Measure RTO/RPO metrics
6. Generate test report
7. Clean up test environment

### Backup Validation

```bash
# Validate backup integrity
./validate-backup.sh \
  --backup-arn arn:aws:backup:us-east-1:123456789012:recovery-point:abc-123

# Sample data restoration test
./test-restore.sh \
  --table SalesTable-production \
  --sample-size 1000 \
  --verify-integrity
```

---

## Retention Policies

### DynamoDB Backups

| Backup Type | Retention | Purpose |
|------------|-----------|---------|
| Point-in-Time | 35 days | Operational recovery |
| Daily snapshots | 30 days | Short-term archival |
| Weekly snapshots | 90 days | Medium-term archival |
| Monthly snapshots | 1 year | Long-term archival |
| Annual snapshots | 7 years | Compliance |

### S3 Files

| Version Type | Retention | Lifecycle |
|-------------|-----------|-----------|
| Current version | Indefinite | N/A |
| Previous versions | 90 days | Transition to Glacier |
| Glacier versions | 7 years | Delete after |

### Exported Backups

| Export Type | Retention | Storage |
|------------|-----------|---------|
| Weekly JSON | 90 days | S3 Standard |
| Monthly JSON | 1 year | S3 Standard-IA |
| Annual JSON | 7 years | S3 Glacier |

### Lifecycle Management

```bash
# Configure S3 lifecycle policies
./configure-lifecycle.sh --environment production
```

**Policies**:
- Day 0-30: S3 Standard
- Day 31-90: S3 Standard-IA
- Day 91-365: S3 Glacier
- Day 365+: S3 Glacier Deep Archive
- Day 2555+: Delete (7 years)

---

## Backup Scripts Reference

### Main Scripts

```bash
# Enable all backup features
./backup-enable-all.sh --environment production

# Create full backup
./backup.sh --environment production --type full

# Restore from PITR
./restore-pitr.sh --table TABLE --timestamp TIMESTAMP

# Restore from snapshot
./restore-snapshot.sh --backup-arn ARN

# Test DR procedures
./test-dr.sh --environment staging

# Validate backups
./validate-backup.sh --backup-arn ARN
```

### Utility Scripts

```bash
# List all backups
./list-backups.sh --environment production

# Check backup status
./backup-status.sh

# Generate backup report
./backup-report.sh --month 2026-01

# Clean old backups
./cleanup-backups.sh --older-than 90
```

---

## Monitoring and Alerts

### CloudWatch Metrics

Custom metrics tracked:
- `Backup/Success` - Successful backup count
- `Backup/Failure` - Failed backup count
- `Backup/Duration` - Backup duration (seconds)
- `Backup/Size` - Backup size (GB)

### Alerts

Email/Slack notifications for:
- ❌ Backup failure
- ⚠️ Backup duration > 1 hour
- ⚠️ Backup size anomaly (>20% change)
- ✅ Daily backup completion (summary)

### Dashboard

CloudWatch dashboard showing:
- Backup success rate (last 30 days)
- Backup size trends
- PITR status
- S3 versioning status
- Cross-region replication lag

---

## Compliance and Security

### Encryption

All backups encrypted:
- **At Rest**: AES-256
- **In Transit**: TLS 1.2+
- **Key Management**: AWS KMS

### Access Control

Backup operations require:
- IAM role: `BackupAdministrator`
- MFA for restore operations
- Audit logging enabled

### Audit Trail

All backup/restore operations logged:
- CloudTrail: API calls
- CloudWatch Logs: Operation details
- S3 Access Logs: Backup access

---

## Cost Optimization

### Estimated Costs (Production)

| Service | Monthly Cost |
|---------|--------------|
| DynamoDB PITR | $200 |
| DynamoDB snapshots | $50 |
| S3 versioning | $100 |
| S3 Glacier storage | $20 |
| AWS Backup service | $30 |
| Cross-region replication | $50 |
| **Total** | **~$450** |

### Cost Reduction Tips

1. **Optimize snapshot frequency**: Reduce daily to weekly for dev
2. **Use lifecycle policies**: Move old backups to Glacier
3. **Clean old versions**: Delete S3 versions >90 days
4. **Compress exports**: Use gzip for JSON exports
5. **Review retention**: Align with compliance requirements

---

## Troubleshooting

### Backup Fails

```bash
# Check backup job status
aws backup describe-backup-job --backup-job-id JOB_ID

# Common issues:
# 1. Insufficient IAM permissions
# 2. Table in UPDATING state
# 3. Backup vault locked
# 4. Regional capacity limits
```

### Restore Fails

```bash
# Check restore job status
aws backup describe-restore-job --restore-job-id JOB_ID

# Common issues:
# 1. Target table already exists
# 2. Insufficient capacity
# 3. Network connectivity
# 4. KMS key access denied
```

### PITR Not Working

```bash
# Check PITR status
aws dynamodb describe-continuous-backups \
  --table-name SalesTable-production

# Re-enable if disabled
aws dynamodb update-continuous-backups \
  --table-name SalesTable-production \
  --point-in-time-recovery-specification PointInTimeRecoveryEnabled=true
```

---

## Best Practices

1. ✅ **Test restores monthly** - Verify backups work
2. ✅ **Automate everything** - Reduce human error
3. ✅ **Monitor backup jobs** - Quick failure detection
4. ✅ **Document procedures** - Everyone knows the process
5. ✅ **Use multiple backup types** - Defense in depth
6. ✅ **Encrypt all backups** - Security compliance
7. ✅ **Version control scripts** - Track changes
8. ✅ **Cross-region backups** - Regional failure protection
9. ✅ **Tag all backups** - Easy identification
10. ✅ **Measure RTO/RPO** - Continuous improvement

---

## Support

For backup/restore issues:
- **Emergency**: Call incident hotline
- **Non-urgent**: Create ticket in ServiceNow
- **Questions**: #infrastructure-support Slack channel

## Additional Resources

- [AWS Backup Documentation](https://docs.aws.amazon.com/backup/)
- [DynamoDB PITR Guide](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/PointInTimeRecovery.html)
- [S3 Versioning Best Practices](https://docs.aws.amazon.com/AmazonS3/latest/userguide/Versioning.html)
