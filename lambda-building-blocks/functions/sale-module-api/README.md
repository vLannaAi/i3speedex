# i2speedex Sale Module API

Lambda functions for the i2speedex Sale Module backend API.

## Architecture Overview

This is a **monorepo** containing all Lambda functions for the Sale Module API. The monorepo approach allows:
- Shared code across all Lambda functions
- Single build process
- Easier dependency management
- Better code reusability

## Directory Structure

```
sale-module-api/
├── src/
│   ├── common/                 # Shared code across all Lambda functions
│   │   ├── clients/            # AWS SDK clients
│   │   │   ├── dynamodb.ts     # DynamoDB operations
│   │   │   ├── s3.ts           # S3 file operations
│   │   │   └── lambda.ts       # Lambda invocations (building blocks)
│   │   ├── middleware/         # Lambda middleware
│   │   │   └── auth.ts         # Authentication & authorization
│   │   ├── types/              # TypeScript interfaces
│   │   │   └── index.ts        # Common types (Sale, Buyer, Producer, etc.)
│   │   ├── utils/              # Utility functions
│   │   │   ├── response.ts     # HTTP response helpers
│   │   │   └── validation.ts   # Input validation
│   │   └── validators/         # Request validators
│   └── handlers/               # Lambda function handlers
│       ├── sales/              # Sales CRUD handlers
│       ├── buyers/             # Buyers CRUD handlers
│       ├── producers/          # Producers CRUD handlers
│       ├── invoices/           # Invoice generation handlers
│       ├── files/              # File upload handlers
│       ├── search/             # Search handlers
│       └── dashboard/          # Dashboard handlers
├── tests/                      # Unit and integration tests
├── package.json
├── tsconfig.json
├── jest.config.js
└── README.md
```

## Common Modules

### 1. DynamoDB Client (`src/common/clients/dynamodb.ts`)

Provides reusable functions for DynamoDB operations:

```typescript
import { getItem, putItem, updateItem, queryItems, softDelete } from '../common/clients/dynamodb';

// Get a sale
const sale = await getItem<Sale>({
  TableName: TableNames.Sales,
  Key: { PK: `SALE#${saleId}`, SK: 'METADATA' }
});

// Query sale lines
const { items: lines } = await queryItems<SaleLine>({
  TableName: TableNames.SaleLines,
  KeyConditionExpression: 'PK = :pk',
  ExpressionAttributeValues: { ':pk': `SALE#${saleId}` }
});

// Soft delete
await softDelete(TableNames.Sales, { PK: `SALE#${saleId}`, SK: 'METADATA' }, username);
```

**Key Features:**
- Helper functions for CRUD operations
- Pagination support with `nextToken`
- Soft delete functionality
- Timestamp management
- Condition expression builder

### 2. S3 Client (`src/common/clients/s3.ts`)

Provides functions for S3 file operations:

```typescript
import { uploadInvoicePDF, generateDownloadUrl, deleteFile } from '../common/clients/s3';

// Upload PDF invoice
const s3Key = await uploadInvoicePDF({
  saleId: 'SALE001',
  pdfBuffer: pdfData,
  language: 'it'
});

// Generate pre-signed download URL
const downloadUrl = await generateInvoiceDownloadUrl({
  saleId: 'SALE001',
  format: 'pdf',
  language: 'it',
  expiresIn: 3600 // 1 hour
});

// Delete file
await deleteFile({
  bucket: BucketNames.Documents,
  key: s3Key
});
```

**Key Features:**
- Upload/download operations
- Pre-signed URL generation
- File metadata retrieval
- Document lifecycle management

### 3. Lambda Client (`src/common/clients/lambda.ts`)

Invoke building block Lambda functions:

```typescript
import { renderTemplate, convertHtmlToPdf, generateSdiXml, generateCompleteInvoice } from '../common/clients/lambda';

// Render HTML template
const html = await renderTemplate({
  template: 'invoice',
  language: 'it',
  data: invoiceData
});

// Convert HTML to PDF
const pdfBuffer = await convertHtmlToPdf({ html });

// Generate complete invoice (HTML + PDF + SDI XML for IT)
const { html, pdf, xml } = await generateCompleteInvoice({
  template: 'invoice',
  language: 'it',
  data: invoiceData,
  sdiData: sdiRequestData
});
```

**Building Blocks:**
- Template Renderer (HTML generation)
- HTML-to-PDF Converter
- SDI XML Generator (Italian e-invoicing)

### 4. Authentication Middleware (`src/common/middleware/auth.ts`)

Extract and validate user context from Cognito JWT:

```typescript
import { getUserContext, requireAdminOrOperator, requireWritePermission } from '../common/middleware/auth';

export async function handler(event: APIGatewayProxyEvent) {
  // Extract user from JWT
  const user = getUserContext(event);

  // Check permissions
  requireWritePermission(user); // Throws ForbiddenError if user is read-only

  // Check specific roles
  if (isAdmin(user)) {
    // Admin-only logic
  }
}
```

**Features:**
- Extract user context from JWT claims
- Role-based access control (admin, operator, viewer)
- Resource ownership checks
- Permission validators

### 5. Response Utilities (`src/common/utils/response.ts`)

Standard HTTP response formatters:

```typescript
import { successResponse, createdResponse, notFoundResponse, handleError } from '../common/utils/response';

// Success response
return successResponse(sale, 200);

// Created response
return createdResponse(newSale);

// Paginated response
return paginatedResponse(sales, {
  total: 100,
  page: 1,
  pageSize: 20,
  totalPages: 5,
  hasMore: true
});

// Error handling
try {
  // ... operation
} catch (error) {
  return handleError(error, requestId, path);
}
```

**Response Types:**
- Success (200, 201, 204)
- Client errors (400, 401, 403, 404, 409, 422)
- Server errors (500)
- Automatic error handling

### 6. Validation Utilities (`src/common/utils/validation.ts`)

Input validation and custom error classes:

```typescript
import { validateSaleData, validateBuyerData, ValidationError } from '../common/utils/validation';

// Validate sale data
try {
  validateSaleData(requestBody);
} catch (error) {
  if (error instanceof ValidationError) {
    return validationErrorResponse(error.message);
  }
}

// Custom error classes
throw new NotFoundError('Sale not found');
throw new ValidationError('Invalid email address');
throw new ForbiddenError('Insufficient permissions');
```

**Validators:**
- Field validators (required, string length, number range, enum)
- Object validators (sale, buyer, producer)
- Type validators (email, VAT, fiscal code, postal code)
- Pagination validators

## Common Types

All TypeScript interfaces are defined in `src/common/types/index.ts`:

```typescript
import { Sale, SaleLine, Buyer, Producer, CreateSaleRequest, UpdateSaleRequest } from '../common/types';
```

**Main Types:**
- `Sale` - Sale entity
- `SaleLine` - Sale line item
- `Buyer` - Buyer entity
- `Producer` - Producer entity
- `Attachment` - File attachment
- `ApiResponse<T>` - Standard API response
- `PaginatedResponse<T>` - Paginated API response
- `UserContext` - User context from JWT

## Environment Variables

Lambda functions require the following environment variables:

```bash
# AWS Region
AWS_REGION=eu-west-1

# DynamoDB Tables
SALES_TABLE_NAME=i2speedex-sales-dev
SALE_LINES_TABLE_NAME=i2speedex-sale-lines-dev
BUYERS_TABLE_NAME=i2speedex-buyers-dev
PRODUCERS_TABLE_NAME=i2speedex-producers-dev
USERS_TABLE_NAME=i2speedex-users-dev

# S3 Buckets
DOCUMENTS_BUCKET_NAME=i2speedex-documents-dev-827562051115
ATTACHMENTS_BUCKET_NAME=i2speedex-attachments-dev-827562051115

# Building Block Lambda Functions
TEMPLATE_RENDERER_FUNCTION_NAME=TemplateRendererLambda-Dev
HTML_TO_PDF_FUNCTION_NAME=HtmlToPdfLambda-Dev
SDI_GENERATOR_FUNCTION_NAME=SdiInvoiceGeneratorLambda-Dev

# CORS Origin
CORS_ORIGIN=http://localhost:3000
```

## Development

### Build

```bash
npm run build
```

Compiles TypeScript to JavaScript in the `dist/` directory.

### Watch Mode

```bash
npm run watch
```

Watches for file changes and recompiles automatically.

### Run Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage
```

### Lint

```bash
npm run lint
```

## Lambda Handler Pattern

All Lambda handlers follow this pattern:

```typescript
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { getUserContext, requireWritePermission } from '../common/middleware/auth';
import { parseRequestBody, getPathParameter } from '../common/middleware/auth';
import { successResponse, handleError } from '../common/utils/response';
import { validateSaleData } from '../common/utils/validation';
import { getItem, putItem, TableNames } from '../common/clients/dynamodb';

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;
  const path = event.path;

  try {
    // 1. Extract user context
    const user = getUserContext(event);

    // 2. Check permissions
    requireWritePermission(user);

    // 3. Extract parameters
    const saleId = getPathParameter(event, 'id');
    const body = parseRequestBody(event);

    // 4. Validate input
    validateSaleData(body);

    // 5. Business logic
    // ... perform operations

    // 6. Return success response
    return successResponse(result);

  } catch (error) {
    // 7. Handle errors
    return handleError(error, requestId, path);
  }
}
```

## Testing

### Unit Tests

Test individual functions in isolation:

```typescript
import { handler } from '../src/handlers/sales/get-sale';

describe('GetSale Handler', () => {
  it('should return sale when found', async () => {
    const event = createMockEvent({ pathParameters: { id: 'SALE001' } });
    const result = await handler(event);

    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body);
    expect(body.data.saleId).toBe('SALE001');
  });

  it('should return 404 when sale not found', async () => {
    const event = createMockEvent({ pathParameters: { id: 'INVALID' } });
    const result = await handler(event);

    expect(result.statusCode).toBe(404);
  });
});
```

### Integration Tests

Test complete workflows:

```typescript
describe('Sale Invoice Generation Workflow', () => {
  it('should create sale, generate invoice, and download PDF', async () => {
    // 1. Create sale
    const createResult = await createSaleHandler(createEvent);
    const saleId = JSON.parse(createResult.body).data.saleId;

    // 2. Add lines
    await addLineHandler(addLineEvent);

    // 3. Generate invoice
    await generateInvoiceHandler(generateEvent);

    // 4. Get download URL
    const downloadResult = await getDownloadUrlHandler(downloadEvent);
    expect(downloadResult.statusCode).toBe(200);
  });
});
```

## Deployment

Lambda functions are deployed via CDK stacks. Each handler will be packaged and deployed separately.

## IAM Permissions

Lambda functions require these IAM permissions:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "dynamodb:GetItem",
        "dynamodb:PutItem",
        "dynamodb:UpdateItem",
        "dynamodb:DeleteItem",
        "dynamodb:Query",
        "dynamodb:Scan"
      ],
      "Resource": [
        "arn:aws:dynamodb:*:*:table/i2speedex-sales-*",
        "arn:aws:dynamodb:*:*:table/i2speedex-sale-lines-*",
        "arn:aws:dynamodb:*:*:table/i2speedex-buyers-*",
        "arn:aws:dynamodb:*:*:table/i2speedex-producers-*"
      ]
    },
    {
      "Effect": "Allow",
      "Action": [
        "s3:GetObject",
        "s3:PutObject",
        "s3:DeleteObject"
      ],
      "Resource": [
        "arn:aws:s3:::i2speedex-documents-*/*",
        "arn:aws:s3:::i2speedex-attachments-*/*"
      ]
    },
    {
      "Effect": "Allow",
      "Action": [
        "lambda:InvokeFunction"
      ],
      "Resource": [
        "arn:aws:lambda:*:*:function:TemplateRendererLambda-*",
        "arn:aws:lambda:*:*:function:HtmlToPdfLambda-*",
        "arn:aws:lambda:*:*:function:SdiInvoiceGeneratorLambda-*"
      ]
    }
  ]
}
```

## Next Steps

1. Implement Sales CRUD handlers (`src/handlers/sales/`)
2. Implement Buyers CRUD handlers (`src/handlers/buyers/`)
3. Implement Producers CRUD handlers (`src/handlers/producers/`)
4. Implement Invoice generation handlers (`src/handlers/invoices/`)
5. Implement File upload handlers (`src/handlers/files/`)
6. Implement Search and Dashboard handlers
7. Create CDK stacks for Lambda deployment
8. Connect Lambda functions to API Gateway routes
9. Write unit tests
10. Write integration tests

## Notes

- All timestamps use ISO 8601 format
- All monetary values use 2 decimal places
- Soft delete is used (deletedAt field) instead of hard delete
- Pagination uses `nextToken` for cursor-based pagination
- Error responses follow standard format with requestId for tracing
