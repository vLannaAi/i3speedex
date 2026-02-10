# Buyers & Producers CRUD Implementation

## Task #14: Buyers CRUD Lambda Functions
## Task #15: Producers CRUD Lambda Functions

**Date**: January 29, 2026
**Status**: ✅ Buyers Complete, ✅ Producers Complete
**Handlers Implemented**: 5 Buyers, 5 Producers

---

## Buyers CRUD Implementation

### Overview

Implemented complete CRUD operations for Buyers entity, including:
- List buyers with filtering and search
- Get buyer details
- Create new buyers
- Update existing buyers
- Soft delete buyers (with validation)

---

### Implemented Handlers

#### 1. List Buyers
**File**: `src/handlers/buyers/list-buyers.ts`
**Route**: `GET /api/buyers`
**Description**: List all buyers with pagination and search

**Features**:
- Pagination with `page`, `pageSize`, and `nextToken`
- Filter by status (active/inactive)
- Filter by country
- Search by company name (case-insensitive, contains)
- Sort alphabetically by company name
- Excludes soft-deleted buyers

**Query Parameters**:
```
?page=1
&pageSize=20
&status=active|inactive
&country=IT
&search=acme
&nextToken=base64encodedtoken
```

**Response**:
```json
{
  "success": true,
  "data": [
    {
      "buyerId": "BUYER001",
      "companyName": "Acme Corp",
      "vatNumber": "IT12345678901",
      "fiscalCode": "RSSMRA80A01H501U",
      "address": "Via Roma 1",
      "city": "Milan",
      "province": "MI",
      "postalCode": "20100",
      "country": "IT",
      "email": "info@acme.com",
      "phone": "+39 02 1234567",
      "pec": "acme@pec.it",
      "sdi": "ABC1234",
      "status": "active",
      "totalSales": 10,
      "totalRevenue": 50000.00,
      "createdAt": "2026-01-29T12:00:00.000Z"
    }
  ],
  "pagination": {
    "total": 50,
    "page": 1,
    "pageSize": 20,
    "totalPages": 3,
    "hasMore": true
  }
}
```

---

#### 2. Get Buyer
**File**: `src/handlers/buyers/get-buyer.ts`
**Route**: `GET /api/buyers/{id}`
**Description**: Get buyer details by ID

**Features**:
- Fetch complete buyer details
- Validate buyer exists and is not deleted
- All authenticated users can view buyers

**Response**:
```json
{
  "success": true,
  "data": {
    "buyerId": "BUYER001",
    "companyName": "Acme Corp",
    "vatNumber": "IT12345678901",
    "fiscalCode": "RSSMRA80A01H501U",
    "address": "Via Roma 1",
    "city": "Milan",
    "province": "MI",
    "postalCode": "20100",
    "country": "IT",
    "email": "info@acme.com",
    "phone": "+39 02 1234567",
    "pec": "acme@pec.it",
    "sdi": "ABC1234",
    "defaultPaymentMethod": "bank_transfer",
    "defaultPaymentTerms": "30 days",
    "notes": "VIP customer",
    "status": "active",
    "totalSales": 10,
    "totalRevenue": 50000.00,
    "lastSaleDate": "2026-01-28",
    "createdAt": "2026-01-01T00:00:00.000Z",
    "updatedAt": "2026-01-29T12:00:00.000Z",
    "createdBy": "admin@i2speedex.com",
    "updatedBy": "operator@i2speedex.com"
  }
}
```

---

#### 3. Create Buyer
**File**: `src/handlers/buyers/create-buyer.ts`
**Route**: `POST /api/buyers`
**Description**: Create a new buyer

**Features**:
- Generate unique buyer ID (timestamp-based)
- Validate buyer data (VAT, fiscal code, email, postal code)
- Initialize status as "active"
- Initialize statistics (totalSales: 0, totalRevenue: 0)
- Create GSI attributes for querying
- Require write permission (admin or operator)

**Request Body**:
```json
{
  "companyName": "Acme Corp",
  "vatNumber": "IT12345678901",
  "fiscalCode": "RSSMRA80A01H501U",
  "address": "Via Roma 1",
  "city": "Milan",
  "province": "MI",
  "postalCode": "20100",
  "country": "IT",
  "email": "info@acme.com",
  "phone": "+39 02 1234567",
  "pec": "acme@pec.it",
  "sdi": "ABC1234",
  "defaultPaymentMethod": "bank_transfer",
  "defaultPaymentTerms": "30 days",
  "notes": "VIP customer"
}
```

**Response**: 201 Created with buyer object

---

#### 4. Update Buyer
**File**: `src/handlers/buyers/update-buyer.ts`
**Route**: `PUT /api/buyers/{id}`
**Description**: Update an existing buyer

**Features**:
- Update any buyer field
- Update GSI attributes when status/country/companyName changes
- Validate updated data
- Require write permission

**Request Body**:
```json
{
  "companyName": "Acme Corporation",
  "address": "Via Roma 10",
  "phone": "+39 02 9876543",
  "email": "contact@acme.com",
  "status": "inactive"
}
```

**Response**: 200 OK with updated buyer object

---

#### 5. Delete Buyer
**File**: `src/handlers/buyers/delete-buyer.ts`
**Route**: `DELETE /api/buyers/{id}`
**Description**: Soft delete a buyer

**Features**:
- Soft delete (set `deletedAt` timestamp)
- Check for associated sales before deletion
- Prevent deleting buyers with active sales
- Require write permission

**Response**: 204 No Content

**Error Example**:
```json
{
  "success": false,
  "error": "Forbidden",
  "message": "Cannot delete buyer with associated sales. Please delete or reassign sales first.",
  "statusCode": 403
}
```

---

### DynamoDB Access Patterns (Buyers)

**Base Access**:
- PK: `BUYER#{buyerId}`
- SK: `METADATA`

**GSI1** (Status Index):
- GSI1PK: `STATUS#{status}`
- GSI1SK: `{companyName}`
- Use: Query buyers by status, sorted by name

**GSI2** (Country Index):
- GSI2PK: `COUNTRY#{country}`
- GSI2SK: `{companyName}`
- Use: Query buyers by country, sorted by name

---

### Validation Rules (Buyers)

**Required Fields**:
- companyName (1-200 chars)
- address (1-200 chars)
- city (1-100 chars)
- postalCode (country-specific format)
- country (2-letter ISO code)

**Optional Fields with Validation**:
- vatNumber (must match VAT format: 2 letters + 8-12 digits)
- fiscalCode (Italian: 16 alphanumeric characters)
- email (valid email format)
- sdi (Italian SDI code: 7 alphanumeric characters)
- phone (any format)
- pec (Italian certified email)

**Status**:
- Must be "active" or "inactive"
- Defaults to "active" on creation

---

### Permissions Matrix (Buyers)

| Operation | Admin | Operator | Viewer |
|-----------|-------|----------|--------|
| List Buyers | ✅ | ✅ | ✅ |
| Get Buyer | ✅ | ✅ | ✅ |
| Create Buyer | ✅ | ✅ | ❌ |
| Update Buyer | ✅ | ✅ | ❌ |
| Delete Buyer | ✅ | ✅ | ❌ |

---

### Business Rules (Buyers)

1. **Buyer ID**: Auto-generated timestamp-based ID
2. **Default Status**: New buyers start as "active"
3. **Statistics**: totalSales and totalRevenue initialized to 0
4. **Deletion Protection**: Cannot delete buyers with associated sales
5. **Soft Delete**: Buyers marked with `deletedAt`, not physically deleted
6. **Italian Fields**: VAT, fiscal code, PEC, and SDI validated for Italian buyers
7. **Payment Defaults**: Payment method and terms stored for reuse in sales

---

## Producers CRUD Implementation

### Overview

Producers represent the seller/producer side of sales transactions. Implementation follows the same patterns as Buyers with slight differences (e.g., website field instead of PEC/SDI).

### Implemented Handlers

#### 1. List Producers
**File**: `src/handlers/producers/list-producers.ts`
**Route**: `GET /api/producers`
**Description**: List all producers with pagination and search

**Features**:
- Same features as List Buyers
- Filter by status (active/inactive)
- Filter by country
- Search by company name (case-insensitive)
- Alphabetical sorting
- Pagination with nextToken

**Query Parameters**: Same as Buyers (status, country, search, page, pageSize, nextToken)

#### 2. Get Producer
**File**: `src/handlers/producers/get-producer.ts`
**Route**: `GET /api/producers/{id}`
**Description**: Get producer details by ID

**Features**:
- Fetch complete producer details
- Validate producer exists and is not deleted
- All authenticated users can view producers

#### 3. Create Producer
**File**: `src/handlers/producers/create-producer.ts`
**Route**: `POST /api/producers`
**Description**: Create a new producer

**Features**:
- Generate unique producer ID
- Validate producer data (VAT, fiscal code, email, postal code)
- Initialize status as "active"
- Initialize statistics (totalSales: 0)
- Create GSI attributes
- Require write permission

**Request Body**:
```json
{
  "companyName": "i2speedex Srl",
  "vatNumber": "IT09876543210",
  "fiscalCode": "09876543210",
  "address": "Via Milano 100",
  "city": "Rome",
  "province": "RM",
  "postalCode": "00100",
  "country": "IT",
  "email": "info@i2speedex.com",
  "phone": "+39 06 1234567",
  "website": "https://i2speedex.com",
  "notes": "Main company"
}
```

**Response**: 201 Created with producer object

#### 4. Update Producer
**File**: `src/handlers/producers/update-producer.ts`
**Route**: `PUT /api/producers/{id}`
**Description**: Update an existing producer

**Features**:
- Update any producer field
- Update GSI attributes when status/country/companyName changes
- Validate updated data
- Require write permission

**Request Body**: Partial producer object with fields to update

#### 5. Delete Producer
**File**: `src/handlers/producers/delete-producer.ts`
**Route**: `DELETE /api/producers/{id}`
**Description**: Soft delete a producer

**Features**:
- Soft delete (set `deletedAt` timestamp)
- Check for associated sales before deletion
- Prevent deleting producers with active sales
- Require write permission
- Uses GSI3 to query producer's sales

**Response**: 204 No Content

---

### DynamoDB Access Patterns (Producers)

**Base Access**:
- PK: `PRODUCER#{producerId}`
- SK: `METADATA`

**GSI1** (Status Index):
- GSI1PK: `STATUS#{status}`
- GSI1SK: `{companyName}`

**GSI2** (Country Index):
- GSI2PK: `COUNTRY#{country}`
- GSI2SK: `{companyName}`

---

## Common Features

Both Buyers and Producers implement:

✅ **Authentication**: Extract user context from Cognito JWT
✅ **Authorization**: Check user permissions (admin, operator, viewer)
✅ **Validation**: Validate input data (VAT, fiscal code, email, postal code)
✅ **Error Handling**: Consistent error responses with request ID
✅ **Soft Delete**: Use `deletedAt` timestamp instead of hard delete
✅ **Timestamps**: Track `createdAt`, `updatedAt`, `createdBy`, `updatedBy`
✅ **Search**: Case-insensitive search by company name
✅ **Filtering**: Filter by status, country
✅ **Pagination**: Cursor-based pagination with nextToken
✅ **CORS**: Include CORS headers in all responses

---

## Testing

To test the handlers:

```bash
# Build
npm run build

# List buyers
curl -X GET \
  https://r10lp4qqkg.execute-api.eu-west-1.amazonaws.com/api/buyers \
  -H "Authorization: Bearer $TOKEN"

# Create buyer
curl -X POST \
  https://r10lp4qqkg.execute-api.eu-west-1.amazonaws.com/api/buyers \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "companyName": "Acme Corp",
    "address": "Via Roma 1",
    "city": "Milan",
    "postalCode": "20100",
    "country": "IT"
  }'

# Get buyer
curl -X GET \
  https://r10lp4qqkg.execute-api.eu-west-1.amazonaws.com/api/buyers/BUYER001 \
  -H "Authorization: Bearer $TOKEN"

# Update buyer
curl -X PUT \
  https://r10lp4qqkg.execute-api.eu-west-1.amazonaws.com/api/buyers/BUYER001 \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status": "inactive"}'

# Delete buyer
curl -X DELETE \
  https://r10lp4qqkg.execute-api.eu-west-1.amazonaws.com/api/buyers/BUYER001 \
  -H "Authorization: Bearer $TOKEN"
```

---

## Next Steps

1. ✅ Task #13: Implement Sales CRUD Lambda functions - **COMPLETE**
2. ✅ Task #14: Implement Buyers CRUD Lambda functions - **COMPLETE**
3. ✅ Task #15: Implement Producers CRUD Lambda functions - **COMPLETE**
4. ⏳ Task #16: Implement Invoice Generation Lambda functions - **NEXT**
5. ⏳ Task #17: Implement File Upload Lambda functions
6. ⏳ Task #18: Implement Search and Dashboard Lambda functions
7. ⏳ Task #19: Connect Lambda functions to API Gateway routes
8. ⏳ Task #20: Write unit tests for Lambda functions
9. ⏳ Task #21: Create integration tests for API endpoints

---

**Status**: ✅ Buyers & Producers CRUD Complete
**Date**: January 29, 2026
**Handlers**: 5/5 Buyers + 5/5 Producers = 10/10 implemented
**Build**: ✅ Successful
**Locations**:
- Buyers: `/Users/vicio/i2speedex/lambda-building-blocks/functions/sale-module-api/src/handlers/buyers/`
- Producers: `/Users/vicio/i2speedex/lambda-building-blocks/functions/sale-module-api/src/handlers/producers/`
