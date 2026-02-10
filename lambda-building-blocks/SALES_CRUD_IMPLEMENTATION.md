# Sales CRUD Implementation

## Task #13: Sales CRUD Lambda Functions

**Date**: January 29, 2026
**Status**: ✅ Complete
**Handlers Implemented**: 10

---

## Overview

Implemented complete CRUD (Create, Read, Update, Delete) operations for Sales and Sale Lines, including:
- List sales with filtering and pagination
- Get sale details
- Create new sales
- Update existing sales
- Soft delete sales
- Manage sale lines (list, create, update, delete)
- Confirm sales (change status from draft to confirmed)

---

## Implemented Handlers

### 1. List Sales
**File**: `src/handlers/sales/list-sales.ts`
**Route**: `GET /api/sales`
**Description**: List all sales with pagination, filtering, and sorting

**Features**:
- Pagination with `page`, `pageSize`, and `nextToken`
- Filter by status, buyer, producer, date range, creator
- Uses DynamoDB GSIs for efficient querying:
  - GSI1 (status index) for status filtering
  - GSI2 (buyer index) for buyer filtering
  - GSI3 (producer index) for producer filtering
  - GSI4 (date index) for date range queries
- Non-admins can only see their own sales
- Excludes soft-deleted sales

**Query Parameters**:
```
?page=1
&pageSize=20
&status=draft|confirmed|invoiced|paid|cancelled
&buyerId=BUYER001
&producerId=PROD001
&dateFrom=2026-01-01
&dateTo=2026-12-31
&createdBy=username
&nextToken=base64encodedtoken
```

**Response**:
```json
{
  "success": true,
  "data": [
    {
      "saleId": "SALE001",
      "saleNumber": 1,
      "saleDate": "2026-01-29",
      "buyerName": "Acme Corp",
      "producerName": "i2speedex",
      "total": 1220.00,
      "status": "draft",
      ...
    }
  ],
  "pagination": {
    "total": 100,
    "page": 1,
    "pageSize": 20,
    "totalPages": 5,
    "hasMore": true,
    "nextToken": "..."
  }
}
```

---

### 2. Get Sale
**File**: `src/handlers/sales/get-sale.ts`
**Route**: `GET /api/sales/{id}`
**Description**: Get sale details by ID

**Features**:
- Fetch complete sale details
- Validate sale exists and is not deleted
- Check user access permissions
- Non-admins can only access their own sales

**Response**:
```json
{
  "success": true,
  "data": {
    "saleId": "SALE001",
    "saleNumber": 1,
    "saleDate": "2026-01-29",
    "buyerId": "BUYER001",
    "buyerName": "Acme Corp",
    "buyerVatNumber": "IT12345678901",
    "buyerAddress": "Via Roma 1",
    "buyerCity": "Milan",
    "buyerCountry": "IT",
    "producerId": "PROD001",
    "producerName": "i2speedex",
    "subtotal": 1000.00,
    "taxAmount": 220.00,
    "total": 1220.00,
    "paymentMethod": "bank_transfer",
    "status": "draft",
    "invoiceGenerated": false,
    "linesCount": 3,
    "currency": "EUR",
    "createdAt": "2026-01-29T12:00:00.000Z",
    "createdBy": "admin@i2speedex.com"
  }
}
```

---

### 3. Create Sale
**File**: `src/handlers/sales/create-sale.ts`
**Route**: `POST /api/sales`
**Description**: Create a new sale

**Features**:
- Generate unique sale ID (timestamp-based)
- Auto-increment sale number (per year)
- Fetch and denormalize buyer details
- Fetch and denormalize producer details
- Initialize totals to 0 (calculated when lines added)
- Set default status to "draft"
- Create GSI attributes for efficient querying
- Require write permission (admin or operator)

**Request Body**:
```json
{
  "saleDate": "2026-01-29",
  "buyerId": "BUYER001",
  "producerId": "PROD001",
  "paymentMethod": "bank_transfer",
  "paymentTerms": "30 days",
  "deliveryMethod": "courier",
  "deliveryDate": "2026-02-05",
  "notes": "Handle with care",
  "internalNotes": "VIP customer",
  "referenceNumber": "REF-2026-001",
  "currency": "EUR"
}
```

**Response**: 201 Created with sale object

---

### 4. Update Sale
**File**: `src/handlers/sales/update-sale.ts`
**Route**: `PUT /api/sales/{id}`
**Description**: Update an existing sale

**Features**:
- Update sale fields (date, buyer, producer, payment, delivery, notes, status)
- Refetch buyer/producer details if changed
- Update GSI attributes when buyer/producer/status/date changes
- Prevent updating invoiced sales (unless draft)
- Check user access permissions
- Require write permission

**Request Body**:
```json
{
  "saleDate": "2026-01-30",
  "buyerId": "BUYER002",
  "paymentMethod": "credit_card",
  "notes": "Updated notes",
  "status": "confirmed"
}
```

**Response**: 200 OK with updated sale object

---

### 5. Delete Sale
**File**: `src/handlers/sales/delete-sale.ts`
**Route**: `DELETE /api/sales/{id}`
**Description**: Soft delete a sale

**Features**:
- Soft delete (set `deletedAt` timestamp)
- Prevent deleting invoiced sales (unless draft)
- Check user access permissions
- Require write permission

**Response**: 204 No Content

---

### 6. List Sale Lines
**File**: `src/handlers/sales/list-sale-lines.ts`
**Route**: `GET /api/sales/{id}/lines`
**Description**: Get all lines for a sale

**Features**:
- Fetch all lines for a specific sale
- Sort by line number
- Exclude soft-deleted lines
- Validate sale exists and user has access

**Response**:
```json
{
  "success": true,
  "data": [
    {
      "lineId": "uuid-1",
      "lineNumber": 1,
      "productCode": "PROD-001",
      "productDescription": "Product A",
      "quantity": 10,
      "unitPrice": 50.00,
      "discount": 10,
      "discountAmount": 50.00,
      "netAmount": 450.00,
      "taxRate": 22,
      "taxAmount": 99.00,
      "totalAmount": 549.00,
      "unitOfMeasure": "pz"
    },
    ...
  ]
}
```

---

### 7. Create Sale Line
**File**: `src/handlers/sales/create-sale-line.ts`
**Route**: `POST /api/sales/{id}/lines`
**Description**: Add a new line to a sale

**Features**:
- Auto-increment line number
- Calculate line amounts (discount, net, tax, total)
- Update sale totals after adding line
- Update sale lines count
- Prevent adding lines to invoiced sales
- Require write permission

**Request Body**:
```json
{
  "productCode": "PROD-001",
  "productDescription": "Product A",
  "quantity": 10,
  "unitPrice": 50.00,
  "discount": 10,
  "taxRate": 22,
  "unitOfMeasure": "pz",
  "notes": "Fragile"
}
```

**Calculations**:
- Discount Amount = (quantity × unitPrice × discount) / 100
- Net Amount = (quantity × unitPrice) - discountAmount
- Tax Amount = (netAmount × taxRate) / 100
- Total Amount = netAmount + taxAmount

**Response**: 201 Created with line object

---

### 8. Update Sale Line
**File**: `src/handlers/sales/update-sale-line.ts`
**Route**: `PUT /api/sales/{id}/lines/{lineId}`
**Description**: Update an existing sale line

**Features**:
- Update line fields (product, quantity, price, discount, tax)
- Recalculate amounts when quantity/price/discount/tax changes
- Update sale totals after line update
- Prevent updating lines in invoiced sales
- Require write permission

**Request Body**:
```json
{
  "quantity": 15,
  "unitPrice": 45.00,
  "discount": 5,
  "taxRate": 22
}
```

**Response**: 200 OK with updated line object

---

### 9. Delete Sale Line
**File**: `src/handlers/sales/delete-sale-line.ts`
**Route**: `DELETE /api/sales/{id}/lines/{lineId}`
**Description**: Soft delete a sale line

**Features**:
- Soft delete (set `deletedAt` timestamp)
- Recalculate sale totals after line deletion
- Update sale lines count
- Prevent deleting lines from invoiced sales
- Require write permission

**Response**: 204 No Content

---

### 10. Confirm Sale
**File**: `src/handlers/sales/confirm-sale.ts`
**Route**: `POST /api/sales/{id}/confirm`
**Description**: Confirm a sale (change status from draft to confirmed)

**Features**:
- Change status from "draft" to "confirmed"
- Validate sale has at least one line
- Verify totals match line totals (data integrity check)
- Recalculate totals if mismatch detected
- Update GSI1PK for status filtering
- Prevent confirming already confirmed/invoiced sales
- Require write permission

**Response**: 200 OK with updated sale object

---

## Common Features

All handlers implement:

✅ **Authentication**: Extract user context from Cognito JWT
✅ **Authorization**: Check user permissions (admin, operator, viewer)
✅ **Validation**: Validate input data and business rules
✅ **Error Handling**: Consistent error responses with request ID
✅ **Soft Delete**: Use `deletedAt` timestamp instead of hard delete
✅ **Timestamps**: Track `createdAt`, `updatedAt`, `createdBy`, `updatedBy`
✅ **Access Control**: Non-admins can only access their own resources
✅ **Data Integrity**: Validate foreign keys (buyer, producer)
✅ **Denormalization**: Cache buyer/producer details in sale for performance
✅ **CORS**: Include CORS headers in all responses

---

## Data Calculations

### Line Amounts
```typescript
discountAmount = (quantity × unitPrice × discount) / 100
netAmount = (quantity × unitPrice) - discountAmount
taxAmount = (netAmount × taxRate) / 100
totalAmount = netAmount + taxAmount
```

### Sale Totals
```typescript
subtotal = Σ(line.netAmount)
taxAmount = Σ(line.taxAmount)
total = Σ(line.totalAmount)
linesCount = count(non-deleted lines)
```

All amounts rounded to 2 decimal places.

---

## DynamoDB Access Patterns

### Sales Table

**Base Access**:
- PK: `SALE#{saleId}`
- SK: `METADATA`

**GSI1** (Status Index):
- GSI1PK: `STATUS#{status}`
- GSI1SK: `{saleDate}`
- Use: Query sales by status and date

**GSI2** (Buyer Index):
- GSI2PK: `BUYER#{buyerId}`
- GSI2SK: `{saleDate}`
- Use: Query all sales for a buyer

**GSI3** (Producer Index):
- GSI3PK: `PRODUCER#{producerId}`
- GSI3SK: `{saleDate}`
- Use: Query all sales for a producer

**GSI4** (Date Index):
- GSI4PK: `SALE`
- GSI4SK: `{saleDate}`
- Use: Query all sales by date, get next sale number

### Sale Lines (in Sales Table)

**Base Access**:
- PK: `SALE#{saleId}`
- SK: `LINE#{lineId}`
- Use: Query all lines for a sale with `begins_with(SK, 'LINE#')`

---

## Permissions Matrix

| Operation | Admin | Operator | Viewer |
|-----------|-------|----------|--------|
| List Sales | ✅ All | ✅ Own | ✅ Own |
| Get Sale | ✅ | ✅ | ✅ |
| Create Sale | ✅ | ✅ | ❌ |
| Update Sale | ✅ | ✅ Own | ❌ |
| Delete Sale | ✅ | ✅ Own | ❌ |
| List Lines | ✅ | ✅ | ✅ |
| Create Line | ✅ | ✅ Own | ❌ |
| Update Line | ✅ | ✅ Own | ❌ |
| Delete Line | ✅ | ✅ Own | ❌ |
| Confirm Sale | ✅ | ✅ Own | ❌ |

---

## Error Responses

### 400 Bad Request
Invalid input data or parameters

### 401 Unauthorized
Missing or invalid JWT token

### 403 Forbidden
- Insufficient permissions (viewer trying to write)
- Cannot modify invoiced sales
- Cannot access other user's resources (non-admin)

### 404 Not Found
- Sale not found
- Sale line not found
- Buyer not found
- Producer not found
- Resource soft-deleted

### 422 Validation Error
- Invalid sale data
- Invalid sale line data
- Cannot confirm sale with no lines
- Cannot delete invoiced sale

### 500 Internal Server Error
Unexpected error

---

## Business Rules

1. **Sale Number**: Auto-incremented per year (resets to 1 each year)
2. **Default Status**: New sales start as "draft"
3. **Line Numbers**: Auto-incremented within sale (1, 2, 3...)
4. **Totals**: Calculated from lines, not manually set
5. **Invoiced Sales**: Cannot be modified or deleted (unless draft)
6. **Soft Delete**: Resources marked with `deletedAt`, not physically deleted
7. **Buyer/Producer**: Must exist and be active when creating/updating sale
8. **Confirmation**: Sale must have at least one line to be confirmed
9. **Currency**: Defaults to EUR if not specified
10. **Denormalization**: Buyer and producer details copied to sale on create/update

---

## Testing

To test the handlers:

```bash
# Build
npm run build

# Run tests (when implemented)
npm test

# Test specific handler (example with AWS CLI)
aws lambda invoke \
  --function-name ListSalesFunction \
  --payload '{"httpMethod":"GET","path":"/api/sales","queryStringParameters":{"page":"1","pageSize":"20"}}' \
  response.json
```

---

## Next Steps

1. ✅ Task #13: Implement Sales CRUD Lambda functions - **COMPLETE**
2. ⏳ Task #14: Implement Buyers CRUD Lambda functions - **NEXT**
3. ⏳ Task #15: Implement Producers CRUD Lambda functions
4. ⏳ Task #16: Implement Invoice Generation Lambda functions
5. ⏳ Task #17: Implement File Upload Lambda functions
6. ⏳ Task #18: Implement Search and Dashboard Lambda functions
7. ⏳ Task #19: Connect Lambda functions to API Gateway routes
8. ⏳ Task #20: Write unit tests for Lambda functions
9. ⏳ Task #21: Create integration tests for API endpoints

---

**Status**: ✅ Sales CRUD Implementation Complete
**Date**: January 29, 2026
**Handlers**: 10/10 implemented
**Build**: ✅ Successful
**Location**: `/Users/vicio/i2speedex/lambda-building-blocks/functions/sale-module-api/src/handlers/sales/`
