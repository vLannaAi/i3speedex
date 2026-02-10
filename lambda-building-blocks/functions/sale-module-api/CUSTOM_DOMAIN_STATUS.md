# Custom Domain Configuration Status

**Domain**: app.speedex.it
**Environment**: production
**Status**: IN PROGRESS
**Last Updated**: 2026-02-02 18:10 UTC

---

## Completed Steps ✅

### 1. ACM Certificate Created
- **Certificate ARN**: `arn:aws:acm:us-east-1:827562051115:certificate/9757409f-c0d3-48e9-95a5-225bfd767f4e`
- **Domain**: `*.speedex.it` (wildcard)
- **SANs**: `speedex.it`, `app.speedex.it`
- **Validation Method**: DNS
- **Status**: PENDING_VALIDATION (expected, can take up to 30 minutes)

### 2. DNS Validation Record Added
- **Record Name**: `_759b2141df9305e403825e82a91d62c9.speedex.it`
- **Type**: CNAME
- **Value**: `_35f66e91f539e36aff3ba913bae65a3b.htgdxnmnnj.acm-validations.aws.`
- **Hosted Zone ID**: `Z08665952P3WWROBCEGXU`
- **Status**: ✅ Created successfully

### 3. Core Infrastructure Deployed
**DynamoDB Tables** (3/3 ✅):
- ✅ `SalesTable-production`
- ✅ `BuyersTable-production`
- ✅ `ProducersTable-production`

**S3 Buckets** (2/2 ✅):
- ✅ `sale-module-attachments-production`
  - Encryption: Enabled (AES256)
  - Versioning: Enabled
  - Public Access: Blocked
  - Lifecycle: Pending manual configuration
- ✅ `sale-module-invoices-production`
  - Encryption: Enabled (AES256)
  - Versioning: Enabled
  - Public Access: Blocked
  - Lifecycle: Pending manual configuration

### 4. CloudFront Configuration Updated
- **Config File**: `cloudfront/config/production.json`
- **ACMCertificateArn**: Updated with certificate ARN
- **CustomDomainName**: Set to `app.speedex.it`
- **Status**: ✅ Ready for deployment

### 5. Deployment Scripts Fixed
- **deploy-core.sh**: Fixed deletion protection and PITR retry logic
- **deploy-core.sh**: Made lifecycle configuration non-blocking
- **Status**: ✅ Ready for use

---

## Pending Steps ⏳

### 6. Certificate Validation (IN PROGRESS)
**Current Status**: PENDING_VALIDATION

**What's happening**:
- AWS is verifying DNS ownership via the CNAME record
- This process can take 5-30 minutes
- DNS propagation delays can extend validation time

**How to check**:
```bash
aws acm describe-certificate \
  --certificate-arn arn:aws:acm:us-east-1:827562051115:certificate/9757409f-c0d3-48e9-95a5-225bfd767f4e \
  --region us-east-1 \
  --query 'Certificate.Status' \
  --output text
```

**Expected**: Status will change from `PENDING_VALIDATION` to `ISSUED`

### 7. CloudFront Deployment (WAITING ON STEP 6)
**Prerequisites**:
- ✅ CloudFront configuration updated
- ⏳ ACM certificate validated

**Commands** (once certificate is validated):
```bash
cd /Users/vicio/i2speedex/lambda-building-blocks/functions/sale-module-api/cloudfront
./deploy.sh production deploy
```

**Duration**: ~5-10 minutes

### 8. API Gateway Deployment (NOT STARTED)
**Prerequisites**:
- Lambda functions deployed
- SAM template ready

**Status**: Needs deployment (separate from custom domain)

### 9. DNS CNAME Record (WAITING ON STEP 7)
**Prerequisites**:
- ✅ Route 53 hosted zone exists
- ⏳ CloudFront distribution deployed

**Commands** (after CloudFront deployment):
```bash
# Get CloudFront domain
DIST_DOMAIN=$(aws cloudformation describe-stacks \
  --stack-name sale-module-cloudfront-production \
  --region us-east-1 \
  --query 'Stacks[0].Outputs[?OutputKey==`DistributionDomainName`].OutputValue' \
  --output text)

# Create CNAME
cd /Users/vicio/i2speedex/lambda-building-blocks/functions/sale-module-api
./create-cname.sh --environment production --cloudfront-domain $DIST_DOMAIN
```

**Duration**: ~2-5 minutes

### 10. Testing and Verification (WAITING ON STEP 9)
**Tests to run**:
```bash
# DNS resolution
dig app.speedex.it

# SSL certificate
openssl s_client -connect app.speedex.it:443 -servername app.speedex.it < /dev/null

# API health check
curl -I https://app.speedex.it/api/health
```

---

## Timeline Estimate

| Step | Duration | Status |
|------|----------|--------|
| 1-5: Initial setup | 5 mins | ✅ COMPLETE |
| 6: Certificate validation | 5-30 mins | ⏳ IN PROGRESS (~15 mins so far) |
| 7: CloudFront deployment | 5-10 mins | ⏳ WAITING |
| 8: API Gateway deployment | 5-10 mins | ⏳ WAITING |
| 9: DNS CNAME creation | 2-5 mins | ⏳ WAITING |
| 10: Testing | 2-3 mins | ⏳ WAITING |
| **Total** | **24-63 mins** | **~25% complete** |

---

## What's Working Now

✅ **DynamoDB**: All tables created and ready
- Sales, Buyers, Producers tables
- Point-in-time recovery enabled
- Billing mode: PAY_PER_REQUEST

✅ **S3**: All buckets created and configured
- Attachments and Invoices buckets
- Encryption enabled
- Versioning enabled
- Public access blocked

✅ **Route 53**: DNS configured
- Hosted zone active
- Validation CNAME added

✅ **ACM**: Certificate requested
- Wildcard certificate for `*.speedex.it`
- DNS validation in progress

---

## What's NOT Working Yet

❌ **Custom Domain**: `app.speedex.it` not accessible
- Certificate not validated yet
- CloudFront not deployed
- DNS CNAME not created

❌ **API Gateway**: Not deployed
- Lambda functions not deployed
- API endpoints not available

❌ **CloudFront**: Not deployed
- Waiting for certificate validation
- Distribution not created

---

## Next Actions (Automated)

Once certificate validation completes (Status changes to `ISSUED`):

**Option 1: Automatic (Recommended)**
```bash
# Check certificate status every minute until validated
while true; do
  STATUS=$(aws acm describe-certificate \
    --certificate-arn arn:aws:acm:us-east-1:827562051115:certificate/9757409f-c0d3-48e9-95a5-225bfd767f4e \
    --region us-east-1 \
    --query 'Certificate.Status' \
    --output text)

  echo "$(date): Certificate status: $STATUS"

  if [ "$STATUS" == "ISSUED" ]; then
    echo "Certificate validated! Proceeding with CloudFront deployment..."

    # Deploy CloudFront
    cd /Users/vicio/i2speedex/lambda-building-blocks/functions/sale-module-api/cloudfront
    ./deploy.sh production deploy

    # Get CloudFront domain
    DIST_DOMAIN=$(aws cloudformation describe-stacks \
      --stack-name sale-module-cloudfront-production \
      --region us-east-1 \
      --query 'Stacks[0].Outputs[?OutputKey==`DistributionDomainName`].OutputValue' \
      --output text)

    # Create CNAME
    cd ..
    ./create-cname.sh --environment production --cloudfront-domain $DIST_DOMAIN

    # Test
    echo "Testing custom domain..."
    sleep 60  # Wait for DNS propagation
    curl -I https://app.speedex.it/api/health

    break
  fi

  sleep 60  # Check every minute
done
```

**Option 2: Manual**
1. Monitor certificate status in AWS Console or via CLI
2. Once status is `ISSUED`, run CloudFront deployment manually
3. Get CloudFront domain and create CNAME manually
4. Test the domain

---

## Troubleshooting

### Certificate Taking Too Long to Validate

**Check DNS propagation**:
```bash
# Check validation record from multiple DNS servers
dig @8.8.8.8 _759b2141df9305e403825e82a91d62c9.speedex.it CNAME
dig @1.1.1.1 _759b2141df9305e403825e82a91d62c9.speedex.it CNAME

# Check from AWS Route 53
aws route53 test-dns-answer \
  --hosted-zone-id Z08665952P3WWROBCEGXU \
  --record-name _759b2141df9305e403825e82a91d62c9.speedex.it \
  --record-type CNAME
```

**If validation record is missing**:
```bash
# Re-run setup script
./setup-custom-domain.sh --environment production
```

**If still failing after 1 hour**:
- Contact AWS Support
- Check Route 53 hosted zone ownership
- Verify DNS is delegated correctly to Route 53 nameservers

### Deployment Script Errors

**If deploy-core.sh fails**:
- Check error logs in terminal output
- Verify AWS credentials
- Check IAM permissions
- Resources might already exist (check AWS Console)

**If CloudFront deployment fails**:
- Verify certificate is in `us-east-1` region
- Check certificate status is `ISSUED`
- Verify API Gateway and S3 buckets exist

---

## Cost Summary

**Current Monthly Costs** (resources deployed):

| Service | Resource | Cost/Month |
|---------|----------|------------|
| DynamoDB | 3 tables (on-demand) | $2-10 |
| S3 | 2 buckets + storage | $1-5 |
| Route 53 | Hosted zone + queries | $0.50-2 |
| ACM | SSL certificate | $0 (FREE) |
| **Total (current)** | | **$3.50-17** |

**After Complete Setup**:

| Service | Resource | Cost/Month |
|---------|----------|------------|
| CloudFront | Distribution | $10-100+ |
| API Gateway | REST API | $3.50-35 |
| Lambda | Functions | $0-20 |
| **Total (complete)** | | **$17-172** |

*Costs vary based on traffic volume*

---

## Files Created

1. ✅ `/Users/vicio/i2speedex/lambda-building-blocks/functions/sale-module-api/setup-custom-domain.sh`
2. ✅ `/Users/vicio/i2speedex/lambda-building-blocks/functions/sale-module-api/create-cname.sh`
3. ✅ `/Users/vicio/i2speedex/lambda-building-blocks/functions/sale-module-api/CUSTOM_DOMAIN_SETUP.md`
4. ✅ `/Users/vicio/i2speedex/lambda-building-blocks/functions/sale-module-api/CUSTOM_DOMAIN_COMPLETE.md`
5. ✅ `/Users/vicio/i2speedex/lambda-building-blocks/functions/sale-module-api/CUSTOM_DOMAIN_STATUS.md` (this file)
6. ✅ `/Users/vicio/i2speedex/lambda-building-blocks/functions/sale-module-api/cloudfront/config/production.json` (updated)
7. ✅ `/Users/vicio/i2speedex/lambda-building-blocks/functions/sale-module-api/environments/config/production.json` (updated)

---

## Summary

**Progress**: 5/10 steps complete (50% infrastructure, 25% overall)

**Blocked By**: ACM certificate validation (typical wait: 5-30 minutes)

**Est. Completion**: 15-35 minutes from now

**Current Status**:
- ✅ Core infrastructure deployed and ready
- ⏳ Certificate validation in progress
- ⏳ Waiting to deploy CloudFront and create DNS CNAME

**Recommendation**:
Monitor certificate status and proceed with CloudFront deployment once certificate is validated. All scripts and configurations are ready.

---

## Quick Commands

**Check certificate status**:
```bash
watch -n 60 'aws acm describe-certificate --certificate-arn arn:aws:acm:us-east-1:827562051115:certificate/9757409f-c0d3-48e9-95a5-225bfd767f4e --region us-east-1 --query "Certificate.Status" --output text'
```

**Check created resources**:
```bash
# DynamoDB tables
aws dynamodb list-tables --region us-east-1 | grep production

# S3 buckets
aws s3 ls | grep sale-module

# Route 53 records
aws route53 list-resource-record-sets --hosted-zone-id Z08665952P3WWROBCEGXU --query "ResourceRecordSets[?contains(Name, 'speedex')]"
```

**Continue deployment** (once certificate is validated):
```bash
cd cloudfront && ./deploy.sh production deploy
```
