# Custom Domain Setup Complete

## Overview

Custom domain configuration for `app.speedex.it` with CloudFront has been fully implemented and documented.

**Domain**: `app.speedex.it`
**Certificate**: `*.speedex.it` (wildcard)
**Status**: ✅ Ready for Deployment

---

## What Was Created

### 1. Setup Script: `setup-custom-domain.sh` ✅

**Purpose**: Automated setup for ACM certificate and CloudFront configuration

**Features**:
- Checks for existing `*.speedex.it` certificate in us-east-1
- Creates new ACM certificate if needed with DNS validation
- Automatically adds DNS validation records to Route 53
- Waits for certificate validation (5-10 minutes)
- Updates CloudFront configuration files with certificate ARN and custom domain
- Saves configuration for next steps

**Usage**:
```bash
./setup-custom-domain.sh --environment production
```

**What It Does**:
1. ✅ Check for existing ACM certificate
2. ✅ Create new certificate if needed
3. ✅ Add DNS validation records
4. ✅ Wait for certificate validation
5. ✅ Update CloudFront config
6. ✅ Save configuration

**Duration**: 10-15 minutes (includes certificate validation)

---

### 2. CNAME Creation Script: `create-cname.sh` ✅

**Purpose**: Creates Route 53 CNAME record pointing to CloudFront distribution

**Features**:
- Looks up Route 53 hosted zone for speedex.it
- Creates or updates CNAME record for app.speedex.it
- Waits for DNS propagation
- Verifies DNS resolution
- Tests endpoint availability

**Usage**:
```bash
# Get CloudFront domain
DIST_DOMAIN=$(aws cloudformation describe-stacks \
  --stack-name sale-module-cloudfront-production \
  --region us-east-1 \
  --query 'Stacks[0].Outputs[?OutputKey==`DistributionDomainName`].OutputValue' \
  --output text)

# Create CNAME
./create-cname.sh --environment production --cloudfront-domain $DIST_DOMAIN
```

**What It Does**:
1. ✅ Lookup Route 53 hosted zone
2. ✅ Check for existing CNAME
3. ✅ Create/update CNAME record
4. ✅ Wait for DNS propagation
5. ✅ Verify DNS resolution

**Duration**: 2-5 minutes

---

### 3. Documentation: `CUSTOM_DOMAIN_SETUP.md` ✅

**Comprehensive 40+ page guide covering**:

#### Quick Start
- Complete setup in 4 commands
- 15-20 minute total setup time

#### Architecture
- DNS flow diagram
- Component overview
- Integration points

#### Detailed Setup Steps
1. Certificate management (new or existing)
2. CloudFront deployment
3. Route 53 DNS configuration
4. Testing and verification

#### Certificate Management
- Wildcard certificate (`*.speedex.it`)
- DNS validation setup
- Automatic renewal
- Status checking

#### DNS Configuration
- CNAME record creation
- Validation records
- DNS propagation testing
- Multiple environment setup

#### Troubleshooting
- Certificate validation issues
- DNS resolution problems
- SSL certificate errors
- CloudFront 403/502 errors
- Complete diagnostic commands

#### Security Considerations
- HTTPS-only enforcement
- TLS 1.2+ requirement
- Security headers configuration
- WAF protection rules

#### Cost Implications
- ACM: FREE
- Route 53: ~$0.50/month
- CloudFront: $10-900/month (based on traffic)

#### Monitoring and Maintenance
- CloudWatch alarms
- CloudFront logs
- Certificate expiration monitoring
- Health check setup

#### Rollback Procedures
- Revert to CloudFront domain
- Remove custom domain
- Emergency procedures

#### Best Practices
- Pre-production testing
- Change management
- Security guidelines
- Performance optimization

---

## Complete Deployment Flow

### Step-by-Step Process

```bash
cd /Users/vicio/i2speedex/lambda-building-blocks/functions/sale-module-api

# Step 1: Setup custom domain (10-15 min)
./setup-custom-domain.sh --environment production

# Expected output:
# - ✓ Found/created certificate
# - ✓ DNS validation added
# - ✓ Certificate validated
# - ✓ CloudFront config updated

# Step 2: Deploy CloudFront (5-10 min)
cd cloudfront
./deploy.sh production deploy

# Expected output:
# - CloudFormation stack UPDATE_IN_PROGRESS
# - Distribution updated with custom domain
# - Certificate attached

# Step 3: Get CloudFront domain
DIST_DOMAIN=$(aws cloudformation describe-stacks \
  --stack-name sale-module-cloudfront-production \
  --region us-east-1 \
  --query 'Stacks[0].Outputs[?OutputKey==`DistributionDomainName`].OutputValue' \
  --output text)

echo "CloudFront Domain: $DIST_DOMAIN"

# Step 4: Create DNS record (2-5 min)
cd ..
./create-cname.sh --environment production --cloudfront-domain $DIST_DOMAIN

# Expected output:
# - ✓ CNAME record created
# - ✓ DNS propagated
# - ✓ DNS resolves correctly

# Step 5: Test (1 min)
curl -I https://app.speedex.it/api/health

# Expected: HTTP/2 200 OK
```

**Total Time**: ~20-30 minutes

---

## File Structure

```
lambda-building-blocks/functions/sale-module-api/
├── setup-custom-domain.sh           # Certificate and config setup (executable)
├── create-cname.sh                  # DNS record creation (executable)
├── CUSTOM_DOMAIN_SETUP.md           # Complete documentation (40+ pages)
└── CUSTOM_DOMAIN_COMPLETE.md        # This summary

cloudfront/
├── config/
│   ├── dev.json                     # Updated with ACM cert and domain
│   ├── staging.json                 # Updated with ACM cert and domain
│   └── production.json              # Updated with ACM cert and domain
└── deploy.sh                        # CloudFront deployment

/tmp/
└── custom-domain-setup.env          # Setup configuration (after running setup)
```

---

## Technical Architecture

### Components

#### ACM Certificate
- **Domain**: `*.speedex.it` (wildcard)
- **Region**: us-east-1 (required for CloudFront)
- **Validation**: DNS (automatic via Route 53)
- **SANs**: speedex.it, app.speedex.it
- **Renewal**: Automatic (free)

#### CloudFront Distribution
- **Custom Domain**: app.speedex.it
- **SSL Certificate**: `*.speedex.it` from ACM
- **Protocol**: HTTPS only (HTTP redirects to HTTPS)
- **TLS**: Minimum version 1.2
- **Security**: WAF enabled with 4 rule sets
- **Caching**: Optimized cache policies
- **Origins**: API Gateway, S3, Lambda URL

#### Route 53 DNS
- **Hosted Zone**: speedex.it
- **CNAME Record**: app.speedex.it → {cloudfront-domain}
- **TTL**: 300 seconds
- **Validation CNAME**: For ACM certificate validation

### Request Flow

```
User Browser
    ↓ (HTTPS request)
app.speedex.it
    ↓ (DNS lookup - Route 53)
d1234567890.cloudfront.net (CNAME)
    ↓ (Edge location)
CloudFront Distribution
    ↓ (TLS termination with ACM cert)
    ├─→ API Gateway (API calls)
    ├─→ S3 (static files)
    └─→ Lambda URL (function invocations)
        ↓
Backend Services (Lambda, DynamoDB, S3)
```

---

## Security Features

### SSL/TLS
- ✅ TLS 1.2+ only
- ✅ Modern cipher suites
- ✅ Perfect Forward Secrecy (PFS)
- ✅ Automatic certificate renewal

### Security Headers
```
Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
X-XSS-Protection: 1; mode=block
Content-Security-Policy: default-src 'self'
```

### WAF Rules
- ✅ Core Rule Set (OWASP Top 10)
- ✅ Known Bad Inputs protection
- ✅ SQL Injection protection
- ✅ Linux OS protection

### Access Control
- ✅ CloudFront access logs enabled
- ✅ Origin access identity for S3
- ✅ API Gateway authorization
- ✅ Lambda execution roles

---

## Testing Checklist

After deployment, verify:

### DNS Resolution
```bash
# Check CNAME record
dig app.speedex.it CNAME

# Check A record resolution
dig app.speedex.it A

# Test from multiple DNS servers
dig @8.8.8.8 app.speedex.it
dig @1.1.1.1 app.speedex.it
```

### SSL Certificate
```bash
# Check certificate
openssl s_client -connect app.speedex.it:443 -servername app.speedex.it < /dev/null

# Verify certificate details
echo | openssl s_client -servername app.speedex.it -connect app.speedex.it:443 2>/dev/null | openssl x509 -noout -text
```

### API Endpoints
```bash
# Health check
curl -I https://app.speedex.it/api/health

# Full health check
curl https://app.speedex.it/api/health

# Verbose output
curl -v https://app.speedex.it/api/health 2>&1 | grep -E "HTTP|Server|X-Cache"
```

### Expected Results
- ✅ DNS resolves to CloudFront distribution
- ✅ SSL certificate valid for `*.speedex.it`
- ✅ HTTPS connection successful (no warnings)
- ✅ HTTP/2 200 OK response
- ✅ CloudFront headers present (`X-Amz-Cf-Id`, `X-Cache`)
- ✅ Security headers present (HSTS, X-Frame-Options, etc.)

---

## Cost Analysis

### Initial Setup
- **ACM Certificate**: FREE
- **Route 53 Hosted Zone**: $0.50/month (if new)
- **CloudFront Distribution**: No setup cost

### Ongoing Costs

#### Low Traffic (100 GB/month, 1M requests)
- Route 53: $0.50/month (hosted zone)
- CloudFront Data Transfer: $8.50/month (100 GB × $0.085)
- CloudFront Requests: $0.75/month (1M × $0.0075/10K)
- **Total**: ~$10/month

#### Medium Traffic (1 TB/month, 10M requests)
- Route 53: $0.50/month
- CloudFront Data Transfer: $85/month (1 TB × $0.085)
- CloudFront Requests: $7.50/month (10M × $0.0075/10K)
- **Total**: ~$93/month

#### High Traffic (10 TB/month, 100M requests)
- Route 53: $0.50/month
- CloudFront Data Transfer: $850/month (10 TB × $0.085)
- CloudFront Requests: $75/month (100M × $0.0075/10K)
- **Total**: ~$925/month

**Note**: Costs decrease with higher volumes due to tiered pricing.

---

## Environment Configuration

### Development
```bash
# Domain: dev.app.speedex.it (if needed)
./setup-custom-domain.sh --environment dev
cd cloudfront && ./deploy.sh dev deploy
```

### Staging
```bash
# Domain: staging.app.speedex.it (if needed)
./setup-custom-domain.sh --environment staging
cd cloudfront && ./deploy.sh staging deploy
```

### Production
```bash
# Domain: app.speedex.it
./setup-custom-domain.sh --environment production
cd cloudfront && ./deploy.sh production deploy
```

**Note**: All environments can use the same `*.speedex.it` wildcard certificate.

---

## Monitoring Setup

### CloudWatch Alarms

After deployment, create alarms:

```bash
# Get distribution ID
DIST_ID=$(aws cloudformation describe-stacks \
  --stack-name sale-module-cloudfront-production \
  --region us-east-1 \
  --query 'Stacks[0].Outputs[?OutputKey==`DistributionId`].OutputValue' \
  --output text)

# Create 4xx error alarm
aws cloudwatch put-metric-alarm \
  --alarm-name app-speedex-it-4xx-errors \
  --alarm-description "High 4xx error rate on app.speedex.it" \
  --metric-name 4xxErrorRate \
  --namespace AWS/CloudFront \
  --statistic Average \
  --period 300 \
  --threshold 5 \
  --comparison-operator GreaterThanThreshold \
  --dimensions Name=DistributionId,Value=$DIST_ID

# Create 5xx error alarm
aws cloudwatch put-metric-alarm \
  --alarm-name app-speedex-it-5xx-errors \
  --alarm-description "High 5xx error rate on app.speedex.it" \
  --metric-name 5xxErrorRate \
  --namespace AWS/CloudFront \
  --statistic Average \
  --period 300 \
  --threshold 1 \
  --comparison-operator GreaterThanThreshold \
  --dimensions Name=DistributionId,Value=$DIST_ID
```

### Access Logs

CloudFront access logs are stored in:
```
s3://sale-module-logs-{environment}/cloudfront/
```

Analyze logs:
```bash
# Download recent logs
aws s3 sync s3://sale-module-logs-production/cloudfront/ ./logs/ --exclude "*" --include "*.gz"

# Uncompress and analyze
gunzip logs/*.gz
cat logs/*.log | grep "app.speedex.it" | wc -l
```

---

## Maintenance

### Certificate Renewal
- **Automatic**: ACM handles renewal automatically
- **Requirement**: DNS validation records must remain in Route 53
- **Notification**: ACM sends email 45 days before expiration
- **Action Required**: None (if DNS records are in place)

### DNS Updates
- **CNAME Changes**: Use `create-cname.sh` script
- **TTL**: 300 seconds (5 minutes for changes to propagate)
- **Testing**: Always test in dev environment first

### CloudFront Updates
- **Configuration Changes**: Update via `cloudfront/deploy.sh`
- **Invalidations**: Use AWS CLI or console
- **Monitoring**: Watch CloudWatch metrics during changes

---

## Troubleshooting Reference

### Quick Diagnostics

```bash
# Check certificate status
aws acm list-certificates --region us-east-1

# Check DNS
dig app.speedex.it

# Check SSL
openssl s_client -connect app.speedex.it:443 -servername app.speedex.it < /dev/null

# Check CloudFront distribution
aws cloudfront list-distributions --query "DistributionList.Items[?Aliases.Items[?contains(@, 'app.speedex.it')]]"

# Check Route 53 records
aws route53 list-resource-record-sets --hosted-zone-id YOUR_ZONE_ID
```

### Common Issues

1. **Certificate Validation Pending** → Check DNS validation record in Route 53
2. **DNS Not Resolving** → Wait 5-10 minutes for propagation
3. **SSL Error** → Verify certificate is in us-east-1 and includes domain
4. **403 Forbidden** → Check WAF rules and origin configuration
5. **502 Bad Gateway** → Verify API Gateway is accessible

**See CUSTOM_DOMAIN_SETUP.md for detailed troubleshooting steps.**

---

## Next Steps

### Immediate Actions

1. **Deploy to Dev First**
   ```bash
   ./setup-custom-domain.sh --environment dev
   cd cloudfront && ./deploy.sh dev deploy
   # Test thoroughly
   ```

2. **Deploy to Production**
   ```bash
   ./setup-custom-domain.sh --environment production
   cd cloudfront && ./deploy.sh production deploy
   # Get distribution domain and create CNAME
   ```

3. **Test Thoroughly**
   - DNS resolution
   - SSL certificate
   - API endpoints
   - Security headers
   - Performance

### Follow-Up Tasks

1. **Update Documentation**
   - API documentation with new domain
   - Integration guides
   - Client SDKs

2. **Update Client Applications**
   - Frontend app configuration
   - Mobile apps
   - Third-party integrations

3. **Setup Monitoring**
   - CloudWatch alarms
   - Synthetic monitoring
   - Log analysis
   - Performance tracking

4. **Enable Advanced Features**
   - Origin Shield (if needed)
   - Real-time logs
   - CloudFront Functions
   - Lambda@Edge

---

## Summary

✅ **Custom Domain Setup Complete**

**What You Have**:
- Automated setup scripts (2 files)
- Comprehensive documentation (40+ pages)
- Production-ready configuration
- Security best practices
- Monitoring guidelines
- Troubleshooting procedures

**What To Do**:
1. Run `setup-custom-domain.sh` for your environment
2. Deploy CloudFront with `cloudfront/deploy.sh`
3. Create DNS record with `create-cname.sh`
4. Test and verify
5. Update client applications

**Result**:
`https://app.speedex.it/api/*` will be live with:
- ✅ Free SSL certificate
- ✅ CloudFront CDN performance
- ✅ WAF security protection
- ✅ HTTPS-only access
- ✅ Automatic certificate renewal
- ✅ Professional branded domain

**Estimated Setup Time**: 20-30 minutes

---

## Files Created

1. ✅ `setup-custom-domain.sh` - Main setup script (executable)
2. ✅ `create-cname.sh` - DNS record creation (executable)
3. ✅ `CUSTOM_DOMAIN_SETUP.md` - Complete documentation (40+ pages)
4. ✅ `CUSTOM_DOMAIN_COMPLETE.md` - This summary

**All ready for deployment!**
