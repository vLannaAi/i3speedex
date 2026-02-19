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
cd lambda-building-blocks/functions/sale-module-api && npx jest tests/unit/handlers/sales/list-sales.test.ts  # Single test
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
2. **Backend** (`lambda-building-blocks/`) — AWS CDK with 9 stacks deploying ~45 Lambda handlers

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

**Handler pattern** — each handler is a standalone Lambda in `functions/sale-module-api/src/handlers/{domain}/{verb}-{noun}.ts`. Domains: `sales/`, `buyers/`, `producers/`, `invoices/`, `attachments/`, `dashboard/`, `search/`, `sync/`.

**Shared code** in `src/common/`:
- `clients/dynamodb.ts` — DynamoDB CRUD operations
- `clients/s3.ts` — S3 file operations
- `clients/lambda.ts` — Cross-Lambda invocation
- `middleware/auth.ts` — JWT validation via `getUserContext(event)`, role checking via `requireRole(user, ['admin'])`
- `utils/response.ts` — `successResponse(statusCode, data)` / `errorResponse(statusCode, message)`
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

Tests in `tests/unit/handlers/` mirror the handler structure. AWS SDK clients are mocked:
```typescript
jest.mock('../../src/common/clients/dynamodb');
```
Jest config: `ts-jest`, 10s timeout, 70% coverage threshold, ignores `tests/integration/`.

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
