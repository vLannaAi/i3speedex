# i2speedex Sale Module - Lambda Architecture

## Phase 2: Backend Development

**Date**: January 29, 2026
**Status**: ✅ Architecture Complete
**Task**: Design Lambda function architecture (Task #12)

---

## Architecture Overview

The Sale Module API uses a **monorepo architecture** where all Lambda functions share common code, utilities, and dependencies. This approach provides:

- **Code Reusability**: Shared clients, utilities, and types across all handlers
- **Consistency**: Standard patterns for authentication, validation, and responses
- **Maintainability**: Single build process and dependency management
- **Type Safety**: Full TypeScript support with strict mode

---

## Project Structure

```
functions/sale-module-api/
├── src/
│   ├── common/                    # Shared code (reusable across all handlers)
│   │   ├── clients/               # AWS SDK clients
│   │   │   ├── dynamodb.ts        # DynamoDB operations
│   │   │   ├── s3.ts              # S3 file operations
│   │   │   └── lambda.ts          # Invoke building blocks
│   │   ├── middleware/            # Lambda middleware
│   │   │   └── auth.ts            # Authentication & authorization
│   │   ├── types/                 # TypeScript interfaces
│   │   │   └── index.ts           # Common types
│   │   └── utils/                 # Utility functions
│   │       ├── response.ts        # HTTP response helpers
│   │       └── validation.ts      # Input validation
│   └── handlers/                  # Lambda function handlers
│       ├── sales/                 # Sales CRUD (10 handlers)
│       ├── buyers/                # Buyers CRUD (5 handlers)
│       ├── producers/             # Producers CRUD (5 handlers)
│       ├── invoices/              # Invoice generation (4 handlers)
│       ├── files/                 # File upload (4 handlers)
│       ├── search/                # Search (4 handlers)
│       └── dashboard/             # Dashboard (3 handlers)
├── tests/                         # Unit and integration tests
├── package.json
├── tsconfig.json
├── jest.config.js
└── README.md
```

---

## Common Modules

### 1. DynamoDB Client (`common/clients/dynamodb.ts`)

**Purpose**: Reusable functions for DynamoDB operations

**Key Features**:
- CRUD operations (get, put, update, delete, query, scan)
- Pagination with `nextToken` encoding/decoding
- Soft delete functionality
- Timestamp management (createdAt, updatedAt)
- Transactional writes
- Condition expression builder

**Example Usage**:
```typescript
import { getItem, putItem, queryItems, softDelete, TableNames } from '../common/clients/dynamodb';

// Get a sale
const sale = await getItem<Sale>({
  TableName: TableNames.Sales,
  Key: { PK: `SALE#${saleId}`, SK: 'METADATA' }
});

// Query sale lines with pagination
const { items, lastEvaluatedKey } = await queryItems<SaleLine>({
  TableName: TableNames.SaleLines,
  KeyConditionExpression: 'PK = :pk',
  ExpressionAttributeValues: { ':pk': `SALE#${saleId}` },
  Limit: 20
});

// Soft delete (sets deletedAt timestamp)
await softDelete(TableNames.Sales, { PK, SK }, username);
```

**Table Names**:
- `i2speedex-sales-dev`
- `i2speedex-sale-lines-dev`
- `i2speedex-buyers-dev`
- `i2speedex-producers-dev`
- `i2speedex-users-dev`

---

### 2. S3 Client (`common/clients/s3.ts`)

**Purpose**: File operations for documents and attachments

**Key Features**:
- Upload/download operations
- Pre-signed URL generation (uploads and downloads)
- File metadata retrieval
- Lifecycle management (delete files and folders)
- Support for multiple file types (PDF, HTML, XML)

**Example Usage**:
```typescript
import {
  uploadInvoicePDF,
  uploadInvoiceHTML,
  uploadInvoiceXML,
  generateDownloadUrl,
  generateAttachmentUploadUrl,
  deleteSaleDocuments,
  BucketNames
} from '../common/clients/s3';

// Upload PDF invoice
const s3Key = await uploadInvoicePDF({
  saleId: 'SALE001',
  pdfBuffer: pdfData,
  language: 'it'
});
// Result: pdfs/2026/SALE001/invoice-SALE001-it.pdf

// Generate pre-signed download URL (valid 1 hour)
const downloadUrl = await generateInvoiceDownloadUrl({
  saleId: 'SALE001',
  format: 'pdf',
  language: 'it',
  expiresIn: 3600
});

// Generate pre-signed upload URL for attachments (valid 15 min)
const { uploadUrl, key } = await generateAttachmentUploadUrl({
  entityType: 'sale',
  entityId: 'SALE001',
  filename: 'contract.pdf',
  contentType: 'application/pdf',
  expiresIn: 900
});

// Delete all documents for a sale
await deleteSaleDocuments('SALE001');
```

**Bucket Names**:
- `i2speedex-documents-dev-827562051115` (PDFs, HTML, XML invoices)
- `i2speedex-attachments-dev-827562051115` (uploaded files)

---

### 3. Lambda Client (`common/clients/lambda.ts`)

**Purpose**: Invoke building block Lambda functions

**Key Features**:
- Render HTML templates (Template Renderer)
- Convert HTML to PDF (HTML-to-PDF)
- Generate Italian SDI XML (SDI Generator)
- Complete invoice generation workflow

**Example Usage**:
```typescript
import {
  renderTemplate,
  convertHtmlToPdf,
  generateSdiXml,
  generateCompleteInvoice
} from '../common/clients/lambda';

// 1. Render HTML template
const html = await renderTemplate({
  template: 'invoice',
  language: 'it',
  data: {
    sale: { ... },
    buyer: { ... },
    producer: { ... },
    lines: [ ... ]
  }
});

// 2. Convert HTML to PDF
const pdfBuffer = await convertHtmlToPdf({
  html,
  options: {
    format: 'A4',
    printBackground: true,
    margin: { top: '20mm', right: '15mm', bottom: '20mm', left: '15mm' }
  }
});

// 3. Generate SDI XML (Italian e-invoicing)
const xml = await generateSdiXml({
  sale: { ... },
  buyer: { ... },
  producer: { ... },
  lines: [ ... ],
  totals: { ... }
});

// 4. Complete workflow (HTML + PDF + SDI XML for IT)
const { html, pdf, xml } = await generateCompleteInvoice({
  template: 'invoice',
  language: 'it',
  data: invoiceData,
  sdiData: sdiRequestData
});
```

**Building Block Functions**:
- `TemplateRendererLambda-Dev` - HTML template rendering
- `HtmlToPdfLambda-Dev` - HTML to PDF conversion
- `SdiInvoiceGeneratorLambda-Dev` - Italian SDI XML generation

---

### 4. Authentication Middleware (`common/middleware/auth.ts`)

**Purpose**: Extract and validate user context from Cognito JWT tokens

**Key Features**:
- Extract user context from API Gateway authorizer
- Role-based access control (RBAC)
- Permission checks (admin, operator, viewer)
- Resource ownership validation
- Path/query parameter extraction
- Request body parsing

**Example Usage**:
```typescript
import {
  getUserContext,
  requireAdminOrOperator,
  requireWritePermission,
  isAdmin,
  canAccessResource,
  getPathParameter,
  parseRequestBody
} from '../common/middleware/auth';

export async function handler(event: APIGatewayProxyEvent) {
  // Extract user from JWT
  const user = getUserContext(event);
  // Result: { username, email, groups, operatorId, role }

  // Check permissions
  requireWritePermission(user); // Throws ForbiddenError if viewer

  // Role-specific logic
  if (isAdmin(user)) {
    // Admin can see all sales
  } else {
    // Operators see only their own sales
    filter.createdBy = user.username;
  }

  // Extract parameters
  const saleId = getPathParameter(event, 'id');
  const body = parseRequestBody<CreateSaleRequest>(event);
}
```

**User Roles**:
- `admin` - Full access to all resources
- `operator` - Create/edit sales, buyers, producers
- `viewer` - Read-only access

---

### 5. Response Utilities (`common/utils/response.ts`)

**Purpose**: Standard HTTP response formatters for API Gateway

**Key Features**:
- Success responses (200, 201, 204)
- Error responses (400, 401, 403, 404, 409, 422, 500)
- Paginated responses
- CORS headers
- Automatic error handling

**Example Usage**:
```typescript
import {
  successResponse,
  createdResponse,
  paginatedResponse,
  notFoundResponse,
  validationErrorResponse,
  handleError
} from '../common/utils/response';

// Success response (200)
return successResponse(sale);

// Created response (201)
return createdResponse(newSale);

// Paginated response
return paginatedResponse(sales, {
  total: 100,
  page: 1,
  pageSize: 20,
  totalPages: 5,
  hasMore: true,
  nextToken: encodedToken
});

// Error responses
return notFoundResponse('Sale not found');
return validationErrorResponse('Invalid sale date');

// Automatic error handling
try {
  // ... operations
} catch (error) {
  return handleError(error, requestId, path);
}
```

**Response Format**:
```json
{
  "success": true,
  "data": { ... }
}
```

**Error Format**:
```json
{
  "success": false,
  "error": "Validation Error",
  "message": "saleDate is required",
  "statusCode": 422,
  "timestamp": "2026-01-29T12:00:00.000Z",
  "path": "/api/sales",
  "requestId": "abc-123-def"
}
```

---

### 6. Validation Utilities (`common/utils/validation.ts`)

**Purpose**: Input validation and custom error classes

**Key Features**:
- Field validators (required, string length, number range, enum)
- Type validators (email, VAT, fiscal code, postal code, currency)
- Object validators (sale, buyer, producer, sale line)
- Pagination validators
- Custom error classes

**Example Usage**:
```typescript
import {
  validateSaleData,
  validateBuyerData,
  validatePaginationParams,
  isValidEmail,
  isValidVatNumber,
  ValidationError,
  NotFoundError,
  ForbiddenError
} from '../common/utils/validation';

// Validate sale data
validateSaleData(requestBody);
// Throws ValidationError if invalid

// Validate buyer data
validateBuyerData(requestBody);

// Validate pagination
const { page, pageSize, nextToken } = validatePaginationParams({
  page: event.queryStringParameters?.page,
  pageSize: event.queryStringParameters?.pageSize,
  nextToken: event.queryStringParameters?.nextToken
});

// Custom errors
throw new NotFoundError('Sale not found');
throw new ValidationError('Invalid email address');
throw new ForbiddenError('Insufficient permissions');
```

**Validators**:
- `validateRequired(value, fieldName)`
- `validateStringLength(value, fieldName, min, max)`
- `validateNumberRange(value, fieldName, min, max)`
- `validateEnum(value, fieldName, allowedValues)`
- `validateSaleData(data)`
- `validateBuyerData(data)`
- `validateProducerData(data)`
- `validateSaleLineData(data)`

---

### 7. Common Types (`common/types/index.ts`)

**Purpose**: TypeScript interfaces for all entities and requests

**Main Types**:
- `Sale` - Sale entity with buyer/producer info
- `SaleLine` - Sale line item
- `Buyer` - Buyer entity
- `Producer` - Producer entity
- `Attachment` - File attachment
- `CreateSaleRequest` - Create sale request body
- `UpdateSaleRequest` - Update sale request body
- `CreateSaleLineRequest` - Create sale line request body
- `ApiResponse<T>` - Standard API response
- `PaginatedResponse<T>` - Paginated API response
- `ErrorResponse` - Error response
- `UserContext` - User context from JWT

**Example**:
```typescript
import { Sale, CreateSaleRequest, ApiResponse } from '../common/types';

const sale: Sale = {
  PK: 'SALE#SALE001',
  SK: 'METADATA',
  saleId: 'SALE001',
  saleNumber: 1,
  saleDate: '2026-01-29',
  buyerId: 'BUYER001',
  buyerName: 'Acme Corp',
  producerId: 'PROD001',
  producerName: 'i2speedex',
  subtotal: 1000.00,
  taxAmount: 220.00,
  total: 1220.00,
  status: 'draft',
  invoiceGenerated: false,
  linesCount: 3,
  currency: 'EUR',
  createdAt: '2026-01-29T12:00:00.000Z',
  updatedAt: '2026-01-29T12:00:00.000Z',
  createdBy: 'admin@i2speedex.com',
  updatedBy: 'admin@i2speedex.com'
};
```

---

## Standard Lambda Handler Pattern

All Lambda handlers follow this standard pattern:

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
    // 1. Extract user context from JWT
    const user = getUserContext(event);

    // 2. Check permissions
    requireWritePermission(user);

    // 3. Extract and parse request data
    const saleId = getPathParameter(event, 'id');
    const body = parseRequestBody<CreateSaleRequest>(event);

    // 4. Validate input
    validateSaleData(body);

    // 5. Perform business logic
    const sale = await getItem<Sale>({
      TableName: TableNames.Sales,
      Key: { PK: `SALE#${saleId}`, SK: 'METADATA' }
    });

    // 6. Return success response
    return successResponse(sale);

  } catch (error) {
    // 7. Handle errors with standard error responses
    return handleError(error, requestId, path);
  }
}
```

---

## Planned Lambda Handlers

### Sales CRUD (10 handlers)
1. `GET /api/sales` - List sales with pagination
2. `GET /api/sales/{id}` - Get sale details
3. `POST /api/sales` - Create new sale
4. `PUT /api/sales/{id}` - Update sale
5. `DELETE /api/sales/{id}` - Soft delete sale
6. `GET /api/sales/{id}/lines` - Get sale lines
7. `POST /api/sales/{id}/lines` - Add line to sale
8. `PUT /api/sales/{id}/lines/{lineId}` - Update line
9. `DELETE /api/sales/{id}/lines/{lineId}` - Delete line
10. `POST /api/sales/{id}/confirm` - Confirm sale (change status)

### Buyers CRUD (5 handlers)
11. `GET /api/buyers` - List buyers
12. `GET /api/buyers/{id}` - Get buyer details
13. `POST /api/buyers` - Create new buyer
14. `PUT /api/buyers/{id}` - Update buyer
15. `DELETE /api/buyers/{id}` - Soft delete buyer

### Producers CRUD (5 handlers)
16. `GET /api/producers` - List producers
17. `GET /api/producers/{id}` - Get producer details
18. `POST /api/producers` - Create new producer
19. `PUT /api/producers/{id}` - Update producer
20. `DELETE /api/producers/{id}` - Soft delete producer

### Invoice Generation (4 handlers)
21. `POST /api/sales/{id}/invoice/html` - Generate HTML invoice
22. `POST /api/sales/{id}/invoice/pdf` - Generate PDF invoice
23. `POST /api/sales/{id}/invoice/sdi` - Generate SDI XML
24. `GET /api/sales/{id}/invoice/download` - Get download URL

### File Upload (4 handlers)
25. `POST /api/sales/{id}/upload-url` - Get pre-signed upload URL
26. `POST /api/sales/{id}/attachments` - Register uploaded file
27. `GET /api/sales/{id}/attachments` - List attachments
28. `DELETE /api/sales/{id}/attachments/{attachmentId}` - Delete attachment

### Search (4 handlers)
29. `GET /api/search?q={query}` - Global search
30. `GET /api/search/sales?q={query}` - Search sales
31. `GET /api/search/buyers?q={query}` - Search buyers
32. `GET /api/search/producers?q={query}` - Search producers

### Dashboard (3 handlers)
33. `GET /api/dashboard/stats` - Dashboard statistics
34. `GET /api/dashboard/recent` - Recent activity
35. `GET /api/dashboard/charts` - Chart data

**Total: 35 Lambda handlers**

---

## Environment Variables

All Lambda functions require these environment variables:

```bash
# AWS
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

# Lambda Functions
TEMPLATE_RENDERER_FUNCTION_NAME=TemplateRendererLambda-Dev
HTML_TO_PDF_FUNCTION_NAME=HtmlToPdfLambda-Dev
SDI_GENERATOR_FUNCTION_NAME=SdiInvoiceGeneratorLambda-Dev

# CORS
CORS_ORIGIN=http://localhost:3000
```

---

## IAM Permissions

Lambda execution role requires:

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
        "arn:aws:dynamodb:eu-west-1:827562051115:table/i2speedex-sales-dev",
        "arn:aws:dynamodb:eu-west-1:827562051115:table/i2speedex-sales-dev/index/*",
        "arn:aws:dynamodb:eu-west-1:827562051115:table/i2speedex-sale-lines-dev",
        "arn:aws:dynamodb:eu-west-1:827562051115:table/i2speedex-buyers-dev",
        "arn:aws:dynamodb:eu-west-1:827562051115:table/i2speedex-buyers-dev/index/*",
        "arn:aws:dynamodb:eu-west-1:827562051115:table/i2speedex-producers-dev",
        "arn:aws:dynamodb:eu-west-1:827562051115:table/i2speedex-producers-dev/index/*",
        "arn:aws:dynamodb:eu-west-1:827562051115:table/i2speedex-users-dev"
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
        "arn:aws:s3:::i2speedex-documents-dev-827562051115/*",
        "arn:aws:s3:::i2speedex-attachments-dev-827562051115/*"
      ]
    },
    {
      "Effect": "Allow",
      "Action": [
        "s3:ListBucket"
      ],
      "Resource": [
        "arn:aws:s3:::i2speedex-documents-dev-827562051115",
        "arn:aws:s3:::i2speedex-attachments-dev-827562051115"
      ]
    },
    {
      "Effect": "Allow",
      "Action": [
        "lambda:InvokeFunction"
      ],
      "Resource": [
        "arn:aws:lambda:eu-west-1:827562051115:function:TemplateRendererLambda-Dev",
        "arn:aws:lambda:eu-west-1:827562051115:function:HtmlToPdfLambda-Dev",
        "arn:aws:lambda:eu-west-1:827562051115:function:SdiInvoiceGeneratorLambda-Dev"
      ]
    },
    {
      "Effect": "Allow",
      "Action": [
        "logs:CreateLogGroup",
        "logs:CreateLogStream",
        "logs:PutLogEvents"
      ],
      "Resource": "arn:aws:logs:*:*:*"
    }
  ]
}
```

---

## Development Workflow

1. **Build**: `npm run build` - Compile TypeScript to JavaScript
2. **Watch**: `npm run watch` - Auto-compile on file changes
3. **Test**: `npm test` - Run all tests
4. **Lint**: `npm run lint` - Check code quality

---

## Testing Strategy

### Unit Tests
- Test individual functions in isolation
- Mock AWS SDK clients
- Test validation logic
- Test error handling

### Integration Tests
- Test complete workflows
- Test with real DynamoDB Local
- Test authentication flows
- Test pagination

---

## Next Steps

1. ✅ Task #12: Design Lambda function architecture - **COMPLETE**
2. ⏳ Task #13: Implement Sales CRUD Lambda functions - **NEXT**
3. ⏳ Task #14: Implement Buyers CRUD Lambda functions
4. ⏳ Task #15: Implement Producers CRUD Lambda functions
5. ⏳ Task #16: Implement Invoice Generation Lambda functions
6. ⏳ Task #17: Implement File Upload Lambda functions
7. ⏳ Task #18: Implement Search and Dashboard Lambda functions
8. ⏳ Task #19: Connect Lambda functions to API Gateway routes
9. ⏳ Task #20: Write unit tests for Lambda functions
10. ⏳ Task #21: Create integration tests for API endpoints

---

**Status**: ✅ Lambda Architecture Complete
**Created**: January 29, 2026, 12:45 UTC
**Created By**: Claude Code
**Location**: `/Users/vicio/i2speedex/lambda-building-blocks/functions/sale-module-api/`
**Next**: Implement Sales CRUD Lambda functions (Task #13)
