# i2speedex Sale Module - API Gateway Setup

## HTTP API Gateway (v2)

**Date**: January 29, 2026
**Status**: ✅ API Gateway Deployed
**Environment**: Development (dev)

---

## Deployed Resources

### HTTP API
**API Name**: `i2speedex-sale-api-dev`
**API ID**: `r10lp4qqkg`
**Protocol**: HTTP (API Gateway v2)
**Region**: eu-west-1
**Status**: ✅ ACTIVE

### Endpoints
**Base URL**: `https://r10lp4qqkg.execute-api.eu-west-1.amazonaws.com`
**API Endpoint**: `https://r10lp4qqkg.execute-api.eu-west-1.amazonaws.com/api`

### Authorizer
**Authorizer ID**: `rxfwdw`
**Name**: `cognito-authorizer-dev`
**Type**: JWT (JSON Web Token)
**Identity Source**: Authorization header
**Issuer**: `https://cognito-idp.eu-west-1.amazonaws.com/eu-west-1_5C3HQsAtE`
**Audience**: `1ut7n5a1tpb0i48mqctol09eua` (Frontend Client ID)

---

## CORS Configuration

**Allowed Origins**:
- `http://localhost:3000` (local development)
- `https://dev-sales.i2speedex.com` (dev environment)

**Allowed Methods**:
- GET
- POST
- PUT
- PATCH
- DELETE
- OPTIONS

**Allowed Headers**:
- Content-Type
- Authorization
- X-Amz-Date
- X-Api-Key
- X-Amz-Security-Token

**Allow Credentials**: ✅ Yes
**Max Age**: 1 hour (3600 seconds)

---

## Throttling Configuration

### Development Environment
- **Burst Limit**: 100 requests
- **Rate Limit**: 50 requests/second

### Production Environment (when deployed)
- **Burst Limit**: 200 requests
- **Rate Limit**: 100 requests/second

---

## Access Logging

**Log Group**: `/aws/apigateway/i2speedex-sale-api-dev`
**Retention**: 7 days (dev), 30 days (prod)

**Log Format** (JSON):
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

---

## Planned API Routes

The following routes will be implemented in Phase 2 (Backend Development):

### Sales Routes
```
GET    /api/sales              - List all sales (paginated, filterable)
GET    /api/sales/{id}         - Get sale details by ID
POST   /api/sales              - Create new sale
PUT    /api/sales/{id}         - Update existing sale
DELETE /api/sales/{id}         - Delete sale (soft delete)

GET    /api/sales/{id}/lines   - Get all lines for a sale
POST   /api/sales/{id}/lines   - Add new line to sale
PUT    /api/sales/{id}/lines/{lineId} - Update sale line
DELETE /api/sales/{id}/lines/{lineId} - Delete sale line

POST   /api/sales/{id}/invoice/html - Generate HTML invoice
POST   /api/sales/{id}/invoice/pdf  - Generate PDF invoice
POST   /api/sales/{id}/invoice/sdi  - Generate Italian SDI XML
```

### Buyers Routes
```
GET    /api/buyers             - List all buyers (paginated, searchable)
GET    /api/buyers/{id}        - Get buyer details by ID
POST   /api/buyers             - Create new buyer
PUT    /api/buyers/{id}        - Update existing buyer
DELETE /api/buyers/{id}        - Delete buyer (soft delete)
```

### Producers Routes
```
GET    /api/producers          - List all producers (paginated, searchable)
GET    /api/producers/{id}     - Get producer details by ID
POST   /api/producers          - Create new producer
PUT    /api/producers/{id}     - Update existing producer
DELETE /api/producers/{id}     - Delete producer (soft delete)
```

### Dashboard Routes
```
GET    /api/dashboard/stats    - Get dashboard statistics (sales count, revenue, etc.)
GET    /api/dashboard/recent   - Get recent sales activity
GET    /api/dashboard/charts   - Get chart data (monthly sales, top buyers, etc.)
```

### Search Routes
```
GET    /api/search?q={query}  - Global search across sales, buyers, producers
GET    /api/search/sales?q={query}    - Search sales only
GET    /api/search/buyers?q={query}   - Search buyers only
GET    /api/search/producers?q={query} - Search producers only
```

### User Management Routes
```
GET    /api/users/me           - Get current user profile
PUT    /api/users/me           - Update current user profile
GET    /api/users              - List all users (admin only)
POST   /api/users              - Create new user (admin only)
PUT    /api/users/{id}         - Update user (admin only)
DELETE /api/users/{id}         - Delete user (admin only)
```

---

## Authentication & Authorization

### JWT Token Flow

1. **Login**: User authenticates with Cognito
2. **Token**: Cognito returns ID token, access token, refresh token
3. **API Request**: Include access token in Authorization header
4. **Validation**: API Gateway validates JWT with Cognito
5. **Lambda**: Request forwarded to Lambda with user context

### Making Authenticated Requests

```typescript
// Get JWT token from Cognito
const session = await fetchAuthSession();
const token = session.tokens?.accessToken?.toString();

// Make authenticated API request
const response = await fetch('https://r10lp4qqkg.execute-api.eu-west-1.amazonaws.com/api/sales', {
  method: 'GET',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  },
});

const data = await response.json();
```

### Authorization Header Format
```
Authorization: Bearer eyJraWQiOiJ...truncated...
```

### Token Validation
- Issuer must match Cognito User Pool
- Audience must match Client ID
- Token must not be expired
- Signature must be valid

---

## Integration with Nuxt 4

### API Client Composable

```typescript
// composables/useApi.ts
export const useApi = () => {
  const config = useRuntimeConfig();
  const { user } = useAuth();

  const baseUrl = config.public.apiUrl || 'https://r10lp4qqkg.execute-api.eu-west-1.amazonaws.com/api';

  const getAuthHeaders = async () => {
    const session = await fetchAuthSession();
    const token = session.tokens?.accessToken?.toString();

    return {
      'Content-Type': 'application/json',
      'Authorization': token ? `Bearer ${token}` : '',
    };
  };

  const get = async (endpoint: string) => {
    const headers = await getAuthHeaders();
    const response = await fetch(`${baseUrl}${endpoint}`, {
      method: 'GET',
      headers,
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    return response.json();
  };

  const post = async (endpoint: string, data: any) => {
    const headers = await getAuthHeaders();
    const response = await fetch(`${baseUrl}${endpoint}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    return response.json();
  };

  const put = async (endpoint: string, data: any) => {
    const headers = await getAuthHeaders();
    const response = await fetch(`${baseUrl}${endpoint}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    return response.json();
  };

  const del = async (endpoint: string) => {
    const headers = await getAuthHeaders();
    const response = await fetch(`${baseUrl}${endpoint}`, {
      method: 'DELETE',
      headers,
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    return response.json();
  };

  return {
    get,
    post,
    put,
    delete: del,
  };
};
```

### Usage in Components

```vue
<script setup lang="ts">
const api = useApi();
const { data: sales, pending, error } = await useAsyncData('sales', () =>
  api.get('/sales')
);
</script>

<template>
  <div>
    <div v-if="pending">Loading...</div>
    <div v-else-if="error">Error: {{ error }}</div>
    <div v-else>
      <SalesTable :sales="sales" />
    </div>
  </div>
</template>
```

### Nuxt Configuration

```typescript
// nuxt.config.ts
export default defineNuxtConfig({
  runtimeConfig: {
    public: {
      apiUrl: process.env.NUXT_PUBLIC_API_URL || 'https://r10lp4qqkg.execute-api.eu-west-1.amazonaws.com/api',
      cognitoUserPoolId: 'eu-west-1_5C3HQsAtE',
      cognitoClientId: '1ut7n5a1tpb0i48mqctol09eua',
    },
  },
});
```

### Environment Variables

```bash
# .env.development
NUXT_PUBLIC_API_URL=https://r10lp4qqkg.execute-api.eu-west-1.amazonaws.com/api

# .env.production
NUXT_PUBLIC_API_URL=https://api.sales.i2speedex.com/api
```

---

## Testing API Gateway

### Test CORS Preflight

```bash
curl -X OPTIONS \
  https://r10lp4qqkg.execute-api.eu-west-1.amazonaws.com/api/sales \
  -H "Origin: http://localhost:3000" \
  -H "Access-Control-Request-Method: GET" \
  -H "Access-Control-Request-Headers: Authorization" \
  -v
```

Expected response headers:
```
Access-Control-Allow-Origin: http://localhost:3000
Access-Control-Allow-Methods: GET,POST,PUT,PATCH,DELETE,OPTIONS
Access-Control-Allow-Headers: Content-Type,Authorization,X-Amz-Date,X-Api-Key,X-Amz-Security-Token
Access-Control-Allow-Credentials: true
Access-Control-Max-Age: 3600
```

### Test Authentication (requires valid JWT)

```bash
# Get token from Cognito first, then:
TOKEN="your-jwt-token-here"

curl -X GET \
  https://r10lp4qqkg.execute-api.eu-west-1.amazonaws.com/api/sales \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json"
```

### Test without Authentication (should fail)

```bash
curl -X GET \
  https://r10lp4qqkg.execute-api.eu-west-1.amazonaws.com/api/sales \
  -v
```

Expected response:
```
HTTP/1.1 401 Unauthorized
{"message":"Unauthorized"}
```

---

## CloudWatch Monitoring

### View API Logs

```bash
# Tail API Gateway logs
aws logs tail /aws/apigateway/i2speedex-sale-api-dev --follow

# Query specific time range
aws logs filter-log-events \
  --log-group-name /aws/apigateway/i2speedex-sale-api-dev \
  --start-time $(date -u -d '1 hour ago' +%s)000 \
  --filter-pattern '{ $.status >= 400 }'
```

### CloudWatch Metrics

Available metrics:
- **Count**: Total number of API requests
- **4XXError**: Client error count
- **5XXError**: Server error count
- **Latency**: Request/response time
- **IntegrationLatency**: Backend integration time

### View Metrics

```bash
# Get API request count (last hour)
aws cloudwatch get-metric-statistics \
  --namespace AWS/ApiGateway \
  --metric-name Count \
  --dimensions Name=ApiId,Value=r10lp4qqkg \
  --start-time $(date -u -d '1 hour ago' --iso-8601) \
  --end-time $(date -u --iso-8601) \
  --period 3600 \
  --statistics Sum
```

---

## Error Handling

### Common HTTP Status Codes

| Code | Meaning | Cause |
|------|---------|-------|
| 200 | OK | Successful request |
| 201 | Created | Resource created successfully |
| 400 | Bad Request | Invalid request body or parameters |
| 401 | Unauthorized | Missing or invalid JWT token |
| 403 | Forbidden | Valid token but insufficient permissions |
| 404 | Not Found | Resource doesn't exist |
| 429 | Too Many Requests | Rate limit exceeded |
| 500 | Internal Server Error | Lambda function error |
| 502 | Bad Gateway | Lambda timeout or crash |
| 504 | Gateway Timeout | Request took longer than 30 seconds |

### Error Response Format

```json
{
  "error": "Error message",
  "message": "Detailed error description",
  "statusCode": 400,
  "timestamp": "2026-01-29T00:00:00.000Z",
  "path": "/api/sales",
  "requestId": "abc-123-def"
}
```

---

## Cost Estimation

### API Gateway HTTP API Pricing

**Free Tier**: First 1 million requests/month FREE

**Beyond Free Tier**:
- $1.00 per million requests (first 300M)
- $0.90 per million requests (next 700M+)

### Expected Cost for i2speedex

**Assumptions**:
- 100 sales/month
- 10 API calls per sale (CRUD operations)
- 1,000 total requests/month

**Monthly Cost**:
- 1,000 requests × $0.00 = **$0.00** (within free tier)

**Headroom**: Can handle up to **1 million requests/month** before charges

---

## Security Best Practices

### API Gateway Level

1. ✅ Enable CORS only for trusted origins
2. ✅ Use JWT authorizer for authentication
3. ✅ Configure throttling to prevent abuse
4. ✅ Enable access logging for audit trail
5. ⏸️ Add WAF (Web Application Firewall) for production
6. ⏸️ Use custom domain with SSL certificate
7. ⏸️ Implement API keys for additional security layer

### Application Level

1. Validate all input data in Lambda functions
2. Sanitize user input to prevent injection attacks
3. Implement role-based access control (RBAC)
4. Use least-privilege IAM policies
5. Enable X-Ray tracing for debugging
6. Implement request/response logging
7. Set up CloudWatch alarms for anomalies

---

## Next Steps (Phase 2 - Backend Development)

- [ ] Create Lambda functions for CRUD operations
- [ ] Connect Lambda integrations to API Gateway routes
- [ ] Implement DynamoDB data access layer
- [ ] Add input validation and error handling
- [ ] Write unit tests for Lambda functions
- [ ] Set up integration tests for API endpoints
- [ ] Configure custom domain (optional)
- [ ] Add AWS WAF protection (production)

---

## Infrastructure as Code

### CDK Stack Location
`lambda-building-blocks/cdk/lib/sale-module-api-gateway-stack.ts`

### Deploy Commands

```bash
# Deploy API Gateway
cd lambda-building-blocks/cdk
npx cdk deploy SaleModuleApiGateway-Dev --context environment=dev

# View stack outputs
aws cloudformation describe-stacks \
  --stack-name SaleModuleApiGateway-Dev \
  --query 'Stacks[0].Outputs'
```

---

## Links

- **API Gateway Console**: https://eu-west-1.console.aws.amazon.com/apigateway/main/apis/r10lp4qqkg/routes
- **CloudWatch Logs**: https://eu-west-1.console.aws.amazon.com/cloudwatch/home?region=eu-west-1#logsV2:log-groups/log-group/$252Faws$252Fapigateway$252Fi2speedex-sale-api-dev
- **CloudFormation Stack**: https://eu-west-1.console.aws.amazon.com/cloudformation/home?region=eu-west-1#/stacks/stackinfo?stackId=arn:aws:cloudformation:eu-west-1:827562051115:stack/SaleModuleApiGateway-Dev/ff7fc890-fcb5-11f0-808a-02498bbfc435

---

**Status**: ✅ API Gateway Deployed & Configured
**Deployment Date**: January 29, 2026, 08:58 UTC
**Deployed By**: Claude Code
**Environment**: Development (dev)
**Base URL**: https://r10lp4qqkg.execute-api.eu-west-1.amazonaws.com/api
**Next**: Configure S3 buckets for file storage (PDFs, XML invoices)
