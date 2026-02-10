# DynamoDB Schema Design - Sale Module API

## Overview

This document defines the complete DynamoDB schema for the Sale Module API, designed to support all business operations while maintaining optimal performance and cost efficiency.

---

## Design Principles

1. **Single-Table Design**: All entities stored in one table for optimal performance and cost
2. **Composite Keys**: PK and SK patterns enable flexible querying
3. **Sparse Indexes**: GSIs only include relevant items
4. **Denormalization**: Strategic duplication for read performance
5. **Access Pattern First**: Schema designed around query needs, not entities

---

## Table Structure

### Main Table: `SalesTable-{environment}`

**Partition Key (PK)**: String - Entity identifier
**Sort Key (SK)**: String - Sub-entity or metadata

**Billing Mode**: PAY_PER_REQUEST (on-demand)

**Point-in-Time Recovery**: Enabled (staging/production)

**Deletion Protection**: Enabled (production only)

---

## Access Patterns

### Critical Access Patterns

1. **Get sale by ID** - Single item lookup
2. **List all sales** - Scan/Query with pagination
3. **Get sale lines for a sale** - Query by PK
4. **Get buyer by ID** - Single item lookup
5. **List all buyers** - Query with GSI
6. **Get sales for a buyer** - Query with GSI
7. **Get producer by ID** - Single item lookup
8. **List all producers** - Query with GSI
9. **Get sales for a producer** - Query with GSI
10. **Get sales by date range** - Query with GSI
11. **Get sales by status** - Query with GSI
12. **Get invoice for sale** - Single item lookup

### Performance Requirements

- Single item reads: < 10ms (P50), < 50ms (P99)
- List operations: < 100ms (P50), < 500ms (P99)
- Write operations: < 20ms (P50), < 100ms (P99)

---

## Entity Definitions

### 1. Sale (Venda)

**PK Pattern**: `SALE#{sale_id}`
**SK Pattern**: `#METADATA#sale`

**Attributes**:
```json
{
  "PK": "SALE#SALE001",
  "SK": "#METADATA#sale",
  "EntityType": "Sale",
  "SaleId": "SALE001",

  "BuyerId": "BUYER001",
  "BuyerName": "ACME Corporation",
  "BuyerDocument": "12.345.678/0001-90",

  "ProducerId": "PRODUCER001",
  "ProducerName": "Farm Industries Ltd",
  "ProducerDocument": "98.765.432/0001-10",

  "SaleDate": "2026-01-30T14:30:00Z",
  "DeliveryDate": "2026-02-15T00:00:00Z",
  "InvoiceDate": "2026-01-30T14:30:00Z",

  "Status": "CONFIRMED",
  "PaymentTerms": "30_DAYS",

  "Quantity": 1000,
  "UnitPrice": 25.50,
  "Subtotal": 25500.00,
  "Discount": 500.00,
  "Tax": 2550.00,
  "Total": 27550.00,

  "Currency": "BRL",
  "Notes": "Urgent delivery requested",

  "InvoiceNumber": "NF-2026-001",
  "InvoiceKey": "35260112345678000190550010000000011234567890",
  "InvoiceFileUrl": "s3://invoices/2026/01/SALE001-invoice.pdf",

  "CreatedAt": "2026-01-30T14:30:00Z",
  "CreatedBy": "user@i2speedex.com",
  "UpdatedAt": "2026-01-30T15:00:00Z",
  "UpdatedBy": "user@i2speedex.com",

  "GSI1PK": "BUYER#BUYER001",
  "GSI1SK": "SALE#2026-01-30T14:30:00Z",

  "GSI2PK": "PRODUCER#PRODUCER001",
  "GSI2SK": "SALE#2026-01-30T14:30:00Z",

  "GSI3PK": "STATUS#CONFIRMED",
  "GSI3SK": "SALE#2026-01-30T14:30:00Z"
}
```

**Status Values**:
- `DRAFT` - Sale created but not confirmed
- `CONFIRMED` - Sale confirmed, awaiting invoice
- `INVOICED` - Invoice generated
- `SHIPPED` - Goods shipped
- `DELIVERED` - Goods delivered
- `CANCELLED` - Sale cancelled

**Payment Terms**:
- `CASH` - Cash on delivery
- `15_DAYS` - 15 days after delivery
- `30_DAYS` - 30 days after delivery
- `45_DAYS` - 45 days after delivery
- `60_DAYS` - 60 days after delivery
- `90_DAYS` - 90 days after delivery

### 2. Sale Line (Linha de Venda)

**PK Pattern**: `SALE#{sale_id}`
**SK Pattern**: `LINE#{line_number}`

**Attributes**:
```json
{
  "PK": "SALE#SALE001",
  "SK": "LINE#001",
  "EntityType": "SaleLine",
  "SaleId": "SALE001",
  "LineNumber": 1,

  "ProductCode": "PROD-CORN-001",
  "ProductName": "Premium Yellow Corn",
  "ProductDescription": "Grade A yellow corn, 25kg bags",

  "Quantity": 1000,
  "Unit": "KG",
  "UnitPrice": 25.50,
  "Subtotal": 25500.00,
  "Discount": 500.00,
  "Tax": 2550.00,
  "Total": 27550.00,

  "DiscountPercentage": 2.0,
  "TaxPercentage": 10.0,

  "Notes": "Organic certification required",

  "CreatedAt": "2026-01-30T14:30:00Z",
  "UpdatedAt": "2026-01-30T14:35:00Z"
}
```

### 3. Buyer (Comprador)

**PK Pattern**: `BUYER#{buyer_id}`
**SK Pattern**: `#METADATA#buyer`

**Attributes**:
```json
{
  "PK": "BUYER#BUYER001",
  "SK": "#METADATA#buyer",
  "EntityType": "Buyer",
  "BuyerId": "BUYER001",

  "Name": "ACME Corporation",
  "TradeName": "ACME",
  "Document": "12.345.678/0001-90",
  "DocumentType": "CNPJ",

  "Email": "purchasing@acme.com",
  "Phone": "+55 11 1234-5678",
  "Mobile": "+55 11 98765-4321",

  "Address": {
    "Street": "Av. Paulista",
    "Number": "1000",
    "Complement": "10º andar",
    "Neighborhood": "Bela Vista",
    "City": "São Paulo",
    "State": "SP",
    "PostalCode": "01310-100",
    "Country": "BR"
  },

  "BillingAddress": {
    "Street": "Av. Paulista",
    "Number": "1000",
    "Complement": "10º andar",
    "Neighborhood": "Bela Vista",
    "City": "São Paulo",
    "State": "SP",
    "PostalCode": "01310-100",
    "Country": "BR"
  },

  "Status": "ACTIVE",
  "CreditLimit": 100000.00,
  "PaymentTerms": "30_DAYS",

  "ContactPerson": "John Doe",
  "ContactEmail": "john.doe@acme.com",
  "ContactPhone": "+55 11 98765-4321",

  "TaxId": "12.345.678/0001-90",
  "StateRegistration": "123.456.789.012",

  "Notes": "Preferred customer - priority delivery",

  "CreatedAt": "2026-01-15T10:00:00Z",
  "CreatedBy": "admin@i2speedex.com",
  "UpdatedAt": "2026-01-25T14:00:00Z",
  "UpdatedBy": "admin@i2speedex.com",

  "GSI1PK": "BUYERS",
  "GSI1SK": "BUYER#ACME Corporation"
}
```

**Status Values**:
- `ACTIVE` - Active buyer
- `INACTIVE` - Temporarily inactive
- `BLOCKED` - Blocked due to payment issues
- `SUSPENDED` - Administrative suspension

### 4. Producer (Produtor)

**PK Pattern**: `PRODUCER#{producer_id}`
**SK Pattern**: `#METADATA#producer`

**Attributes**:
```json
{
  "PK": "PRODUCER#PRODUCER001",
  "SK": "#METADATA#producer",
  "EntityType": "Producer",
  "ProducerId": "PRODUCER001",

  "Name": "Farm Industries Ltd",
  "TradeName": "Farm Industries",
  "Document": "98.765.432/0001-10",
  "DocumentType": "CNPJ",

  "Email": "sales@farmindustries.com",
  "Phone": "+55 19 3456-7890",
  "Mobile": "+55 19 98765-4321",

  "Address": {
    "Street": "Rodovia SP-330",
    "Number": "Km 125",
    "Complement": "Fazenda Santa Rita",
    "Neighborhood": "Rural",
    "City": "Campinas",
    "State": "SP",
    "PostalCode": "13100-000",
    "Country": "BR"
  },

  "Status": "ACTIVE",
  "ProductCategories": ["GRAINS", "CORN", "SOYBEANS"],

  "ContactPerson": "Maria Silva",
  "ContactEmail": "maria.silva@farmindustries.com",
  "ContactPhone": "+55 19 98765-4321",

  "TaxId": "98.765.432/0001-10",
  "StateRegistration": "987.654.321.098",

  "BankAccount": {
    "Bank": "001",
    "BankName": "Banco do Brasil",
    "Agency": "1234-5",
    "Account": "12345-6",
    "AccountType": "CHECKING"
  },

  "Certifications": [
    {
      "Type": "ORGANIC",
      "Number": "ORG-2025-001",
      "Issuer": "IBD",
      "ValidUntil": "2027-12-31"
    }
  ],

  "Notes": "Premium supplier - organic certification",

  "CreatedAt": "2026-01-10T09:00:00Z",
  "CreatedBy": "admin@i2speedex.com",
  "UpdatedAt": "2026-01-20T11:00:00Z",
  "UpdatedBy": "admin@i2speedex.com",

  "GSI1PK": "PRODUCERS",
  "GSI1SK": "PRODUCER#Farm Industries Ltd"
}
```

**Status Values**:
- `ACTIVE` - Active producer
- `INACTIVE` - Temporarily inactive
- `SUSPENDED` - Administrative suspension

### 5. Invoice Metadata

**PK Pattern**: `SALE#{sale_id}`
**SK Pattern**: `#INVOICE#metadata`

**Attributes**:
```json
{
  "PK": "SALE#SALE001",
  "SK": "#INVOICE#metadata",
  "EntityType": "InvoiceMetadata",
  "SaleId": "SALE001",

  "InvoiceNumber": "NF-2026-001",
  "InvoiceKey": "35260112345678000190550010000000011234567890",
  "InvoiceSeries": "1",
  "InvoiceModel": "55",

  "IssueDate": "2026-01-30T14:30:00Z",
  "AuthorizationDate": "2026-01-30T14:35:00Z",
  "AuthorizationProtocol": "135260000123456",

  "Status": "AUTHORIZED",
  "FileUrl": "s3://invoices/2026/01/SALE001-invoice.pdf",
  "XmlUrl": "s3://invoices/2026/01/SALE001-invoice.xml",

  "TotalValue": 27550.00,
  "TaxValue": 2550.00,

  "CreatedAt": "2026-01-30T14:30:00Z",
  "UpdatedAt": "2026-01-30T14:35:00Z"
}
```

**Status Values**:
- `DRAFT` - Invoice being prepared
- `PENDING_AUTHORIZATION` - Sent for authorization
- `AUTHORIZED` - Invoice authorized
- `REJECTED` - Authorization rejected
- `CANCELLED` - Invoice cancelled

---

## Global Secondary Indexes (GSIs)

### GSI1: Query by Buyer

**Index Name**: `GSI1`
**Partition Key**: `GSI1PK` (String)
**Sort Key**: `GSI1SK` (String)
**Projection**: ALL

**Use Cases**:
- List all buyers (alphabetically)
- Get all sales for a buyer
- Get sales for a buyer within date range

**Access Patterns**:
```javascript
// List all buyers
{
  GSI1PK: "BUYERS",
  GSI1SK: begins_with("BUYER#")
}

// Get sales for a specific buyer
{
  GSI1PK: "BUYER#BUYER001",
  GSI1SK: begins_with("SALE#")
}

// Get sales for buyer in date range
{
  GSI1PK: "BUYER#BUYER001",
  GSI1SK: between("SALE#2026-01-01", "SALE#2026-01-31")
}
```

### GSI2: Query by Producer

**Index Name**: `GSI2`
**Partition Key**: `GSI2PK` (String)
**Sort Key**: `GSI2SK` (String)
**Projection**: ALL

**Use Cases**:
- List all producers (alphabetically)
- Get all sales for a producer
- Get sales for a producer within date range

**Access Patterns**:
```javascript
// List all producers
{
  GSI2PK: "PRODUCERS",
  GSI2SK: begins_with("PRODUCER#")
}

// Get sales for a specific producer
{
  GSI2PK: "PRODUCER#PRODUCER001",
  GSI2SK: begins_with("SALE#")
}

// Get sales for producer in date range
{
  GSI2PK: "PRODUCER#PRODUCER001",
  GSI2SK: between("SALE#2026-01-01", "SALE#2026-01-31")
}
```

### GSI3: Query by Status

**Index Name**: `GSI3`
**Partition Key**: `GSI3PK` (String)
**Sort Key**: `GSI3SK` (String)
**Projection**: ALL

**Use Cases**:
- Get all sales by status
- Get sales by status within date range
- Monitor sales pipeline

**Access Patterns**:
```javascript
// Get all confirmed sales
{
  GSI3PK: "STATUS#CONFIRMED",
  GSI3SK: begins_with("SALE#")
}

// Get confirmed sales in date range
{
  GSI3PK: "STATUS#CONFIRMED",
  GSI3SK: between("SALE#2026-01-01", "SALE#2026-01-31")
}
```

---

## Data Migration Mapping

### From S9 PostgreSQL to DynamoDB

#### Sales Table (vendas)

| PostgreSQL Column | DynamoDB Attribute | Transformation |
|------------------|-------------------|----------------|
| `id_venda` | `SaleId` | Prefix with "SALE#" |
| `id_comprador` | `BuyerId` | Prefix with "BUYER#" |
| `id_produtor` | `ProducerId` | Prefix with "PRODUCER#" |
| `data_venda` | `SaleDate` | Convert to ISO 8601 |
| `data_entrega` | `DeliveryDate` | Convert to ISO 8601 |
| `data_nota` | `InvoiceDate` | Convert to ISO 8601 |
| `status` | `Status` | Map to enum values |
| `valor_total` | `Total` | Convert to Number |
| `numero_nota` | `InvoiceNumber` | String |
| `chave_nota` | `InvoiceKey` | String |

#### Buyers Table (compradores)

| PostgreSQL Column | DynamoDB Attribute | Transformation |
|------------------|-------------------|----------------|
| `id_comprador` | `BuyerId` | Prefix with "BUYER#" |
| `nome` | `Name` | String |
| `cnpj` | `Document` | String |
| `email` | `Email` | String |
| `telefone` | `Phone` | String |
| `endereco` | `Address` | Convert to nested object |
| `status` | `Status` | Map to enum values |

#### Producers Table (produtores)

| PostgreSQL Column | DynamoDB Attribute | Transformation |
|------------------|-------------------|----------------|
| `id_produtor` | `ProducerId` | Prefix with "PRODUCER#" |
| `nome` | `Name` | String |
| `cnpj` | `Document` | String |
| `email` | `Email` | String |
| `telefone` | `Phone` | String |
| `endereco` | `Address` | Convert to nested object |
| `status` | `Status` | Map to enum values |

---

## Example Queries

### 1. Get Sale by ID

```javascript
const params = {
  TableName: 'SalesTable-production',
  Key: {
    PK: 'SALE#SALE001',
    SK: '#METADATA#sale'
  }
};

const result = await dynamodb.get(params).promise();
```

### 2. Get Sale with All Lines

```javascript
const params = {
  TableName: 'SalesTable-production',
  KeyConditionExpression: 'PK = :pk',
  ExpressionAttributeValues: {
    ':pk': 'SALE#SALE001'
  }
};

const result = await dynamodb.query(params).promise();
// Returns sale metadata + all sale lines
```

### 3. List All Buyers

```javascript
const params = {
  TableName: 'SalesTable-production',
  IndexName: 'GSI1',
  KeyConditionExpression: 'GSI1PK = :pk',
  ExpressionAttributeValues: {
    ':pk': 'BUYERS'
  }
};

const result = await dynamodb.query(params).promise();
```

### 4. Get Sales for Buyer

```javascript
const params = {
  TableName: 'SalesTable-production',
  IndexName: 'GSI1',
  KeyConditionExpression: 'GSI1PK = :pk',
  ExpressionAttributeValues: {
    ':pk': 'BUYER#BUYER001'
  },
  ScanIndexForward: false  // Most recent first
};

const result = await dynamodb.query(params).promise();
```

### 5. Get Sales by Status

```javascript
const params = {
  TableName: 'SalesTable-production',
  IndexName: 'GSI3',
  KeyConditionExpression: 'GSI3PK = :pk',
  ExpressionAttributeValues: {
    ':pk': 'STATUS#CONFIRMED'
  }
};

const result = await dynamodb.query(params).promise();
```

### 6. Get Sales in Date Range

```javascript
const params = {
  TableName: 'SalesTable-production',
  IndexName: 'GSI3',
  KeyConditionExpression: 'GSI3PK = :pk AND GSI3SK BETWEEN :start AND :end',
  ExpressionAttributeValues: {
    ':pk': 'STATUS#CONFIRMED',
    ':start': 'SALE#2026-01-01T00:00:00Z',
    ':end': 'SALE#2026-01-31T23:59:59Z'
  }
};

const result = await dynamodb.query(params).promise();
```

---

## Capacity Planning

### Read Capacity

**Estimated RCUs (Read Capacity Units)**:

| Operation | Frequency | Item Size | RCUs/op | Total RCUs |
|-----------|-----------|-----------|---------|------------|
| Get Sale | 1000/day | 4 KB | 1 | 0.012/sec |
| List Sales | 100/day | 4 KB × 20 | 20 | 0.023/sec |
| Get Buyer | 500/day | 2 KB | 0.5 | 0.003/sec |
| List Buyers | 50/day | 2 KB × 50 | 25 | 0.014/sec |

**Total**: ~0.052 RCUs/sec average

**Recommendation**: Use PAY_PER_REQUEST (on-demand) billing for unpredictable workloads

### Write Capacity

**Estimated WCUs (Write Capacity Units)**:

| Operation | Frequency | Item Size | WCUs/op | Total WCUs |
|-----------|-----------|-----------|---------|------------|
| Create Sale | 100/day | 4 KB | 4 | 0.005/sec |
| Update Sale | 200/day | 4 KB | 4 | 0.009/sec |
| Create Buyer | 10/day | 2 KB | 2 | 0.0002/sec |
| Create Producer | 5/day | 2 KB | 2 | 0.0001/sec |

**Total**: ~0.014 WCUs/sec average

### Storage Estimate

**Per Sale**: ~5 KB (metadata + 3 lines average)
**Per Buyer**: ~2 KB
**Per Producer**: ~2 KB

**1 Year Estimate**:
- 36,500 sales × 5 KB = 182.5 MB
- 500 buyers × 2 KB = 1 MB
- 200 producers × 2 KB = 0.4 MB
- **Total**: ~184 MB

**5 Year Estimate**: ~920 MB

**Cost Estimate**:
- Storage: 920 MB × $0.25/GB = $0.23/month
- Reads: ~$1-2/month (on-demand)
- Writes: ~$1-2/month (on-demand)
- **Total**: ~$3-5/month

---

## Best Practices

### 1. Composite Keys
✅ Use meaningful prefixes (SALE#, BUYER#, PRODUCER#)
✅ Sort keys enable range queries
✅ Metadata items use #METADATA# pattern

### 2. Denormalization
✅ Store buyer/producer names in sale for quick access
✅ Duplicate frequently accessed data
✅ Trade storage for read performance

### 3. GSI Design
✅ Sparse indexes (only items with GSI keys)
✅ Project ALL attributes for flexibility
✅ Use sort keys for range queries

### 4. Item Collections
✅ Keep related items together (sale + lines)
✅ Single query returns all related data
✅ Atomic transactions possible

### 5. Data Types
✅ Use Numbers for calculations (not strings)
✅ ISO 8601 for dates (sortable)
✅ Nested objects for addresses
✅ Arrays for lists

### 6. Naming Conventions
✅ PascalCase for attribute names
✅ SCREAMING_SNAKE_CASE for enums
✅ Prefix# pattern for keys
✅ Consistent patterns across entities

---

## Migration Strategy

### Phase 1: Schema Validation
1. Review schema with stakeholders
2. Validate access patterns
3. Confirm GSI design
4. Test with sample data

### Phase 2: Data Migration
1. Extract from S9 PostgreSQL
2. Transform to DynamoDB format
3. Validate transformed data
4. Load to DynamoDB tables

### Phase 3: Verification
1. Compare record counts
2. Verify relationships
3. Test all access patterns
4. Performance testing

### Phase 4: Cutover
1. Dual-write period (S9 + DynamoDB)
2. Verify data consistency
3. Switch read traffic
4. Monitor and validate
5. Decommission S9 tables

---

## Maintenance

### Regular Tasks

**Daily**:
- Monitor CloudWatch metrics
- Check error rates
- Verify backup completion

**Weekly**:
- Review access patterns
- Analyze slow queries
- Check capacity usage

**Monthly**:
- Review and optimize GSIs
- Analyze cost trends
- Clean up old data (if needed)
- Test restore procedures

### Monitoring Metrics

- **Read Throttles**: Should be 0
- **Write Throttles**: Should be 0
- **User Errors**: < 0.1%
- **System Errors**: < 0.01%
- **Latency P50**: < 10ms
- **Latency P99**: < 50ms

---

## Security

### Encryption
- **At Rest**: KMS encryption enabled
- **In Transit**: TLS 1.2+
- **Backup**: Encrypted with KMS

### Access Control
- **IAM Policies**: Least privilege
- **VPC Endpoints**: Private access
- **Audit Logging**: CloudTrail enabled

### Data Protection
- **PITR**: 35-day recovery window
- **Backups**: Daily automated backups
- **Versioning**: Not applicable (DynamoDB)
- **Deletion Protection**: Enabled (production)

---

## Conclusion

This schema design provides:

✅ **Performance**: Single-digit millisecond reads
✅ **Flexibility**: Multiple access patterns via GSIs
✅ **Scalability**: On-demand billing handles traffic spikes
✅ **Cost-Effective**: ~$3-5/month for typical workload
✅ **Maintainable**: Clear patterns and naming conventions
✅ **Secure**: Encryption, access control, backup

The schema is production-ready and optimized for the Sale Module's access patterns.
