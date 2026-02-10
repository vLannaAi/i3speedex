# Custom Domain Setup Guide: app.speedex.it

## Overview

This guide covers setting up the custom domain `app.speedex.it` for the Sale Module API with CloudFront CDN, including ACM certificate management and Route 53 DNS configuration.

**Domain**: `app.speedex.it`
**Certificate**: `*.speedex.it` (wildcard)
**CDN**: CloudFront distribution
**DNS**: Route 53

---

## Architecture

```
User Request (HTTPS)
    ↓
app.speedex.it (Route 53 CNAME)
    ↓
CloudFront Distribution (*.speedex.it SSL)
    ↓
┌─────────────────────────────────────┐
│ Origin 1: API Gateway (API traffic) │
│ Origin 2: S3 Static (static files)  │
│ Origin 3: Lambda URL (functions)    │
└─────────────────────────────────────┘
```

**Key Components**:
- **ACM Certificate**: `*.speedex.it` wildcard certificate in us-east-1
- **CloudFront**: Custom domain alias with HTTPS
- **Route 53**: CNAME record pointing to CloudFront distribution
- **WAF**: Web Application Firewall for security

---

## Prerequisites

### Required Tools
```bash
# AWS CLI
aws --version  # 2.x required

# jq (JSON processor)
jq --version

# dig (DNS lookup)
dig -v
```

### AWS Permissions
Your AWS user/role needs:
- `acm:*` - Certificate management
- `route53:*` - DNS management
- `cloudfront:*` - CDN management
- `cloudformation:*` - Stack updates

### Existing Resources
- Route 53 hosted zone for `speedex.it`
- CloudFront distribution deployed (from cloudfront/deploy.sh)
- IAM permissions configured

---

## Quick Start

### Complete Setup (New Certificate)

```bash
cd /Users/vicio/i2speedex/lambda-building-blocks/functions/sale-module-api

# Step 1: Setup custom domain (creates certificate, updates config)
./setup-custom-domain.sh --environment production

# Step 2: Deploy CloudFront with custom domain
cd cloudfront
./deploy.sh production deploy

# Step 3: Get CloudFront distribution domain
DIST_DOMAIN=$(aws cloudformation describe-stacks \
  --stack-name sale-module-cloudfront-production \
  --region us-east-1 \
  --query 'Stacks[0].Outputs[?OutputKey==`DistributionDomainName`].OutputValue' \
  --output text)

echo "CloudFront Domain: $DIST_DOMAIN"

# Step 4: Create CNAME record
cd ..
./create-cname.sh --environment production --cloudfront-domain $DIST_DOMAIN

# Step 5: Test
curl -I https://app.speedex.it/api/health
```

**Total Time**: ~15-20 minutes (including certificate validation)

---

## Detailed Setup Steps

### Step 1: Setup Custom Domain and Certificate

The `setup-custom-domain.sh` script handles:
1. Checking for existing `*.speedex.it` certificate
2. Creating new certificate if needed
3. Adding DNS validation records to Route 53
4. Waiting for certificate validation
5. Updating CloudFront configuration files

**Usage**:
```bash
./setup-custom-domain.sh --environment production
```

**What it does**:
- **Checks ACM**: Looks for existing `*.speedex.it` certificate in us-east-1
- **Creates Certificate** (if needed):
  - Domain: `*.speedex.it`
  - SANs: `speedex.it`, `app.speedex.it`
  - Validation: DNS (automatic via Route 53)
- **DNS Validation**: Automatically adds CNAME records to Route 53
- **Updates Config**: Modifies `cloudfront/config/{env}.json` with:
  - `ACMCertificateArn`: Certificate ARN
  - `CustomDomainName`: `app.speedex.it`

**Output Files**:
- `/tmp/custom-domain-setup.env` - Configuration for next steps
- `cloudfront/config/production.json` - Updated with certificate and domain

**Expected Output**:
```
==========================================
Custom Domain Setup: app.speedex.it
==========================================
Environment: production
Domain: app.speedex.it
Wildcard: *.speedex.it
Region: us-east-1 (required for CloudFront)

[Step 1/6] Checking for existing ACM certificate...
✓ Found existing certificate: arn:aws:acm:us-east-1:...:certificate/...
  Status: ISSUED

[Step 5/6] Updating CloudFront configuration...
✓ Updated cloudfront/config/production.json
  ACMCertificateArn: arn:aws:acm:us-east-1:...:certificate/...
  CustomDomainName: app.speedex.it

==========================================
Custom Domain Setup Complete!
==========================================
```

### Step 2: Deploy CloudFront Distribution

After updating the configuration, deploy CloudFront:

```bash
cd cloudfront
./deploy.sh production deploy
```

**What it does**:
- Updates CloudFront distribution with custom domain alias
- Configures SSL certificate
- Updates origins and cache behaviors
- Applies WAF rules

**Duration**: ~5-10 minutes (CloudFront distribution update)

**Verify Deployment**:
```bash
# Check stack status
aws cloudformation describe-stacks \
  --stack-name sale-module-cloudfront-production \
  --region us-east-1 \
  --query 'Stacks[0].StackStatus' \
  --output text

# Get distribution domain
aws cloudformation describe-stacks \
  --stack-name sale-module-cloudfront-production \
  --region us-east-1 \
  --query 'Stacks[0].Outputs[?OutputKey==`DistributionDomainName`].OutputValue' \
  --output text
```

### Step 3: Create Route 53 CNAME Record

The `create-cname.sh` script creates the DNS record:

```bash
# Get CloudFront domain from stack output
DIST_DOMAIN=$(aws cloudformation describe-stacks \
  --stack-name sale-module-cloudfront-production \
  --region us-east-1 \
  --query 'Stacks[0].Outputs[?OutputKey==`DistributionDomainName`].OutputValue' \
  --output text)

# Create CNAME
./create-cname.sh --environment production --cloudfront-domain $DIST_DOMAIN
```

**What it does**:
- Looks up Route 53 hosted zone for `speedex.it`
- Creates/updates CNAME record: `app.speedex.it → {cloudfront-domain}`
- Waits for DNS propagation
- Verifies DNS resolution

**Expected Output**:
```
==========================================
Create CNAME Record: app.speedex.it
==========================================
Environment: production
Domain: app.speedex.it
Target: d1234567890.cloudfront.net

[Step 1/4] Looking up Route 53 hosted zone...
✓ Found hosted zone: Z1234567890ABC

[Step 2/4] Checking for existing CNAME record...
No existing record found. A new CNAME will be created.

[Step 3/4] Creating CNAME record in Route 53...
✓ CNAME record created/updated
  Change ID: C1234567890XYZ

[Step 4/4] Waiting for DNS propagation...
✓ DNS change propagated!

Verifying DNS resolution...
✓ DNS resolves to: d1234567890.cloudfront.net

==========================================
CNAME Record Created!
==========================================
```

### Step 4: Verify and Test

Wait 5-10 minutes for full DNS propagation, then test:

**DNS Verification**:
```bash
# Check DNS resolution
dig app.speedex.it

# Check CNAME record
dig app.speedex.it CNAME

# Check from Google DNS
dig @8.8.8.8 app.speedex.it

# Check from Cloudflare DNS
dig @1.1.1.1 app.speedex.it
```

**SSL/TLS Verification**:
```bash
# Check SSL certificate
openssl s_client -connect app.speedex.it:443 -servername app.speedex.it < /dev/null

# Verify certificate details
echo | openssl s_client -servername app.speedex.it -connect app.speedex.it:443 2>/dev/null | openssl x509 -noout -subject -issuer -dates
```

**API Testing**:
```bash
# Health check
curl -I https://app.speedex.it/api/health

# Full request
curl -X GET https://app.speedex.it/api/health

# With verbose output
curl -v https://app.speedex.it/api/health

# Test authentication
curl -X POST https://app.speedex.it/api/sales \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"buyerId":"B001","producerId":"P001"}'
```

**Expected Responses**:
- **200 OK**: Service working correctly
- **SSL**: Certificate valid for `*.speedex.it`
- **Headers**: Should include CloudFront headers (`X-Cache`, `X-Amz-Cf-Id`)

---

## Using Existing Certificate

If you already have a `*.speedex.it` certificate:

```bash
# The script will automatically detect it
./setup-custom-domain.sh --environment production

# Output will show:
# [Step 1/6] Checking for existing ACM certificate...
# ✓ Found existing certificate: arn:aws:acm:us-east-1:...:certificate/...
#   Status: ISSUED
```

**Manual Certificate Specification**:
If you want to use a specific certificate ARN, you can manually update the CloudFront config:

```bash
# Edit config file
jq --arg cert "arn:aws:acm:us-east-1:123456789012:certificate/your-cert-id" \
   '.Parameters.ACMCertificateArn = $cert' \
   cloudfront/config/production.json > tmp.json && mv tmp.json cloudfront/config/production.json
```

---

## Environment-Specific Setup

### Development Environment

```bash
# Use dev subdomain: dev.app.speedex.it
DOMAIN="dev.app.speedex.it"

# Setup certificate (same wildcard works)
./setup-custom-domain.sh --environment dev

# Deploy
cd cloudfront && ./deploy.sh dev deploy

# Create CNAME for dev subdomain
# (Requires updating DOMAIN variable in create-cname.sh or using dev.app.speedex.it)
```

### Staging Environment

```bash
# Use staging subdomain: staging.app.speedex.it
./setup-custom-domain.sh --environment staging
cd cloudfront && ./deploy.sh staging deploy
```

### Production Environment

```bash
# Use main domain: app.speedex.it
./setup-custom-domain.sh --environment production
cd cloudfront && ./deploy.sh production deploy
```

---

## Certificate Management

### Certificate Details

**Certificate**: `*.speedex.it` wildcard
**Region**: us-east-1 (required for CloudFront)
**Validation**: DNS (via Route 53)
**Subject Alternative Names** (SANs):
- `*.speedex.it`
- `speedex.it`
- `app.speedex.it`

### Check Certificate Status

```bash
# List certificates
aws acm list-certificates --region us-east-1

# Get certificate details
CERT_ARN="arn:aws:acm:us-east-1:123456789012:certificate/your-cert-id"
aws acm describe-certificate \
  --certificate-arn "$CERT_ARN" \
  --region us-east-1
```

### Certificate Renewal

ACM certificates auto-renew if DNS validation records remain in place:

```bash
# Check renewal status
aws acm describe-certificate \
  --certificate-arn "$CERT_ARN" \
  --region us-east-1 \
  --query 'Certificate.RenewalSummary'

# Renewal is automatic - no action needed
```

**Important**: Keep DNS validation CNAME records in Route 53 for automatic renewal.

---

## DNS Configuration

### Route 53 Records Created

After setup, you'll have these records in `speedex.it` hosted zone:

**CNAME Record** (app.speedex.it):
```
Name: app.speedex.it
Type: CNAME
Value: d1234567890.cloudfront.net
TTL: 300
```

**Validation CNAME** (for ACM):
```
Name: _abc123def456.speedex.it
Type: CNAME
Value: _xyz789ghi012.acm-validations.aws.
TTL: 300
```

### View Current DNS Records

```bash
# Get hosted zone ID
ZONE_ID=$(aws route53 list-hosted-zones \
  --query "HostedZones[?Name=='speedex.it.'].Id" \
  --output text | cut -d'/' -f3)

# List all records
aws route53 list-resource-record-sets \
  --hosted-zone-id "$ZONE_ID" \
  --output table

# Get specific record
aws route53 list-resource-record-sets \
  --hosted-zone-id "$ZONE_ID" \
  --query "ResourceRecordSets[?Name=='app.speedex.it.']"
```

### Update DNS Record

```bash
# Update CNAME to new CloudFront distribution
./create-cname.sh --environment production --cloudfront-domain NEW_CLOUDFRONT_DOMAIN
```

---

## Troubleshooting

### Issue 1: Certificate Validation Pending

**Symptom**: Certificate stuck in `PENDING_VALIDATION` status

**Check**:
```bash
aws acm describe-certificate \
  --certificate-arn "$CERT_ARN" \
  --region us-east-1 \
  --query 'Certificate.Status'
```

**Solution**:
1. Check DNS validation record exists in Route 53
2. Wait 5-10 minutes for DNS propagation
3. Verify DNS resolution of validation record:
   ```bash
   dig _abc123def456.speedex.it CNAME
   ```

### Issue 2: DNS Not Resolving

**Symptom**: `dig app.speedex.it` returns no results

**Check**:
```bash
# Check if CNAME exists
aws route53 list-resource-record-sets \
  --hosted-zone-id "$ZONE_ID" \
  --query "ResourceRecordSets[?Name=='app.speedex.it.']"

# Test from different DNS servers
dig @8.8.8.8 app.speedex.it
dig @1.1.1.1 app.speedex.it
```

**Solution**:
1. Verify CNAME record was created: Check Route 53 console
2. Wait for DNS propagation (can take 5-10 minutes)
3. Clear local DNS cache:
   ```bash
   # macOS
   sudo dscacheutil -flushcache; sudo killall -HUP mDNSResponder

   # Linux
   sudo systemd-resolve --flush-caches
   ```

### Issue 3: SSL Certificate Error

**Symptom**: Browser shows SSL certificate error

**Check**:
```bash
openssl s_client -connect app.speedex.it:443 -servername app.speedex.it
```

**Solution**:
1. Verify CloudFront has correct ACM certificate configured
2. Ensure certificate is in `us-east-1` region
3. Check certificate includes `app.speedex.it` in SANs
4. Wait for CloudFront deployment to complete (~10 minutes)

### Issue 4: 403 Forbidden from CloudFront

**Symptom**: `curl https://app.speedex.it/api/health` returns 403

**Check**:
```bash
# Check WAF rules
aws wafv2 list-web-acls --scope CLOUDFRONT --region us-east-1

# Check CloudFront logs
aws s3 ls s3://sale-module-logs-production/cloudfront/ --recursive | tail -20
```

**Solution**:
1. Verify API Gateway origin is configured correctly
2. Check WAF rules aren't blocking requests
3. Ensure request path matches origin behavior rules
4. Review CloudFront access logs in S3

### Issue 5: 502 Bad Gateway

**Symptom**: CloudFront returns 502 error

**Check**:
```bash
# Test API Gateway directly
API_URL=$(aws cloudformation describe-stacks \
  --stack-name sale-module-api-production \
  --query 'Stacks[0].Outputs[?OutputKey==`ApiUrl`].OutputValue' \
  --output text)

curl -I "$API_URL/health"
```

**Solution**:
1. Verify API Gateway is deployed and accessible
2. Check Lambda functions are running
3. Review CloudWatch logs for Lambda errors
4. Ensure origin domain is correct in CloudFront config

---

## Security Considerations

### HTTPS Only

CloudFront is configured to redirect HTTP to HTTPS:
```yaml
ViewerProtocolPolicy: redirect-to-https
```

### TLS Version

Minimum TLS version: 1.2
```yaml
MinimumProtocolVersion: TLSv1.2_2021
```

### Security Headers

CloudFront adds security headers:
- `Strict-Transport-Security: max-age=31536000; includeSubDomains; preload`
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `X-XSS-Protection: 1; mode=block`
- `Content-Security-Policy: default-src 'self'`

### WAF Protection

Web Application Firewall rules enabled:
- AWS Managed Rules - Core Rule Set
- AWS Managed Rules - Known Bad Inputs
- AWS Managed Rules - SQL Injection
- AWS Managed Rules - Linux Operating System

---

## Cost Implications

### ACM Certificate
- **Cost**: FREE
- **Renewal**: Automatic and free

### Route 53
- **Hosted Zone**: $0.50/month
- **Queries**: $0.40 per million queries
- **Health Checks**: $0.50/health check/month

### CloudFront
- **Data Transfer**: $0.085/GB (first 10 TB/month)
- **Requests**: $0.0075 per 10,000 HTTPS requests
- **Custom Domain**: No additional charge

**Estimated Monthly Cost**:
- **Low Traffic** (100 GB, 1M requests): ~$10
- **Medium Traffic** (1 TB, 10M requests): ~$100
- **High Traffic** (10 TB, 100M requests): ~$900

---

## Monitoring and Maintenance

### CloudWatch Alarms

Monitor custom domain health:
```bash
# Create alarm for 4xx errors
aws cloudwatch put-metric-alarm \
  --alarm-name app-speedex-it-4xx-errors \
  --alarm-description "High 4xx error rate" \
  --metric-name 4xxErrorRate \
  --namespace AWS/CloudFront \
  --statistic Average \
  --period 300 \
  --threshold 5 \
  --comparison-operator GreaterThanThreshold \
  --dimensions Name=DistributionId,Value=YOUR_DISTRIBUTION_ID
```

### CloudFront Logs

Access logs stored in S3:
```bash
# View recent logs
aws s3 ls s3://sale-module-logs-production/cloudfront/ --recursive | tail -20

# Download and analyze
aws s3 cp s3://sale-module-logs-production/cloudfront/latest.log .
cat latest.log | grep "app.speedex.it" | wc -l
```

### Certificate Expiration Monitoring

```bash
# Check certificate expiration
aws acm describe-certificate \
  --certificate-arn "$CERT_ARN" \
  --region us-east-1 \
  --query 'Certificate.NotAfter'
```

ACM handles renewal automatically - no action required.

---

## Rollback Procedures

### Revert to CloudFront Domain

If issues occur, revert to direct CloudFront domain:

```bash
# Delete CNAME record
ZONE_ID=$(aws route53 list-hosted-zones \
  --query "HostedZones[?Name=='speedex.it.'].Id" \
  --output text | cut -d'/' -f3)

cat > /tmp/delete-cname.json <<EOF
{
  "Changes": [{
    "Action": "DELETE",
    "ResourceRecordSet": {
      "Name": "app.speedex.it",
      "Type": "CNAME",
      "TTL": 300,
      "ResourceRecords": [{"Value": "d1234567890.cloudfront.net"}]
    }
  }]
}
EOF

aws route53 change-resource-record-sets \
  --hosted-zone-id "$ZONE_ID" \
  --change-batch file:///tmp/delete-cname.json
```

**Access via CloudFront domain**: `https://d1234567890.cloudfront.net/api/health`

### Remove Custom Domain from CloudFront

```bash
# Remove custom domain from config
jq 'del(.Parameters.CustomDomainName)' \
  cloudfront/config/production.json > tmp.json && mv tmp.json cloudfront/config/production.json

# Redeploy
cd cloudfront && ./deploy.sh production deploy
```

---

## Best Practices

### Pre-Production Testing

1. **Test in Dev First**: Always test custom domain setup in dev environment
2. **Verify SSL**: Ensure SSL certificate is valid before production
3. **Load Test**: Test with production-like traffic
4. **Monitor Errors**: Watch for 4xx/5xx errors after deployment

### Change Management

1. **Maintenance Window**: Schedule during low-traffic periods
2. **Communication**: Notify users of potential downtime
3. **Rollback Plan**: Have rollback procedure ready
4. **Gradual Rollout**: Consider using weighted routing

### Security

1. **Certificate Management**: Keep DNS validation records in place
2. **WAF Rules**: Regularly review and update WAF rules
3. **Access Logs**: Enable and monitor CloudFront access logs
4. **SSL/TLS**: Use latest TLS versions (1.2+)

### Performance

1. **Cache Policies**: Optimize cache behaviors for your API
2. **Compression**: Enable compression for text-based content
3. **Origin Shield**: Consider enabling for additional caching layer
4. **Regional Edge Caches**: Automatically used by CloudFront

---

## Next Steps

After successful custom domain setup:

1. **Update API Documentation**
   - Update all API endpoint URLs to use `app.speedex.it`
   - Update Swagger/OpenAPI definitions
   - Update client SDKs

2. **Update Client Applications**
   - Update frontend app to use new domain
   - Update mobile apps
   - Update integration partners

3. **DNS Migration** (if moving from another domain)
   - Update DNS records gradually
   - Use Route 53 weighted routing for gradual migration
   - Monitor metrics during transition

4. **Enable Advanced Features**
   - CloudFront Origin Shield
   - Real-time logs
   - CloudFront Functions for edge computing
   - Lambda@Edge for advanced logic

5. **Setup Monitoring**
   - CloudWatch dashboards
   - Alarms for errors and latency
   - Synthetic monitoring (Route 53 health checks)
   - Third-party monitoring (Pingdom, Datadog, etc.)

---

## References

### Documentation
- [ACM User Guide](https://docs.aws.amazon.com/acm/latest/userguide/)
- [CloudFront Developer Guide](https://docs.aws.amazon.com/cloudfront/latest/developerguide/)
- [Route 53 Developer Guide](https://docs.aws.amazon.com/route53/latest/developerguide/)

### Scripts
- `setup-custom-domain.sh` - Certificate and configuration setup
- `create-cname.sh` - DNS record creation
- `cloudfront/deploy.sh` - CloudFront deployment

### Configuration Files
- `cloudfront/config/{env}.json` - CloudFront configuration per environment
- `cloudfront/cloudfront.yaml` - CloudFormation template
- `/tmp/custom-domain-setup.env` - Setup environment variables

---

## Support

**Issues with Custom Domain Setup**:
- Check CloudFormation stack events
- Review CloudFront distribution settings
- Check Route 53 records in console
- Review ACM certificate status

**Need Help**:
- AWS Support (if you have a support plan)
- CloudFormation stack outputs for resource details
- CloudWatch logs for runtime errors

---

## Summary

Custom domain setup complete! You now have:

- ✅ SSL certificate for `*.speedex.it`
- ✅ CloudFront distribution with custom domain
- ✅ Route 53 CNAME record
- ✅ HTTPS-only access
- ✅ WAF protection
- ✅ Security headers
- ✅ Access logging

**Primary Domain**: https://app.speedex.it/api/health

The Sale Module API is now accessible via a branded custom domain with enterprise-grade security, performance, and monitoring.
