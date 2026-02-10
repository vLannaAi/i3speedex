# Testing Documentation

## Test Suite Overview

This document describes the testing strategy and implementation for the Sale Module API.

## Test Statistics

- **Total Test Suites**: 37
- **Total Tests**: 394
- **Test Coverage**: 85% (statements)

## Unit Tests

### Coverage by Module

| Module | Handlers | Tests | Statement Coverage | Branch Coverage |
|--------|----------|-------|--------------------|-----------------|
| **Sales** | 10 | 94 | 96.02% | 90.25% |
| **Buyers** | 5 | 28 | 94.69% | 76% |
| **Producers** | 5 | 28 | 94.69% | 76% |
| **Invoices** | 4 | 43 | 96.42% | 82.92% |
| **Attachments** | 4 | 37 | 100% | 100% |
| **Search** | 3 | 26 | 100% | 92.2% |
| **Dashboard** | 4 | 54 | 99.48% | 92% |
| **Utilities** | - | 84 | 87.89% | 69.29% |

### Handler Coverage Details

#### Sales Handlers (94 tests)
- ✓ create-sale (13 tests)
- ✓ get-sale (7 tests)
- ✓ list-sales (11 tests)
- ✓ update-sale (12 tests)
- ✓ delete-sale (7 tests)
- ✓ confirm-sale (8 tests)
- ✓ create-sale-line (10 tests)
- ✓ list-sale-lines (7 tests)
- ✓ update-sale-line (11 tests)
- ✓ delete-sale-line (8 tests)

#### Buyers Handlers (28 tests)
- ✓ create-buyer (8 tests)
- ✓ get-buyer (4 tests)
- ✓ list-buyers (8 tests)
- ✓ update-buyer (4 tests)
- ✓ delete-buyer (4 tests)

#### Producers Handlers (28 tests)
- ✓ create-producer (8 tests)
- ✓ get-producer (4 tests)
- ✓ list-producers (8 tests)
- ✓ update-producer (4 tests)
- ✓ delete-producer (4 tests)

#### Invoices Handlers (43 tests)
- ✓ generate-html-invoice (12 tests)
- ✓ generate-pdf-invoice (8 tests)
- ✓ get-invoice-download-url (11 tests)
- ✓ generate-sdi-invoice (12 tests)

#### Attachments Handlers (37 tests)
- ✓ generate-upload-url (10 tests)
- ✓ register-attachment (8 tests)
- ✓ list-attachments (9 tests)
- ✓ delete-attachment (10 tests)

#### Search Handlers (26 tests)
- ✓ search-sales (10 tests)
- ✓ search-buyers (8 tests)
- ✓ search-producers (8 tests)

#### Dashboard Handlers (54 tests)
- ✓ get-dashboard-stats (10 tests)
- ✓ get-sales-by-date-range (16 tests)
- ✓ get-top-buyers (14 tests)
- ✓ get-recent-activity (17 tests)

#### Utility Tests (84 tests)
- ✓ validation.test.ts (58 tests)
- ✓ response.test.ts (26 tests)

## Running Tests

### Run all unit tests
```bash
npm test
```

### Run tests in watch mode
```bash
npm run test:watch
```

### Run tests with coverage
```bash
npm run test:coverage
```

### Run specific test file
```bash
npm test -- create-sale.test.ts
```

### Run tests for a specific module
```bash
npm test -- --testPathPattern=handlers/sales
npm test -- --testPathPattern=handlers/buyers
npm test -- --testPathPattern=handlers/invoices
```

## Test Patterns

### AAA Pattern (Arrange-Act-Assert)

All tests follow the AAA pattern for clarity:

```typescript
it('should create sale successfully', async () => {
  // Arrange
  const requestBody = { /* test data */ };
  const event = createEventWithBody(requestBody);
  mockPutItem.mockResolvedValueOnce(undefined);

  // Act
  const response = await handler(event);

  // Assert
  expect(response.statusCode).toBe(201);
  expect(body.data.sale.saleId).toBeDefined();
});
```

### Mocking Strategy

We use **partial mocking** to preserve utility functions while mocking external services:

```typescript
jest.mock('../../../src/common/clients/dynamodb', () => ({
  ...jest.requireActual('../../../src/common/clients/dynamodb'),
  getItem: jest.fn(),
  putItem: jest.fn(),
  updateItem: jest.fn(),
}));
```

### Test Fixtures

Reusable test data is defined in `tests/fixtures/`:
- `event.fixture.ts` - API Gateway event builders
- `sale.fixture.ts` - Mock data for sales, buyers, producers, etc.

### Coverage Areas

Each handler test suite covers:
1. ✓ **Happy path** - Successful operations
2. ✓ **Validation errors** - Invalid input handling
3. ✓ **Not found errors** - Missing resources
4. ✓ **Permission errors** - Access control (Admin vs operator)
5. ✓ **Business logic errors** - State validation (e.g., can't update invoiced sale)
6. ✓ **Database errors** - DynamoDB error handling
7. ✓ **External service errors** - S3, Lambda invocation failures

## Known Coverage Gaps

### AWS Client Wrappers (Low Coverage Expected)
- `dynamodb.ts`: 37% - AWS SDK wrapper, better tested via integration tests
- `lambda.ts`: 23% - Lambda invocation wrapper, requires actual Lambda runtime
- `s3.ts`: 21% - S3 operations wrapper, requires actual S3 bucket

These modules are thin wrappers around AWS SDKs and are intentionally not fully covered by unit tests. They are better validated through:
- Integration tests with LocalStack
- End-to-end tests in staging environment
- Manual testing

### Minor Edge Cases
- Auth middleware: Some token parsing edge cases (71% coverage)
- Update handlers: Optional field handling (83% coverage)

## Test Maintenance

### When Adding New Handlers
1. Create test file: `tests/unit/handlers/<module>/<handler-name>.test.ts`
2. Import handler and necessary fixtures
3. Mock external dependencies (DynamoDB, S3, Lambda)
4. Write tests covering all scenarios (success, validation, errors, permissions)
5. Run coverage to ensure >90% coverage for the new handler

### When Modifying Handlers
1. Update corresponding test file
2. Ensure all existing tests still pass
3. Add new tests for new functionality
4. Maintain >90% coverage for handler modules

## Integration Tests

Integration tests validate end-to-end API workflows against a running API environment.

**Status**: Infrastructure Ready (Task #21 in progress)

### Running Integration Tests

```bash
# Configure environment
cp .env.integration.example .env.integration
# Edit .env.integration with your API endpoint and tokens

# Install dependencies (includes axios)
npm install

# Run integration tests
npm run test:integration

# Run both unit and integration tests
npm run test:all
```

### What's Covered

✓ **Infrastructure**: API client, test data factories, setup/teardown helpers
✓ **Sample Tests**: Buyers CRUD operations, complete sale lifecycle workflow

### Pending Test Coverage

Integration tests are ready to be written for:
- Producers CRUD operations
- Sales CRUD operations
- Invoice generation workflows
- Attachment upload/download
- Search functionality
- Dashboard endpoints
- Access control scenarios

See `tests/integration/README.md` for detailed documentation on:
- Setting up test environment (LocalStack or AWS)
- Writing new integration tests
- Authentication configuration
- Debugging and troubleshooting

## CI/CD Integration

Tests are run automatically on:
- Pre-commit hooks (if configured)
- Pull request validation
- Deployment pipeline

## Troubleshooting

### Tests failing with "Cannot find module"
```bash
npm install
```

### Tests timing out
Increase timeout in test file:
```typescript
jest.setTimeout(10000); // 10 seconds
```

### Coverage not generating
```bash
rm -rf coverage/
npm run test:coverage
```

### Mock not working
Ensure mock is defined before importing the module:
```typescript
jest.mock('../../../src/common/clients/dynamodb');
import { handler } from '../../../src/handlers/...';
```

## Best Practices

1. **Isolation** - Each test should be independent and not rely on other tests
2. **Clarity** - Test names should clearly describe what is being tested
3. **Completeness** - Cover success, errors, edge cases, and permissions
4. **Maintainability** - Use fixtures for common test data
5. **Performance** - Mock external services to keep tests fast
6. **Real-world scenarios** - Test actual user workflows, not just code paths

## Contributing

When contributing tests:
1. Follow existing patterns and conventions
2. Maintain or improve coverage percentages
3. Add tests for any new functionality
4. Update this documentation if adding new test categories
