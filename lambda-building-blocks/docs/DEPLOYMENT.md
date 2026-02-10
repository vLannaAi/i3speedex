# Deployment Guide

Step-by-step guide for deploying the HTML-to-PDF Lambda function to AWS.

## Prerequisites

### 1. AWS Account

- Active AWS account
- IAM user with appropriate permissions
- Programmatic access (Access Key ID and Secret Access Key)

### 2. AWS CLI

Install and configure AWS CLI:

```bash
# Install AWS CLI (macOS)
brew install awscli

# Install AWS CLI (Linux)
curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
unzip awscliv2.zip
sudo ./aws/install

# Configure AWS CLI
aws configure
# Enter:
# - AWS Access Key ID
# - AWS Secret Access Key
# - Default region: eu-west-1
# - Default output format: json
```

### 3. Node.js and NPM

```bash
# Install Node.js 20.x (macOS)
brew install node@20

# Verify installation
node --version  # Should be 20.x
npm --version   # Should be 10.x or later
```

### 4. AWS CDK

```bash
# Install AWS CDK globally
npm install -g aws-cdk

# Verify installation
cdk --version  # Should be 2.x

# Bootstrap CDK (one-time setup per account/region)
cdk bootstrap aws://ACCOUNT-ID/eu-west-1
```

## Deployment Steps

### Step 1: Clone Repository

```bash
cd /path/to/your/projects
git clone <repository-url>
cd lambda-building-blocks
```

### Step 2: Install Dependencies

```bash
# Install CDK dependencies
cd cdk
npm install

# Install Lambda function dependencies
cd ../functions/html-to-pdf
npm install

# Return to root
cd ../..
```

### Step 3: Build

```bash
# Build CDK
cd cdk
npm run build

# Build Lambda function
cd ../functions/html-to-pdf
npm run build

# Return to CDK directory
cd ../../cdk
```

### Step 4: Review Stack

```bash
# Synthesize CloudFormation template
npm run synth

# Review what will be deployed
npm run diff
```

### Step 5: Deploy to Dev Environment

```bash
# Deploy to dev
npm run deploy:dev

# Confirm deployment when prompted
# CDK will show resources to be created:
# - Lambda function
# - IAM role
# - S3 bucket
# - CloudWatch alarms
# - SNS topic
# - Function URL

# Type 'y' to proceed
```

**Expected output**:

```
✅  HtmlToPdfLambda-Dev

Outputs:
HtmlToPdfLambda-Dev.AlarmTopicArn = arn:aws:sns:eu-west-1:123456789012:HtmlToPdfLambda-Dev-AlarmTopic...
HtmlToPdfLambda-Dev.BucketName = html-to-pdf-dev-123456789012
HtmlToPdfLambda-Dev.FunctionArn = arn:aws:lambda:eu-west-1:123456789012:function:html-to-pdf-dev
HtmlToPdfLambda-Dev.FunctionName = html-to-pdf-dev
HtmlToPdfLambda-Dev.FunctionUrl = https://abcdef1234.lambda-url.eu-west-1.on.aws/

Stack ARN:
arn:aws:cloudformation:eu-west-1:123456789012:stack/HtmlToPdfLambda-Dev/...
```

### Step 6: Test the Function

```bash
# Save Function URL from output
FUNCTION_URL="https://abcdef1234.lambda-url.eu-west-1.on.aws/"

# Test with simple HTML
curl -X POST $FUNCTION_URL \
  -H "Content-Type: application/json" \
  -d '{
    "html": "<!DOCTYPE html><html><head><title>Test</title></head><body><h1>Hello World!</h1></body></html>",
    "options": {
      "format": "A4",
      "printBackground": true
    },
    "outputFormat": "base64"
  }'
```

**Expected response**:

```json
{
  "success": true,
  "pdfBase64": "JVBERi0xLjQKJeLjz9MKMSAwIG9iago8PC9UeXBlL0NhdGFs...",
  "size": 12345,
  "generationTime": 7.234
}
```

### Step 7: Decode and View PDF

```bash
# Save response to file
curl -X POST $FUNCTION_URL \
  -H "Content-Type: application/json" \
  -d @../functions/html-to-pdf/events/simple-test.json \
  > response.json

# Extract base64 PDF
cat response.json | jq -r '.pdfBase64' | base64 -d > test.pdf

# Open PDF
open test.pdf  # macOS
xdg-open test.pdf  # Linux
```

### Step 8: Monitor Logs

```bash
# View real-time logs
aws logs tail /aws/lambda/html-to-pdf-dev --follow

# View recent errors
aws logs tail /aws/lambda/html-to-pdf-dev --filter-pattern "ERROR" --since 1h
```

### Step 9: Deploy to Production

Once dev environment is tested and validated:

```bash
cd cdk
npm run deploy:prod

# Confirm deployment
# Type 'y' to proceed
```

**Production differences**:
- Higher reserved concurrency (10 vs 5)
- X-Ray tracing enabled
- Longer log retention (30 days vs 7 days)
- S3 bucket retention policy (RETAIN vs DESTROY)

## Post-Deployment Configuration

### 1. Subscribe to CloudWatch Alarms

```bash
# Get SNS topic ARN from deployment output
TOPIC_ARN="arn:aws:sns:eu-west-1:123456789012:HtmlToPdfLambda-Dev-AlarmTopic..."

# Subscribe email to topic
aws sns subscribe \
  --topic-arn $TOPIC_ARN \
  --protocol email \
  --notification-endpoint your-email@example.com

# Confirm subscription via email
```

### 2. Configure S3 Bucket Lifecycle (Optional)

```bash
# Get bucket name from deployment output
BUCKET_NAME="html-to-pdf-dev-123456789012"

# Update lifecycle policy to delete PDFs after 7 days (instead of 30)
aws s3api put-bucket-lifecycle-configuration \
  --bucket $BUCKET_NAME \
  --lifecycle-configuration file://lifecycle-policy.json
```

**lifecycle-policy.json**:

```json
{
  "Rules": [
    {
      "Id": "DeleteOldPdfs",
      "Status": "Enabled",
      "Expiration": {
        "Days": 7
      },
      "Filter": {
        "Prefix": "pdfs/"
      }
    }
  ]
}
```

### 3. Set Up CloudWatch Dashboard (Optional)

```bash
# Create dashboard
aws cloudwatch put-dashboard \
  --dashboard-name HtmlToPdfDashboard \
  --dashboard-body file://dashboard.json
```

**dashboard.json**:

```json
{
  "widgets": [
    {
      "type": "metric",
      "properties": {
        "metrics": [
          ["AWS/Lambda", "Invocations", {"stat": "Sum"}],
          [".", "Errors", {"stat": "Sum"}],
          [".", "Duration", {"stat": "Average"}],
          [".", "Throttles", {"stat": "Sum"}]
        ],
        "period": 300,
        "stat": "Average",
        "region": "eu-west-1",
        "title": "HTML-to-PDF Lambda Metrics"
      }
    }
  ]
}
```

## Updating the Function

### Update Lambda Code

```bash
# Make changes to Lambda function code
cd functions/html-to-pdf/src
# Edit files...

# Build
cd ..
npm run build

# Deploy update
cd ../../cdk
npm run deploy:dev  # or deploy:prod
```

### Update Infrastructure

```bash
# Make changes to CDK stack
cd cdk/lib
# Edit html-to-pdf-stack.ts...

# Build
cd ..
npm run build

# Review changes
npm run diff

# Deploy update
npm run deploy:dev  # or deploy:prod
```

## Rollback

### Rollback to Previous Version

```bash
# List CloudFormation stacks
aws cloudformation list-stacks \
  --stack-status-filter UPDATE_COMPLETE \
  --query 'StackSummaries[?starts_with(StackName, `HtmlToPdfLambda`)].{Name:StackName,Time:LastUpdatedTime}' \
  --output table

# Rollback stack (if deployment failed)
aws cloudformation rollback-stack --stack-name HtmlToPdfLambda-Dev
```

### Manual Rollback

1. Go to AWS Console → CloudFormation
2. Select stack: `HtmlToPdfLambda-Dev`
3. Click "Actions" → "Roll back"
4. Confirm rollback

## Cleanup / Destroy

### Delete Dev Stack

```bash
cd cdk
npm run destroy

# Confirm deletion
# Type stack name to proceed
```

**Note**: This will delete:
- Lambda function
- IAM role
- CloudWatch log groups
- CloudWatch alarms
- SNS topic
- S3 bucket (if `autoDeleteObjects: true`)

### Manual Cleanup

If CDK destroy fails:

```bash
# Delete S3 bucket contents first
BUCKET_NAME="html-to-pdf-dev-123456789012"
aws s3 rm s3://$BUCKET_NAME --recursive

# Then destroy stack
cdk destroy
```

## Troubleshooting

### Issue: CDK Bootstrap Failed

**Error**: "Stack does not exist"

**Solution**:

```bash
# Bootstrap CDK for your account/region
cdk bootstrap aws://ACCOUNT-ID/eu-west-1

# Replace ACCOUNT-ID with your AWS account ID
# You can find it with: aws sts get-caller-identity --query Account --output text
```

### Issue: Deployment Timeout

**Error**: "Resource creation cancelled"

**Solution**:

```bash
# Increase CDK timeout
export CDK_DEFAULT_TIMEOUT=1800  # 30 minutes

# Retry deployment
npm run deploy:dev
```

### Issue: Lambda Layer Not Found

**Error**: "Layer version not found"

**Solution**:

Update the Chromium layer ARN in `cdk/lib/html-to-pdf-stack.ts`:

```typescript
// Find latest layer ARN at:
// https://github.com/Sparticuz/chromium/releases

lambda.LayerVersion.fromLayerVersionArn(
  this,
  'ChromiumLayer',
  'arn:aws:lambda:eu-west-1:764866452798:layer:chrome-aws-lambda:43'  // Update version
)
```

### Issue: Permission Denied

**Error**: "User is not authorized to perform: cloudformation:CreateStack"

**Solution**:

Ensure your IAM user has the following policies:
- `AWSCloudFormationFullAccess`
- `IAMFullAccess`
- `AWSLambda_FullAccess`
- `AmazonS3FullAccess`
- `CloudWatchFullAccess`

Or attach the `PowerUserAccess` managed policy.

### Issue: Function URL Not Working

**Error**: "403 Forbidden" or "404 Not Found"

**Solution**:

1. Verify Function URL is enabled:

```bash
aws lambda get-function-url-config --function-name html-to-pdf-dev
```

2. Check CORS configuration:

```bash
aws lambda get-function-url-config --function-name html-to-pdf-dev \
  --query 'Cors'
```

3. Test with curl (not browser first):

```bash
curl -v -X POST $FUNCTION_URL \
  -H "Content-Type: application/json" \
  -d '{"html":"<html><body>Test</body></html>","outputFormat":"base64"}'
```

## Security Best Practices

### 1. Enable IAM Authentication (Production)

Update CDK stack:

```typescript
const functionUrl = this.function.addFunctionUrl({
  authType: lambda.FunctionUrlAuthType.AWS_IAM,  // Change from NONE
  cors: { ... }
});
```

### 2. Restrict CORS Origins (Production)

Update CDK stack:

```typescript
cors: {
  allowedOrigins: ['https://yourdomain.com'],  // Change from ['*']
  allowedMethods: [lambda.HttpMethod.POST],
  allowedHeaders: ['Content-Type'],
  maxAge: cdk.Duration.seconds(300)
}
```

### 3. Enable VPC (Optional)

If accessing private resources:

```typescript
this.function = new lambda.Function(this, 'HtmlToPdfFunction', {
  // ... other config
  vpc: ec2.Vpc.fromLookup(this, 'VPC', { vpcId: 'vpc-12345' }),
  vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS }
});
```

### 4. Encrypt S3 Bucket with KMS (Optional)

```typescript
const kmsKey = new kms.Key(this, 'PdfBucketKey', {
  enableKeyRotation: true
});

this.bucket = new s3.Bucket(this, 'PdfBucket', {
  encryption: s3.BucketEncryption.KMS,
  encryptionKey: kmsKey,
  // ... other config
});
```

## Cost Monitoring

### Set Up Billing Alarms

```bash
# Create SNS topic for billing alerts
aws sns create-topic --name BillingAlerts

# Subscribe email
aws sns subscribe \
  --topic-arn arn:aws:sns:us-east-1:123456789012:BillingAlerts \
  --protocol email \
  --notification-endpoint your-email@example.com

# Create billing alarm (must be in us-east-1)
aws cloudwatch put-metric-alarm \
  --alarm-name LambdaCostAlarm \
  --alarm-description "Alert when Lambda costs exceed $10" \
  --metric-name EstimatedCharges \
  --namespace AWS/Billing \
  --statistic Maximum \
  --period 21600 \
  --evaluation-periods 1 \
  --threshold 10 \
  --comparison-operator GreaterThanThreshold \
  --dimensions Name=ServiceName,Value=AWSLambda \
  --alarm-actions arn:aws:sns:us-east-1:123456789012:BillingAlerts \
  --region us-east-1
```

### Monitor Costs

```bash
# View cost explorer (requires Cost Explorer API access)
aws ce get-cost-and-usage \
  --time-period Start=2024-01-01,End=2024-01-31 \
  --granularity MONTHLY \
  --metrics UnblendedCost \
  --filter file://filter.json

# filter.json
{
  "Dimensions": {
    "Key": "SERVICE",
    "Values": ["AWS Lambda"]
  }
}
```

## Next Steps

1. ✅ Deploy to dev environment
2. ✅ Test with sample invoices
3. ✅ Monitor CloudWatch logs and metrics
4. ✅ Subscribe to alarm notifications
5. ✅ Deploy to production
6. ✅ Integrate with i2speedex application
7. ✅ Set up CI/CD pipeline (optional)

## References

- [AWS CDK Documentation](https://docs.aws.amazon.com/cdk/)
- [AWS Lambda Documentation](https://docs.aws.amazon.com/lambda/)
- [Lambda Function URLs](https://docs.aws.amazon.com/lambda/latest/dg/lambda-urls.html)
- [CloudFormation Stack Management](https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/stacks.html)
