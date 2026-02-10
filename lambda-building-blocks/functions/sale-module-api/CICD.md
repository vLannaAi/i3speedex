# CI/CD Pipeline Documentation

## Overview

This document describes the Continuous Integration and Continuous Deployment (CI/CD) pipeline for the Sale Module API.

## Table of Contents

- [Pipeline Overview](#pipeline-overview)
- [Prerequisites](#prerequisites)
- [GitHub Actions Workflows](#github-actions-workflows)
- [Deployment Process](#deployment-process)
- [Environment Configuration](#environment-configuration)
- [Manual Deployment](#manual-deployment)
- [Monitoring and Rollback](#monitoring-and-rollback)
- [Troubleshooting](#troubleshooting)

---

## Pipeline Overview

The CI/CD pipeline consists of two main workflows:

1. **CI (Continuous Integration)** - Runs on every push and pull request
   - Code linting
   - TypeScript type checking
   - Unit tests with coverage
   - Integration tests (on PRs)
   - Security scanning
   - Build artifact creation

2. **CD (Continuous Deployment)** - Deploys to AWS environments
   - Automatic deployment from `develop` → dev
   - Automatic deployment from `main` → production
   - Manual deployment via workflow dispatch

### Deployment Flow

```
Developer → Push to develop → CI Pipeline → Deploy to Dev
                                                ↓
                                          Run smoke tests
                                                ↓
                                            Success ✓

Developer → Create PR to main → CI Pipeline → Review
                                                ↓
                                            Merge PR
                                                ↓
                                      Deploy to Production
                                                ↓
                                          Run smoke tests
                                                ↓
                                            Tag release
```

---

## Prerequisites

### Required Tools

- **AWS CLI** (v2.x or higher)
- **AWS SAM CLI** (v1.x or higher)
- **Node.js** (v18.x or higher)
- **npm** (v9.x or higher)
- **Git** (v2.x or higher)

### AWS Requirements

1. **IAM Permissions**
   - CloudFormation: Full access
   - Lambda: Full access
   - API Gateway: Full access
   - DynamoDB: Read/Write access
   - S3: Read/Write access
   - IAM: PassRole permission
   - CloudWatch Logs: Write access

2. **GitHub Secrets** (for GitHub Actions)
   - `AWS_DEPLOY_ROLE_ARN` - IAM role ARN for deployment
   - `COGNITO_USER_POOL_ID` - Cognito User Pool ID
   - `ADMIN_TOKEN` - Admin JWT token for smoke tests
   - `SNYK_TOKEN` - Snyk API token (optional)

3. **GitHub Variables** (per environment)
   - `AWS_REGION` - AWS region (default: us-east-1)
   - `DYNAMODB_SALES_TABLE` - DynamoDB table name
   - `DYNAMODB_BUYERS_TABLE` - DynamoDB table name
   - `DYNAMODB_PRODUCERS_TABLE` - DynamoDB table name
   - `S3_ATTACHMENTS_BUCKET` - S3 bucket for attachments
   - `S3_INVOICES_BUCKET` - S3 bucket for invoices

---

## GitHub Actions Workflows

### CI Workflow (.github/workflows/ci.yml)

Triggered on:
- Push to `main` or `develop` branches
- Pull requests to `main` or `develop` branches

Jobs:
1. **lint** - Run ESLint
2. **unit-test** - Run unit tests with coverage
3. **type-check** - TypeScript compilation
4. **integration-test** - Run integration tests (PR only)
5. **security-scan** - npm audit and Snyk
6. **build-artifact** - Create deployment package
7. **validate-success** - Ensure all checks passed

### CD Workflow (.github/workflows/deploy.yml)

Triggered on:
- Push to `main` → deploys to production
- Push to `develop` → deploys to dev
- Manual workflow dispatch → deploys to selected environment

Jobs:
1. **determine-environment** - Select target environment
2. **deploy** - Deploy to AWS using SAM
3. **notify** - Send deployment notifications

### Branch Strategy

- `develop` - Development branch (auto-deploys to dev)
- `main` - Production branch (auto-deploys to production)
- `feature/*` - Feature branches (run CI only)
- `hotfix/*` - Hotfix branches (run CI only)

---

## Deployment Process

### Automatic Deployment

1. **To Development**:
   ```bash
   git checkout develop
   git add .
   git commit -m "Your changes"
   git push origin develop
   ```
   - CI pipeline runs automatically
   - If all tests pass, deploys to dev environment
   - Smoke tests verify deployment

2. **To Production**:
   ```bash
   git checkout main
   git merge develop
   git push origin main
   ```
   - CI pipeline runs automatically
   - Deploys to production environment
   - Creates deployment tag
   - Runs smoke tests

### Manual Deployment

Via GitHub Actions:
1. Go to Actions → CD - Deploy to AWS
2. Click "Run workflow"
3. Select environment (dev/staging/production)
4. Click "Run workflow"

Via Command Line:
```bash
# Navigate to project directory
cd lambda-building-blocks/functions/sale-module-api

# Deploy to dev
./scripts/deploy.sh dev

# Deploy to staging
./scripts/deploy.sh staging

# Deploy to production
./scripts/deploy.sh production
```

---

## Environment Configuration

### Setting Up Environments

1. **Create configuration file**:
   ```bash
   cd config/
   cp dev.env.example dev.env
   # Edit dev.env with actual values
   ```

2. **Configure GitHub Secrets**:
   - Go to repository Settings → Secrets and variables → Actions
   - Add secrets for each environment
   - Add environment-specific variables

3. **Create GitHub Environments**:
   - Go to repository Settings → Environments
   - Create environments: dev, staging, production
   - Configure protection rules for production

### Environment Variables

Each environment requires these variables:

```bash
# AWS Configuration
AWS_REGION=us-east-1
AWS_ACCOUNT_ID=123456789012

# Cognito
COGNITO_USER_POOL_ID=us-east-1_xxxxxxxxx

# DynamoDB Tables
DYNAMODB_SALES_TABLE=SalesTable-{env}
DYNAMODB_BUYERS_TABLE=BuyersTable-{env}
DYNAMODB_PRODUCERS_TABLE=ProducersTable-{env}

# S3 Buckets
S3_ATTACHMENTS_BUCKET=sale-module-attachments-{env}
S3_INVOICES_BUCKET=sale-module-invoices-{env}
```

---

## Monitoring and Rollback

### Monitoring Deployment

1. **CloudWatch Logs**:
   ```bash
   # View logs for specific function
   sam logs --stack-name sale-module-api-{env} \
            --name CreateSaleFunction \
            --tail

   # View all logs
   sam logs --stack-name sale-module-api-{env} --tail
   ```

2. **CloudWatch Metrics**:
   - Invocation count
   - Error rate
   - Duration
   - Throttles

3. **API Gateway Metrics**:
   - Request count
   - 4xx/5xx errors
   - Latency

### Rollback Procedure

#### Automatic Rollback
CloudFormation automatically rolls back on deployment failure.

#### Manual Rollback

1. **Using CloudFormation**:
   ```bash
   # List recent deployments
   aws cloudformation describe-stack-events \
       --stack-name sale-module-api-production \
       --max-items 50

   # Rollback to previous version
   aws cloudformation rollback-stack \
       --stack-name sale-module-api-production
   ```

2. **Using Git Tags**:
   ```bash
   # List recent deployment tags
   git tag -l "deploy-*" | tail -5

   # Checkout previous version
   git checkout deploy-20260130-120000

   # Deploy previous version
   ./scripts/deploy.sh production
   ```

3. **Emergency Rollback**:
   ```bash
   # Quick rollback using SAM
   sam deploy \
       --stack-name sale-module-api-production \
       --no-execute-changeset \
       --region us-east-1

   # Review changes, then:
   aws cloudformation execute-change-set \
       --change-set-name <changeset-name>
   ```

---

## Troubleshooting

### Common Issues

#### 1. Deployment Fails with Permission Error

**Problem**: IAM role lacks necessary permissions

**Solution**:
```bash
# Check current IAM permissions
aws iam get-role --role-name DeploymentRole

# Add missing permissions via IAM console or:
aws iam attach-role-policy \
    --role-name DeploymentRole \
    --policy-arn arn:aws:iam::aws:policy/AWSLambdaFullAccess
```

#### 2. Tests Fail in CI Pipeline

**Problem**: Tests pass locally but fail in CI

**Solution**:
- Check Node.js version matches (18.x)
- Verify dependencies are locked in package-lock.json
- Check for environment-specific code
- Review CI logs for specific error messages

#### 3. API Returns 502 Bad Gateway

**Problem**: Lambda function errors or timeout

**Solution**:
```bash
# Check Lambda logs
sam logs --stack-name sale-module-api-{env} --tail

# Check Lambda configuration
aws lambda get-function-configuration \
    --function-name sale-module-create-sale-{env}

# Increase timeout if needed
aws lambda update-function-configuration \
    --function-name sale-module-create-sale-{env} \
    --timeout 60
```

#### 4. DynamoDB Table Not Found

**Problem**: Lambda cannot access DynamoDB table

**Solution**:
- Verify table exists: `aws dynamodb list-tables`
- Check IAM permissions
- Verify environment variable: `DYNAMODB_SALES_TABLE`
- Check VPC configuration if using VPC

#### 5. S3 Access Denied

**Problem**: Lambda cannot read/write to S3

**Solution**:
- Verify bucket exists and is in same region
- Check IAM permissions (S3 read/write)
- Verify bucket policy allows Lambda execution role
- Check CORS configuration for API requests

### Debug Mode

Enable debug logging:

```bash
# In Lambda environment
export LOG_LEVEL=DEBUG

# In SAM local
sam local start-api --debug
```

### Viewing Deployment Status

```bash
# Check stack status
aws cloudformation describe-stacks \
    --stack-name sale-module-api-{env} \
    --query 'Stacks[0].StackStatus'

# View stack events
aws cloudformation describe-stack-events \
    --stack-name sale-module-api-{env} \
    --max-items 20
```

---

## Best Practices

### Pre-Deployment Checklist

- [ ] All tests passing locally
- [ ] Code reviewed and approved
- [ ] Environment variables configured
- [ ] Database migrations prepared (if needed)
- [ ] Deployment scheduled (for production)
- [ ] Rollback plan documented
- [ ] Monitoring dashboards ready

### Post-Deployment Checklist

- [ ] Smoke tests passed
- [ ] CloudWatch metrics normal
- [ ] Error rates acceptable
- [ ] API Gateway health check successful
- [ ] Integration tests passed
- [ ] Stakeholders notified
- [ ] Documentation updated

### Security Best Practices

1. **Never commit secrets** to version control
2. **Use IAM roles** instead of access keys
3. **Enable CloudTrail** for audit logging
4. **Encrypt sensitive data** in S3 and DynamoDB
5. **Rotate credentials** regularly
6. **Review IAM policies** periodically
7. **Enable MFA** for production deployments

---

## Additional Resources

- [AWS SAM Documentation](https://docs.aws.amazon.com/serverless-application-model/)
- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [AWS Lambda Best Practices](https://docs.aws.amazon.com/lambda/latest/dg/best-practices.html)
- [CloudFormation Rollback](https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/using-cfn-rollback-triggers.html)

---

## Support

For issues or questions:
- **Technical Issues**: Create an issue in the repository
- **Deployment Issues**: Contact DevOps team
- **Security Concerns**: Contact security team immediately
