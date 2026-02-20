# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

i3speedex Sale Module — an AWS serverless application for managing sales, invoices, buyers, and producers. Built with TypeScript throughout: Nuxt 4 frontend, AWS CDK infrastructure, and Lambda handlers. Targets the Italian market (FatturaPA e-invoicing, SDI codes, PEC).

AWS Region: `eu-west-1`. Runtime: Node.js 20.x, ARM64.

## Build & Test Commands

### Frontend (`frontend/`)

```bash
cd frontend && npm run dev          # Dev server (localhost:3000)
cd frontend && npm run build        # Production build
cd frontend && npm run generate     # Static site generation
cd frontend && npm run lint         # ESLint
cd frontend && npm run typecheck    # TypeScript validation
```

### Backend — Sale Module API (`lambda-building-blocks/functions/sale-module-api/`)

```bash
cd lambda-building-blocks/functions/sale-module-api && npm run build   # TypeScript compile
cd lambda-building-blocks/functions/sale-module-api && npm test        # Unit tests
cd lambda-building-blocks/functions/sale-module-api && npx jest tests/unit/handlers/list-sales.test.ts  # Single test
cd lambda-building-blocks/functions/sale-module-api && npm run test:watch     # Watch mode
cd lambda-building-blocks/functions/sale-module-api && npm run test:coverage  # Coverage (70% threshold)
cd lambda-building-blocks/functions/sale-module-api && npm run lint           # ESLint
```

### CDK Infrastructure (`lambda-building-blocks/cdk/`)

```bash
cd lambda-building-blocks/cdk && npm run build         # Compile stacks
cd lambda-building-blocks/cdk && npm run deploy:dev     # Deploy dev
cd lambda-building-blocks/cdk && npm run deploy:prod    # Deploy prod
cd lambda-building-blocks/cdk && cdk diff --context environment=dev  # Preview changes
```

## Architecture

### Two-Part System

1. **Frontend** (`frontend/`) — Nuxt 4 SPA (SSR disabled) with Nuxt UI v4 + Tailwind CSS 4
2. **Backend** (`lambda-building-blocks/`) — AWS CDK with 9 stacks deploying 12 consolidated Lambda functions (38 routes total)

### Frontend Architecture

**Framework**: Nuxt 4.3.1, Vue 3 Composition API (`<script setup>`), SPA mode (no SSR).
**UI**: Nuxt UI v4 + Tailwind CSS 4 + Lucide icons. Custom red primary color (#bb0231).
**Auth**: Amazon Cognito Identity JS SDK — session restored on load via plugin, auto-token-refresh on 401.

Key patterns:
- **Composables** (`app/composables/`) — All business logic lives here: `useAuth` (Cognito), `useApi` (HTTP client with auto-refresh), `useSales`/`useBuyers`/`useProducers` (CRUD), `useInvoices`, `useAttachments`, `useDashboard`, `useSearch`
- **Encrypted caching** — `useCachedSales`/`useCachedBuyers`/`useCachedProducers` implement delta sync with AES-GCM encrypted localStorage via `useCache` + `utils/crypto-store.ts`
- **API layer** — All API calls go through `useApi` composable which wraps `$fetch` with Bearer token injection
- **File-based routing** — `app/pages/` with `[id].vue` dynamic routes for sales, buyers, producers
- **Auth middleware** — `middleware/auth.global.ts` (global login guard) + `middleware/role.ts` (role-based access)
- **Components** organized by domain: `sales/`, `buyers/`, `producers/`, `attachments/`, `shared/`, `layout/`

Runtime config (from `.env`): `NUXT_PUBLIC_API_BASE_URL`, `NUXT_PUBLIC_COGNITO_USER_POOL_ID`, `NUXT_PUBLIC_COGNITO_CLIENT_ID`, `NUXT_PUBLIC_COGNITO_REGION`.

### Backend Architecture

**CDK Stacks** (9 stacks, deployment order matters — defined in `cdk/bin/app.ts`):
1. DynamoDB (5 tables) → 2. Cognito → 3. API Gateway HTTP v2 → 4. S3 → 5. Lambda (all handlers) → 6-8. Building blocks (HTML-to-PDF, Template Renderer, SDI Generator) → 9. Email Reconciler

**Lambda functions (12 total)** — each is a router that dispatches by HTTP method/path to internal handler functions. All entry points are in `functions/sale-module-api/src/handlers/`:

| # | Lambda | Entry point | Routes |
|---|--------|-------------|--------|
| 1 | BuyersFunction | `buyers/buyers.ts` | GET/POST /api/buyers, GET/PUT/DELETE /api/buyers/{id} |
| 2 | ProducersFunction | `producers/producers.ts` | GET/POST /api/producers, GET/PUT/DELETE /api/producers/{id} |
| 3 | SalesCrudFunction | `sales/sales-crud.ts` | GET/POST /api/sales, GET/PUT/DELETE /api/sales/{id} |
| 4 | SaleLinesFunction | `sales/sale-lines.ts` | GET/POST /api/sales/{id}/lines, PUT/DELETE /api/sales/{id}/lines/{lineId} |
| 5 | ConfirmSaleFunction | `sales/confirm-sale.ts` | POST /api/sales/{id}/confirm |
| 6 | InvoiceFunction | `invoices/invoices.ts` | POST /api/sales/{id}/invoice/{html\|pdf\|sdi}, GET …/download |
| 7 | AttachmentUploadFunction | `attachments/generate-upload-url.ts` | POST /api/sales/{id}/upload-url |
| 8 | AttachmentCrudFunction | `attachments/attachments.ts` | POST/GET /api/sales/{id}/attachments, DELETE …/{attachmentId} |
| 9 | SearchFunction | `search/search.ts` | GET /api/search/{sales\|buyers\|producers} |
| 10 | SyncSalesFunction | `sync/sync-sales.ts` | GET /api/sync/sales |
| 11 | SyncEntitiesFunction | `sync/sync-entities.ts` | GET /api/sync/{buyers\|producers} |
| 12 | DashboardFunction | `dashboard/dashboard.ts` | GET /api/dashboard/{stats\|sales-by-date\|top-buyers\|recent-activity} |

**Consolidated handler pattern** — `buyers/buyers.ts` and `producers/producers.ts` contain all CRUD operations as named exports (`listBuyers`, `getBuyer`, `createBuyer`, `updateBuyer`, `deleteBuyer`) plus a `handler` router. The `sales/` domain still uses individual files (`list-sales.ts`, `get-sale.ts`, etc.) imported by the router.

**Shared code** in `src/common/`:
- `clients/dynamodb.ts` — DynamoDB CRUD operations (`getItem`, `putItem`, `updateItem`, `scanAllItems`, `scanItems`, `queryItems`, `softDelete`, `addTimestamps`, `updateTimestamp`)
- `clients/s3.ts` — S3 file operations
- `clients/lambda.ts` — Cross-Lambda invocation
- `middleware/auth.ts` — JWT validation via `getUserContext(event)`, `requireWritePermission(user)`, `getPathParameter`, `getQueryParameter`, `parseRequestBody`
- `utils/response.ts` — `successResponse`, `createdResponse`, `noContentResponse`, `paginatedResponse`, `handleError`
- `utils/validation.ts` — `validatePaginationParams`, `validateBuyerData`, `validateProducerData`, `NotFoundError`, `ForbiddenError`, `ValidationError`
- `utils/entity-utils.ts` — Shared DynamoDB patterns: `scanEntities` (list + paginate), `getEntityOrThrow` (fetch + 404 check), `buildUpdateSet` (UPDATE expression builder), `searchEntities` (keyword search + paginate)
- `types/index.ts` — All TypeScript interfaces

### DynamoDB Design

Single-table design with composite keys:
- **Sale**: PK=`SALE#{saleId}`, SK=`METADATA`
- **SaleLine**: PK=`SALE#{saleId}`, SK=`LINE#{lineId}`
- **Buyer**: PK=`BUYER#{buyerId}`, SK=`METADATA`
- **Producer**: PK=`PRODUCER#{producerId}`, SK=`METADATA`
- **GSIs**: GSI1 (by status), GSI2 (by buyer), GSI3 (by producer), GSI4 (by creator)
- **Soft delete**: `deletedAt` timestamp, filter with `attribute_not_exists(deletedAt)`
- **Denormalization**: Buyer/producer names stored directly on Sale records

### Testing

Tests live flat in `tests/unit/handlers/` (one file per domain or per handler). AWS SDK clients are mocked with partial mocks to preserve utility functions:
```typescript
jest.mock('../../../src/common/clients/dynamodb', () => ({
  ...jest.requireActual('../../../src/common/clients/dynamodb'),
  scanAllItems: jest.fn(),
  getItem: jest.fn(),
}));
```
Consolidated domains (`buyers.ts`, `producers.ts`) are tested via named exports (`listBuyers`, `getBuyer`, …) imported directly — no HTTP routing needed in tests. Jest config: `ts-jest`, 10s timeout, 70% coverage threshold, ignores `tests/integration/`.

### Invoice Workflow

Sale data → Template Renderer (Handlebars/EJS → HTML) → HTML-to-PDF (Puppeteer+Chromium → PDF) or SDI Generator (FatturaPA XML). Supports Italian, English, German, French.

## Environment Configuration

CDK context (`--context environment=dev|staging|prod`):
- **dev**: 256MB memory, 5 reserved concurrency, 7-day log retention
- **prod**: 512MB memory, 10 reserved concurrency, 30-day log retention, X-Ray, RETAIN removal policy

## Building Block Functions

Separate Lambda functions in `lambda-building-blocks/functions/`:
- `html-to-pdf/` — Puppeteer + `@sparticuz/chromium` for PDF generation
- `template-renderer/` — Handlebars/EJS/Mustache HTML rendering
- `sdi-invoice-generator/` — FatturaPA XML for Italian e-invoicing
- `email-reconciler/` — Claude API-powered email parsing
