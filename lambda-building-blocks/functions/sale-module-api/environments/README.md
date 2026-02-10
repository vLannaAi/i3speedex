# AWS Environment Setup

## Overview

This directory contains scripts and configuration for deploying the Sale Module API infrastructure to AWS across multiple environments (dev, staging, production).

---

## Quick Start

### 1. Configure Environment

```bash
cd environments

# Edit configuration file for your environment
vi config/dev.json
```

Update required values:
- `accountId` - Your AWS account ID
- S3 bucket names (must be globally unique)
- Custom domain names (optional)
- ACM certificate ARNs (optional)

### 2. Deploy Environment

```bash
# Deploy complete environment
./setup-environment.sh --environment dev

# Deploy only core infrastructure
./setup-environment.sh --environment dev --components core

# Dry run (show what would be deployed)
./setup-environment.sh --environment dev --dry-run
```

### 3. Verify Deployment

```bash
# Verify all resources are healthy
./verify-environment.sh --environment dev

# Get API endpoints
./get-endpoints.sh --environment dev
```

---

## Directory Structure

```
environments/
├── README.md                  # This file
├── setup-environment.sh       # Main deployment script
├── verify-environment.sh      # Verification script
├── teardown-environment.sh    # Cleanup script
├── get-endpoints.sh           # Display endpoints
│
├── config/                    # Environment configurations
│   ├── dev.json              # Development configuration
│   ├── staging.json          # Staging configuration
│   └── production.json       # Production configuration
│
├── scripts/                   # Deployment scripts
│   ├── check-prerequisites.sh
│   ├── deploy-core.sh
│   ├── deploy-lambda.sh
│   ├── deploy-api-gateway.sh
│   ├── deploy-backup.sh
│   └── post-deploy.sh
│
└── outputs/                   # Deployment outputs (generated)
    ├── dev-outputs.json
    ├── dev.env
    └── ...
```

---

## Scripts Reference

### Main Scripts

#### setup-environment.sh

Deploys complete infrastructure for an environment.

```bash
./setup-environment.sh --environment ENV [OPTIONS]

Options:
  --environment, -e ENV   Environment (dev|staging|production)
  --components, -c TYPE   Components to deploy (all|core|cdn|backup)
  --skip-confirmation, -y Skip confirmation prompts
  --dry-run               Show what would be deployed
  --help, -h              Show this help
```

**Examples:**
```bash
# Full deployment
./setup-environment.sh --environment dev

# Core infrastructure only
./setup-environment.sh --environment production --components core

# Skip confirmations
./setup-environment.sh --environment staging -y

# Dry run
./setup-environment.sh --environment dev --dry-run
```

#### verify-environment.sh

Verifies all deployed resources are working correctly.

```bash
./verify-environment.sh --environment ENV

Options:
  --environment, -e ENV   Environment to verify
  --help, -h              Show this help
```

**Checks:**
- DynamoDB tables (status, accessibility)
- S3 buckets (existence, permissions)
- Cognito User Pool (existence)
- API Gateway (endpoint, health check)
- CloudFront distribution (if enabled)

#### teardown-environment.sh

Deletes all resources for an environment.

```bash
./teardown-environment.sh --environment ENV [OPTIONS]

Options:
  --environment, -e ENV   Environment to tear down
  --skip-confirmation, -y Skip confirmation prompts
  --help, -h              Show this help
```

**Warning:** This is destructive and will delete ALL resources and data.

#### get-endpoints.sh

Displays all API endpoints and URLs.

```bash
./get-endpoints.sh --environment ENV [OPTIONS]

Options:
  --environment, -e ENV   Environment
  --format, -f FORMAT     Output format (text|json)
  --help, -h              Show this help
```

**Examples:**
```bash
# Text output (default)
./get-endpoints.sh --environment production

# JSON output
./get-endpoints.sh --environment staging --format json
```

### Component Scripts

Located in `scripts/` directory:

- **check-prerequisites.sh** - Validates requirements before deployment
- **deploy-core.sh** - Deploys DynamoDB, S3, Cognito
- **deploy-lambda.sh** - Deploys Lambda functions via SAM
- **deploy-api-gateway.sh** - Configures API Gateway
- **deploy-backup.sh** - Sets up backup infrastructure
- **post-deploy.sh** - Post-deployment configuration and output

---

## Configuration

### Environment Configuration Files

Configuration files are in `config/` directory in JSON format.

#### Required Fields

```json
{
  "environment": "dev",
  "region": "us-east-1",
  "accountId": "123456789012",
  "projectName": "sale-module-api",

  "dynamodb": {
    "salesTable": "SalesTable-dev",
    "buyersTable": "BuyersTable-dev",
    "producersTable": "ProducersTable-dev",
    "billingMode": "PAY_PER_REQUEST",
    "pointInTimeRecovery": false,
    "deletionProtection": false
  },

  "s3": {
    "attachmentsBucket": "sale-module-attachments-dev",
    "invoicesBucket": "sale-module-invoices-dev",
    "versioning": false,
    "lifecycleRules": { ... }
  },

  "cognito": {
    "userPoolName": "SaleModuleUsers-dev",
    "userPoolClientName": "SaleModuleClient-dev",
    "mfaConfiguration": "OPTIONAL",
    "passwordPolicy": { ... }
  },

  "lambda": {
    "runtime": "nodejs18.x",
    "timeout": 30,
    "memorySize": 512,
    "environment": { ... }
  },

  "apiGateway": {
    "stageName": "dev",
    "throttling": { ... },
    "logging": { ... },
    "customDomain": { ... }
  },

  "cloudfront": {
    "enabled": false,
    "priceClass": "PriceClass_100",
    "waf": { ... }
  },

  "backup": {
    "enabled": false,
    "pitr": false,
    "s3Versioning": false
  },

  "monitoring": {
    "enableDetailedMetrics": true,
    "alarmEmail": "dev-team@i2speedex.com",
    "alarms": { ... }
  },

  "tags": {
    "Environment": "dev",
    "Project": "SaleModule",
    "ManagedBy": "CloudFormation"
  }
}
```

### Environment Differences

| Feature | Dev | Staging | Production |
|---------|-----|---------|------------|
| PITR | ❌ | ✅ | ✅ |
| S3 Versioning | ❌ | ✅ | ✅ |
| CloudFront | ❌ | ✅ | ✅ |
| WAF | ❌ | ✅ | ✅ |
| Custom Domain | ❌ | ✅ | ✅ |
| MFA | Optional | Optional | Required |
| Deletion Protection | ❌ | ❌ | ✅ |
| Reserved Concurrency | No | No | 100 |
| Backup Retention | N/A | 30 days | 90 days |

---

## Deployment Process

### Phase 1: Prerequisites Check

Validates:
- AWS CLI installed and configured
- Node.js, npm, jq installed
- AWS credentials valid
- Required permissions
- Configuration files valid
- No conflicting resources

### Phase 2: Core Infrastructure

Deploys:
- DynamoDB tables (SalesTable, BuyersTable, ProducersTable)
- S3 buckets (attachments, invoices)
- Cognito User Pool and client

**Duration:** ~5 minutes

### Phase 3: Lambda Functions

Deploys:
- All Lambda functions
- IAM roles and policies
- Environment variables

**Duration:** ~10 minutes

### Phase 4: API Gateway

Configures:
- REST API
- Routes and integrations
- Stage deployment
- Throttling limits

**Duration:** ~2 minutes

### Phase 5: CloudFront CDN

Deploys (if enabled):
- CloudFront distribution
- Origin Access Identity
- Cache policies
- WAF rules

**Duration:** ~15-20 minutes

### Phase 6: Backup Infrastructure

Configures (if enabled):
- AWS Backup plans
- Point-in-Time Recovery
- S3 versioning
- Lifecycle policies

**Duration:** ~3 minutes

### Phase 7: Post-Deployment

- Gathers endpoints
- Generates output files
- Creates .env file

**Duration:** ~1 minute

**Total Time:** ~25-40 minutes (depending on components)

---

## Prerequisites

### Required Tools

- **AWS CLI** v2.x or later
- **Node.js** 18.x or later
- **npm** 8.x or later
- **jq** 1.6 or later
- **bash** 4.0 or later

Optional:
- **AWS SAM CLI** (for Lambda deployment)
- **Python 3** (for migration scripts)

### AWS Credentials

Configure AWS credentials:

```bash
aws configure

# Or use environment variables
export AWS_ACCESS_KEY_ID=your-key
export AWS_SECRET_ACCESS_KEY=your-secret
export AWS_DEFAULT_REGION=us-east-1
```

### AWS Permissions

Required IAM permissions:
- `dynamodb:*`
- `s3:*`
- `cognito-idp:*`
- `lambda:*`
- `apigateway:*`
- `cloudformation:*`
- `cloudfront:*` (if using CDN)
- `wafv2:*` (if using WAF)
- `iam:CreateRole`, `iam:AttachRolePolicy`

### AWS Resources

Before deployment:
- ACM certificate (for custom domain) in us-east-1
- DNS access (for custom domain setup)
- S3 bucket names must be globally unique

---

## Post-Deployment

### Generated Files

After successful deployment, check the `outputs/` directory:

**{environment}-outputs.json:**
```json
{
  "environment": "dev",
  "region": "us-east-1",
  "apiGateway": {
    "id": "abc123",
    "endpoint": "https://abc123.execute-api.us-east-1.amazonaws.com/dev"
  },
  "cognito": {
    "userPoolId": "us-east-1_ABC123",
    "userPoolName": "SaleModuleUsers-dev"
  },
  ...
}
```

**{environment}.env:**
```bash
ENVIRONMENT=dev
AWS_REGION=us-east-1
API_ENDPOINT=https://...
COGNITO_USER_POOL_ID=us-east-1_ABC123
...
```

### Verification Steps

1. **Check Resource Status:**
   ```bash
   ./verify-environment.sh --environment dev
   ```

2. **Test API Health Endpoint:**
   ```bash
   API_URL=$(./get-endpoints.sh --environment dev --format json | jq -r '.endpoints.apiGateway')
   curl $API_URL/api/health
   ```

3. **View CloudWatch Logs:**
   ```bash
   aws logs tail /aws/lambda/sale-module-create-sale-dev --follow
   ```

4. **Check DynamoDB Tables:**
   ```bash
   aws dynamodb list-tables
   ```

### DNS Configuration (Custom Domain)

If using a custom domain:

1. Get CloudFront domain:
   ```bash
   DIST_DOMAIN=$(aws cloudformation describe-stacks \
     --stack-name sale-module-cloudfront-production \
     --query 'Stacks[0].Outputs[?OutputKey==`DistributionDomainName`].OutputValue' \
     --output text)
   ```

2. Create CNAME record:
   ```
   api.sale-module.i2speedex.com → $DIST_DOMAIN
   ```

3. Wait for DNS propagation (5-30 minutes)

4. Test:
   ```bash
   curl -I https://api.sale-module.i2speedex.com/api/health
   ```

---

## Troubleshooting

### Deployment Failures

**Stack already exists:**
```bash
# Delete existing stack
aws cloudformation delete-stack --stack-name sale-module-api-dev

# Wait for deletion
aws cloudformation wait stack-delete-complete --stack-name sale-module-api-dev

# Retry deployment
./setup-environment.sh --environment dev
```

**Permission denied errors:**
- Verify AWS credentials: `aws sts get-caller-identity`
- Check IAM permissions
- Ensure credentials have admin access or required permissions

**S3 bucket already exists:**
- S3 bucket names must be globally unique
- Change bucket names in `config/{env}.json`
- Or delete existing buckets (if safe)

**Timeout errors:**
- CloudFront deployment can take 15-20 minutes
- DynamoDB table creation ~2 minutes per table
- Be patient and check AWS Console

### Verification Failures

**API Gateway not found:**
- May be deployed via SAM with different name
- Check CloudFormation stacks: `aws cloudformation list-stacks`
- Look for stack starting with `sale-module-api-`

**Health endpoint returns 404:**
- Health endpoint may not be implemented yet
- This is expected if Lambda functions haven't been deployed
- Deploy Lambda functions: `./setup-environment.sh -e dev -c core`

**DynamoDB table status CREATING:**
- Tables are still being created
- Wait a few minutes and re-run verification
- Check status: `aws dynamodb describe-table --table-name TABLE_NAME`

### Common Issues

**"jq: command not found":**
```bash
# macOS
brew install jq

# Linux
sudo apt-get install jq
```

**"AWS CLI not configured":**
```bash
aws configure
# Enter your access key, secret key, and default region
```

**"Insufficient permissions":**
- Contact AWS administrator
- Ensure IAM user/role has required permissions
- Consider using admin access for initial setup

---

## Best Practices

### Development

1. Always deploy to `dev` first
2. Test thoroughly before promoting to staging
3. Use `--dry-run` to preview changes
4. Keep configuration files in version control (without secrets)
5. Use environment variables for sensitive data

### Staging

1. Mirror production configuration as closely as possible
2. Enable all security features (WAF, MFA, etc.)
3. Run load tests
4. Verify backup and restore procedures
5. Test disaster recovery scenarios

### Production

1. Enable deletion protection
2. Enable PITR and backups
3. Configure cross-region replication
4. Set up comprehensive monitoring
5. Document runbooks and procedures
6. Require MFA for administrative actions
7. Regular security audits
8. Cost monitoring and optimization

### Maintenance

1. **Regular Updates:**
   - Update Lambda runtimes
   - Patch security vulnerabilities
   - Update dependencies

2. **Monitoring:**
   - Review CloudWatch metrics daily
   - Check alarms and notifications
   - Analyze access logs weekly

3. **Backups:**
   - Test restore procedures monthly
   - Verify backup integrity
   - Clean up old backups

4. **Cost Optimization:**
   - Review costs monthly
   - Optimize cache policies
   - Adjust provisioned capacity

---

## Cleanup

### Tear Down Environment

```bash
# With confirmation
./teardown-environment.sh --environment dev

# Skip confirmation (dangerous!)
./teardown-environment.sh --environment dev -y
```

**What Gets Deleted:**
- All DynamoDB tables and data
- All S3 buckets and contents
- Cognito User Pool and users
- Lambda functions
- API Gateway
- CloudFront distribution
- Backup plans
- CloudFormation stacks

**Note:** This operation is irreversible. Always backup data before tearing down.

### Partial Cleanup

Delete specific resources:

```bash
# Delete CloudFront only
cd ../cloudfront
./deploy.sh dev delete

# Delete backup plan only
aws cloudformation delete-stack --stack-name sale-module-backup-plan-dev

# Delete Lambda functions only
aws cloudformation delete-stack --stack-name sale-module-api-lambda-dev
```

---

## Cost Estimates

### Development Environment

- DynamoDB (on-demand): $10-20/month
- S3 (minimal data): $1-5/month
- Lambda (low traffic): $5-10/month
- Cognito: Free tier
- CloudWatch: $5/month
- **Total:** ~$25-40/month

### Staging Environment

- DynamoDB (on-demand + PITR): $50-100/month
- S3 (versioning enabled): $20-30/month
- Lambda: $20-30/month
- CloudFront: $10-20/month
- WAF: $15/month
- Backups: $10/month
- **Total:** ~$125-200/month

### Production Environment

- DynamoDB (on-demand + PITR): $200-500/month
- S3 (versioning + lifecycle): $50-100/month
- Lambda (reserved concurrency): $100-200/month
- CloudFront + WAF: $100-300/month
- Backups: $50/month
- Monitoring: $20/month
- **Total:** ~$520-1,170/month

*Estimates based on moderate traffic (~1M requests/month)*

---

## Support

For questions or issues:
- **Documentation:** See main project README
- **Infrastructure Issues:** #infrastructure Slack channel
- **Deployment Help:** Create ticket in ServiceNow
- **Emergencies:** Incident hotline

---

## Additional Resources

- [AWS CloudFormation Documentation](https://docs.aws.amazon.com/cloudformation/)
- [AWS SAM Documentation](https://docs.aws.amazon.com/serverless-application-model/)
- [Infrastructure as Code Best Practices](https://docs.aws.amazon.com/prescriptive-guidance/latest/strategy-infrastructure-as-code/)
- Project-specific docs: `../docs/`
