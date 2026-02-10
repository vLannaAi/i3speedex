# Deployment Checklist

Use this checklist to track your deployment progress.

## Pre-Deployment

### Prerequisites

- [ ] AWS Account created
- [ ] AWS CLI installed (`aws --version`)
- [ ] AWS CLI configured (`aws configure`)
- [ ] Node.js 20.x installed (`node --version`)
- [ ] AWS CDK installed (`cdk --version`)
- [ ] CDK bootstrapped (`cdk bootstrap`)

### Verification

```bash
# Verify AWS credentials
aws sts get-caller-identity

# Expected output:
# {
#     "UserId": "...",
#     "Account": "123456789012",
#     "Arn": "arn:aws:iam::123456789012:user/..."
# }

# Verify Node.js version
node --version  # Should be v20.x.x

# Verify CDK
cdk --version  # Should be 2.x.x
```

## Build Phase

- [ ] Clone/navigate to repository
  ```bash
  cd /path/to/lambda-building-blocks
  ```

- [ ] Install dependencies
  ```bash
  npm run build
  ```
  - [ ] CDK dependencies installed
  - [ ] Lambda dependencies installed
  - [ ] TypeScript compiled successfully

- [ ] Run tests (optional but recommended)
  ```bash
  npm test
  ```
  - [ ] All tests pass

## Dev Deployment

### Review Stack

- [ ] Review what will be deployed
  ```bash
  cd cdk
  npm run synth
  npm run diff
  ```

- [ ] Verify stack components:
  - [ ] Lambda function (html-to-pdf-dev)
  - [ ] S3 bucket (html-to-pdf-dev-*)
  - [ ] IAM role
  - [ ] CloudWatch alarms
  - [ ] SNS topic
  - [ ] Function URL

### Deploy

- [ ] Deploy to dev environment
  ```bash
  npm run deploy:dev
  ```

- [ ] Wait for deployment to complete (~3-5 minutes)

- [ ] Save outputs:
  - [ ] Function URL: `_______________________________________________`
  - [ ] Bucket Name: `_______________________________________________`
  - [ ] Function ARN: `_______________________________________________`
  - [ ] Alarm Topic: `_______________________________________________`

## Post-Deployment Configuration

### Subscribe to Alarms

- [ ] Subscribe email to SNS topic
  ```bash
  TOPIC_ARN="<paste-topic-arn-here>"
  aws sns subscribe \
    --topic-arn $TOPIC_ARN \
    --protocol email \
    --notification-endpoint your-email@example.com
  ```

- [ ] Confirm email subscription (check inbox)

### Verify Deployment

- [ ] Check Lambda function exists
  ```bash
  aws lambda get-function --function-name html-to-pdf-dev
  ```

- [ ] Check S3 bucket exists
  ```bash
  BUCKET_NAME="<paste-bucket-name-here>"
  aws s3 ls s3://$BUCKET_NAME
  ```

- [ ] Check Function URL
  ```bash
  aws lambda get-function-url-config --function-name html-to-pdf-dev
  ```

## Testing Phase

### Basic Test

- [ ] Test with simple HTML
  ```bash
  FUNCTION_URL="<paste-function-url-here>"

  curl -X POST $FUNCTION_URL \
    -H "Content-Type: application/json" \
    -d '{
      "html": "<!DOCTYPE html><html><body><h1>Test</h1></body></html>",
      "outputFormat": "base64"
    }' | jq .
  ```

- [ ] Verify response:
  - [ ] `success: true`
  - [ ] `pdfBase64` is not empty
  - [ ] `size` > 0
  - [ ] `generationTime` < 10 seconds

### Test with Sample Invoice

- [ ] Test with provided sample
  ```bash
  curl -X POST $FUNCTION_URL \
    -H "Content-Type: application/json" \
    -d @functions/html-to-pdf/events/simple-test.json \
    > response.json
  ```

- [ ] Decode and view PDF
  ```bash
  cat response.json | jq -r '.pdfBase64' | base64 -d > test.pdf
  open test.pdf
  ```

- [ ] Verify PDF quality:
  - [ ] PDF opens correctly
  - [ ] Text is readable
  - [ ] Styling is correct
  - [ ] Italian characters (àèéìòù €) display correctly

### Test with Real Invoice

- [ ] Create your own invoice HTML
- [ ] Generate PDF
- [ ] Verify output quality:
  - [ ] Layout matches expectations
  - [ ] All text visible
  - [ ] Images display (if any)
  - [ ] Multi-page works (if applicable)
  - [ ] Headers/footers correct (if applicable)

### Test S3 Upload

- [ ] Test S3 output format
  ```bash
  curl -X POST $FUNCTION_URL \
    -H "Content-Type: application/json" \
    -d @functions/html-to-pdf/events/s3-output-test.json \
    | jq .
  ```

- [ ] Verify response:
  - [ ] `s3Url` present
  - [ ] `s3Key` present

- [ ] Check S3 bucket
  ```bash
  aws s3 ls s3://$BUCKET_NAME/pdfs/ --recursive
  ```

### Test Client Scripts

- [ ] Test Node.js client
  ```bash
  FUNCTION_URL=$FUNCTION_URL npm run test-client
  ```
  - [ ] PDF generated successfully
  - [ ] test-output.pdf created

- [ ] Test Python client
  ```bash
  cd functions/html-to-pdf/examples
  FUNCTION_URL=$FUNCTION_URL python test-client.py
  ```
  - [ ] PDF generated successfully
  - [ ] test-output.pdf created

## Monitoring Setup

### CloudWatch Logs

- [ ] View real-time logs
  ```bash
  npm run logs:dev
  ```

- [ ] Verify log format:
  - [ ] JSON structured logs
  - [ ] timestamp present
  - [ ] level present (INFO, ERROR, etc.)
  - [ ] requestId present

### CloudWatch Metrics

- [ ] Go to AWS Console → CloudWatch → Metrics
- [ ] Check Lambda metrics:
  - [ ] Invocations
  - [ ] Errors (should be 0)
  - [ ] Duration
  - [ ] Throttles (should be 0)

### CloudWatch Alarms

- [ ] Go to AWS Console → CloudWatch → Alarms
- [ ] Verify alarms exist:
  - [ ] html-to-pdf-dev-errors
  - [ ] html-to-pdf-dev-duration
  - [ ] html-to-pdf-dev-throttles

- [ ] Verify alarm state: OK (green)

## Performance Validation

### Measure Performance

- [ ] Cold start test
  ```bash
  # Wait 15 minutes for Lambda to go cold
  # Then test again and measure time
  time curl -X POST $FUNCTION_URL -d @functions/html-to-pdf/events/simple-test.json
  ```
  - [ ] Cold start: _______ seconds (target: < 5 seconds)

- [ ] Warm start test
  ```bash
  # Immediately test again
  time curl -X POST $FUNCTION_URL -d @functions/html-to-pdf/events/simple-test.json
  ```
  - [ ] Warm start: _______ seconds (target: < 3 seconds)

### Load Test (Optional)

- [ ] Test 10 concurrent requests
  ```bash
  for i in {1..10}; do
    curl -X POST $FUNCTION_URL \
      -H "Content-Type: application/json" \
      -d @functions/html-to-pdf/events/simple-test.json &
  done
  wait
  ```

- [ ] Check CloudWatch metrics:
  - [ ] All requests succeeded
  - [ ] No throttles
  - [ ] Average duration acceptable

## Cost Monitoring

### Set Up Billing Alerts

- [ ] Go to AWS Console → Billing → Billing preferences
- [ ] Enable "Receive PDF Invoice By Email"
- [ ] Enable "Receive Free Tier Usage Alerts"
- [ ] Enable "Receive Billing Alerts"
- [ ] Set budget alert (optional):
  - [ ] Create budget: $10/month
  - [ ] Email alert at 80% ($8)

### Monitor Costs

- [ ] Go to AWS Console → Cost Explorer
- [ ] Check current month costs:
  - [ ] Lambda: $______ (target: $0)
  - [ ] S3: $______ (target: $0)
  - [ ] Total: $______ (target: $0)

### Free Tier Usage

- [ ] Go to AWS Console → Billing → Free Tier
- [ ] Check Lambda usage:
  - [ ] Requests: ______ / 1,000,000
  - [ ] Compute: ______ / 400,000 GB-seconds
  - [ ] % Used: ______ (target: < 1%)

## Documentation Review

- [ ] Review README.md
- [ ] Review QUICKSTART.md
- [ ] Review DEPLOYMENT.md
- [ ] Review functions/html-to-pdf/README.md
- [ ] Review IMPLEMENTATION_SUMMARY.md

## Production Readiness (Before Prod Deployment)

### Security Hardening

- [ ] Review CORS settings
  - [ ] Consider restricting origins
  - [ ] Update in `cdk/lib/html-to-pdf-stack.ts` if needed

- [ ] Review authentication
  - [ ] Consider enabling IAM auth
  - [ ] Update authType in stack if needed

- [ ] Review S3 bucket policy
  - [ ] Verify block public access enabled
  - [ ] Verify encryption enabled

### Performance Optimization

- [ ] Review Lambda memory
  - [ ] Current: 2048 MB
  - [ ] Adjust if needed based on testing

- [ ] Review Lambda timeout
  - [ ] Current: 30 seconds
  - [ ] Adjust if needed based on testing

- [ ] Review reserved concurrency
  - [ ] Current: 10 (prod)
  - [ ] Adjust based on expected load

### Monitoring Enhancement

- [ ] Review alarm thresholds
  - [ ] Error threshold: 1 error
  - [ ] Duration threshold: 25 seconds
  - [ ] Adjust if needed

- [ ] Set up CloudWatch Dashboard (optional)
- [ ] Configure additional alarms (optional)

## Production Deployment

- [ ] Review production differences:
  - [ ] Higher concurrency (10 vs 5)
  - [ ] X-Ray tracing enabled
  - [ ] Longer log retention (30 days)
  - [ ] S3 bucket retention (RETAIN)

- [ ] Deploy to production
  ```bash
  npm run deploy:prod
  ```

- [ ] Save production outputs:
  - [ ] Function URL: `_______________________________________________`
  - [ ] Bucket Name: `_______________________________________________`
  - [ ] Function ARN: `_______________________________________________`
  - [ ] Alarm Topic: `_______________________________________________`

- [ ] Subscribe to production alarms
- [ ] Test production endpoint
- [ ] Monitor for 48 hours

## Integration with i2speedex

- [ ] Create invoice HTML templates
- [ ] Integrate Lambda invocation in i2speedex
- [ ] Test end-to-end flow
- [ ] Implement error handling
- [ ] Add retry logic (if needed)

## Post-Deployment

### Documentation

- [ ] Update Function URLs in documentation
- [ ] Document any configuration changes
- [ ] Create runbook for operations team

### Knowledge Transfer

- [ ] Share deployment guide with team
- [ ] Review monitoring procedures
- [ ] Review troubleshooting guide
- [ ] Schedule review meeting

### Ongoing Monitoring

- [ ] Set up weekly cost review
- [ ] Set up weekly performance review
- [ ] Monitor CloudWatch alarms
- [ ] Review error logs regularly

## Success Criteria

- [ ] PDFs generated successfully
- [ ] Performance meets targets (< 8 seconds)
- [ ] Costs remain at $0 (free tier)
- [ ] No errors in CloudWatch logs
- [ ] User feedback is positive
- [ ] Ready for production use

## Rollback Plan (If Needed)

If issues occur:

- [ ] Stop using Function URL (switch back to old system temporarily)
- [ ] Review CloudWatch logs for errors
- [ ] Fix issues in dev environment
- [ ] Re-test thoroughly
- [ ] Re-deploy to production

Or:

- [ ] Destroy stack
  ```bash
  npm run destroy:dev  # or destroy:prod
  ```
- [ ] Wait for stack deletion
- [ ] Re-deploy with fixes

---

## Sign-Off

### Dev Environment

- [ ] Deployed by: __________________ Date: __________
- [ ] Tested by: __________________ Date: __________
- [ ] Approved by: __________________ Date: __________

### Production Environment

- [ ] Deployed by: __________________ Date: __________
- [ ] Tested by: __________________ Date: __________
- [ ] Approved by: __________________ Date: __________

---

**Deployment Status**:
- Dev: ☐ Not Started | ☐ In Progress | ☐ Complete
- Prod: ☐ Not Started | ☐ In Progress | ☐ Complete

**Ready for Production**: ☐ Yes | ☐ No

**Notes**:
_______________________________________________________________________
_______________________________________________________________________
_______________________________________________________________________
