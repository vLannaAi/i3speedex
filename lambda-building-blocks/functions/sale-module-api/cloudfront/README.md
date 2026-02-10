# CloudFront CDN Distribution

## Overview

This directory contains CloudFormation templates and deployment scripts for setting up Amazon CloudFront CDN distribution for the Sale Module API, providing global content delivery, caching, security, and performance optimization.

---

## Table of Contents

- [Features](#features)
- [Architecture](#architecture)
- [Prerequisites](#prerequisites)
- [Quick Start](#quick-start)
- [Configuration](#configuration)
- [Deployment](#deployment)
- [Cache Management](#cache-management)
- [Monitoring](#monitoring)
- [Security](#security)
- [Troubleshooting](#troubleshooting)
- [Cost Optimization](#cost-optimization)

---

## Features

### Performance

- **Global Edge Locations**: Content delivered from 400+ edge locations worldwide
- **HTTP/2 and HTTP/3**: Modern protocol support for faster connections
- **Compression**: Automatic Gzip and Brotli compression
- **Smart Caching**: Separate cache policies for API and static assets
- **Connection Reuse**: Origin connection pooling

### Security

- **AWS WAF Integration**: Protection against common web exploits
- **Rate Limiting**: DDoS protection with configurable rate limits
- **Security Headers**: HSTS, CSP, X-Frame-Options, etc.
- **TLS 1.2+**: Modern encryption standards
- **Origin Access Identity**: Secure S3 access without public buckets
- **Managed Rule Sets**: AWS-managed security rules

### Caching

- **Multi-Tier Caching**: Different policies for API vs static content
- **Origin Shield**: Optional additional caching layer
- **Query String Forwarding**: Selective query parameter caching
- **Header Forwarding**: Authorization and custom headers
- **Cache Invalidation**: On-demand and automated invalidation

### Monitoring

- **CloudWatch Metrics**: Request count, bandwidth, error rates
- **Access Logs**: Detailed request logging to S3
- **Real-time Monitoring**: CloudWatch alarms for errors
- **WAF Logging**: Security event tracking

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      CloudFront Distribution                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌──────────────────┐     ┌──────────────────┐                  │
│  │   Edge Location  │     │   Edge Location  │                  │
│  │   (US-East-1)    │     │   (EU-West-1)    │    ... 400+      │
│  └────────┬─────────┘     └────────┬─────────┘                  │
│           │                         │                            │
│           └──────────┬──────────────┘                            │
│                      │                                           │
│           ┌──────────▼──────────┐                                │
│           │  Origin Shield      │  (Optional)                    │
│           │  (US-East-1)        │                                │
│           └──────────┬──────────┘                                │
│                      │                                           │
│         ┌────────────┴────────────┐                              │
│         │                         │                              │
│  ┌──────▼──────┐         ┌───────▼────────┐                     │
│  │ API Gateway │         │  S3 Buckets    │                     │
│  │  (Origin)   │         │  (Attachments  │                     │
│  │             │         │   & Invoices)  │                     │
│  └─────────────┘         └────────────────┘                     │
│                                                                   │
│  Features:                                                        │
│  • AWS WAF (Rate limiting, SQL injection, XSS protection)        │
│  • Cache Policies (API: no-cache, Static: 1-day TTL)            │
│  • Security Headers (HSTS, CSP, X-Frame-Options)                 │
│  • Access Logs → S3                                              │
│  • CloudWatch Alarms                                             │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

### Origins

1. **API Gateway Origin**
   - Path: `/api/*` (default behavior)
   - Caching: Disabled (dynamic content)
   - Methods: GET, POST, PUT, DELETE, PATCH, OPTIONS
   - Headers: Authorization, Content-Type forwarded

2. **Attachments S3 Origin**
   - Path: `/attachments/*`
   - Caching: 1 day default, 1 year max
   - Methods: GET, HEAD, OPTIONS
   - Access: CloudFront OAI (no public access)

3. **Invoices S3 Origin**
   - Path: `/invoices/*`
   - Caching: 1 day default, 1 year max
   - Methods: GET, HEAD, OPTIONS
   - Access: CloudFront OAI (no public access)

---

## Prerequisites

### AWS Resources

- API Gateway deployed and accessible
- S3 buckets created:
  - Attachments bucket
  - Invoices bucket
- (Optional) ACM certificate for custom domain in us-east-1

### AWS Permissions

Required IAM permissions:
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "cloudformation:*",
        "cloudfront:*",
        "s3:*",
        "wafv2:*",
        "cloudwatch:*",
        "iam:CreateRole",
        "iam:AttachRolePolicy"
      ],
      "Resource": "*"
    }
  ]
}
```

### Tools

- AWS CLI v2
- jq (JSON processor)
- bash 4.0+

---

## Quick Start

### 1. Configure Environment

```bash
cd cloudfront

# Edit configuration for your environment
vi config/dev.json
```

Update the following values:
- `ApiGatewayDomainName`: Your API Gateway domain
- `AttachmentsBucketName`: Your attachments S3 bucket
- `InvoicesBucketName`: Your invoices S3 bucket
- (Optional) `ACMCertificateArn`: Your SSL certificate ARN
- (Optional) `CustomDomainName`: Your custom domain

### 2. Deploy CloudFront

```bash
# Deploy to dev environment
./deploy.sh dev deploy

# Deploy to staging
./deploy.sh staging deploy

# Deploy to production
./deploy.sh production deploy
```

### 3. Wait for Deployment

CloudFront deployment takes 15-20 minutes.

Check status:
```bash
./deploy.sh dev status
```

### 4. Configure DNS (if using custom domain)

Get the CloudFront domain name:
```bash
aws cloudformation describe-stacks \
  --stack-name sale-module-cloudfront-dev \
  --region us-east-1 \
  --query 'Stacks[0].Outputs[?OutputKey==`DistributionDomainName`].OutputValue' \
  --output text
```

Create a CNAME record in Route 53 or your DNS provider:
```
api.sale-module.i2speedex.com → d123abc456def.cloudfront.net
```

---

## Configuration

### Environment Files

Configuration files are located in `config/`:

- `dev.json` - Development environment
- `staging.json` - Staging environment
- `production.json` - Production environment

### Configuration Parameters

| Parameter | Description | Example |
|-----------|-------------|---------|
| `Environment` | Environment name | `production` |
| `ApiGatewayDomainName` | API Gateway domain | `abc123.execute-api.us-east-1.amazonaws.com` |
| `ApiGatewayStage` | API Gateway stage | `prod` |
| `AttachmentsBucketName` | Attachments S3 bucket | `sale-module-attachments-prod` |
| `InvoicesBucketName` | Invoices S3 bucket | `sale-module-invoices-prod` |
| `ACMCertificateArn` | SSL certificate ARN | `arn:aws:acm:us-east-1:...` |
| `CustomDomainName` | Custom domain | `api.sale-module.i2speedex.com` |
| `EnableWAF` | Enable AWS WAF | `true` |
| `PriceClass` | Price class | `PriceClass_200` |

### Price Classes

| Price Class | Edge Locations | Use Case |
|-------------|----------------|----------|
| `PriceClass_100` | US, Canada, Europe | Development, lowest cost |
| `PriceClass_200` | US, Canada, Europe, Asia, Middle East, Africa | Staging, regional apps |
| `PriceClass_All` | All edge locations | Production, global apps |

---

## Deployment

### Deploy Distribution

```bash
# Deploy/update distribution
./deploy.sh [ENVIRONMENT] deploy

# Examples
./deploy.sh dev deploy
./deploy.sh staging deploy
./deploy.sh production deploy
```

### Update Existing Distribution

```bash
# Update configuration
./deploy.sh [ENVIRONMENT] update
```

### Delete Distribution

```bash
# Delete distribution (requires confirmation)
./deploy.sh [ENVIRONMENT] delete
```

**Warning**: Deletion disables the distribution first (takes ~15 minutes), then deletes the stack.

### Check Status

```bash
# Get distribution status and statistics
./deploy.sh [ENVIRONMENT] status
```

Output includes:
- Stack status
- Distribution ID
- Distribution status (Deployed/InProgress)
- Domain name
- Request count (last hour)
- Bandwidth usage
- Error rate

---

## Cache Management

### Cache Policies

#### API Cache Policy
- **TTL**: 0 seconds (no caching)
- **Use Case**: Dynamic API responses
- **Headers**: Authorization, Accept, Content-Type forwarded
- **Query Strings**: All forwarded
- **Compression**: Gzip, Brotli enabled

#### Static Assets Cache Policy
- **Default TTL**: 86400 seconds (1 day)
- **Max TTL**: 31536000 seconds (1 year)
- **Use Case**: Attachments, invoices, static files
- **Headers**: None forwarded
- **Query Strings**: None forwarded
- **Compression**: Gzip, Brotli enabled

### Cache Invalidation

Invalidate cache after deployments or content changes:

```bash
# Invalidate all paths
./deploy.sh [ENVIRONMENT] invalidate

# Using AWS CLI
DIST_ID=$(aws cloudformation describe-stacks \
  --stack-name sale-module-cloudfront-production \
  --query 'Stacks[0].Outputs[?OutputKey==`DistributionId`].OutputValue' \
  --output text)

aws cloudfront create-invalidation \
  --distribution-id $DIST_ID \
  --paths "/*"

# Invalidate specific paths
aws cloudfront create-invalidation \
  --distribution-id $DIST_ID \
  --paths "/api/sales/*" "/attachments/*"
```

**Cost**: First 1,000 invalidations per month are free, then $0.005 per path.

### Cache Behavior Priority

Behaviors are evaluated in order:

1. `/attachments/*` → Attachments S3 origin (cached)
2. `/invoices/*` → Invoices S3 origin (cached)
3. `/*` (default) → API Gateway origin (not cached)

---

## Monitoring

### CloudWatch Metrics

Key metrics tracked:

- **Requests**: Total number of requests
- **BytesDownloaded**: Total data transferred
- **BytesUploaded**: Total data received
- **4xxErrorRate**: Client error rate
- **5xxErrorRate**: Server error rate
- **CacheHitRate**: Percentage of requests served from cache

### View Metrics

```bash
# Via deploy script
./deploy.sh production status

# Via AWS Console
# CloudWatch → Metrics → CloudFront → Per-Distribution Metrics

# Via AWS CLI
aws cloudwatch get-metric-statistics \
  --namespace AWS/CloudFront \
  --metric-name Requests \
  --dimensions Name=DistributionId,Value=EXAMPLEID \
  --start-time 2026-01-30T00:00:00Z \
  --end-time 2026-01-30T23:59:59Z \
  --period 3600 \
  --statistics Sum
```

### CloudWatch Alarms

Automatically created alarms:

1. **5xxErrorRate** - Alert when >5%
   - Evaluation: 2 periods of 5 minutes
   - Action: SNS notification

2. **4xxErrorRate** - Alert when >25%
   - Evaluation: 2 periods of 5 minutes
   - Action: SNS notification

### Access Logs

Logs are stored in S3:
```
s3://sale-module-cdn-logs-{environment}-{account-id}/cloudfront/{environment}/
```

Log format: W3C extended log format

Fields include:
- Date, time, edge location
- Client IP
- HTTP method, URI, status code
- Bytes transferred
- User agent
- Referer

**Retention**: 90 days (30 days Standard, 60 days Standard-IA)

### Analyze Logs

```bash
# Download recent logs
aws s3 sync \
  s3://sale-module-cdn-logs-production-123456789012/cloudfront/production/ \
  ./logs/ \
  --exclude "*" \
  --include "$(date +%Y-%m-%d)*"

# Top 10 requested paths
zcat logs/*.gz | awk '{print $8}' | sort | uniq -c | sort -rn | head -10

# Top 10 client IPs
zcat logs/*.gz | awk '{print $5}' | sort | uniq -c | sort -rn | head -10

# Error rate
zcat logs/*.gz | awk '$9 >= 400 {errors++} END {print errors/NR*100"%"}'
```

---

## Security

### AWS WAF (Web Application Firewall)

Enabled in staging and production environments.

#### Managed Rules

1. **Rate Limiting**
   - Production: 2,000 requests per 5 minutes per IP
   - Staging: 10,000 requests per 5 minutes per IP
   - Action: Block

2. **Core Rule Set** (AWSManagedRulesCommonRuleSet)
   - OWASP Top 10 protection
   - SQL injection prevention
   - Cross-site scripting (XSS) prevention
   - Action: Block

3. **Known Bad Inputs** (AWSManagedRulesKnownBadInputsRuleSet)
   - Protection against known malicious patterns
   - Action: Block

4. **SQL Injection** (AWSManagedRulesSQLiRuleSet)
   - Advanced SQL injection protection
   - Action: Block

#### Custom Rules

Add custom rules in `cloudfront.yaml`:

```yaml
- Name: BlockSpecificUserAgent
  Priority: 10
  Statement:
    ByteMatchStatement:
      SearchString: "BadBot"
      FieldToMatch:
        SingleHeader:
          Name: user-agent
      TextTransformations:
        - Priority: 0
          Type: LOWERCASE
  Action:
    Block: {}
  VisibilityConfig:
    SampledRequestsEnabled: true
    CloudWatchMetricsEnabled: true
    MetricName: BlockSpecificUserAgent
```

### Security Headers

Response headers automatically added:

```
Strict-Transport-Security: max-age=63072000; includeSubdomains
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
X-XSS-Protection: 1; mode=block
Referrer-Policy: strict-origin-when-cross-origin
```

### CORS Configuration

CORS headers for API requests:

```
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS
Access-Control-Allow-Headers: *
```

**Note**: Adjust `Access-Control-Allow-Origin` to specific domains in production.

### Origin Access Identity (OAI)

S3 buckets are accessed via OAI, not public access:

- CloudFront uses OAI to access S3
- S3 bucket policies allow only OAI
- Direct S3 URLs are blocked

### TLS/SSL

- **Minimum Protocol**: TLS 1.2
- **Certificate**: ACM-issued or imported certificate
- **SNI**: Server Name Indication enabled
- **Viewer Protocol**: Redirect HTTP to HTTPS

---

## Troubleshooting

### Distribution Not Updating

**Problem**: Changes not visible after deployment

**Solutions**:
1. Wait 15-20 minutes for deployment to complete
2. Check distribution status: `./deploy.sh [env] status`
3. Invalidate cache: `./deploy.sh [env] invalidate`
4. Clear browser cache

### 403 Forbidden Errors

**Problem**: S3 objects return 403

**Solutions**:
1. Verify OAI has access to S3 buckets
2. Check S3 bucket policies
3. Ensure objects exist in S3
4. Verify object permissions

```bash
# Check bucket policy
aws s3api get-bucket-policy --bucket sale-module-attachments-production

# Test object access
aws s3api head-object \
  --bucket sale-module-attachments-production \
  --key attachments/test.pdf
```

### 504 Gateway Timeout

**Problem**: Requests timing out

**Solutions**:
1. Check API Gateway origin health
2. Increase Lambda timeout
3. Optimize slow Lambda functions
4. Check origin connection

```bash
# Test origin directly
curl -I https://abc123.execute-api.us-east-1.amazonaws.com/prod/api/health
```

### High Error Rate

**Problem**: 5xx errors above threshold

**Solutions**:
1. Check CloudWatch Logs for Lambda errors
2. Review API Gateway logs
3. Check DynamoDB throttling
4. Scale Lambda concurrency

```bash
# View CloudWatch metrics
aws cloudwatch get-metric-statistics \
  --namespace AWS/CloudFront \
  --metric-name 5xxErrorRate \
  --dimensions Name=DistributionId,Value=EXAMPLEID \
  --start-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 300 \
  --statistics Average
```

### Cache Not Working

**Problem**: Low cache hit rate

**Solutions**:
1. Verify cache policy settings
2. Check if query strings are varying
3. Ensure cache behaviors match paths
4. Review cache headers from origin

```bash
# Test cache headers
curl -I https://d123abc.cloudfront.net/attachments/test.pdf

# Look for:
# X-Cache: Hit from cloudfront
# Age: 3600
```

### WAF Blocking Legitimate Traffic

**Problem**: False positives from WAF rules

**Solutions**:
1. Review WAF sampled requests
2. Create exception rules
3. Adjust rate limits
4. Disable specific managed rules

```bash
# View blocked requests
aws wafv2 get-sampled-requests \
  --web-acl-arn arn:aws:wafv2:... \
  --rule-metric-name RateLimitRule \
  --scope CLOUDFRONT \
  --time-window StartTime=...,EndTime=...
```

---

## Cost Optimization

### Estimated Costs

#### Development Environment
- Data Transfer: $0.085/GB (first 10 TB)
- Requests: $0.0075 per 10,000 requests (HTTP)
- Certificate: Free (ACM)
- Invalidations: First 1,000/month free
- **Estimated**: ~$50/month (low traffic)

#### Production Environment
- Data Transfer: $0.085/GB (first 10 TB), $0.060/GB (next 40 TB)
- Requests: $0.0075 per 10,000 requests (HTTP)
- WAF: $5/month + $1 per million requests
- Certificate: Free (ACM)
- Origin Shield: $0.010 per 10,000 requests (optional)
- **Estimated**: ~$200-500/month (moderate traffic)

### Cost Reduction Strategies

1. **Optimize Cache TTL**
   - Increase TTL for static content
   - Use versioned URLs for immutable content
   - Cache API responses when possible

2. **Compress Content**
   - Enable Gzip/Brotli compression (automatic)
   - Serve compressed assets from origin
   - Reduce payload sizes

3. **Use Appropriate Price Class**
   - Development: PriceClass_100 (US, Europe only)
   - Production: PriceClass_200 (exclude Oceania if not needed)

4. **Optimize Invalidations**
   - Use versioned URLs instead of invalidations
   - Batch invalidations
   - Use wildcard paths

5. **Monitor and Optimize**
   - Review CloudWatch metrics weekly
   - Identify and cache frequently accessed content
   - Remove unused distributions

### Cost Calculator

AWS Pricing Calculator: https://calculator.aws/

Example calculation for production:
- 100 GB data transfer: $8.50
- 10 million requests: $7.50
- WAF: $6.00
- **Total**: ~$22/month

---

## Best Practices

### Performance

1. ✅ Use HTTP/2 and HTTP/3
2. ✅ Enable compression
3. ✅ Set appropriate cache TTLs
4. ✅ Use Origin Shield for high-traffic origins
5. ✅ Optimize images and assets before uploading
6. ✅ Use versioned URLs for cache busting
7. ✅ Minimize redirects
8. ✅ Use appropriate price class for your users

### Security

1. ✅ Always use HTTPS
2. ✅ Enable WAF in production
3. ✅ Use OAI for S3 access
4. ✅ Implement rate limiting
5. ✅ Add security headers
6. ✅ Regularly review WAF logs
7. ✅ Use custom domains with ACM certificates
8. ✅ Enable access logging

### Operations

1. ✅ Monitor CloudWatch metrics daily
2. ✅ Set up CloudWatch alarms
3. ✅ Test cache invalidation process
4. ✅ Document custom configurations
5. ✅ Use Infrastructure as Code (CloudFormation)
6. ✅ Tag all resources appropriately
7. ✅ Regular cost reviews
8. ✅ Test disaster recovery procedures

---

## Additional Resources

- [AWS CloudFront Documentation](https://docs.aws.amazon.com/cloudfront/)
- [AWS WAF Documentation](https://docs.aws.amazon.com/waf/)
- [CloudFront Best Practices](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/best-practices.html)
- [CloudFront Pricing](https://aws.amazon.com/cloudfront/pricing/)

---

## Support

For issues or questions:
- **Infrastructure**: #infrastructure Slack channel
- **Security**: #security Slack channel
- **Emergencies**: Incident hotline

## Maintenance

- **Review**: Monthly
- **Updates**: As needed
- **Cost Review**: Monthly
- **Security Audit**: Quarterly
