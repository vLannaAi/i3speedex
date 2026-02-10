# Quick Start Guide

Get the HTML-to-PDF Lambda function up and running in 10 minutes.

## Prerequisites

- AWS Account with programmatic access
- AWS CLI configured (`aws configure`)
- Node.js 20.x installed
- AWS CDK installed (`npm install -g aws-cdk`)

## 1. Install Dependencies

```bash
# From repository root
npm run build
```

This installs and builds both the CDK and Lambda function code.

## 2. Bootstrap CDK (One-time)

```bash
# Bootstrap CDK for your account/region
npm run bootstrap
```

## 3. Deploy to Dev

```bash
npm run deploy:dev
```

**Expected output:**

```
✅  HtmlToPdfLambda-Dev

Outputs:
HtmlToPdfLambda-Dev.FunctionUrl = https://abcdef1234.lambda-url.eu-west-1.on.aws/
HtmlToPdfLambda-Dev.BucketName = html-to-pdf-dev-123456789012
...
```

**Save the Function URL** - you'll need it for testing.

## 4. Test the Function

### Option A: Using curl

```bash
# Set your Function URL
export FUNCTION_URL="https://abcdef1234.lambda-url.eu-west-1.on.aws/"

# Test with simple HTML
curl -X POST $FUNCTION_URL \
  -H "Content-Type: application/json" \
  -d '{
    "html": "<!DOCTYPE html><html><head><title>Test</title></head><body><h1>Hello World!</h1><p>This is a test PDF.</p></body></html>",
    "options": {
      "format": "A4",
      "printBackground": true
    },
    "outputFormat": "base64"
  }' | jq .
```

### Option B: Using test event

```bash
# Test with sample invoice
curl -X POST $FUNCTION_URL \
  -H "Content-Type: application/json" \
  -d @functions/html-to-pdf/events/simple-test.json > response.json

# Extract and save PDF
cat response.json | jq -r '.pdfBase64' | base64 -d > test.pdf

# Open PDF
open test.pdf  # macOS
xdg-open test.pdf  # Linux
```

### Option C: Using test client

```bash
# Node.js client
FUNCTION_URL=$FUNCTION_URL npm run test-client

# Python client
cd functions/html-to-pdf/examples
FUNCTION_URL=$FUNCTION_URL python test-client.py
```

## 5. View Logs

```bash
# View real-time logs
npm run logs:dev

# Or manually
aws logs tail /aws/lambda/html-to-pdf-dev --follow
```

## 6. Monitor Function

### CloudWatch Dashboard

1. Go to AWS Console → CloudWatch → Dashboards
2. View Lambda metrics:
   - Invocations
   - Errors
   - Duration
   - Throttles

### CloudWatch Alarms

Alarms are automatically created for:
- Error rate > 1%
- Duration > 25 seconds
- Throttles

Subscribe to alarm notifications:

```bash
# Get SNS topic ARN from deployment output
TOPIC_ARN="arn:aws:sns:eu-west-1:123456789012:HtmlToPdfLambda-Dev-AlarmTopic..."

# Subscribe email
aws sns subscribe \
  --topic-arn $TOPIC_ARN \
  --protocol email \
  --notification-endpoint your-email@example.com
```

## 7. Generate Real Invoice

Create your own HTML invoice and test:

```bash
# Create invoice.html
cat > invoice.html << 'EOF'
<!DOCTYPE html>
<html lang="it">
<head>
    <meta charset="UTF-8">
    <title>Fattura T042/2024</title>
    <style>
        body { font-family: Arial, sans-serif; padding: 40px; }
        h1 { color: #2c3e50; }
        table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        table th { background: #34495e; color: white; padding: 10px; text-align: left; }
        table td { padding: 8px; border-bottom: 1px solid #ddd; }
    </style>
</head>
<body>
    <h1>Fattura N. T042/2024</h1>
    <p><strong>Data:</strong> 27/01/2024</p>
    <p><strong>Cliente:</strong> Test S.r.l.</p>
    <table>
        <thead>
            <tr><th>Descrizione</th><th>Q.tà</th><th>Prezzo</th><th>Totale</th></tr>
        </thead>
        <tbody>
            <tr><td>Consulenza</td><td>10</td><td>€100</td><td>€1,000</td></tr>
            <tr><td>Licenza</td><td>1</td><td>€500</td><td>€500</td></tr>
        </tbody>
    </table>
    <p><strong>Totale: €1,500</strong></p>
</body>
</html>
EOF

# Generate PDF
HTML=$(cat invoice.html | jq -Rs .)
curl -X POST $FUNCTION_URL \
  -H "Content-Type: application/json" \
  -d "{\"html\":$HTML,\"options\":{\"format\":\"A4\",\"printBackground\":true},\"outputFormat\":\"base64\"}" \
  | jq -r '.pdfBase64' | base64 -d > invoice.pdf

# Open PDF
open invoice.pdf
```

## Common Commands

### Deployment

```bash
# Deploy to dev
npm run deploy:dev

# Deploy to production
npm run deploy:prod

# Review changes before deploying
npm run diff:dev
npm run diff:prod
```

### Testing

```bash
# Run unit tests
npm test

# Run integration tests
npm run test-client
```

### Monitoring

```bash
# View dev logs
npm run logs:dev

# View prod logs
npm run logs:prod

# Tail logs with filter
aws logs tail /aws/lambda/html-to-pdf-dev --follow --filter-pattern "ERROR"
```

### Cleanup

```bash
# Destroy dev stack
npm run destroy:dev

# Destroy prod stack
npm run destroy:prod
```

## Troubleshooting

### Issue: CDK not found

```bash
npm install -g aws-cdk
```

### Issue: AWS credentials not configured

```bash
aws configure
# Enter:
# - AWS Access Key ID
# - AWS Secret Access Key
# - Default region: eu-west-1
# - Default output format: json
```

### Issue: Bootstrap required

```bash
npm run bootstrap
```

### Issue: Lambda timeout

- Increase Lambda timeout in `cdk/lib/html-to-pdf-stack.ts`
- Optimize HTML (reduce images, complexity)
- Increase Lambda memory for faster CPU

### Issue: Function URL 403/404

- Verify Function URL in deployment output
- Check CORS configuration
- Test with curl first (not browser)

## Next Steps

1. ✅ Test with your own HTML invoices
2. ✅ Integrate with your application
3. ✅ Monitor costs and performance
4. ✅ Deploy to production when ready
5. ✅ Set up CI/CD pipeline (optional)

## Cost Estimate

**Expected cost for 10 invoices/month: $0** (Free Tier)

**Breakdown:**
- Lambda invocations: Free (1M/month free tier)
- Lambda compute: 160 GB-seconds = $0 (400K GB-sec free tier)
- S3 storage: ~5MB = $0 (5GB free tier)

**Free tier headroom**: Can generate up to **2,500 PDFs/month** at $0 cost

## Resources

- Full documentation: [README.md](README.md)
- Deployment guide: [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)
- Function API reference: [functions/html-to-pdf/README.md](functions/html-to-pdf/README.md)
- Test events: [functions/html-to-pdf/events/](functions/html-to-pdf/events/)
- Examples: [functions/html-to-pdf/examples/](functions/html-to-pdf/examples/)

## Support

For issues or questions:
- Check [Troubleshooting](#troubleshooting) section
- Review CloudWatch logs
- Create an issue in the repository
- Contact the development team

---

**Happy PDF generating! 🎉**
