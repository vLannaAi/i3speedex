# API Gateway Integration

## Task #19: Connect Lambda Functions to API Gateway Routes

**Date**: January 29, 2026
**Status**: ✅ Complete
**Routes Configured**: 35

---

## Overview

Successfully connected all 40 Lambda handlers to AWS API Gateway HTTP API (v2) with JWT authentication via Cognito. This completes the backend API infrastructure, making all endpoints accessible via REST API.

### Key Features

- **35 API Routes** mapped to 40 Lambda handlers
- **JWT Authentication** via Cognito User Pool
- **CORS Configuration** for frontend integration
- **Automatic Deployment** via AWS CDK
- **Throttling & Rate Limiting** configured
- **CloudWatch Logging** enabled
- **IAM Permissions** automatically granted

---

## CDK Stack Architecture

### Stack Dependencies

```
SaleModuleLambdaStack
  ├── depends on: SaleModuleApiGatewayStack
  ├── depends on: SaleModuleDynamoDBStack
  ├── depends on: SaleModuleS3Stack
  ├── depends on: SaleModuleCognitoStack
  └── integrates with: Building Block Lambdas
```

### New CDK Stack

**File**: `/Users/vicio/i2speedex/lambda-building-blocks/cdk/lib/sale-module-lambda-stack.ts`

**Purpose**: Creates all 40 Lambda functions and connects them to API Gateway routes

**Key Components**:
1. **Lambda Functions** - Creates all handlers with common configuration
2. **API Gateway Routes** - Maps routes to Lambda integrations
3. **IAM Permissions** - Grants DynamoDB, S3, and Lambda invoke permissions
4. **JWT Authorizer** - Configures Cognito authentication

---

## Lambda Configuration

### Common Settings (All Functions)

```typescript
{
  runtime: Node.js 20.x (ARM64)
  timeout: 30 seconds (60s for invoice functions)
  memorySize: 256MB (dev) / 512MB (prod)
  logRetention: 7 days (dev) / 30 days (prod)
  bundling: {
    minify: true (prod only)
    sourceMap: true (dev only)
    target: ES2020
  }
}
```

### Environment Variables

All Lambda functions receive:
```typescript
{
  NODE_ENV: 'dev' | 'staging' | 'prod'
  AWS_REGION: 'eu-west-1'
  SALES_TABLE_NAME: 'i2speedex-sales-dev'
  BUYERS_TABLE_NAME: 'i2speedex-buyers-dev'
  PRODUCERS_TABLE_NAME: 'i2speedex-producers-dev'
  DOCUMENTS_BUCKET_NAME: 'i2speedex-documents-dev-827562051115'
  TEMPLATE_RENDERER_FUNCTION_NAME: 'TemplateRendererLambda-Dev'
  HTML_TO_PDF_FUNCTION_NAME: 'HtmlToPdfLambda-Dev'
  SDI_GENERATOR_FUNCTION_NAME: 'SdiInvoiceGeneratorLambda-Dev'
}
```

---

## API Routes

### Sales Routes (10)

| Method | Path | Handler | Auth | Description |
|--------|------|---------|------|-------------|
| GET | `/api/sales` | list-sales | ✅ | List sales with pagination |
| GET | `/api/sales/{id}` | get-sale | ✅ | Get single sale |
| POST | `/api/sales` | create-sale | ✅ | Create new sale |
| PUT | `/api/sales/{id}` | update-sale | ✅ | Update sale |
| DELETE | `/api/sales/{id}` | delete-sale | ✅ | Soft delete sale |
| POST | `/api/sales/{id}/confirm` | confirm-sale | ✅ | Confirm sale |
| GET | `/api/sales/{id}/lines` | list-sale-lines | ✅ | List sale lines |
| POST | `/api/sales/{id}/lines` | create-sale-line | ✅ | Add line to sale |
| PUT | `/api/sales/{id}/lines/{lineId}` | update-sale-line | ✅ | Update line |
| DELETE | `/api/sales/{id}/lines/{lineId}` | delete-sale-line | ✅ | Delete line |

### Buyers Routes (5)

| Method | Path | Handler | Auth | Description |
|--------|------|---------|------|-------------|
| GET | `/api/buyers` | list-buyers | ✅ | List buyers |
| GET | `/api/buyers/{id}` | get-buyer | ✅ | Get single buyer |
| POST | `/api/buyers` | create-buyer | ✅ | Create new buyer |
| PUT | `/api/buyers/{id}` | update-buyer | ✅ | Update buyer |
| DELETE | `/api/buyers/{id}` | delete-buyer | ✅ | Soft delete buyer |

### Producers Routes (5)

| Method | Path | Handler | Auth | Description |
|--------|------|---------|------|-------------|
| GET | `/api/producers` | list-producers | ✅ | List producers |
| GET | `/api/producers/{id}` | get-producer | ✅ | Get single producer |
| POST | `/api/producers` | create-producer | ✅ | Create new producer |
| PUT | `/api/producers/{id}` | update-producer | ✅ | Update producer |
| DELETE | `/api/producers/{id}` | delete-producer | ✅ | Soft delete producer |

### Invoice Routes (4)

| Method | Path | Handler | Auth | Description |
|--------|------|---------|------|-------------|
| POST | `/api/sales/{id}/invoice/html` | generate-html-invoice | ✅ | Generate HTML invoice |
| POST | `/api/sales/{id}/invoice/pdf` | generate-pdf-invoice | ✅ | Generate PDF invoice |
| POST | `/api/sales/{id}/invoice/sdi` | generate-sdi-invoice | ✅ | Generate SDI XML |
| GET | `/api/sales/{id}/invoice/download` | get-invoice-download-url | ✅ | Get download URL |

### Attachment Routes (4)

| Method | Path | Handler | Auth | Description |
|--------|------|---------|------|-------------|
| POST | `/api/sales/{id}/upload-url` | generate-upload-url | ✅ | Generate upload URL |
| POST | `/api/sales/{id}/attachments` | register-attachment | ✅ | Register attachment |
| GET | `/api/sales/{id}/attachments` | list-attachments | ✅ | List attachments |
| DELETE | `/api/sales/{id}/attachments/{attachmentId}` | delete-attachment | ✅ | Delete attachment |

### Search Routes (3)

| Method | Path | Handler | Auth | Description |
|--------|------|---------|------|-------------|
| GET | `/api/search/sales` | search-sales | ✅ | Search sales |
| GET | `/api/search/buyers` | search-buyers | ✅ | Search buyers |
| GET | `/api/search/producers` | search-producers | ✅ | Search producers |

### Dashboard Routes (4)

| Method | Path | Handler | Auth | Description |
|--------|------|---------|------|-------------|
| GET | `/api/dashboard/stats` | get-dashboard-stats | ✅ | Get statistics |
| GET | `/api/dashboard/sales-by-date` | get-sales-by-date-range | ✅ | Get sales by date |
| GET | `/api/dashboard/top-buyers` | get-top-buyers | ✅ | Get top buyers |
| GET | `/api/dashboard/recent-activity` | get-recent-activity | ✅ | Get activity feed |

**Total**: 35 routes

---

## Authentication & Authorization

### JWT Authorizer Configuration

```typescript
{
  issuer: 'https://cognito-idp.eu-west-1.amazonaws.com/${userPoolId}'
  audience: [userPoolClientId]
  identitySource: '$request.header.Authorization'
  type: JWT
}
```

### Required Headers

```
Authorization: Bearer ${JWT_TOKEN}
Content-Type: application/json
```

### Token Acquisition

1. User authenticates with Cognito
2. Receives JWT access token
3. Includes token in Authorization header
4. API Gateway validates token before invoking Lambda

### Role-Based Access Control (RBAC)

Implemented at Lambda handler level:
- **Admin**: Full access to all resources
- **Operator**: Access to own resources only
- **Viewer**: Read-only access

---

## CORS Configuration

Enabled for frontend integration:

```typescript
{
  allowHeaders: [
    'Content-Type',
    'Authorization',
    'X-Amz-Date',
    'X-Api-Key',
    'X-Amz-Security-Token'
  ],
  allowMethods: [
    'GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'
  ],
  allowOrigins: [
    'http://localhost:3000',                    // Dev
    'https://dev-sales.i2speedex.com',         // Dev
    'https://sales.i2speedex.com'              // Prod
  ],
  allowCredentials: true,
  maxAge: 3600 seconds
}
```

---

## IAM Permissions

### DynamoDB Permissions

All Lambda functions receive:
```
- dynamodb:GetItem
- dynamodb:PutItem
- dynamodb:UpdateItem
- dynamodb:DeleteItem
- dynamodb:Query
- dynamodb:Scan
```

Applied to:
- `i2speedex-sales-${environment}` (+ GSI indexes)
- `i2speedex-buyers-${environment}` (+ GSI indexes)
- `i2speedex-producers-${environment}` (+ GSI indexes)

### S3 Permissions

All Lambda functions receive:
```
- s3:GetObject
- s3:PutObject
- s3:DeleteObject
- s3:ListBucket
```

Applied to:
- `i2speedex-documents-${environment}-${account}`

### Lambda Invoke Permissions

Invoice generation functions receive:
```
- lambda:InvokeFunction
```

Applied to:
- `TemplateRendererLambda-${environment}`
- `HtmlToPdfLambda-${environment}`
- `SdiInvoiceGeneratorLambda-${environment}`

---

## Throttling & Rate Limiting

### Default Stage Settings

**Development**:
```
burstLimit: 100 requests
rateLimit: 50 requests/second
```

**Production**:
```
burstLimit: 200 requests
rateLimit: 100 requests/second
```

### Per-Route Throttling

Can be configured per route if needed:
```typescript
cfnStage.routeSettings = {
  '/api/sales': {
    throttlingBurstLimit: 50,
    throttlingRateLimit: 25,
  }
};
```

---

## CloudWatch Logging

### Access Logs

Enabled with JSON format:
```json
{
  "requestId": "$context.requestId",
  "ip": "$context.identity.sourceIp",
  "requestTime": "$context.requestTime",
  "httpMethod": "$context.httpMethod",
  "routeKey": "$context.routeKey",
  "status": "$context.status",
  "protocol": "$context.protocol",
  "responseLength": "$context.responseLength",
  "errorMessage": "$context.error.message",
  "integrationErrorMessage": "$context.integrationErrorMessage"
}
```

**Log Group**: `/aws/apigateway/i2speedex-sale-api-${environment}`
**Retention**: 7 days (dev), 30 days (prod)

### Lambda Logs

Each Lambda function has its own log group:
**Pattern**: `/aws/lambda/SaleModule${HandlerName}-${environment}`
**Retention**: 7 days (dev), 30 days (prod)

---

## Deployment

### Prerequisites

1. DynamoDB tables deployed
2. S3 buckets deployed
3. Cognito user pool deployed
4. API Gateway deployed
5. Building block Lambdas deployed

### Deploy Lambda Stack

```bash
cd /Users/vicio/i2speedex/lambda-building-blocks/cdk

# Deploy to dev
cdk deploy SaleModuleLambda-Dev --context environment=dev

# Deploy to prod
cdk deploy SaleModuleLambda-Prod --context environment=prod
```

### Deployment Output

```
✅ SaleModuleLambda-Dev

Outputs:
SaleModuleLambda-Dev.ApiEndpoint = https://r10lp4qqkg.execute-api.eu-west-1.amazonaws.com/api
SaleModuleLambda-Dev.FunctionCount = 40
SaleModuleLambda-Dev.RouteCount = 35

Stack ARN:
arn:aws:cloudformation:eu-west-1:827562051115:stack/SaleModuleLambda-Dev/...
```

---

## Testing

### Get JWT Token

```bash
# Authenticate with Cognito
aws cognito-idp initiate-auth \
  --auth-flow USER_PASSWORD_AUTH \
  --client-id ${CLIENT_ID} \
  --auth-parameters USERNAME=admin@i2speedex.com,PASSWORD=${PASSWORD} \
  --region eu-west-1

# Extract access token
TOKEN=$(echo $RESPONSE | jq -r '.AuthenticationResult.AccessToken')
```

### Test Endpoints

```bash
# List sales
curl -X GET \
  https://r10lp4qqkg.execute-api.eu-west-1.amazonaws.com/api/sales \
  -H "Authorization: Bearer ${TOKEN}"

# Create sale
curl -X POST \
  https://r10lp4qqkg.execute-api.eu-west-1.amazonaws.com/api/sales \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "saleDate": "2026-01-29",
    "buyerId": "BUYER001",
    "producerId": "PROD001",
    "currency": "EUR"
  }'

# Search sales
curl -X GET \
  "https://r10lp4qqkg.execute-api.eu-west-1.amazonaws.com/api/search/sales?q=acme" \
  -H "Authorization: Bearer ${TOKEN}"

# Dashboard stats
curl -X GET \
  https://r10lp4qqkg.execute-api.eu-west-1.amazonaws.com/api/dashboard/stats \
  -H "Authorization: Bearer ${TOKEN}"
```

---

## Monitoring

### CloudWatch Metrics

Available metrics:
- `4XXError` - Client errors
- `5XXError` - Server errors
- `Count` - Total requests
- `Latency` - Response time
- `IntegrationLatency` - Lambda execution time

### CloudWatch Alarms (Production)

1. **Client Errors Alarm**
   - Threshold: 10 errors in 5 minutes
   - Evaluation: 2 periods

2. **Server Errors Alarm**
   - Threshold: 5 errors in 5 minutes
   - Evaluation: 2 periods

3. **Latency Alarm**
   - Threshold: 1000ms average
   - Evaluation: 3 periods

### X-Ray Tracing

Enabled in production for distributed tracing:
- Request flow visualization
- Performance bottleneck identification
- Error rate analysis

---

## Cost Optimization

### Lambda Configuration

- **ARM64 Architecture**: 20% cost savings vs x86
- **Memory**: Right-sized (256MB dev, 512MB prod)
- **Timeout**: Conservative (30s, 60s for invoice)

### API Gateway

- **HTTP API**: 70% cheaper than REST API
- **Caching**: Not enabled (optimize later if needed)
- **Regional Endpoint**: Lower latency, lower cost

### Bundling

- **Minification**: Reduced bundle size (prod only)
- **Tree Shaking**: Removes unused code
- **External Modules**: Excludes AWS SDK (provided by runtime)

### Estimated Monthly Cost (Dev)

```
Lambda: ~$5/month (100K requests, 256MB, 1s avg)
API Gateway: ~$1/month (100K requests)
DynamoDB: ~$2.50/month (on-demand)
S3: ~$0.50/month (10GB storage, 1K requests)
CloudWatch: ~$0.50/month (logs)
---
Total: ~$10/month
```

---

## Security

### Authentication

- ✅ JWT tokens required for all routes
- ✅ Token validation by API Gateway (before Lambda)
- ✅ Short token expiry (1 hour)
- ✅ Refresh token support via Cognito

### Authorization

- ✅ Role-based access control in handlers
- ✅ Resource ownership validation
- ✅ Admin/Operator/Viewer permissions

### Network Security

- ✅ HTTPS only (TLS 1.2+)
- ✅ CORS restricted origins
- ✅ Rate limiting enabled
- ✅ Throttling configured

### Data Security

- ✅ S3 encryption at rest (AES256)
- ✅ DynamoDB encryption at rest
- ✅ Sensitive data not logged
- ✅ IAM principle of least privilege

---

## Troubleshooting

### Common Issues

**1. 401 Unauthorized**
- Check JWT token is valid and not expired
- Verify Authorization header format: `Bearer ${TOKEN}`
- Confirm user has active session in Cognito

**2. 403 Forbidden**
- Check user has correct role/permissions
- Verify user is accessing own resources (for operators)
- Check Cognito user groups

**3. 500 Internal Server Error**
- Check CloudWatch logs for Lambda function
- Verify environment variables are set
- Confirm DynamoDB tables exist
- Check S3 bucket permissions

**4. 502 Bad Gateway**
- Lambda timeout (check execution time)
- Lambda out of memory (check memory usage)
- Unhandled exception in Lambda (check logs)

**5. 429 Too Many Requests**
- Rate limit exceeded
- Wait and retry with exponential backoff
- Consider request optimization

### Debugging Tips

```bash
# View Lambda logs
aws logs tail /aws/lambda/SaleModuleListSales-Dev --follow

# View API Gateway logs
aws logs tail /aws/apigateway/i2speedex-sale-api-dev --follow

# Test Lambda directly (bypass API Gateway)
aws lambda invoke \
  --function-name SaleModuleListSales-Dev \
  --payload '{"requestContext":{"authorizer":{"jwt":{"claims":{"cognito:username":"admin"}}}}}' \
  response.json

# Check Lambda metrics
aws cloudwatch get-metric-statistics \
  --namespace AWS/Lambda \
  --metric-name Invocations \
  --dimensions Name=FunctionName,Value=SaleModuleListSales-Dev \
  --start-time 2026-01-29T00:00:00Z \
  --end-time 2026-01-29T23:59:59Z \
  --period 3600 \
  --statistics Sum
```

---

## Next Steps

1. ✅ Task #13-18: Implement Lambda handlers - **COMPLETE**
2. ✅ Task #19: Connect to API Gateway - **COMPLETE**
3. ⏳ Task #20: Write unit tests - **NEXT**
4. ⏳ Task #21: Integration tests
5. ⏳ Frontend development
6. ⏳ Load testing
7. ⏳ Security audit
8. ⏳ Production deployment

---

**Status**: ✅ API Gateway Integration Complete
**Date**: January 29, 2026
**Routes**: 35/35 connected
**Functions**: 40/40 deployed
**Authentication**: JWT via Cognito
**Documentation**: Complete
