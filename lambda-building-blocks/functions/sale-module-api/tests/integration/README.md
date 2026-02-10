# Integration Tests

This directory contains integration tests that validate end-to-end API workflows.

## Overview

Integration tests differ from unit tests in that they:
- Make actual HTTP requests to a running API
- Test complete workflows across multiple endpoints
- Validate data persistence and state changes
- Test authentication and authorization
- Verify error handling in realistic scenarios

## Structure

```
tests/integration/
├── api/                    # Basic CRUD tests for each resource
│   ├── buyers.test.ts
│   ├── producers.test.ts
│   └── sales.test.ts
├── workflows/              # Complex multi-step workflows
│   ├── sale-lifecycle.test.ts
│   └── invoice-generation.test.ts
├── helpers/                # Shared utilities
│   ├── api-client.ts      # HTTP client wrapper
│   ├── test-data.ts       # Test data factories
│   └── setup.ts           # Setup and teardown helpers
└── README.md              # This file
```

## Prerequisites

Integration tests require a running API environment. You have two options:

### Option 1: Local API with LocalStack (Recommended for Development)

Use LocalStack to emulate AWS services locally:

```bash
# Install LocalStack
pip install localstack

# Start LocalStack with required services
localstack start -d

# Configure AWS CLI to use LocalStack
export AWS_ENDPOINT_URL=http://localhost:4566
export AWS_ACCESS_KEY_ID=test
export AWS_SECRET_ACCESS_KEY=test
export AWS_REGION=us-east-1

# Create DynamoDB tables
npm run setup:localstack

# Start local API server
npm run start:local
```

### Option 2: AWS Development Environment

Deploy to a dedicated development environment in AWS:

```bash
# Deploy to dev environment
npm run deploy:dev

# Set API endpoint
export API_BASE_URL=https://your-api-id.execute-api.us-east-1.amazonaws.com/dev
```

## Configuration

Integration tests are configured via environment variables:

### Required Variables

```bash
# Enable integration tests
export RUN_INTEGRATION_TESTS=true

# API endpoint
export API_BASE_URL=http://localhost:3000  # or your deployed API URL

# Authentication tokens
export ADMIN_TOKEN=<your-admin-jwt-token>
export OPERATOR_TOKEN=<your-operator-jwt-token>
```

### Optional Variables

```bash
# Test timeout (milliseconds)
export TEST_TIMEOUT=30000

# Cleanup on failure
export CLEANUP_ON_FAILURE=true
```

## Running Integration Tests

### Run all integration tests

```bash
npm run test:integration
```

### Run specific test suite

```bash
npm run test:integration -- buyers.test.ts
npm run test:integration -- workflows/sale-lifecycle.test.ts
```

### Run with verbose output

```bash
npm run test:integration -- --verbose
```

### Skip cleanup (for debugging)

```bash
export SKIP_CLEANUP=true
npm run test:integration
```

## Getting Authentication Tokens

Integration tests require valid JWT tokens for authentication.

### Using AWS Cognito (Production-like)

```bash
# Install AWS CLI and jq
aws cognito-idp initiate-auth \
  --auth-flow USER_PASSWORD_AUTH \
  --client-id <your-cognito-client-id> \
  --auth-parameters USERNAME=admin@i2speedex.com,PASSWORD=<password> \
  --query 'AuthenticationResult.IdToken' \
  --output text
```

### Using Local Mock Tokens (Development)

For local development, you can use the mock token generator:

```bash
npm run generate:mock-tokens
```

This will output:
```
Admin Token: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Operator Token: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

## Test Structure

Integration tests follow this pattern:

```typescript
import { setupTests, teardownTests } from '../helpers/setup';
import { createTestBuyer } from '../helpers/test-data';

describe('Buyers API', () => {
  let context: TestContext;

  beforeAll(async () => {
    context = await setupTests();
  });

  afterAll(async () => {
    await teardownTests(context);
  });

  it('should create a buyer', async () => {
    const { adminClient, cleanup } = context;

    const buyerData = createTestBuyer();
    const response = await adminClient.post('/api/buyers', buyerData);

    expect(response.statusCode).toBe(201);
    cleanup.trackBuyer(response.body.data.buyer.buyerId);
  });
});
```

## Best Practices

### 1. Resource Cleanup

Always track created resources for cleanup:

```typescript
const response = await adminClient.post('/api/buyers', buyerData);
cleanup.trackBuyer(response.body.data.buyer.buyerId);
```

Resources are automatically deleted in `afterAll()` hook.

### 2. Test Isolation

Each test should be independent:
- Don't rely on data from previous tests
- Create fresh test data for each test
- Use unique identifiers (timestamps, counters)

### 3. Use Test Data Factories

Use factory functions instead of hardcoding test data:

```typescript
// Good
const buyer = createTestBuyer({ city: 'Rome' });

// Bad
const buyer = {
  companyName: 'Test Company',
  vatNumber: 'IT12345678901',
  // ...50 more fields
};
```

### 4. Test Complete Workflows

Integration tests should validate realistic user scenarios:

```typescript
it('should complete sale lifecycle', async () => {
  // 1. Create buyer and producer
  // 2. Create sale
  // 3. Add lines
  // 4. Confirm sale
  // 5. Generate invoice
  // 6. Verify invoice was created
});
```

### 5. Handle Asynchronous Operations

Some operations may take time (invoice generation, file uploads):

```typescript
import { waitFor } from '../helpers/setup';

await waitFor(
  async () => {
    const response = await client.get(`/api/sales/${saleId}`);
    return response.body.data.sale.invoiceGenerated === true;
  },
  { timeout: 5000, description: 'invoice generation' }
);
```

## Debugging Integration Tests

### Enable verbose logging

```bash
DEBUG=* npm run test:integration
```

### Keep resources after test failure

```bash
export CLEANUP_ON_FAILURE=false
npm run test:integration
```

### Run single test

```bash
npm run test:integration -- --testNamePattern="should create a buyer"
```

### Inspect API responses

Add console.log in tests:

```typescript
const response = await adminClient.post('/api/buyers', buyerData);
console.log('Response:', JSON.stringify(response, null, 2));
```

## Troubleshooting

### "Connection refused" error

- Verify API is running: `curl http://localhost:3000/health`
- Check `API_BASE_URL` environment variable
- Ensure LocalStack is running (if using local setup)

### "Unauthorized" errors

- Verify authentication tokens are valid
- Check token expiration
- Ensure tokens have correct permissions (Admin vs operator)

### Tests timing out

- Increase timeout: `export TEST_TIMEOUT=60000`
- Check if API is responding slowly
- Verify database connections are not exhausted

### Data not cleaning up

- Check if cleanup hook is running
- Verify admin token has delete permissions
- Look for errors in teardown logs

## CI/CD Integration

Integration tests can be run in CI/CD pipelines:

```yaml
# .github/workflows/integration-tests.yml
name: Integration Tests

on: [push, pull_request]

jobs:
  integration:
    runs-on: ubuntu-latest
    services:
      localstack:
        image: localstack/localstack
        ports:
          - 4566:4566

    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
        with:
          node-version: '18'

      - name: Install dependencies
        run: npm install

      - name: Setup test environment
        run: npm run setup:test-env

      - name: Run integration tests
        env:
          RUN_INTEGRATION_TESTS: true
          API_BASE_URL: http://localhost:3000
          ADMIN_TOKEN: ${{ secrets.TEST_ADMIN_TOKEN }}
          OPERATOR_TOKEN: ${{ secrets.TEST_OPERATOR_TOKEN }}
        run: npm run test:integration
```

## Writing New Integration Tests

1. Determine if your test is API-level (CRUD) or workflow-level
2. Create test file in appropriate directory (`api/` or `workflows/`)
3. Use `setupTests()` and `teardownTests()` for lifecycle management
4. Use test data factories from `helpers/test-data.ts`
5. Track created resources with `cleanup.trackX()` methods
6. Follow AAA pattern (Arrange, Act, Assert)
7. Test both success and error scenarios
8. Validate HTTP status codes and response structure

## Current Test Coverage

- ✓ Buyers CRUD operations (11 tests)
- ✓ Sale lifecycle workflow (3 tests)
- ⏳ Producers CRUD operations (pending)
- ⏳ Sales CRUD operations (pending)
- ⏳ Invoice generation workflow (pending)
- ⏳ Search functionality (pending)
- ⏳ Dashboard endpoints (pending)

## Next Steps

1. Complete remaining API-level tests (producers, sales)
2. Add workflow tests for invoice generation
3. Test attachment upload/download workflows
4. Add performance/load tests
5. Set up continuous integration
