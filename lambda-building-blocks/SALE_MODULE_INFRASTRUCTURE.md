# i2speedex Sale Module - Infrastructure Setup

## Phase 1 Progress: Week 1 - DynamoDB Tables

**Date**: January 28, 2026
**Status**: ✅ DynamoDB Tables Deployed
**Environment**: Development (dev)

---

## Deployed Infrastructure

### DynamoDB Tables (5 Total)

All tables deployed to AWS Region: **eu-west-1**

#### 1. Sales Table
**Table Name**: `i2speedex-sales-dev`
**Status**: ✅ ACTIVE
**Purpose**: Store all sales/invoices with denormalized buyer and producer info

**Primary Key**:
- Partition Key (PK): `SALE#{id}` (e.g., `SALE#2001`)
- Sort Key (SK): `METADATA`

**Global Secondary Indexes**:
1. **GSI1-QueryByBuyer**: Query all sales for a specific buyer
   - PK: `GSI1PK` (e.g., `BUYER#5`)
   - SK: `GSI1SK` (e.g., `SALE#2024-03-15#2001`)

2. **GSI2-QueryByProducer**: Query all sales for a specific producer
   - PK: `GSI2PK` (e.g., `PRODUCER#22`)
   - SK: `GSI2SK` (e.g., `SALE#2024-03-15#2001`)

3. **GSI3-QueryByStatus**: Query sales by status (draft, sent, paid, etc.)
   - PK: `GSI3PK` (e.g., `STATUS#sent`)
   - SK: `GSI3SK` (e.g., `SALE#2024-03-15#2001`)

4. **GSI4-QueryByDate**: Query sales by year/date range
   - PK: `GSI4PK` (e.g., `YEAR#2024`)
   - SK: `GSI4SK` (e.g., `2024-03-15#SALE#2001`)

**Features**:
- DynamoDB Streams: ✅ Enabled (NEW_AND_OLD_IMAGES)
- Point-in-Time Recovery: ❌ Disabled (dev environment)
- Billing Mode: Pay-per-request (on-demand)
- TTL: Configured for optional auto-expiring data

#### 2. Sale Lines Table
**Table Name**: `i2speedex-sale-lines-dev`
**Status**: ✅ ACTIVE
**Purpose**: Store all line items for each sale

**Primary Key**:
- Partition Key (PK): `SALE#{saleId}` (e.g., `SALE#2001`)
- Sort Key (SK): `LINE#{pos}` (e.g., `LINE#001`)

**Query Pattern**: Get all lines for a sale
```
Query(PK = "SALE#2001", SK begins_with "LINE#")
```

**Features**:
- DynamoDB Streams: ✅ Enabled
- Billing Mode: Pay-per-request

#### 3. Buyers Table
**Table Name**: `i2speedex-buyers-dev`
**Status**: ✅ ACTIVE
**Purpose**: Store buyer/customer information

**Primary Key**:
- Partition Key (PK): `BUYER#{id}` (e.g., `BUYER#5`)
- Sort Key (SK): `METADATA`

**Global Secondary Indexes**:
1. **GSI1-QueryByCode**: Unique lookup by buyer code
   - PK: `GSI1PK` (e.g., `BUYER_CODE#berrang m`)
   - SK: `GSI1SK` (`METADATA`)

2. **GSI2-QueryByStatus**: Filter buyers by status (active, inactive, etc.)
   - PK: `GSI2PK` (e.g., `BUYER_STATUS#online`)
   - SK: `GSI2SK` (e.g., `BUYER#5`)

**Features**:
- DynamoDB Streams: ✅ Enabled
- Billing Mode: Pay-per-request

#### 4. Producers Table
**Table Name**: `i2speedex-producers-dev`
**Status**: ✅ ACTIVE
**Purpose**: Store producer/supplier information

**Primary Key**:
- Partition Key (PK): `PRODUCER#{id}` (e.g., `PRODUCER#22`)
- Sort Key (SK): `METADATA`

**Global Secondary Indexes**:
1. **GSI1-QueryByCode**: Unique lookup by producer code
2. **GSI2-QueryByStatus**: Filter producers by status

**Features**:
- DynamoDB Streams: ✅ Enabled
- Billing Mode: Pay-per-request

#### 5. Users Table
**Table Name**: `i2speedex-users-dev`
**Status**: ✅ ACTIVE
**Purpose**: Sync user data from AWS Cognito and store permissions

**Primary Key**:
- Partition Key (PK): `USER#{cognitoSub}` (e.g., `USER#us-east-1:abc-123-def`)
- Sort Key (SK): `METADATA`

**Global Secondary Index**:
1. **GSI1-QueryByEmail**: Lookup user by email address
   - PK: `GSI1PK` (e.g., `EMAIL#user@example.com`)
   - SK: `GSI1SK` (`METADATA`)

**Features**:
- DynamoDB Streams: ❌ Disabled (not needed for user sync)
- Billing Mode: Pay-per-request

---

## Table Configuration Summary

| Table | Primary Key | GSIs | Streams | PITR | Billing |
|-------|------------|------|---------|------|---------|
| Sales | PK, SK | 4 | ✅ | ❌ (dev) | On-demand |
| SaleLines | PK, SK | 0 | ✅ | ❌ (dev) | On-demand |
| Buyers | PK, SK | 2 | ✅ | ❌ (dev) | On-demand |
| Producers | PK, SK | 2 | ✅ | ❌ (dev) | On-demand |
| Users | PK, SK | 1 | ❌ | ❌ (dev) | On-demand |

**Note**: Production environment will have:
- Point-in-Time Recovery: ✅ Enabled
- Deletion Protection: ✅ Enabled
- CloudWatch Alarms: ✅ Configured

---

## DynamoDB Access Patterns

### Common Queries

**Sales Queries**:
```typescript
// Get sale by ID
const sale = await dynamodb.get({
  TableName: 'i2speedex-sales-dev',
  Key: { PK: 'SALE#2001', SK: 'METADATA' }
});

// Get all sales for a buyer
const buyerSales = await dynamodb.query({
  TableName: 'i2speedex-sales-dev',
  IndexName: 'GSI1-QueryByBuyer',
  KeyConditionExpression: 'GSI1PK = :buyerId',
  ExpressionAttributeValues: { ':buyerId': 'BUYER#5' }
});

// Get all sales with status "sent"
const sentSales = await dynamodb.query({
  TableName: 'i2speedex-sales-dev',
  IndexName: 'GSI3-QueryByStatus',
  KeyConditionExpression: 'GSI3PK = :status',
  ExpressionAttributeValues: { ':status': 'STATUS#sent' }
});

// Get sales for year 2024
const sales2024 = await dynamodb.query({
  TableName: 'i2speedex-sales-dev',
  IndexName: 'GSI4-QueryByDate',
  KeyConditionExpression: 'GSI4PK = :year',
  ExpressionAttributeValues: { ':year': 'YEAR#2024' }
});
```

**Sale Lines Queries**:
```typescript
// Get all lines for a sale
const lines = await dynamodb.query({
  TableName: 'i2speedex-sale-lines-dev',
  KeyConditionExpression: 'PK = :saleId AND begins_with(SK, :linePrefix)',
  ExpressionAttributeValues: {
    ':saleId': 'SALE#2001',
    ':linePrefix': 'LINE#'
  }
});
```

**Buyer Queries**:
```typescript
// Get buyer by ID
const buyer = await dynamodb.get({
  TableName: 'i2speedex-buyers-dev',
  Key: { PK: 'BUYER#5', SK: 'METADATA' }
});

// Get buyer by code (unique lookup)
const buyerByCode = await dynamodb.query({
  TableName: 'i2speedex-buyers-dev',
  IndexName: 'GSI1-QueryByCode',
  KeyConditionExpression: 'GSI1PK = :code',
  ExpressionAttributeValues: { ':code': 'BUYER_CODE#berrang m' }
});

// List all active buyers
const activeBuyers = await dynamodb.query({
  TableName: 'i2speedex-buyers-dev',
  IndexName: 'GSI2-QueryByStatus',
  KeyConditionExpression: 'GSI2PK = :status',
  ExpressionAttributeValues: { ':status': 'BUYER_STATUS#online' }
});
```

---

## Data Model Example

### Sale Record
```json
{
  "PK": "SALE#2001",
  "SK": "METADATA",
  "id": 2001,
  "number": 42,
  "year": 2024,
  "status": "sent",

  "buyerId": 5,
  "buyerCode": "berrang_m",
  "buyerName": "Berrang SE",
  "buyerCountry": "DEU",

  "producerId": 22,
  "producerCode": "korea",
  "producerName": "KPF Korea Parts & Fasteners",
  "producerCountry": "KOR",

  "currency": "EUR",
  "amount": 5750.00,
  "vat": 1265.00,
  "total": 7015.00,

  "regDate": "2024-03-15",
  "regDateTimestamp": 1710460800,

  "GSI1PK": "BUYER#5",
  "GSI1SK": "SALE#2024-03-15#2001",
  "GSI2PK": "PRODUCER#22",
  "GSI2SK": "SALE#2024-03-15#2001",
  "GSI3PK": "STATUS#sent",
  "GSI3SK": "SALE#2024-03-15#2001",
  "GSI4PK": "YEAR#2024",
  "GSI4SK": "2024-03-15#SALE#2001",

  "createdAt": "2024-03-15T10:30:00Z",
  "updatedAt": "2024-03-15T14:20:00Z"
}
```

### Sale Line Record
```json
{
  "PK": "SALE#2001",
  "SK": "LINE#001",
  "id": 173,
  "saleId": 2001,
  "pos": 1,
  "code": "GV302-EZ",
  "description": "TONE ELECTRIC SHEAR WRENCH",
  "qty": 1,
  "price": 5750.00,
  "discount": 0,
  "vat": 0,
  "lineSubtotal": 5750.00,
  "lineTotal": 5750.00,
  "createdAt": "2024-03-15T10:30:00Z"
}
```

### Buyer Record
```json
{
  "PK": "BUYER#5",
  "SK": "METADATA",
  "id": 5,
  "code": "berrang_m",
  "status": "online",
  "name": "Berrang SE",
  "country": "DEU",
  "address": "Elsa-Brandstroem-Strasse 12",
  "city": "Mannheim",
  "zip": "D-68229",
  "vat": "DE364389326",
  "email": "info@berrang.de",
  "currency": "EUR",
  "lang": "de",

  "GSI1PK": "BUYER_CODE#berrang_m",
  "GSI1SK": "METADATA",
  "GSI2PK": "BUYER_STATUS#online",
  "GSI2SK": "BUYER#5",

  "createdAt": "2010-08-18T08:09:26Z",
  "updatedAt": "2024-01-15T10:20:30Z"
}
```

---

## Cost Estimation

### Current Usage (Dev Environment)

**Assumptions**:
- 10 writes/day (new sales)
- 100 reads/day (browsing, viewing)
- ~1 KB average item size
- On-demand pricing

**Estimated Monthly Cost**:
- Writes: 300 writes × $1.25 per million = $0.000375
- Reads: 3,000 reads × $0.25 per million = $0.00075
- Storage: 1 GB × $0.25 = $0.25
- **Total: ~$0.25/month**

### Production Estimate (100 sales/month)

**Assumptions**:
- 100 writes/day
- 5,000 reads/day
- ~10 GB storage

**Estimated Monthly Cost**:
- Writes: 3,000 writes × $1.25 per million = $0.00375
- Reads: 150,000 reads × $0.25 per million = $0.0375
- Storage: 10 GB × $0.25 = $2.50
- **Total: ~$2.54/month**

✅ **Well within AWS Free Tier** (25 GB storage, 25 RCUs, 25 WCUs)

---

## Infrastructure as Code

### CDK Stack Location
`lambda-building-blocks/cdk/lib/sale-module-dynamodb-stack.ts`

### Deploy Commands

```bash
# Deploy to dev
cd lambda-building-blocks/cdk
npx cdk deploy SaleModuleDynamoDB-Dev --context environment=dev

# Deploy to staging
npx cdk deploy SaleModuleDynamoDB-Staging --context environment=staging

# Deploy to production
npx cdk deploy SaleModuleDynamoDB-Prod --context environment=prod
```

### View Stack Outputs
```bash
aws cloudformation describe-stacks \
  --stack-name SaleModuleDynamoDB-Dev \
  --query 'Stacks[0].Outputs'
```

---

## Next Steps (Phase 1 - Week 1)

### Remaining Tasks

- [x] ~~Task #2: Design and create DynamoDB tables~~ ✅ **COMPLETED**
- [ ] Task #1: Set up AWS environments (dev/staging/prod)
- [ ] Task #3: Configure AWS Cognito user pool
- [ ] Task #4: Set up API Gateway
- [ ] Task #5: Configure S3 buckets for file storage
- [ ] Task #6: Set up CloudFront CDN distribution
- [ ] Task #7: Create CI/CD pipeline

### Week 2 Tasks (Data Modeling)

- [ ] Task #8: Finalize DynamoDB schema design
- [ ] Task #9: Create data migration scripts (MySQL → DynamoDB)
- [ ] Task #10: Test migration with sample data (100 records)
- [ ] Task #11: Create backup/restore procedures

---

## Monitoring & Maintenance

### View Table Metrics

```bash
# View table details
aws dynamodb describe-table --table-name i2speedex-sales-dev

# List all tables
aws dynamodb list-tables | jq '.TableNames[] | select(startswith("i2speedex"))'

# View item count
aws dynamodb describe-table --table-name i2speedex-sales-dev \
  --query 'Table.ItemCount'
```

### CloudWatch Logs

DynamoDB table metrics are available in CloudWatch:
- Read/Write Capacity Units
- Throttled Requests
- User Errors
- System Errors

**Note**: CloudWatch Alarms are configured only in production environment.

---

## Security

### IAM Permissions Required

Lambda functions will need these DynamoDB permissions:
```json
{
  "Effect": "Allow",
  "Action": [
    "dynamodb:GetItem",
    "dynamodb:PutItem",
    "dynamodb:UpdateItem",
    "dynamodb:DeleteItem",
    "dynamodb:Query",
    "dynamodb:Scan",
    "dynamodb:BatchGetItem",
    "dynamodb:BatchWriteItem"
  ],
  "Resource": [
    "arn:aws:dynamodb:eu-west-1:827562051115:table/i2speedex-*",
    "arn:aws:dynamodb:eu-west-1:827562051115:table/i2speedex-*/index/*"
  ]
}
```

### Data Encryption

- **At Rest**: ✅ AWS managed encryption (default)
- **In Transit**: ✅ TLS 1.2+ (HTTPS)

---

## Troubleshooting

### Common Issues

**Table Not Found**:
- Verify table name: `aws dynamodb list-tables`
- Check region: Tables are in `eu-west-1`

**AccessDeniedException**:
- Check IAM permissions for DynamoDB access
- Verify resource ARNs in IAM policy

**ProvisionedThroughputExceededException**:
- Not applicable (using on-demand billing mode)

**ValidationException**:
- Check key attribute names (PK, SK) and types (STRING)
- Verify GSI attribute names match table schema

---

## Links

- **CloudFormation Stack**: https://eu-west-1.console.aws.amazon.com/cloudformation/home?region=eu-west-1#/stacks/stackinfo?stackId=arn:aws:cloudformation:eu-west-1:827562051115:stack/SaleModuleDynamoDB-Dev/2b59c270-fc63-11f0-8e2e-0676cb566f01
- **DynamoDB Console**: https://eu-west-1.console.aws.amazon.com/dynamodbv2/home?region=eu-west-1#tables

---

**Status**: ✅ Phase 1 Week 1 - DynamoDB Tables Deployed Successfully
**Deployment Date**: January 28, 2026, 23:06 UTC
**Deployed By**: Claude Code
**Environment**: Development (dev)
**Next**: Configure AWS Cognito for user authentication
