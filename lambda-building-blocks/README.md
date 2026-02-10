# Lambda Building Blocks for i2speedex

Reusable AWS Lambda functions optimized for low-volume serverless applications.

## Overview

This repository contains modular, reusable Lambda functions designed for:
- **Low-volume usage** (5-10 operations/month)
- **AWS Free Tier compliance** (1M requests/month, 400K GB-seconds compute)
- **Lambda Function URLs** instead of API Gateway (cost savings)
- **Multi-app reusability** (not specific to i2speedex)

**Estimated Monthly Cost**: **$0-2** (fully covered by Free Tier at current usage)

## Available Building Blocks

### 1. HTML-to-PDF Lambda ⭐ **IMPLEMENTED**

Convert HTML templates to professional PDF documents.

**Status**: ✅ Ready for deployment

**Use Cases**:
- Invoice generation
- Receipt generation
- Report generation
- Contract generation
- Certificate generation

**Features**:
- Puppeteer + Chromium for high-quality PDF rendering
- Support for custom page sizes (A4, A3, Letter, Legal)
- Configurable margins, headers, and footers
- Multiple output formats (base64, S3, presigned URL)
- Built-in input validation and sanitization
- CloudWatch structured logging
- CloudWatch alarms for monitoring

**Documentation**: [functions/html-to-pdf/README.md](functions/html-to-pdf/README.md)

### 2. SDI Invoice Generator Lambda ⏳ **PLANNED**

Generate Italian FatturaPA XML invoices with embedded attachments.

**Status**: Not yet implemented

### 3. Template Renderer Lambda ⏳ **PLANNED**

Render HTML from templates (Handlebars, EJS, Mustache) with data.

**Status**: Not yet implemented

### 4. File Processor Lambda ⏳ **PLANNED**

File operations (encode/decode, format conversion, compression).

**Status**: Not yet implemented

### 5. Document Validator Lambda ⏳ **PLANNED**

Validate documents against schemas (JSON Schema, XSD, Italian fiscal codes).

**Status**: Not yet implemented

## Project Structure

```
lambda-building-blocks/
├── cdk/                          # Infrastructure as Code (AWS CDK)
│   ├── bin/
│   │   └── app.ts               # CDK app entry point
│   ├── lib/
│   │   └── html-to-pdf-stack.ts # Lambda stack definition
│   ├── package.json
│   ├── tsconfig.json
│   └── cdk.json
├── functions/
│   └── html-to-pdf/             # HTML-to-PDF Lambda function
│       ├── src/
│       │   ├── index.ts         # Lambda handler
│       │   ├── pdf-generator.ts # PDF generation logic
│       │   ├── validator.ts     # Input validation
│       │   ├── s3-uploader.ts   # S3 upload logic
│       │   └── logger.ts        # Structured logging
│       ├── test/
│       │   └── validator.test.ts
│       ├── events/              # Sample test events
│       │   ├── sample-invoice.json
│       │   ├── simple-test.json
│       │   └── s3-output-test.json
│       ├── package.json
│       ├── tsconfig.json
│       └── README.md            # Function-specific docs
├── docs/                        # Additional documentation
└── README.md                    # This file
```

## Prerequisites

- **Node.js**: 20.x or later
- **AWS CLI**: Configured with credentials
- **AWS CDK**: 2.x (`npm install -g aws-cdk`)
- **TypeScript**: 5.x
- **AWS Account**: With appropriate permissions

## Quick Start

### 1. Install Dependencies

```bash
# Install CDK dependencies
cd cdk
npm install

# Install Lambda function dependencies
cd ../functions/html-to-pdf
npm install
```

### 2. Build

```bash
# Build CDK
cd cdk
npm run build

# Build Lambda function
cd ../functions/html-to-pdf
npm run build
```

### 3. Deploy to AWS

```bash
cd cdk

# Deploy to dev environment
npm run deploy:dev

# Deploy to production
npm run deploy:prod
```

### 4. Get Function URL

After deployment, CDK will output the Function URL:

```
Outputs:
HtmlToPdfLambda-Dev.FunctionUrl = https://abcdef1234.lambda-url.eu-west-1.on.aws/
```

### 5. Test the Function

```bash
# Using curl
curl -X POST https://your-function-url.lambda-url.eu-west-1.on.aws/ \
  -H "Content-Type: application/json" \
  -d @functions/html-to-pdf/events/simple-test.json

# Using Node.js
node functions/html-to-pdf/examples/test-client.js
```

## Testing Locally

### Using AWS SAM

```bash
# Install SAM CLI
brew install aws-sam-cli

# Test locally
cd functions/html-to-pdf
sam local invoke HtmlToPdfFunction -e events/simple-test.json
```

### Run Unit Tests

```bash
cd functions/html-to-pdf
npm test

# With coverage
npm test -- --coverage
```

## Cost Analysis

### Expected Usage (10 invoices/month)

| Operation | Lambda Calls | GB-seconds | Cost |
|-----------|--------------|------------|------|
| Generate PDF (×10) | 10 | 160 | $0 |

**Free Tier Utilization**: 160 / 400,000 = **0.04%** ✅

**Headroom**: Can scale to **2,500 PDFs/month** before hitting free tier limit

### Cost Beyond Free Tier

- **Lambda compute**: $0.0000166667 per GB-second
- **Lambda requests**: $0.20 per 1M requests
- **S3 storage**: $0.023 per GB/month (eu-west-1)
- **S3 requests**: $0.0004 per 1K PUT, $0.00004 per 1K GET

**Example**: 1,000 PDFs/month = ~$2-3/month

## Monitoring

### CloudWatch Logs

All Lambda functions output structured JSON logs:

```json
{
  "timestamp": "2024-01-27T10:30:00.000Z",
  "level": "INFO",
  "message": "PDF generated successfully",
  "requestId": "abc-123",
  "duration": 7.234,
  "size": 245678
}
```

### CloudWatch Alarms

Automatically configured alarms:
- ✅ Error rate > 1%
- ✅ Duration > 25 seconds (approaching timeout)
- ✅ Throttles (concurrent limit reached)

### Querying Logs

```bash
# View recent logs
aws logs tail /aws/lambda/html-to-pdf-dev --follow

# Query with CloudWatch Logs Insights
aws logs start-query \
  --log-group-name /aws/lambda/html-to-pdf-dev \
  --start-time $(date -u -d '1 hour ago' +%s) \
  --end-time $(date -u +%s) \
  --query-string 'fields @timestamp, message, duration | filter level = "ERROR" | sort @timestamp desc'
```

## Security

### Authentication

- **Default**: Public Function URL (no authentication)
- **Production**: Consider enabling IAM authentication or moving to VPC

### Input Validation

- HTML size limit: 10MB
- XSS prevention: Script tags and event handlers removed
- Puppeteer sandbox: Prevents code execution

### Rate Limiting

- Reserved concurrency: 10 (prod), 5 (dev)
- CloudWatch alarms notify on throttling

### Best Practices

1. **Never expose Function URLs publicly** in production
2. **Use IAM authentication** for internal services
3. **Enable VPC** if accessing private resources
4. **Rotate credentials** regularly
5. **Monitor CloudWatch logs** for suspicious activity

## Troubleshooting

### Lambda Timeout

**Symptom**: 504 Gateway Timeout after 30 seconds

**Solutions**:
- Reduce HTML complexity
- Optimize images (compress, reduce size)
- Increase Lambda timeout (max 15 minutes)
- Increase Lambda memory (more CPU)

### Out of Memory

**Symptom**: Lambda runs out of memory (OOM)

**Solutions**:
- Increase Lambda memory (current: 2048 MB)
- Reduce HTML size
- Optimize images

### Cold Start

**Symptom**: First request after idle takes 3-5 seconds

**Solutions**:
- Accept cold start for low-volume usage
- Use provisioned concurrency (costs $6/month per unit)
- Pre-warm with scheduled CloudWatch event

### PDF Quality Issues

**Symptom**: Fonts, images, or layout incorrect

**Solutions**:
- Use web-safe fonts or embed custom fonts
- Use absolute URLs for images
- Test HTML in browser first
- Check CSS for print media queries

## Roadmap

### Phase 1 (Current): HTML-to-PDF Lambda ✅
- [x] Implement core PDF generation
- [x] Add S3 upload
- [x] Configure Function URL
- [x] Add monitoring and alarms
- [x] Documentation
- [ ] Deploy to production
- [ ] Generate 10+ real invoices
- [ ] Collect user feedback

### Phase 2 (Future): Additional Building Blocks
- [ ] Template Renderer Lambda (if HTML generation needed)
- [ ] SDI Generator Lambda (if Italian e-invoicing needed)
- [ ] File Processor Lambda (if attachment handling needed)
- [ ] Document Validator Lambda (if validation needed)

### Phase 3 (Future): Enhancements
- [ ] IAM authentication
- [ ] Custom domain with CloudFront
- [ ] API Gateway integration (if throttling/caching needed)
- [ ] Multi-region deployment
- [ ] CI/CD pipeline

## Contributing

Contributions are welcome! Please follow these guidelines:

1. Create a feature branch
2. Write tests for new functionality
3. Update documentation
4. Run linter and tests before committing
5. Submit a pull request

## License

MIT License - See LICENSE file for details

## Support

For issues, questions, or feedback:
- Create an issue in this repository
- Contact the development team

## References

- [AWS Lambda Documentation](https://docs.aws.amazon.com/lambda/)
- [AWS CDK Documentation](https://docs.aws.amazon.com/cdk/)
- [Puppeteer Documentation](https://pptr.dev/)
- [@sparticuz/chromium](https://github.com/Sparticuz/chromium)
- [AWS Free Tier](https://aws.amazon.com/free/)
