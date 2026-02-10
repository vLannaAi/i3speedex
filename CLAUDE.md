# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

i2speedex Sale Module — an AWS serverless application for managing sales, invoices, buyers, and producers. Built with TypeScript, AWS CDK, and Lambda. Targets Italian market (FatturaPA e-invoicing, SDI codes, PEC).

AWS Region: `eu-west-1`. Runtime: Node.js 20.x, ARM64.

## Repository Layout

```
lambda-building-blocks/
├── cdk/                          # AWS CDK infrastructure (9 stacks)
│   ├── bin/app.ts                # CDK entry point, stack wiring
│   └── lib/                      # Stack definitions
├── functions/
│   ├── sale-module-api/          # Main API: 40 Lambda handlers
│   ├── html-to-pdf/              # Puppeteer+Chromium PDF generation
│   ├── template-renderer/        # Handlebars/EJS/Mustache → HTML
│   ├── sdi-invoice-generator/    # FatturaPA XML generation
│   └── email-reconciler/         # LLM-powered email parsing (Claude API)
└── layers/                       # Lambda Layers (shared code)
```

## Build & Test Commands

Each function is a separate npm workspace. Navigate to the function directory first.

```bash
# Build CDK infrastructure
cd lambda-building-blocks/cdk && npm run build

# Build a specific function
cd lambda-building-blocks/functions/sale-module-api && npm run build

# Run unit tests (sale-module-api)
cd lambda-building-blocks/functions/sale-module-api && npm test

# Run a single test file
cd lambda-building-blocks/functions/sale-module-api && npx jest tests/unit/handlers/sales/list-sales.test.ts

# Watch mode
cd lambda-building-blocks/functions/sale-module-api && npm run test:watch

# Coverage (70% threshold on branches/functions/lines/statements)
cd lambda-building-blocks/functions/sale-module-api && npm run test:coverage

# Lint
cd lambda-building-blocks/functions/sale-module-api && npm run lint

# Deploy (dev/prod via CDK context)
cd lambda-building-blocks/cdk && npm run deploy:dev
cd lambda-building-blocks/cdk && npm run deploy:prod

# Preview changes before deploy
cd lambda-building-blocks/cdk && cdk diff --context environment=dev
```

## Architecture

### CDK Stacks (cdk/bin/app.ts)

9 stacks with cross-stack references. Deployment order matters:
1. **SaleModuleDynamoDBStack** — 5 DynamoDB tables (Sales, SaleLines, Buyers, Producers, Users) with GSI1-4, streams enabled
2. **SaleModuleCognitoStack** — User Pool, JWT auth, role-based access (Admin/Operator)
3. **SaleModuleApiGatewayStack** — HTTP API v2 with JWT authorizer (depends on Cognito)
4. **SaleModuleS3Stack** — Documents + Attachments buckets
5. **SaleModuleLambdaStack** — All 40 API handlers (depends on DynamoDB, Cognito, API Gateway, S3)
6. **HtmlToPdfStack**, **TemplateRendererStack**, **SdiInvoiceGeneratorStack** — Building block functions
7. **EmailReconcilerStack** — AI email parsing

### Sale Module API (functions/sale-module-api/)

Handler pattern — each handler is a standalone Lambda:
```
src/handlers/{domain}/{verb}-{noun}.ts   → e.g., sales/create-sale.ts
src/common/clients/dynamodb.ts           → DynamoDB CRUD operations
src/common/clients/s3.ts                 → S3 file operations
src/common/clients/lambda.ts             → Cross-function invocation
src/common/middleware/auth.ts            → JWT validation, role checking
src/common/types/index.ts               → All TypeScript interfaces
src/common/utils/response.ts            → HTTP response formatting
src/common/utils/validation.ts          → Input validation
```

Handler domains: `sales/`, `buyers/`, `producers/`, `invoices/`, `attachments/`, `search/`, `dashboard/`

### Key Patterns

- **DynamoDB single-table design**: Composite keys (PK: `SALE#{id}`, SK: `METADATA` or `LINE#{lineId}`), 4 GSIs for flexible queries
- **Soft delete**: `deletedAt` timestamp field, filter with `attribute_not_exists(deletedAt)`
- **Denormalization**: Buyer/producer names stored directly on Sale records
- **Auth**: JWT from Cognito, extracted via `getUserContext(event)`, checked via `requireRole(user, ['admin'])`
- **Responses**: Standardized via `successResponse(statusCode, data)` / `errorResponse(statusCode, message)`
- **Invoice workflow**: Sale data → Template Renderer (HTML) → HTML-to-PDF (PDF) or SDI Generator (XML)

### Testing

Tests in `tests/unit/handlers/` mirror the handler structure. AWS SDK is mocked:
```typescript
jest.mock('../../src/common/clients/dynamodb');
```

Jest config: `ts-jest` preset, 10s timeout, ignores `tests/integration/`.

## Environment Configuration

Environment passed via CDK context (`--context environment=dev|staging|prod`). Key differences:
- **dev**: 256MB memory, 5 reserved concurrency, 7-day log retention, no X-Ray
- **prod**: 512MB memory, 10 reserved concurrency, 30-day log retention, X-Ray enabled, RETAIN removal policy

## Multi-Language Support

Invoice generation supports: Italian (it), English (en), German (de), French (fr). Italian-specific: FatturaPA XML, VAT numbers, fiscal codes, PEC, SDI codes.
