# i2speedex Sale Module - AWS Serverless Migration Evaluation

**Document Version:** 1.0
**Date:** 2026-01-27
**Purpose:** Comprehensive evaluation for migrating to Nuxt 4 + AWS serverless architecture

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Proposed Technology Stack](#proposed-technology-stack)
3. [Architecture Overview](#architecture-overview)
4. [DynamoDB Schema Design](#dynamodb-schema-design)
5. [Frontend Architecture](#frontend-architecture)
6. [Backend Architecture](#backend-architecture)
7. [PDF Generation Strategy](#pdf-generation-strategy)
8. [Authentication & Authorization](#authentication--authorization)
9. [File Storage & Management](#file-storage--management)
10. [Migration Strategy](#migration-strategy)
11. [Cost Analysis](#cost-analysis)
12. [Performance Considerations](#performance-considerations)
13. [Security & Compliance](#security--compliance)
14. [Dashboard & Analytics](#dashboard--analytics)
15. [Mobile Experience](#mobile-experience)
16. [Risks & Mitigation](#risks--mitigation)
17. [Implementation Roadmap](#implementation-roadmap)
18. [Comparison Matrix](#comparison-matrix)

---

## Executive Summary

### Migration Overview

This evaluation proposes a **complete modernization** of the i2speedex Sale module, transitioning from a traditional Java/MySQL stack to a modern **serverless architecture** on AWS with a Vue 3 frontend.

### Key Benefits

✅ **Scalability**: Auto-scaling serverless infrastructure
✅ **Cost Efficiency**: Pay-per-use model, no idle server costs
✅ **Modern UX**: Responsive, mobile-first interface
✅ **Performance**: Global CDN delivery, sub-second response times
✅ **Security**: AWS Cognito with MFA, fine-grained access control
✅ **Maintainability**: Modern development stack, component-based architecture
✅ **Developer Experience**: Hot reload, TypeScript, modern tooling
✅ **Mobile Support**: Progressive Web App (PWA) capabilities

### Investment Required

- **Development Time**: 12-16 weeks (3-4 months)
- **Team Size**: 2-3 developers + 1 DevOps engineer
- **Estimated Cost**: $80,000 - $120,000 (development + migration)
- **Monthly AWS Costs**: $200-500 (low traffic) to $1,000-2,000 (medium traffic)

### Risk Level: **Medium**

Primary risks include DynamoDB schema complexity, data migration integrity, and PDF generation compatibility with Italian SDI requirements.

---

## Proposed Technology Stack

### Frontend Stack

| Technology | Version | Purpose | Why This Choice |
|------------|---------|---------|-----------------|
| **Nuxt 4** | 4.x | SSR/SSG Framework | Modern meta-framework, excellent DX, SEO-friendly |
| **Vue 3** | 3.x | UI Framework | Composition API, better performance, TypeScript support |
| **UnoCSS** | Latest | CSS Framework | Instant on-demand atomic CSS, smaller bundle size |
| **TypeScript** | 5.x | Type Safety | Enhanced DX, catch errors early, better IDE support |
| **Pinia** | Latest | State Management | Official Vue store, lightweight, TypeScript-first |
| **VueUse** | Latest | Composables | Rich collection of utilities, reactive helpers |
| **Nuxt UI** or **PrimeVue** | Latest | Component Library | Pre-built components, accessibility, themeable |
| **VueCharts** or **ApexCharts** | Latest | Data Visualization | Dashboard charts and graphs |
| **Vite** | 5.x | Build Tool | Lightning-fast HMR, optimized builds |

### Backend Stack (AWS Serverless)

| Service | Purpose | Why This Choice |
|---------|---------|-----------------|
| **AWS Lambda** | API Functions | Serverless compute, auto-scaling, pay-per-use |
| **API Gateway** | REST/HTTP API | Managed API layer, throttling, caching |
| **DynamoDB** | Primary Database | NoSQL, millisecond latency, auto-scaling |
| **S3** | File Storage | PDF/XML/attachments storage, 99.99% durability |
| **Cognito** | Authentication | Managed user auth, MFA, OAuth2, SAML |
| **CloudFront** | CDN | Global edge caching, HTTPS, DDoS protection |
| **SES** | Email Service | Transactional emails, invoice delivery |
| **EventBridge** | Event Bus | Async workflows, integrations |
| **Step Functions** | Orchestration | Complex workflows (PDF generation, data migration) |
| **CloudWatch** | Monitoring | Logs, metrics, alarms, dashboards |
| **Systems Manager** | Config Management | Parameter store for secrets and config |
| **X-Ray** | Distributed Tracing | Performance debugging, bottleneck identification |

### Development & Operations

| Tool | Purpose |
|------|---------|
| **AWS CDK** or **Serverless Framework** | Infrastructure as Code |
| **GitHub Actions** or **AWS CodePipeline** | CI/CD |
| **ESLint + Prettier** | Code quality |
| **Vitest** | Unit testing |
| **Playwright** or **Cypress** | E2E testing |
| **Docker** | Local development environment |

### PDF Generation Options

| Option | Pros | Cons | Recommendation |
|--------|------|------|----------------|
| **Puppeteer (Headless Chrome)** | Full CSS support, HTML to PDF, JavaScript execution | Large Lambda layer (~50MB), cold start issues | ⭐ **Best for complex layouts** |
| **Playwright PDF** | Similar to Puppeteer, better performance | Newer, less mature | Good alternative |
| **jsPDF + html2canvas** | Lightweight, client-side capable | Limited layout support, slower rendering | Not recommended for complex invoices |
| **PDFKit** | Programmatic PDF creation, small footprint | No HTML rendering, manual layout coding | Good for simple templates |
| **react-pdf** or **vue-pdf** | Component-based PDF creation | Learning curve, limited to React/Vue syntax | Good for structured documents |
| **Gotenberg** (Docker) | Multiple engines (LibreOffice, Chromium), REST API | Requires container, not serverless | Not suitable for Lambda |
| **AWS Lambda + Chromium Layer** | Pre-built layer, optimized for Lambda | Still large (~50MB) | ⭐ **Recommended** |

**Recommended Solution**: **Puppeteer with AWS Lambda Layer**
- Use [@sparticuz/chromium](https://github.com/Sparticuz/chromium) for Lambda
- HTML/CSS templates for invoices
- Supports Italian characters, complex layouts
- Proven solution for invoice generation

---

## Architecture Overview

### High-Level Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         Internet/Users                          │
└────────────────────────────┬────────────────────────────────────┘
                             │
                    ┌────────▼─────────┐
                    │   CloudFront     │ (CDN)
                    │   + WAF          │ (Security)
                    └────────┬─────────┘
                             │
                ┌────────────┴────────────┐
                │                         │
        ┌───────▼────────┐       ┌───────▼────────┐
        │   S3 Bucket    │       │  API Gateway   │
        │   (Static)     │       │   (REST API)   │
        │   Nuxt App     │       └───────┬────────┘
        └────────────────┘               │
                                         │
                        ┌────────────────┴────────────────┐
                        │                                  │
                ┌───────▼────────┐              ┌─────────▼────────┐
                │  Lambda         │              │   Cognito        │
                │  Functions      │◄─────────────┤   User Pool      │
                │  (Node.js)      │ (Verify JWT) └──────────────────┘
                └───────┬─────────┘
                        │
        ┌───────────────┼───────────────┬───────────────┐
        │               │               │               │
┌───────▼─────┐  ┌──────▼──────┐  ┌────▼─────┐  ┌─────▼──────┐
│  DynamoDB   │  │     S3      │  │   SES    │  │ Step Fns   │
│  (Tables)   │  │  (Files)    │  │ (Email)  │  │ (Workflows)│
└─────────────┘  └─────────────┘  └──────────┘  └────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                    Monitoring & Logging                         │
│  CloudWatch Logs | CloudWatch Metrics | X-Ray | SNS Alarms      │
└─────────────────────────────────────────────────────────────────┘
```

### Request Flow

**1. Static Content (Nuxt App)**
```
User → CloudFront → S3 → Nuxt SSR/SSG Pages → Browser
```

**2. API Requests**
```
Browser → CloudFront → API Gateway → Lambda Authorizer (Cognito)
  → Lambda Function → DynamoDB/S3 → Response
```

**3. PDF Generation**
```
User triggers PDF → Lambda Function → Generate HTML → Puppeteer
  → PDF File → S3 Storage → CloudFront URL → User Download
```

**4. Authentication**
```
User Login → Cognito → JWT Token → Stored in Browser
  → Included in API Requests → Lambda Authorizer validates
```

---

## DynamoDB Schema Design

### DynamoDB vs MySQL: Key Differences

| Aspect | MySQL (Current) | DynamoDB (Proposed) |
|--------|----------------|---------------------|
| Data Model | Relational (normalized) | NoSQL (denormalized) |
| Queries | SQL (flexible) | Key-value + GSI (limited) |
| Joins | Native support | Application-level |
| Transactions | ACID | Limited (up to 25 items) |
| Scaling | Vertical (limited) | Horizontal (unlimited) |
| Cost | Server-based | Request-based |
| Performance | Variable | Single-digit ms latency |

### Design Principles for DynamoDB

1. **Denormalization**: Embed related data to avoid joins
2. **Access Patterns**: Design tables based on query patterns, not entities
3. **Single Table Design**: Consider using one table for all entities (advanced)
4. **GSI Strategy**: Create indexes for alternate query patterns
5. **Composite Keys**: Use compound sort keys for hierarchical data

### Proposed Schema: Option 1 (Multi-Table Design)

**Recommended for easier migration and maintenance**

#### Table 1: `Sales`

**Primary Key:**
- Partition Key (PK): `SALE#{id}` (e.g., `SALE#2001`)
- Sort Key (SK): `METADATA`

**Attributes:**
```javascript
{
  PK: "SALE#2001",
  SK: "METADATA",
  id: 2001,
  number: 42,
  year: 2024,
  status: "sent",

  // Buyer info (denormalized)
  buyerId: 5,
  buyerCode: "berrang m",
  buyerName: "Berrang SE",
  buyerCountry: "DEU",

  // Producer info (denormalized)
  producerId: 22,
  producerCode: "korea",
  producerName: "KPF Korea Parts & Fasteners",
  producerCountry: "KOR",

  // Financial data
  currency: "EUR",
  amount: 5750.00,
  eurAmount: 5750.00,
  vatPerc: 22,
  vat: 1265.00,
  tax: 0.00,
  total: 7015.00,
  payLoad: 7015.00,

  // Dates (ISO 8601 or Unix timestamp)
  regDate: "2024-03-15",
  regDateTimestamp: 1710460800,
  paymentDate: "2024-04-20",

  // References
  poNumber: "PO-2024-001",
  poDate: "2024-03-10",
  buyerRef: "Customer Order #123",

  // Delivery notes
  dnNumber: "DN-001",
  dnDate: "2024-03-14",
  dnNumber2: null,
  dnDate2: null,
  dnNumber3: null,
  dnDate3: null,

  // Payment
  payment: "bank_transfer",
  bankId: "unicredit",
  paymentBank: null,
  paymentBankIban: null,
  paymentNote: null,

  // Notes
  saleNote: "Delivery as per agreement",
  note: "Internal note about this sale",

  // VAT
  vatOff: null,
  vatOn: 1,
  taxOn: 0,

  // PA fields
  cupContractId: null,
  cigContractId: null,

  // Documents
  attachments: ["file1.pdf", "file2.jpg"],
  invoiceAttach: 1,

  // PDF config
  fontBase: 12,

  // Metadata
  createdAt: "2024-03-15T10:30:00Z",
  updatedAt: "2024-03-15T14:20:00Z",
  createdBy: "user@example.com",
  updatedBy: "user@example.com",

  // GSI fields for queries
  GSI1PK: "BUYER#5",
  GSI1SK: "SALE#2024-03-15#2001",
  GSI2PK: "PRODUCER#22",
  GSI2SK: "SALE#2024-03-15#2001",
  GSI3PK: "STATUS#sent",
  GSI3SK: "SALE#2024-03-15#2001",

  // For full-text search (consider AWS OpenSearch)
  searchableText: "berrang korea pO-2024-001 customer order"
}
```

**Global Secondary Indexes (GSI):**

1. **GSI1: QueryByBuyer**
   - PK: `GSI1PK` (e.g., `BUYER#5`)
   - SK: `GSI1SK` (e.g., `SALE#2024-03-15#2001`)
   - Use: Get all sales for a buyer, sorted by date

2. **GSI2: QueryByProducer**
   - PK: `GSI2PK` (e.g., `PRODUCER#22`)
   - SK: `GSI2SK` (e.g., `SALE#2024-03-15#2001`)
   - Use: Get all sales for a producer, sorted by date

3. **GSI3: QueryByStatus**
   - PK: `GSI3PK` (e.g., `STATUS#sent`)
   - SK: `GSI3SK` (e.g., `SALE#2024-03-15#2001`)
   - Use: Get all sales by status, sorted by date

4. **GSI4: QueryByDate** (Optional)
   - PK: `GSI4PK` (e.g., `YEAR#2024`)
   - SK: `GSI4SK` (e.g., `2024-03-15#SALE#2001`)
   - Use: Get all sales in a year, sorted by date

#### Table 2: `SaleLines`

**Primary Key:**
- Partition Key (PK): `SALE#{saleId}` (e.g., `SALE#2001`)
- Sort Key (SK): `LINE#{pos}` (e.g., `LINE#001`)

**Attributes:**
```javascript
{
  PK: "SALE#2001",
  SK: "LINE#001",
  id: 173,
  saleId: 2001,
  pos: 1,

  // Product info
  code: "GV302-EZ",
  description: "TONE ELECTRIC SHEAR WRENCH",

  // Pricing
  qty: 1,
  price: 5750.000000,
  discount: 0.0000,
  vat: 0.0000,

  // Calculated
  lineSubtotal: 5750.00,
  lineTotal: 5750.00,

  // Additional specs
  shipping: null,
  lfz: null,
  standard: "ISO 9001",
  strength: "Grade 8.8",
  drive: "Hex",
  length: "100mm",
  finish: "Zinc plated",
  sorting: null,
  certificate: "EN 10204 3.1",

  // VAT exemption
  vatOff: null,
  vatOffDesc: null,

  // Metadata
  createdAt: "2024-03-15T10:30:00Z",
  updatedAt: "2024-03-15T14:20:00Z"
}
```

**Query Patterns:**
- Get all lines for a sale: `Query(PK = SALE#2001, SK begins_with LINE#)`
- Get specific line: `GetItem(PK = SALE#2001, SK = LINE#001)`

#### Table 3: `Buyers`

**Primary Key:**
- Partition Key (PK): `BUYER#{id}` (e.g., `BUYER#5`)
- Sort Key (SK): `METADATA`

**Attributes:**
```javascript
{
  PK: "BUYER#5",
  SK: "METADATA",
  id: 5,
  code: "berrang m", // Must be unique - enforce with conditional write
  status: "online",

  // Company info
  name: "Berrang SE",
  subName: null,
  country: "DEU",

  // Address
  address: "Elsa-Brandstroem-Strasse 12",
  city: "Mannheim",
  prov: null,
  zip: "D-68229",
  box: "Postfach 100463",

  // Tax info
  vat: "DE364389326",
  taxId: null,
  vatOff: null,
  sdiCode: null,
  ue: "19520723",

  // Contact
  tel: "0049 621 8786 0",
  fax: "0049 621 8786400",
  email: "info@berrang.de",
  emailDomain: "berrang.de",
  pec: null,
  web: "www.berrang.de",
  contact: "Mr. Schmidt",

  // Business info
  currency: "EUR",
  operatorId: 10,
  industrialGroup: "Berrang",
  sector: "C-part Management",
  lang: "de",

  // Payment
  payment: "60 gg. d.f. B.B.",
  bank: null,

  // Shipping addresses (denormalized as array)
  shippingAddresses: [
    {
      date: "20000101",
      mode: "FCA",
      address: "danzas germania 0049 6242 509141"
    }
  ],

  // Notes
  note: "Preferred customer",

  // Metadata
  newDate: "2010-08-18T08:09:26Z",
  createdAt: "2010-08-18T08:09:26Z",
  updatedAt: "2024-01-15T10:20:30Z",

  // GSI for code lookup
  GSI1PK: "BUYER_CODE#berrang m",
  GSI1SK: "METADATA",

  // GSI for status filtering
  GSI2PK: "BUYER_STATUS#online",
  GSI2SK: "BUYER#5"
}
```

**Global Secondary Indexes:**

1. **GSI1: QueryByCode**
   - PK: `GSI1PK` (e.g., `BUYER_CODE#berrang m`)
   - SK: `GSI1SK` (`METADATA`)
   - Use: Lookup buyer by unique code

2. **GSI2: QueryByStatus**
   - PK: `GSI2PK` (e.g., `BUYER_STATUS#online`)
   - SK: `GSI2SK` (e.g., `BUYER#5`)
   - Use: List all buyers with specific status

#### Table 4: `Producers`

**Similar structure to Buyers table**

**Primary Key:**
- Partition Key (PK): `PRODUCER#{id}`
- Sort Key (SK): `METADATA`

**GSI for code lookup and status filtering**

#### Table 5: `Users` (for Cognito sync)

**Primary Key:**
- Partition Key (PK): `USER#{cognitoSub}`
- Sort Key (SK): `METADATA`

**Attributes:**
```javascript
{
  PK: "USER#us-east-1:abc-123-def",
  SK: "METADATA",
  cognitoSub: "us-east-1:abc-123-def",
  email: "user@example.com",
  name: "John Doe",
  role: "operator",
  operatorId: 10,
  permissions: ["sales:read", "sales:write", "buyers:read"],
  status: "active",
  createdAt: "2024-01-01T00:00:00Z",
  lastLogin: "2024-03-15T10:30:00Z"
}
```

### Alternative: Single Table Design (Advanced)

**Table: `i2speedex`**

All entities in one table with intelligent key design:

```javascript
// Sale
{
  PK: "SALE#2001",
  SK: "METADATA",
  EntityType: "Sale",
  // ... sale attributes
}

// Sale Lines (child items)
{
  PK: "SALE#2001",
  SK: "LINE#001",
  EntityType: "SaleLine",
  // ... line attributes
}

// Buyer
{
  PK: "BUYER#5",
  SK: "METADATA",
  EntityType: "Buyer",
  // ... buyer attributes
}

// Sales by Buyer (GSI access pattern)
{
  PK: "SALE#2001",
  SK: "METADATA",
  GSI1PK: "BUYER#5",
  GSI1SK: "SALE#2024-03-15#2001"
}
```

**Pros:**
- Fewer tables to manage
- Transactions can span multiple entity types
- Reduced costs (fewer tables)

**Cons:**
- More complex queries
- Harder to understand and maintain
- Mixing hot and cold data

**Recommendation**: Start with **Multi-Table Design** for clarity, migrate to single table if cost becomes an issue.

### DynamoDB Capacity Planning

**On-Demand vs Provisioned:**

| Mode | Best For | Pricing |
|------|----------|---------|
| **On-Demand** | Unpredictable traffic, new apps | $1.25 per million write requests, $0.25 per million read requests |
| **Provisioned** | Predictable traffic, cost optimization | $0.00065 per WCU/hour, $0.00013 per RCU/hour |

**Recommendation**: Start with **On-Demand**, switch to **Provisioned** after traffic patterns stabilize.

**Estimated Costs (100 sales/day, 5,000 reads/day):**
- On-Demand: ~$30-50/month
- Provisioned: ~$20-30/month (with auto-scaling)

### DynamoDB Access Patterns

| Use Case | Table | Index | Query |
|----------|-------|-------|-------|
| Get sale by ID | Sales | Primary | GetItem(PK=SALE#id) |
| Get all sale lines | SaleLines | Primary | Query(PK=SALE#id, SK begins_with LINE#) |
| Get sales by buyer | Sales | GSI1 | Query(GSI1PK=BUYER#id) |
| Get sales by producer | Sales | GSI2 | Query(GSI2PK=PRODUCER#id) |
| Get sales by status | Sales | GSI3 | Query(GSI3PK=STATUS#status) |
| Get sales by date range | Sales | GSI4 | Query(GSI4PK=YEAR#yyyy, SK between dates) |
| Get buyer by code | Buyers | GSI1 | Query(GSI1PK=BUYER_CODE#code) |
| List active buyers | Buyers | GSI2 | Query(GSI2PK=BUYER_STATUS#online) |

### Full-Text Search: AWS OpenSearch

For searching sale descriptions, notes, and product codes, integrate **AWS OpenSearch Service**:

**Architecture:**
```
DynamoDB Stream → Lambda → OpenSearch
                           ↓
                  Search API → Results
```

**Pros:**
- Full-text search with relevance scoring
- Faceted search and filters
- Aggregations and analytics

**Cons:**
- Additional cost (~$50-200/month for small cluster)
- Operational overhead

**Alternative**: Use DynamoDB with `contains` queries (limited) or client-side filtering.

---

## Frontend Architecture

### Nuxt 4 Application Structure

```
/app
├── /assets
│   ├── /css
│   │   └── main.css (UnoCSS entry)
│   └── /images
├── /components
│   ├── /common
│   │   ├── AppHeader.vue
│   │   ├── AppSidebar.vue
│   │   ├── AppFooter.vue
│   │   ├── DataTable.vue
│   │   ├── SearchBar.vue
│   │   ├── Pagination.vue
│   │   └── StatusBadge.vue
│   ├── /sales
│   │   ├── SalesList.vue
│   │   ├── SalesSearch.vue
│   │   ├── SaleForm.vue
│   │   ├── SaleLineItem.vue
│   │   ├── SaleLineEditor.vue
│   │   ├── SaleStatusBadge.vue
│   │   └── SaleDocuments.vue
│   ├── /buyers
│   │   ├── BuyersList.vue
│   │   ├── BuyerForm.vue
│   │   └── BuyerCard.vue
│   ├── /producers
│   │   ├── ProducersList.vue
│   │   ├── ProducerForm.vue
│   │   └── ProducerCard.vue
│   └── /dashboard
│       ├── DashboardWidget.vue
│       ├── SalesChart.vue
│       ├── RecentActivity.vue
│       ├── QuickStats.vue
│       └── StatusDistribution.vue
├── /composables
│   ├── useAuth.ts
│   ├── useSales.ts
│   ├── useBuyers.ts
│   ├── useProducers.ts
│   ├── useNotifications.ts
│   ├── useCalculations.ts
│   └── useFormatters.ts
├── /layouts
│   ├── default.vue (main layout with sidebar)
│   ├── auth.vue (login/register layout)
│   └── print.vue (print-friendly layout)
├── /middleware
│   ├── auth.ts (route protection)
│   └── permissions.ts (role-based access)
├── /pages
│   ├── index.vue (dashboard)
│   ├── login.vue
│   ├── /sales
│   │   ├── index.vue (sales list)
│   │   ├── [id].vue (sale detail)
│   │   ├── new.vue (create sale)
│   │   └── reports.vue
│   ├── /buyers
│   │   ├── index.vue
│   │   ├── [id].vue
│   │   └── new.vue
│   └── /producers
│       ├── index.vue
│       ├── [id].vue
│       └── new.vue
├── /plugins
│   ├── api.ts (Axios/fetch configuration)
│   ├── cognito.ts (AWS Amplify)
│   └── toast.ts (notifications)
├── /server
│   └── /api (Nuxt API routes - optional, mostly use Lambda)
├── /stores
│   ├── auth.ts (Pinia store)
│   ├── sales.ts
│   ├── buyers.ts
│   └── ui.ts
├── /types
│   ├── sale.ts
│   ├── buyer.ts
│   └── producer.ts
├── /utils
│   ├── validators.ts
│   ├── formatters.ts
│   ├── calculations.ts
│   └── constants.ts
├── app.vue
├── nuxt.config.ts
├── uno.config.ts
└── tsconfig.json
```

### Key Frontend Features

#### 1. Dashboard Page (`/pages/index.vue`)

```vue
<template>
  <div class="dashboard-container">
    <!-- Header -->
    <DashboardHeader :user="authStore.user" />

    <!-- Quick Stats -->
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      <QuickStats
        title="Active Invoices"
        :value="dashboardData.activeInvoices"
        icon="i-heroicons-document-text"
        color="blue"
      />
      <QuickStats
        title="Pending Payment"
        :value="formatCurrency(dashboardData.pendingPayment)"
        icon="i-heroicons-currency-euro"
        color="yellow"
      />
      <QuickStats
        title="This Month Sales"
        :value="dashboardData.monthSales"
        icon="i-heroicons-chart-bar"
        color="green"
      />
      <QuickStats
        title="Overdue Invoices"
        :value="dashboardData.overdueInvoices"
        icon="i-heroicons-exclamation-triangle"
        color="red"
      />
    </div>

    <!-- Charts Row -->
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
      <DashboardWidget title="Sales Trend (Last 6 Months)">
        <SalesChart :data="dashboardData.salesTrend" />
      </DashboardWidget>

      <DashboardWidget title="Status Distribution">
        <StatusDistribution :data="dashboardData.statusDistribution" />
      </DashboardWidget>
    </div>

    <!-- Recent Activity -->
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div class="lg:col-span-2">
        <DashboardWidget title="Recent Invoices">
          <RecentSalesTable :sales="dashboardData.recentSales" />
        </DashboardWidget>
      </div>

      <div>
        <DashboardWidget title="Recent Activity">
          <RecentActivity :activities="dashboardData.recentActivities" />
        </DashboardWidget>
      </div>
    </div>

    <!-- Quick Actions -->
    <div class="fixed bottom-6 right-6">
      <button
        class="btn-fab bg-blue-600 text-white shadow-lg"
        @click="createNewSale"
      >
        <i class="i-heroicons-plus" />
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
const authStore = useAuthStore()
const { data: dashboardData } = await useFetch('/api/dashboard')

const createNewSale = () => navigateTo('/sales/new')
</script>
```

#### 2. Sales List with Search (`/pages/sales/index.vue`)

**Features:**
- Real-time search and filters
- Infinite scroll or pagination
- Column sorting
- Bulk actions
- Export to Excel

```vue
<template>
  <div class="sales-page">
    <!-- Search Bar -->
    <SalesSearch
      v-model:filters="filters"
      @search="handleSearch"
      @reset="handleReset"
    />

    <!-- Data Table -->
    <DataTable
      :data="salesList"
      :columns="columns"
      :loading="loading"
      @row-click="viewSale"
      @sort="handleSort"
    >
      <template #status="{ row }">
        <StatusBadge :status="row.status" />
      </template>

      <template #actions="{ row }">
        <button @click.stop="downloadPDF(row.id)">
          <i class="i-heroicons-arrow-down-tray" />
        </button>
        <button @click.stop="deleteSale(row.id)">
          <i class="i-heroicons-trash" />
        </button>
      </template>
    </DataTable>

    <!-- Pagination -->
    <Pagination
      v-model:page="currentPage"
      :total="totalItems"
      :per-page="perPage"
    />
  </div>
</template>

<script setup lang="ts">
const salesStore = useSalesStore()
const { filters, salesList, loading } = storeToRefs(salesStore)

const handleSearch = () => salesStore.searchSales(filters.value)
const viewSale = (sale: Sale) => navigateTo(`/sales/${sale.id}`)
</script>
```

#### 3. Sale Detail/Edit Page (`/pages/sales/[id].vue`)

**Features:**
- Auto-save drafts (debounced)
- Real-time calculations
- Drag-and-drop file upload
- Inline line item editing
- PDF preview
- Status workflow buttons

```vue
<template>
  <div class="sale-detail">
    <form @submit.prevent="saveSale">
      <!-- Header with Actions -->
      <div class="flex justify-between items-center mb-6">
        <h1>Invoice #{{ sale.number }}/{{ sale.year }}</h1>

        <div class="flex gap-2">
          <button
            v-if="canGeneratePDF"
            type="button"
            @click="generatePDF"
          >
            Generate PDF
          </button>
          <button
            v-if="canGenerateXML"
            type="button"
            @click="generateSDI"
          >
            Generate SDI
          </button>
          <button type="submit" :disabled="!isValid">
            Save
          </button>
        </div>
      </div>

      <!-- Sale Form -->
      <SaleForm v-model="sale" />

      <!-- Line Items Editor -->
      <SaleLineEditor
        v-model="sale.lines"
        @calculate="recalculateTotals"
      />

      <!-- Totals Display -->
      <div class="totals-card">
        <div class="total-row">
          <span>Subtotal:</span>
          <span>{{ formatCurrency(totals.subtotal) }}</span>
        </div>
        <div class="total-row">
          <span>VAT ({{ sale.vatPerc }}%):</span>
          <span>{{ formatCurrency(totals.vat) }}</span>
        </div>
        <div class="total-row font-bold">
          <span>Total:</span>
          <span>{{ formatCurrency(totals.total) }}</span>
        </div>
      </div>

      <!-- Documents Section -->
      <SaleDocuments :sale-id="sale.id" />

      <!-- Attachments -->
      <FileUpload
        v-model="sale.attachments"
        accept=".pdf,.jpg,.png"
        multiple
      />
    </form>
  </div>
</template>

<script setup lang="ts">
const route = useRoute()
const saleId = computed(() => route.params.id as string)

const { sale, loading } = useSale(saleId)
const { totals, recalculateTotals } = useCalculations(sale)
const { saveSale } = useSales()

// Auto-save draft
const { pause, resume } = useIntervalFn(() => {
  saveSale(sale.value, { draft: true })
}, 30000) // every 30 seconds

watch(() => sale.value, () => {
  recalculateTotals()
}, { deep: true })
</script>
```

### UnoCSS Configuration

```typescript
// uno.config.ts
import {
  defineConfig,
  presetAttributify,
  presetIcons,
  presetTypography,
  presetUno,
  presetWebFonts,
  transformerDirectives,
  transformerVariantGroup
} from 'unocss'

export default defineConfig({
  shortcuts: {
    'btn': 'px-4 py-2 rounded-lg font-semibold transition-colors',
    'btn-primary': 'btn bg-blue-600 text-white hover:bg-blue-700',
    'btn-secondary': 'btn bg-gray-600 text-white hover:bg-gray-700',
    'btn-fab': 'w-14 h-14 rounded-full flex items-center justify-center',
    'card': 'bg-white rounded-lg shadow-md p-6',
    'input': 'px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500',
  },
  presets: [
    presetUno(),
    presetAttributify(),
    presetIcons({
      scale: 1.2,
      cdn: 'https://esm.sh/'
    }),
    presetTypography(),
    presetWebFonts({
      fonts: {
        sans: 'Inter:400,500,600,700',
        mono: 'Fira Code'
      }
    })
  ],
  transformers: [
    transformerDirectives(),
    transformerVariantGroup()
  ]
})
```

### Responsive Design Strategy

**Breakpoints:**
```css
sm: 640px   /* Mobile landscape */
md: 768px   /* Tablet */
lg: 1024px  /* Desktop */
xl: 1280px  /* Large desktop */
2xl: 1536px /* Extra large */
```

**Mobile-First Approach:**
```vue
<!-- Stack on mobile, grid on desktop -->
<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
  <!-- Cards -->
</div>

<!-- Full width on mobile, sidebar on desktop -->
<div class="flex flex-col lg:flex-row">
  <aside class="w-full lg:w-64">Sidebar</aside>
  <main class="flex-1">Content</main>
</div>
```

**Mobile Optimizations:**
- Touch-friendly button sizes (min 44x44px)
- Swipe gestures for navigation
- Bottom navigation bar on mobile
- Pull-to-refresh
- Offline support with service workers

---

## Backend Architecture

### Lambda Functions Structure

```
/backend
├── /functions
│   ├── /auth
│   │   ├── login.ts
│   │   ├── register.ts
│   │   └── refresh-token.ts
│   ├── /sales
│   │   ├── list-sales.ts
│   │   ├── get-sale.ts
│   │   ├── create-sale.ts
│   │   ├── update-sale.ts
│   │   ├── delete-sale.ts
│   │   ├── generate-pdf.ts
│   │   ├── generate-sdi.ts
│   │   └── sales-report.ts
│   ├── /sale-lines
│   │   ├── get-lines.ts
│   │   └── batch-update-lines.ts
│   ├── /buyers
│   │   ├── list-buyers.ts
│   │   ├── get-buyer.ts
│   │   ├── create-buyer.ts
│   │   ├── update-buyer.ts
│   │   └── delete-buyer.ts
│   ├── /producers
│   │   ├── list-producers.ts
│   │   ├── get-producer.ts
│   │   ├── create-producer.ts
│   │   ├── update-producer.ts
│   │   └── delete-producer.ts
│   ├── /dashboard
│   │   └── get-dashboard-data.ts
│   └── /utils
│       ├── authorizer.ts
│       └── error-handler.ts
├── /layers
│   ├── /shared
│   │   ├── db-client.ts (DynamoDB client)
│   │   ├── s3-client.ts
│   │   ├── ses-client.ts
│   │   ├── validators.ts
│   │   └── formatters.ts
│   └── /chromium (Puppeteer layer)
├── /lib
│   ├── /models
│   │   ├── Sale.ts
│   │   ├── SaleLine.ts
│   │   ├── Buyer.ts
│   │   └── Producer.ts
│   └── /services
│       ├── SalesService.ts
│       ├── BuyersService.ts
│       ├── ProducersService.ts
│       ├── PDFService.ts
│       └── SDIService.ts
├── /templates
│   ├── /email
│   │   └── invoice-sent.html
│   └── /pdf
│       ├── invoice-template.html
│       └── styles.css
├── package.json
├── tsconfig.json
└── serverless.yml (or CDK app)
```

### Example Lambda Function

**list-sales.ts:**
```typescript
import { APIGatewayProxyHandler } from 'aws-lambda'
import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient, QueryCommand } from '@aws-sdk/lib-dynamodb'
import { errorHandler } from '../utils/error-handler'
import { validateSalesQuery } from '../utils/validators'

const client = new DynamoDBClient({})
const docClient = DynamoDBDocumentClient.from(client)

export const handler: APIGatewayProxyHandler = async (event) => {
  try {
    // Parse query parameters
    const {
      buyerId,
      producerId,
      status,
      startDate,
      endDate,
      limit = 100,
      lastKey
    } = event.queryStringParameters || {}

    // Validate
    validateSalesQuery({ buyerId, producerId, status, startDate, endDate })

    // Get user from authorizer context
    const user = event.requestContext.authorizer?.claims

    // Build query based on filters
    let query: QueryCommandInput

    if (buyerId) {
      // Query GSI1 for buyer
      query = {
        TableName: process.env.SALES_TABLE_NAME,
        IndexName: 'GSI1',
        KeyConditionExpression: 'GSI1PK = :pk',
        ExpressionAttributeValues: {
          ':pk': `BUYER#${buyerId}`
        },
        Limit: Number(limit),
        ExclusiveStartKey: lastKey ? JSON.parse(lastKey) : undefined
      }
    } else if (status) {
      // Query GSI3 for status
      query = {
        TableName: process.env.SALES_TABLE_NAME,
        IndexName: 'GSI3',
        KeyConditionExpression: 'GSI3PK = :pk',
        ExpressionAttributeValues: {
          ':pk': `STATUS#${status}`
        },
        Limit: Number(limit)
      }
    } else {
      // Scan table (not recommended for production)
      // Consider using Scan only with filters or implement pagination
      query = {
        TableName: process.env.SALES_TABLE_NAME,
        FilterExpression: 'SK = :sk',
        ExpressionAttributeValues: {
          ':sk': 'METADATA'
        },
        Limit: Number(limit)
      }
    }

    // Apply additional filters
    if (startDate || endDate) {
      // Add filter expression for date range
      const filterExpressions = []
      const expressionValues = { ...query.ExpressionAttributeValues }

      if (startDate) {
        filterExpressions.push('regDate >= :startDate')
        expressionValues[':startDate'] = startDate
      }
      if (endDate) {
        filterExpressions.push('regDate <= :endDate')
        expressionValues[':endDate'] = endDate
      }

      query.FilterExpression = query.FilterExpression
        ? `${query.FilterExpression} AND ${filterExpressions.join(' AND ')}`
        : filterExpressions.join(' AND ')
      query.ExpressionAttributeValues = expressionValues
    }

    // Execute query
    const result = await docClient.send(new QueryCommand(query))

    // Calculate summary
    const summary = {
      count: result.Items?.length || 0,
      totalAmount: result.Items?.reduce((sum, item) => sum + item.eurAmount, 0) || 0,
      totalVat: result.Items?.reduce((sum, item) => sum + item.vat, 0) || 0
    }

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        sales: result.Items,
        summary,
        lastKey: result.LastEvaluatedKey
          ? JSON.stringify(result.LastEvaluatedKey)
          : null
      })
    }
  } catch (error) {
    return errorHandler(error)
  }
}
```

### API Gateway Configuration

**Serverless Framework (serverless.yml):**
```yaml
service: i2speedex-api

provider:
  name: aws
  runtime: nodejs20.x
  region: eu-west-1
  stage: ${opt:stage, 'dev'}
  environment:
    SALES_TABLE_NAME: ${self:custom.tableName}
    COGNITO_USER_POOL_ID: ${self:custom.cognitoUserPoolId}
    S3_BUCKET: ${self:custom.s3Bucket}
  iam:
    role:
      statements:
        - Effect: Allow
          Action:
            - dynamodb:Query
            - dynamodb:Scan
            - dynamodb:GetItem
            - dynamodb:PutItem
            - dynamodb:UpdateItem
            - dynamodb:DeleteItem
          Resource:
            - arn:aws:dynamodb:${self:provider.region}:*:table/${self:custom.tableName}
            - arn:aws:dynamodb:${self:provider.region}:*:table/${self:custom.tableName}/index/*

functions:
  listSales:
    handler: functions/sales/list-sales.handler
    events:
      - http:
          path: /sales
          method: get
          cors: true
          authorizer:
            type: COGNITO_USER_POOLS
            authorizerId:
              Ref: ApiGatewayAuthorizer

  getSale:
    handler: functions/sales/get-sale.handler
    events:
      - http:
          path: /sales/{id}
          method: get
          cors: true
          authorizer:
            type: COGNITO_USER_POOLS

  createSale:
    handler: functions/sales/create-sale.handler
    events:
      - http:
          path: /sales
          method: post
          cors: true
          authorizer:
            type: COGNITO_USER_POOLS

  generatePDF:
    handler: functions/sales/generate-pdf.handler
    timeout: 30
    memorySize: 2048
    layers:
      - arn:aws:lambda:${self:provider.region}:764866452798:layer:chrome-aws-lambda:43
    events:
      - http:
          path: /sales/{id}/pdf
          method: post
          cors: true
          authorizer:
            type: COGNITO_USER_POOLS

resources:
  Resources:
    ApiGatewayAuthorizer:
      Type: AWS::ApiGateway::Authorizer
      Properties:
        Name: CognitoAuthorizer
        Type: COGNITO_USER_POOLS
        IdentitySource: method.request.header.Authorization
        RestApiId:
          Ref: ApiGatewayRestApi
        ProviderARNs:
          - ${self:custom.cognitoUserPoolArn}
```

---

## PDF Generation Strategy

### Recommended Solution: Puppeteer with Lambda

**Architecture:**
```
User Request → API Gateway → Lambda (Puppeteer)
                                ↓
                        Generate HTML from Template
                                ↓
                        Render with Chromium
                                ↓
                        Upload PDF to S3
                                ↓
                        Return CloudFront URL
```

### Implementation

**generate-pdf.ts:**
```typescript
import chromium from '@sparticuz/chromium'
import puppeteer from 'puppeteer-core'
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import { renderTemplate } from './template-renderer'

const s3Client = new S3Client({})

export const handler = async (event) => {
  const saleId = event.pathParameters.id

  // Get sale data from DynamoDB
  const sale = await getSaleById(saleId)

  // Render HTML template
  const html = await renderTemplate('invoice', {
    sale,
    buyer: sale.buyer,
    producer: sale.producer,
    lines: sale.lines
  })

  // Launch Puppeteer
  const browser = await puppeteer.launch({
    args: chromium.args,
    defaultViewport: chromium.defaultViewport,
    executablePath: await chromium.executablePath(),
    headless: chromium.headless
  })

  const page = await browser.newPage()
  await page.setContent(html, { waitUntil: 'networkidle0' })

  // Generate PDF
  const pdfBuffer = await page.pdf({
    format: 'A4',
    printBackground: true,
    margin: {
      top: '20mm',
      right: '15mm',
      bottom: '20mm',
      left: '15mm'
    }
  })

  await browser.close()

  // Upload to S3
  const key = `pdfs/sales/sale_${saleId}.pdf`
  await s3Client.send(new PutObjectCommand({
    Bucket: process.env.S3_BUCKET,
    Key: key,
    Body: pdfBuffer,
    ContentType: 'application/pdf',
    CacheControl: 'max-age=31536000'
  }))

  // Return CloudFront URL
  const pdfUrl = `https://${process.env.CLOUDFRONT_DOMAIN}/${key}`

  return {
    statusCode: 200,
    body: JSON.stringify({
      pdfUrl,
      message: 'PDF generated successfully'
    })
  }
}
```

### HTML Template for Invoice

**invoice-template.html:**
```html
<!DOCTYPE html>
<html lang="{{lang}}">
<head>
  <meta charset="UTF-8">
  <title>Invoice {{number}}/{{year}}</title>
  <style>
    @page {
      size: A4;
      margin: 20mm 15mm;
    }

    body {
      font-family: 'Arial', sans-serif;
      font-size: {{fontBase}}pt;
      color: #333;
    }

    .header {
      display: flex;
      justify-content: space-between;
      margin-bottom: 30px;
      border-bottom: 2px solid #0066cc;
      padding-bottom: 20px;
    }

    .company-info {
      flex: 1;
    }

    .invoice-info {
      text-align: right;
    }

    .invoice-number {
      font-size: 24pt;
      font-weight: bold;
      color: #0066cc;
    }

    .addresses {
      display: flex;
      justify-content: space-between;
      margin-bottom: 30px;
    }

    .address-block {
      width: 45%;
    }

    .address-block h3 {
      font-size: 12pt;
      color: #666;
      margin-bottom: 10px;
      text-transform: uppercase;
    }

    .line-items table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 30px;
    }

    .line-items th {
      background-color: #f5f5f5;
      padding: 10px;
      text-align: left;
      border-bottom: 2px solid #ddd;
    }

    .line-items td {
      padding: 10px;
      border-bottom: 1px solid #eee;
    }

    .totals {
      float: right;
      width: 300px;
    }

    .totals table {
      width: 100%;
    }

    .totals td {
      padding: 5px 10px;
    }

    .totals .grand-total {
      font-size: 14pt;
      font-weight: bold;
      border-top: 2px solid #333;
    }

    .footer {
      margin-top: 50px;
      padding-top: 20px;
      border-top: 1px solid #ddd;
      font-size: 9pt;
      color: #666;
    }
  </style>
</head>
<body>
  <!-- Header -->
  <div class="header">
    <div class="company-info">
      <img src="{{producerLogo}}" alt="Logo" height="60">
      <h1>{{producerName}}</h1>
      <p>{{producerAddress}}</p>
      <p>VAT: {{producerVat}}</p>
    </div>
    <div class="invoice-info">
      <div class="invoice-number">{{documentType}} {{number}}/{{year}}</div>
      <p><strong>Date:</strong> {{regDate}}</p>
      {{#if poNumber}}
      <p><strong>PO:</strong> {{poNumber}}</p>
      {{/if}}
    </div>
  </div>

  <!-- Addresses -->
  <div class="addresses">
    <div class="address-block">
      <h3>Bill To:</h3>
      <p><strong>{{buyerName}}</strong></p>
      <p>{{buyerAddress}}</p>
      <p>{{buyerZip}} {{buyerCity}}, {{buyerCountry}}</p>
      <p>VAT: {{buyerVat}}</p>
    </div>
    <div class="address-block">
      <h3>Ship To:</h3>
      <p>{{shippingAddress}}</p>
    </div>
  </div>

  <!-- Line Items -->
  <div class="line-items">
    <table>
      <thead>
        <tr>
          <th>#</th>
          <th>Description</th>
          <th>Code</th>
          <th class="right">Qty</th>
          <th class="right">Price</th>
          <th class="right">Discount</th>
          <th class="right">VAT%</th>
          <th class="right">Total</th>
        </tr>
      </thead>
      <tbody>
        {{#each lines}}
        <tr>
          <td>{{pos}}</td>
          <td>{{description}}</td>
          <td>{{code}}</td>
          <td class="right">{{qty}}</td>
          <td class="right">{{formatCurrency price}}</td>
          <td class="right">{{discount}}%</td>
          <td class="right">{{vat}}%</td>
          <td class="right">{{formatCurrency lineTotal}}</td>
        </tr>
        {{/each}}
      </tbody>
    </table>
  </div>

  <!-- Totals -->
  <div class="totals">
    <table>
      <tr>
        <td>Subtotal:</td>
        <td class="right">{{formatCurrency amount}}</td>
      </tr>
      {{#if vat}}
      <tr>
        <td>VAT ({{vatPerc}}%):</td>
        <td class="right">{{formatCurrency vat}}</td>
      </tr>
      {{/if}}
      {{#if tax}}
      <tr>
        <td>Tax:</td>
        <td class="right">{{formatCurrency tax}}</td>
      </tr>
      {{/if}}
      <tr class="grand-total">
        <td>Total:</td>
        <td class="right">{{formatCurrency payLoad}}</td>
      </tr>
    </table>
  </div>

  <div style="clear: both;"></div>

  <!-- Payment Terms -->
  {{#if payment}}
  <div class="payment-info">
    <h3>Payment Terms:</h3>
    <p>{{payment}}</p>
    {{#if bankInfo}}
    <p>Bank: {{bankInfo}}</p>
    <p>IBAN: {{bankIban}}</p>
    {{/if}}
  </div>
  {{/if}}

  <!-- Notes -->
  {{#if saleNote}}
  <div class="notes">
    <h3>Notes:</h3>
    <p>{{saleNote}}</p>
  </div>
  {{/if}}

  <!-- Footer -->
  <div class="footer">
    <p>{{producerName}} - {{producerAddress}} - VAT: {{producerVat}}</p>
    <p>Tel: {{producerTel}} - Email: {{producerEmail}}</p>
  </div>
</body>
</html>
```

### Template Rendering Engine

Use **Handlebars** or **EJS** for template rendering:

```typescript
import Handlebars from 'handlebars'
import { readFileSync } from 'fs'
import { join } from 'path'

// Register helpers
Handlebars.registerHelper('formatCurrency', (value: number) => {
  return new Intl.NumberFormat('it-IT', {
    style: 'currency',
    currency: 'EUR'
  }).format(value)
})

Handlebars.registerHelper('formatDate', (date: string) => {
  return new Date(date).toLocaleDateString('it-IT')
})

export async function renderTemplate(
  templateName: string,
  data: any
): Promise<string> {
  const templatePath = join(__dirname, '../templates/pdf', `${templateName}.html`)
  const templateSource = readFileSync(templatePath, 'utf-8')
  const template = Handlebars.compile(templateSource)
  return template(data)
}
```

### Performance Optimization

**Lambda Configuration:**
- Memory: 2048 MB (more memory = faster CPU)
- Timeout: 30 seconds
- Provisioned Concurrency: Consider for production to avoid cold starts

**Caching Strategy:**
- Cache generated PDFs in S3
- Use ETag/Last-Modified headers
- CloudFront caching with 1-year expiry
- Regenerate only when sale data changes

**Optimization Tips:**
1. Use Lambda layers for Chromium (reduces deployment size)
2. Reuse browser instances when possible (keep-alive)
3. Generate PDFs asynchronously (EventBridge + SQS)
4. Use Step Functions for complex workflows

---

## Authentication & Authorization

### AWS Cognito Setup

**User Pool Configuration:**
```typescript
// CDK Example
import * as cognito from 'aws-cdk-lib/aws-cognito'

const userPool = new cognito.UserPool(this, 'UserPool', {
  userPoolName: 'i2speedex-users',
  selfSignUpEnabled: false, // Admin creates users
  signInAliases: {
    email: true,
    username: false
  },
  standardAttributes: {
    email: {
      required: true,
      mutable: true
    },
    givenName: {
      required: true,
      mutable: true
    },
    familyName: {
      required: true,
      mutable: true
    }
  },
  customAttributes: {
    operatorId: new cognito.NumberAttribute({ min: 1, max: 1000 }),
    role: new cognito.StringAttribute({ minLen: 3, maxLen: 50 })
  },
  passwordPolicy: {
    minLength: 12,
    requireLowercase: true,
    requireUppercase: true,
    requireDigits: true,
    requireSymbols: true
  },
  mfa: cognito.Mfa.OPTIONAL,
  mfaSecondFactor: {
    sms: true,
    otp: true
  },
  accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
  removalPolicy: cdk.RemovalPolicy.RETAIN
})

// App Client
const userPoolClient = userPool.addClient('WebClient', {
  userPoolClientName: 'web-app',
  authFlows: {
    userPassword: true,
    userSrp: true
  },
  generateSecret: false,
  refreshTokenValidity: cdk.Duration.days(30),
  accessTokenValidity: cdk.Duration.hours(1),
  idTokenValidity: cdk.Duration.hours(1)
})
```

### User Roles and Permissions

**Role Definitions:**

| Role | Permissions | Description |
|------|-------------|-------------|
| **Admin** | Full access | System administrators |
| **Operator** | sales:*, buyers:*, producers:* | Sales operators |
| **Viewer** | sales:read, buyers:read, producers:read | Read-only access |
| **Accountant** | sales:read, reports:*, payments:* | Financial reporting |

**Permission Schema:**
```typescript
type Permission =
  | 'sales:read'
  | 'sales:write'
  | 'sales:delete'
  | 'sales:generate-pdf'
  | 'buyers:read'
  | 'buyers:write'
  | 'producers:read'
  | 'producers:write'
  | 'reports:read'
  | 'admin:*'
```

### Frontend Authentication (Nuxt + Cognito)

**Install AWS Amplify:**
```bash
npm install aws-amplify @aws-amplify/ui-vue
```

**Configure Amplify:**
```typescript
// plugins/amplify.ts
import { Amplify } from 'aws-amplify'

export default defineNuxtPlugin(() => {
  Amplify.configure({
    Auth: {
      Cognito: {
        userPoolId: useRuntimeConfig().public.cognitoUserPoolId,
        userPoolClientId: useRuntimeConfig().public.cognitoClientId,
        identityPoolId: useRuntimeConfig().public.cognitoIdentityPoolId,
        loginWith: {
          email: true
        },
        signUpVerificationMethod: 'code',
        userAttributes: {
          email: {
            required: true
          }
        },
        allowGuestAccess: false,
        passwordFormat: {
          minLength: 12,
          requireLowercase: true,
          requireUppercase: true,
          requireNumbers: true,
          requireSpecialCharacters: true
        }
      }
    }
  })
})
```

**Auth Composable:**
```typescript
// composables/useAuth.ts
import { signIn, signOut, getCurrentUser, fetchAuthSession } from 'aws-amplify/auth'

export const useAuth = () => {
  const user = useState('user', () => null)
  const token = useState('token', () => null)
  const isAuthenticated = computed(() => !!user.value)

  const login = async (email: string, password: string) => {
    try {
      const { isSignedIn } = await signIn({ username: email, password })

      if (isSignedIn) {
        const currentUser = await getCurrentUser()
        const session = await fetchAuthSession()

        user.value = currentUser
        token.value = session.tokens?.accessToken.toString()

        return { success: true }
      }
    } catch (error) {
      console.error('Login error:', error)
      return { success: false, error }
    }
  }

  const logout = async () => {
    try {
      await signOut()
      user.value = null
      token.value = null
      navigateTo('/login')
    } catch (error) {
      console.error('Logout error:', error)
    }
  }

  const checkAuth = async () => {
    try {
      const currentUser = await getCurrentUser()
      const session = await fetchAuthSession()

      user.value = currentUser
      token.value = session.tokens?.accessToken.toString()

      return true
    } catch {
      return false
    }
  }

  return {
    user: readonly(user),
    token: readonly(token),
    isAuthenticated,
    login,
    logout,
    checkAuth
  }
}
```

**Auth Middleware:**
```typescript
// middleware/auth.ts
export default defineNuxtRouteMiddleware(async (to, from) => {
  const { checkAuth } = useAuth()

  // Skip auth check for public routes
  if (to.path === '/login') {
    return
  }

  const isAuthenticated = await checkAuth()

  if (!isAuthenticated) {
    return navigateTo('/login')
  }
})
```

**Login Page:**
```vue
<!-- pages/login.vue -->
<template>
  <div class="login-container">
    <div class="login-card">
      <h1>i2speedex</h1>
      <h2>Sales Management</h2>

      <form @submit.prevent="handleLogin">
        <div class="form-group">
          <label for="email">Email</label>
          <input
            id="email"
            v-model="email"
            type="email"
            required
          />
        </div>

        <div class="form-group">
          <label for="password">Password</label>
          <input
            id="password"
            v-model="password"
            type="password"
            required
          />
        </div>

        <button type="submit" :disabled="loading">
          {{ loading ? 'Logging in...' : 'Login' }}
        </button>

        <p v-if="error" class="error">{{ error }}</p>
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
const { login } = useAuth()
const router = useRouter()

const email = ref('')
const password = ref('')
const loading = ref(false)
const error = ref('')

const handleLogin = async () => {
  loading.value = true
  error.value = ''

  const result = await login(email.value, password.value)

  if (result.success) {
    router.push('/')
  } else {
    error.value = 'Invalid email or password'
  }

  loading.value = false
}
</script>
```

### API Request with Authorization

```typescript
// composables/useAPI.ts
export const useAPI = () => {
  const { token } = useAuth()
  const config = useRuntimeConfig()

  const apiClient = $fetch.create({
    baseURL: config.public.apiBaseUrl,
    onRequest({ request, options }) {
      // Add auth header
      options.headers = {
        ...options.headers,
        Authorization: `Bearer ${token.value}`
      }
    },
    onResponseError({ response }) {
      if (response.status === 401) {
        // Token expired, redirect to login
        navigateTo('/login')
      }
    }
  })

  return {
    get: (url: string, opts?: any) => apiClient(url, { method: 'GET', ...opts }),
    post: (url: string, body?: any, opts?: any) =>
      apiClient(url, { method: 'POST', body, ...opts }),
    put: (url: string, body?: any, opts?: any) =>
      apiClient(url, { method: 'PUT', body, ...opts }),
    delete: (url: string, opts?: any) =>
      apiClient(url, { method: 'DELETE', ...opts })
  }
}
```

---

## File Storage & Management

### S3 Bucket Structure

```
i2speedex-files/
├── pdfs/
│   └── sales/
│       ├── sale_2001.pdf
│       ├── sale_2002.pdf
│       └── ...
├── sdi/
│   └── sales/
│       ├── sale_sdi_2001.xml
│       ├── sale_sdi_2002.xml
│       └── ...
├── attachments/
│   └── sales/
│       ├── 2001/
│       │   ├── file1.pdf
│       │   └── file2.jpg
│       ├── 2002/
│       └── ...
├── logos/
│   ├── producers/
│   │   ├── producer_22.png
│   │   └── ...
│   └── buyers/
└── temp/
    └── uploads/ (24-hour lifecycle policy)
```

### S3 Configuration

```typescript
// CDK Example
const bucket = new s3.Bucket(this, 'FilesBucket', {
  bucketName: 'i2speedex-files',
  versioned: true,
  encryption: s3.BucketEncryption.S3_MANAGED,
  blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
  lifecycleRules: [
    {
      id: 'DeleteOldTemp',
      prefix: 'temp/',
      expiration: cdk.Duration.days(1)
    },
    {
      id: 'TransitionToIA',
      transitions: [
        {
          storageClass: s3.StorageClass.INFREQUENT_ACCESS,
          transitionAfter: cdk.Duration.days(90)
        },
        {
          storageClass: s3.StorageClass.GLACIER,
          transitionAfter: cdk.Duration.days(365)
        }
      ]
    }
  ],
  cors: [
    {
      allowedOrigins: ['https://app.i2speedex.com'],
      allowedMethods: [s3.HttpMethods.GET, s3.HttpMethods.PUT, s3.HttpMethods.POST],
      allowedHeaders: ['*'],
      maxAge: 3000
    }
  ]
})
```

### CloudFront Distribution

```typescript
const distribution = new cloudfront.Distribution(this, 'CDN', {
  defaultBehavior: {
    origin: new origins.S3Origin(bucket),
    viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
    cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
    allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
    compress: true
  },
  additionalBehaviors: {
    '/api/*': {
      origin: new origins.HttpOrigin(apiGateway.url),
      viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.HTTPS_ONLY,
      cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
      allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL
    }
  },
  priceClass: cloudfront.PriceClass.PRICE_CLASS_100,
  geoRestriction: cloudfront.GeoRestriction.allowlist('IT', 'EU'), // Italian/EU traffic only
  certificate: certificate,
  domainNames: ['app.i2speedex.com']
})
```

### File Upload (Frontend)

```vue
<template>
  <div class="file-upload">
    <input
      ref="fileInput"
      type="file"
      multiple
      :accept="accept"
      @change="handleFileSelect"
    />

    <div v-if="uploading" class="progress">
      <div
        class="progress-bar"
        :style="{ width: `${uploadProgress}%` }"
      />
    </div>

    <div v-if="files.length" class="file-list">
      <div
        v-for="file in files"
        :key="file.name"
        class="file-item"
      >
        <i class="i-heroicons-document" />
        <span>{{ file.name }}</span>
        <button @click="removeFile(file)">
          <i class="i-heroicons-x-mark" />
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{
  accept?: string
  maxSize?: number // MB
  maxFiles?: number
}>()

const emit = defineEmits<{
  'update:modelValue': [files: string[]]
}>()

const files = ref<File[]>([])
const uploading = ref(false)
const uploadProgress = ref(0)

const { post } = useAPI()

const handleFileSelect = async (event: Event) => {
  const input = event.target as HTMLInputElement
  const selectedFiles = Array.from(input.files || [])

  // Validate file size
  const validFiles = selectedFiles.filter(file => {
    const sizeMB = file.size / 1024 / 1024
    return sizeMB <= (props.maxSize || 10)
  })

  // Validate file count
  if (props.maxFiles && files.value.length + validFiles.length > props.maxFiles) {
    alert(`Maximum ${props.maxFiles} files allowed`)
    return
  }

  files.value.push(...validFiles)
  await uploadFiles(validFiles)
}

const uploadFiles = async (filesToUpload: File[]) => {
  uploading.value = true
  uploadProgress.value = 0

  try {
    // Get presigned URLs from backend
    const { uploadUrls } = await post('/files/presigned-urls', {
      files: filesToUpload.map(f => ({
        name: f.name,
        type: f.type,
        size: f.size
      }))
    })

    // Upload files directly to S3
    const uploads = filesToUpload.map(async (file, index) => {
      const url = uploadUrls[index]

      await fetch(url, {
        method: 'PUT',
        body: file,
        headers: {
          'Content-Type': file.type
        }
      })

      uploadProgress.value = ((index + 1) / filesToUpload.length) * 100
    })

    await Promise.all(uploads)

    // Emit uploaded file keys
    const fileKeys = uploadUrls.map(url => new URL(url).pathname)
    emit('update:modelValue', fileKeys)
  } catch (error) {
    console.error('Upload error:', error)
  } finally {
    uploading.value = false
  }
}
</script>
```

### Presigned URL Generation (Lambda)

```typescript
// functions/files/presigned-urls.ts
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

const s3Client = new S3Client({})

export const handler = async (event) => {
  const { files } = JSON.parse(event.body)

  const uploadUrls = await Promise.all(
    files.map(async (file: any) => {
      const key = `temp/uploads/${Date.now()}_${file.name}`

      const command = new PutObjectCommand({
        Bucket: process.env.S3_BUCKET,
        Key: key,
        ContentType: file.type,
        ContentLength: file.size
      })

      const url = await getSignedUrl(s3Client, command, {
        expiresIn: 300 // 5 minutes
      })

      return { url, key }
    })
  )

  return {
    statusCode: 200,
    body: JSON.stringify({ uploadUrls })
  }
}
```

---

## Migration Strategy

### Phase 1: Preparation (2 weeks)

**Week 1: Infrastructure Setup**
- [ ] Create AWS account and set up billing alerts
- [ ] Set up development, staging, production environments
- [ ] Configure Cognito user pool
- [ ] Create DynamoDB tables with proper indexes
- [ ] Set up S3 buckets with lifecycle policies
- [ ] Configure CloudFront distribution
- [ ] Set up API Gateway with custom domain
- [ ] Configure CI/CD pipeline (GitHub Actions)

**Week 2: Data Modeling & Testing**
- [ ] Finalize DynamoDB schema design
- [ ] Create migration scripts (MySQL → DynamoDB)
- [ ] Test data migration with sample dataset (100 records)
- [ ] Validate data integrity and relationships
- [ ] Create backup/restore procedures
- [ ] Document migration runbook

### Phase 2: Backend Development (4 weeks)

**Week 3-4: Core API Development**
- [ ] Set up Lambda function structure
- [ ] Implement authentication/authorization
- [ ] Implement Sales CRUD operations
- [ ] Implement Sale Lines operations
- [ ] Implement Buyers CRUD operations
- [ ] Implement Producers CRUD operations
- [ ] Create reusable service layers
- [ ] Write unit tests (80%+ coverage)

**Week 5-6: Advanced Features**
- [ ] Implement PDF generation with Puppeteer
- [ ] Implement SDI XML generation
- [ ] Implement file upload/download
- [ ] Implement search and filtering
- [ ] Implement reporting endpoints
- [ ] Implement dashboard data endpoints
- [ ] Set up CloudWatch monitoring and alarms
- [ ] Performance testing and optimization

### Phase 3: Frontend Development (4 weeks)

**Week 7-8: Core UI Development**
- [ ] Set up Nuxt 4 project structure
- [ ] Configure UnoCSS and component library
- [ ] Implement authentication pages (login, forgot password)
- [ ] Implement dashboard page
- [ ] Implement Sales list page with search
- [ ] Implement Sale detail/edit page
- [ ] Implement Buyers list and detail pages
- [ ] Implement Producers list and detail pages
- [ ] Implement responsive layouts for mobile

**Week 9-10: Advanced UI & Polish**
- [ ] Implement real-time calculations
- [ ] Implement file upload components
- [ ] Implement PDF viewer/download
- [ ] Implement charts and visualizations
- [ ] Implement notifications/toasts
- [ ] Implement keyboard shortcuts
- [ ] Implement offline support (PWA)
- [ ] Accessibility audit and fixes
- [ ] Cross-browser testing
- [ ] Mobile device testing

### Phase 4: Data Migration (1 week)

**Week 11: Migration Execution**
- [ ] Create full database backup
- [ ] Run migration scripts on staging environment
- [ ] Validate migrated data (all 379 sales + lines)
- [ ] Test application with migrated data
- [ ] Identify and fix data issues
- [ ] Perform migration dry run on production
- [ ] Document any manual data corrections needed

### Phase 5: Testing & QA (2 weeks)

**Week 12: Integration Testing**
- [ ] End-to-end testing (critical workflows)
- [ ] Integration testing (API + Frontend)
- [ ] Load testing (concurrent users)
- [ ] Security testing (OWASP Top 10)
- [ ] PDF generation testing (all invoice types)
- [ ] SDI XML validation testing
- [ ] Cross-browser compatibility testing
- [ ] Mobile responsiveness testing

**Week 13: User Acceptance Testing**
- [ ] Create test scenarios for users
- [ ] Train users on new interface
- [ ] Collect user feedback
- [ ] Fix critical bugs
- [ ] Performance tuning based on feedback
- [ ] Update documentation
- [ ] Create user guide and training materials

### Phase 6: Deployment (1 week)

**Week 14: Production Deployment**
- [ ] Final code review and approval
- [ ] Deploy backend to production
- [ ] Deploy frontend to production
- [ ] Smoke testing in production
- [ ] Monitor error rates and performance
- [ ] Enable CloudWatch alarms
- [ ] Set up on-call rotation
- [ ] Communicate launch to stakeholders

### Phase 7: Hypercare (2 weeks)

**Week 15-16: Post-Launch Support**
- [ ] Monitor application 24/7
- [ ] Respond to user issues within 4 hours
- [ ] Fix high-priority bugs
- [ ] Collect user feedback
- [ ] Optimize based on real usage patterns
- [ ] Adjust AWS resources as needed
- [ ] Document lessons learned

### Data Migration Approach

**Strategy: Dual-Write Pattern (Recommended)**

1. **Initial Sync**: Migrate all historical data (read-only)
2. **Dual Write**: New writes go to both MySQL and DynamoDB
3. **Validation**: Compare data between systems
4. **Cutover**: Switch reads to DynamoDB
5. **Decommission**: Retire MySQL after 30-day safety period

**Migration Script Example:**

```typescript
// scripts/migrate-data.ts
import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient, BatchWriteCommand } from '@aws-sdk/lib-dynamodb'
import mysql from 'mysql2/promise'

const mysqlConnection = await mysql.createConnection({
  host: 'rdss2.speedex.it',
  user: 'i2',
  password: 'gMIagisJQ0oTxTHB',
  database: 'i2_speedex'
})

const dynamoClient = DynamoDBDocumentClient.from(new DynamoDBClient({}))

async function migrateSales() {
  console.log('Starting sales migration...')

  // Get sales with related data
  const [sales] = await mysqlConnection.execute(`
    SELECT
      sales.*,
      buyers.code as buyer_code,
      buyers.name as buyer_name,
      buyers.country as buyer_country,
      producers.code as producer_code,
      producers.name as producer_name,
      producers.country as producer_country
    FROM sales
      LEFT JOIN buyers ON sales.buyer_id = buyers.id
      LEFT JOIN producers ON sales.producer_id = producers.id
    WHERE NOT (sales.status IN ('proforma', 'deleted'))
    ORDER BY sales.id
  `)

  // Process in batches of 25 (DynamoDB limit)
  const batchSize = 25
  for (let i = 0; i < sales.length; i += batchSize) {
    const batch = sales.slice(i, i + batchSize)

    const putRequests = batch.map((sale: any) => ({
      PutRequest: {
        Item: {
          PK: `SALE#${sale.id}`,
          SK: 'METADATA',
          id: sale.id,
          number: sale.number,
          year: sale.year,
          status: sale.status,
          // ... map all fields
          buyerId: sale.buyer_id,
          buyerCode: sale.buyer_code,
          buyerName: sale.buyer_name,
          buyerCountry: sale.buyer_country,
          producerId: sale.producer_id,
          producerCode: sale.producer_code,
          producerName: sale.producer_name,
          producerCountry: sale.producer_country,
          // GSI keys
          GSI1PK: sale.buyer_id ? `BUYER#${sale.buyer_id}` : null,
          GSI1SK: `SALE#${formatDate(sale.reg_date)}#${sale.id}`,
          GSI2PK: sale.producer_id ? `PRODUCER#${sale.producer_id}` : null,
          GSI2SK: `SALE#${formatDate(sale.reg_date)}#${sale.id}`,
          GSI3PK: `STATUS#${sale.status}`,
          GSI3SK: `SALE#${formatDate(sale.reg_date)}#${sale.id}`,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
      }
    }))

    await dynamoClient.send(new BatchWriteCommand({
      RequestItems: {
        [process.env.SALES_TABLE_NAME!]: putRequests
      }
    }))

    console.log(`Migrated ${i + batch.length}/${sales.length} sales`)
  }

  console.log('Sales migration complete!')
}

async function migrateSaleLines() {
  console.log('Starting sale lines migration...')

  const [lines] = await mysqlConnection.execute(`
    SELECT * FROM sale_lines
    WHERE sale_id IN (
      SELECT id FROM sales
      WHERE NOT (status IN ('proforma', 'deleted'))
    )
    ORDER BY sale_id, pos
  `)

  // Process in batches
  const batchSize = 25
  for (let i = 0; i < lines.length; i += batchSize) {
    const batch = lines.slice(i, i + batchSize)

    const putRequests = batch.map((line: any) => ({
      PutRequest: {
        Item: {
          PK: `SALE#${line.sale_id}`,
          SK: `LINE#${String(line.pos).padStart(3, '0')}`,
          id: line.id,
          saleId: line.sale_id,
          pos: line.pos,
          code: line.code,
          description: line.description,
          qty: line.qty,
          price: line.price,
          discount: line.discount || 0,
          vat: line.vat || 0,
          // ... map remaining fields
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
      }
    }))

    await dynamoClient.send(new BatchWriteCommand({
      RequestItems: {
        [process.env.SALE_LINES_TABLE_NAME!]: putRequests
      }
    }))

    console.log(`Migrated ${i + batch.length}/${lines.length} lines`)
  }

  console.log('Sale lines migration complete!')
}

// Run migration
async function main() {
  try {
    await migrateSales()
    await migrateSaleLines()
    await migrateBuyers()
    await migrateProducers()

    console.log('✅ All data migrated successfully!')
  } catch (error) {
    console.error('❌ Migration failed:', error)
    process.exit(1)
  } finally {
    await mysqlConnection.end()
  }
}

main()
```

### Rollback Plan

**If critical issues occur:**

1. **Immediate**: Switch CloudFront origin back to old system
2. **Within 1 hour**: Disable new Lambda functions
3. **Within 4 hours**: Restore MySQL from backup if data corruption
4. **Communication**: Notify users of temporary rollback
5. **Root Cause Analysis**: Investigate and fix issues
6. **Retry**: Schedule new migration after fixes

---

## Cost Analysis

### AWS Monthly Cost Estimates

**Small Deployment (< 100 sales/month, 5 users)**

| Service | Usage | Monthly Cost |
|---------|-------|--------------|
| Lambda | 50K requests, 512MB, 2s avg | $1-2 |
| Lambda (PDF) | 500 requests, 2GB, 10s | $3-5 |
| API Gateway | 50K requests | $0.18 |
| DynamoDB | 5GB storage, on-demand | $5-10 |
| S3 | 50GB storage, 5K requests | $2 |
| CloudFront | 50GB transfer, 100K requests | $5-8 |
| Cognito | 5 users | Free (< 50K MAU) |
| CloudWatch | Logs + metrics | $5-10 |
| **TOTAL** | | **$21-43/month** |

**Medium Deployment (500 sales/month, 20 users)**

| Service | Usage | Monthly Cost |
|---------|-------|--------------|
| Lambda | 500K requests, 512MB, 2s avg | $10-15 |
| Lambda (PDF) | 2K requests, 2GB, 10s | $10-15 |
| API Gateway | 500K requests | $1.75 |
| DynamoDB | 50GB storage, on-demand | $25-50 |
| S3 | 500GB storage, 50K requests | $15 |
| CloudFront | 500GB transfer, 1M requests | $50-70 |
| Cognito | 20 users | Free |
| CloudWatch | Logs + metrics | $20-30 |
| SES | 2K emails | $0.20 |
| **TOTAL** | | **$132-197/month** |

**Large Deployment (2000 sales/month, 50 users)**

| Service | Usage | Monthly Cost |
|---------|-------|--------------|
| Lambda | 2M requests, 512MB, 2s avg | $40-60 |
| Lambda (PDF) | 8K requests, 2GB, 10s | $40-60 |
| API Gateway | 2M requests | $7 |
| DynamoDB | 200GB storage, provisioned | $100-150 |
| S3 | 2TB storage, 200K requests | $50 |
| CloudFront | 2TB transfer, 5M requests | $200-250 |
| Cognito | 50 users | Free |
| CloudWatch | Logs + metrics | $50-80 |
| SES | 8K emails | $0.80 |
| **TOTAL** | | **$488-658/month** |

### Cost Optimization Strategies

1. **DynamoDB**:
   - Start with on-demand pricing
   - Switch to provisioned capacity when traffic predictable (30-50% savings)
   - Use DynamoDB auto-scaling

2. **Lambda**:
   - Optimize memory allocation (cost-performance balance)
   - Use provisioned concurrency only for critical functions
   - Reduce cold starts with keep-warm strategies

3. **S3**:
   - Use lifecycle policies (transition to IA after 90 days)
   - Enable intelligent tiering
   - Use CloudFront for frequently accessed files

4. **CloudWatch**:
   - Adjust log retention (7-30 days)
   - Use metric filters to reduce storage
   - Consider 3rd-party logging (Datadog, Sentry)

5. **Savings Plans**:
   - Commit to 1-year compute savings plan (20% discount)
   - Reserved capacity for predictable workloads

### Comparison: Current vs New

**Current Stack (Java/MySQL/Jetty):**
- Server: $50-100/month (VPS or EC2 t3.medium)
- Database: $30-80/month (RDS MySQL or dedicated server)
- Backups: $10-20/month
- **Total**: $90-200/month + maintenance overhead

**New Stack (AWS Serverless):**
- Small: $21-43/month
- Medium: $132-197/month
- Large: $488-658/month

**Break-Even Analysis:**
- For small deployments: **Immediate savings**
- For medium deployments: **Similar cost, better scalability**
- For large deployments: **Higher cost, but infinite scalability**

**Additional Benefits (New Stack):**
- Zero server maintenance
- Auto-scaling (no capacity planning)
- High availability (99.99% SLA)
- Global CDN (faster performance)
- Modern DevOps (faster iterations)

---

## Performance Considerations

### Expected Performance Metrics

| Metric | Current System | New System | Improvement |
|--------|---------------|------------|-------------|
| Page Load Time | 2-4s | 0.5-1.5s | **2-3x faster** |
| API Response Time | 200-500ms | 50-200ms | **2-4x faster** |
| Search Query | 1-3s | 100-300ms | **5-10x faster** |
| PDF Generation | 5-10s | 3-8s | **1.5x faster** |
| Time to First Byte | 500-1000ms | 50-150ms | **5-10x faster** |
| Concurrent Users | 10-20 | 1000+ | **50x+ capacity** |

### Performance Optimizations

**Frontend:**
1. **Code Splitting**: Route-based and component-based
2. **Lazy Loading**: Images, charts, heavy components
3. **SSR/SSG**: Static site generation for public pages
4. **Caching**: Aggressive browser caching (1 year)
5. **Image Optimization**: WebP format, responsive images
6. **Bundle Size**: < 200KB initial JS bundle

**Backend:**
1. **DynamoDB Query Optimization**: Use GSIs instead of scans
2. **Lambda Memory**: Right-size memory (more memory = faster CPU)
3. **Connection Pooling**: Reuse connections between invocations
4. **Caching**: Use CloudFront for GET requests (5-minute TTL)
5. **Batch Operations**: Use BatchGetItem/BatchWriteItem

**Database:**
1. **Single-Digit Latency**: DynamoDB provides < 10ms reads/writes
2. **Auto-Scaling**: On-demand or provisioned with auto-scaling
3. **Global Tables**: Multi-region replication (if needed)
4. **DAX**: DynamoDB Accelerator for sub-millisecond reads (if needed)

### Monitoring and Observability

**CloudWatch Dashboards:**
```typescript
// Example metrics to track
const dashboard = new cloudwatch.Dashboard(this, 'AppDashboard', {
  dashboardName: 'i2speedex-monitoring',
  widgets: [
    // API metrics
    new cloudwatch.GraphWidget({
      title: 'API Response Times',
      left: [
        new cloudwatch.Metric({
          namespace: 'AWS/ApiGateway',
          metricName: 'Latency',
          statistic: 'Average'
        })
      ]
    }),

    // Lambda metrics
    new cloudwatch.GraphWidget({
      title: 'Lambda Errors',
      left: [
        new cloudwatch.Metric({
          namespace: 'AWS/Lambda',
          metricName: 'Errors',
          statistic: 'Sum'
        })
      ]
    }),

    // DynamoDB metrics
    new cloudwatch.GraphWidget({
      title: 'DynamoDB Consumed Capacity',
      left: [
        new cloudwatch.Metric({
          namespace: 'AWS/DynamoDB',
          metricName: 'ConsumedReadCapacityUnits',
          statistic: 'Sum'
        })
      ]
    })
  ]
})
```

**Alarms:**
- API 5XX errors > 10/minute
- Lambda errors > 5/minute
- DynamoDB throttles > 0
- CloudFront 5XX errors > 1%
- P99 latency > 2 seconds

**Logging:**
- Structured JSON logs
- Correlation IDs for request tracing
- X-Ray for distributed tracing
- Error tracking with Sentry (optional)

---

## Security & Compliance

### Security Measures

**Authentication & Authorization:**
- ✅ AWS Cognito with MFA
- ✅ JWT token validation
- ✅ Role-based access control (RBAC)
- ✅ Session timeout (1 hour access token)
- ✅ Password policy enforcement

**Data Protection:**
- ✅ Encryption at rest (S3, DynamoDB)
- ✅ Encryption in transit (TLS 1.3)
- ✅ Secrets in AWS Systems Manager Parameter Store
- ✅ No secrets in code or environment variables
- ✅ Regular backups (automated)

**Network Security:**
- ✅ CloudFront with AWS WAF (Web Application Firewall)
- ✅ DDoS protection (AWS Shield Standard)
- ✅ API Gateway throttling (1000 req/sec)
- ✅ CORS configuration (whitelist domains)
- ✅ HTTPS only (redirect HTTP to HTTPS)

**Application Security:**
- ✅ Input validation (frontend + backend)
- ✅ SQL injection prevention (using DynamoDB)
- ✅ XSS prevention (Vue escaping)
- ✅ CSRF protection (SameSite cookies)
- ✅ Content Security Policy (CSP headers)

**Compliance:**
- ✅ GDPR compliance (data residency in EU)
- ✅ Italian e-invoicing (SDI) compliance
- ✅ Audit logs (CloudWatch Logs)
- ✅ Data retention policies
- ✅ Right to be forgotten (soft delete)

### GDPR Considerations

**Data Protection:**
1. **Data Residency**: Use eu-west-1 (Ireland) or eu-south-1 (Milan) region
2. **Encryption**: All data encrypted at rest and in transit
3. **Access Control**: Role-based access with audit logs
4. **Data Minimization**: Only collect necessary data
5. **Right to Access**: API endpoint to export user data
6. **Right to Erasure**: Soft delete with data anonymization
7. **Consent**: Terms of service and privacy policy acceptance

**Implementation:**
```typescript
// Example: GDPR data export
async function exportUserData(userId: string) {
  // Get all data associated with user
  const sales = await getSalesByOperator(userId)
  const activities = await getUserActivities(userId)
  const profile = await getUserProfile(userId)

  return {
    profile,
    sales,
    activities,
    exportDate: new Date().toISOString(),
    format: 'JSON'
  }
}

// Example: GDPR data deletion
async function deleteUserData(userId: string) {
  // Soft delete user
  await updateUser(userId, {
    status: 'deleted',
    email: `deleted_${Date.now()}@example.com`,
    name: '[DELETED]',
    deletedAt: new Date().toISOString()
  })

  // Anonymize sales (keep for accounting, but remove PII)
  await anonymizeSales(userId)

  // Delete sensitive logs after 90 days
  await scheduleLogDeletion(userId, 90)
}
```

---

## Dashboard & Analytics

### Dashboard Design

**Layout:**
```
┌─────────────────────────────────────────────────────────────┐
│  Header: Logo | Navigation | User Menu                       │
├─────────────────────────────────────────────────────────────┤
│  Quick Stats (4 cards)                                       │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐      │
│  │ Active   │ │ Pending  │ │ This     │ │ Overdue  │      │
│  │ Invoices │ │ Payment  │ │ Month    │ │ Invoices │      │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘      │
├─────────────────────────────────────────────────────────────┤
│  Charts (2 columns)                                          │
│  ┌─────────────────────────┐ ┌─────────────────────────┐   │
│  │ Sales Trend             │ │ Status Distribution     │   │
│  │ (Line Chart)            │ │ (Donut Chart)           │   │
│  └─────────────────────────┘ └─────────────────────────┘   │
├─────────────────────────────────────────────────────────────┤
│  Recent Activity (2 columns)                                 │
│  ┌──────────────────────────────────┐ ┌─────────────────┐  │
│  │ Recent Invoices (Table)          │ │ Activity Feed   │  │
│  │ - Latest 10 invoices              │ │ - Create        │  │
│  │ - Status badges                   │ │ - Update        │  │
│  │ - Quick actions                   │ │ - Payment       │  │
│  └──────────────────────────────────┘ └─────────────────┘  │
├─────────────────────────────────────────────────────────────┤
│  FAB: + New Invoice                                          │
└─────────────────────────────────────────────────────────────┘
```

### Dashboard Data API

**Endpoint:** `GET /api/dashboard`

**Response:**
```json
{
  "quickStats": {
    "activeInvoices": 42,
    "pendingPayment": 125000.50,
    "monthSales": 38,
    "overdueInvoices": 3
  },
  "salesTrend": [
    { "month": "2024-01", "amount": 245000, "count": 35 },
    { "month": "2024-02", "amount": 312000, "count": 42 },
    { "month": "2024-03", "amount": 298000, "count": 38 }
  ],
  "statusDistribution": [
    { "status": "sent", "count": 25, "amount": 185000 },
    { "status": "paid", "count": 12, "amount": 98000 },
    { "status": "ready", "count": 5, "amount": 42000 }
  ],
  "recentSales": [
    {
      "id": 2050,
      "number": 50,
      "year": 2024,
      "status": "sent",
      "buyerName": "Berrang SE",
      "amount": 12500,
      "regDate": "2024-03-15",
      "paymentDate": null
    }
    // ... 9 more
  ],
  "recentActivities": [
    {
      "type": "sale_created",
      "saleId": 2050,
      "user": "john@example.com",
      "timestamp": "2024-03-15T10:30:00Z"
    },
    {
      "type": "payment_received",
      "saleId": 2048,
      "amount": 8500,
      "timestamp": "2024-03-15T09:15:00Z"
    }
    // ... more
  ]
}
```

### Charts Implementation

**Sales Trend Chart (ApexCharts):**
```vue
<template>
  <apexchart
    type="line"
    :options="chartOptions"
    :series="series"
    height="300"
  />
</template>

<script setup lang="ts">
import VueApexCharts from 'vue3-apexcharts'

const props = defineProps<{
  data: Array<{ month: string; amount: number; count: number }>
}>()

const series = computed(() => [
  {
    name: 'Sales Amount',
    data: props.data.map(d => d.amount)
  },
  {
    name: 'Sales Count',
    data: props.data.map(d => d.count)
  }
])

const chartOptions = {
  chart: {
    type: 'line',
    toolbar: { show: false }
  },
  xaxis: {
    categories: props.data.map(d => {
      const date = new Date(d.month)
      return date.toLocaleDateString('it-IT', { month: 'short', year: '2-digit' })
    })
  },
  yaxis: [
    {
      title: { text: 'Amount (€)' },
      labels: {
        formatter: (val: number) => `€${val.toLocaleString()}`
      }
    },
    {
      opposite: true,
      title: { text: 'Count' }
    }
  ],
  colors: ['#0066cc', '#00cc66'],
  stroke: {
    curve: 'smooth',
    width: 3
  }
}
</script>
```

### Real-Time Updates

**Option 1: Polling (Simple)**
```typescript
// Refresh dashboard every 60 seconds
useIntervalFn(async () => {
  const data = await $fetch('/api/dashboard')
  dashboardData.value = data
}, 60000)
```

**Option 2: WebSockets (Advanced)**
```typescript
// Use AWS IoT Core or AppSync for real-time updates
const ws = new WebSocket('wss://realtime.i2speedex.com')

ws.onmessage = (event) => {
  const update = JSON.parse(event.data)

  if (update.type === 'sale_created') {
    // Update dashboard stats
    dashboardData.value.activeInvoices++
  }
}
```

---

## Mobile Experience

### Progressive Web App (PWA)

**Features:**
- ✅ Installable on mobile home screen
- ✅ Offline support with service worker
- ✅ Push notifications
- ✅ App-like experience (no browser chrome)

**Nuxt PWA Configuration:**
```typescript
// nuxt.config.ts
export default defineNuxtConfig({
  modules: ['@vite-pwa/nuxt'],

  pwa: {
    registerType: 'autoUpdate',
    manifest: {
      name: 'i2speedex Sales',
      short_name: 'i2speedex',
      description: 'Sales management application',
      theme_color: '#0066cc',
      background_color: '#ffffff',
      display: 'standalone',
      orientation: 'portrait',
      icons: [
        {
          src: '/icon-192.png',
          sizes: '192x192',
          type: 'image/png'
        },
        {
          src: '/icon-512.png',
          sizes: '512x512',
          type: 'image/png'
        }
      ]
    },
    workbox: {
      navigateFallback: '/',
      globPatterns: ['**/*.{js,css,html,png,svg,ico}'],
      runtimeCaching: [
        {
          urlPattern: /^https:\/\/api\.i2speedex\.com\/.*/,
          handler: 'NetworkFirst',
          options: {
            cacheName: 'api-cache',
            expiration: {
              maxEntries: 100,
              maxAgeSeconds: 60 * 60 // 1 hour
            }
          }
        }
      ]
    }
  }
})
```

### Mobile UI Patterns

**Bottom Navigation (Mobile):**
```vue
<template>
  <nav class="mobile-nav md:hidden">
    <NuxtLink to="/" class="nav-item">
      <i class="i-heroicons-home" />
      <span>Home</span>
    </NuxtLink>
    <NuxtLink to="/sales" class="nav-item">
      <i class="i-heroicons-document-text" />
      <span>Sales</span>
    </NuxtLink>
    <button class="nav-item nav-fab" @click="createSale">
      <i class="i-heroicons-plus" />
    </button>
    <NuxtLink to="/buyers" class="nav-item">
      <i class="i-heroicons-users" />
      <span>Buyers</span>
    </NuxtLink>
    <NuxtLink to="/profile" class="nav-item">
      <i class="i-heroicons-user-circle" />
      <span>Profile</span>
    </NuxtLink>
  </nav>
</template>

<style scoped>
.mobile-nav {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  display: flex;
  justify-content: space-around;
  background: white;
  border-top: 1px solid #e5e7eb;
  padding: 0.5rem;
  z-index: 1000;
}

.nav-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.25rem;
  color: #6b7280;
  font-size: 0.75rem;
}

.nav-fab {
  background: #0066cc;
  color: white;
  border-radius: 50%;
  width: 56px;
  height: 56px;
  margin-top: -28px;
  box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);
}
</style>
```

**Swipe Gestures:**
```typescript
// composables/useSwipe.ts
import { useSwipe as useVueUseSwipe } from '@vueuse/core'

export const useSwipe = (element: Ref<HTMLElement | null>) => {
  const { direction, lengthX, lengthY } = useVueUseSwipe(element)

  const onSwipeLeft = ref<() => void>()
  const onSwipeRight = ref<() => void>()

  watch(direction, (newDirection) => {
    if (newDirection === 'left' && lengthX.value > 50) {
      onSwipeLeft.value?.()
    } else if (newDirection === 'right' && lengthX.value > 50) {
      onSwipeRight.value?.()
    }
  })

  return {
    onSwipeLeft,
    onSwipeRight
  }
}
```

**Pull to Refresh:**
```vue
<template>
  <div ref="container" class="pull-to-refresh">
    <div v-if="pulling" class="refresh-indicator">
      <i class="i-heroicons-arrow-path animate-spin" />
    </div>
    <slot />
  </div>
</template>

<script setup lang="ts">
const emit = defineEmits<{
  refresh: []
}>()

const container = ref<HTMLElement | null>(null)
const pulling = ref(false)

let startY = 0
let currentY = 0

const handleTouchStart = (e: TouchEvent) => {
  if (window.scrollY === 0) {
    startY = e.touches[0].clientY
  }
}

const handleTouchMove = (e: TouchEvent) => {
  if (startY) {
    currentY = e.touches[0].clientY
    const diff = currentY - startY

    if (diff > 100) {
      pulling.value = true
    }
  }
}

const handleTouchEnd = async () => {
  if (pulling.value) {
    emit('refresh')
    await new Promise(resolve => setTimeout(resolve, 1000))
  }

  pulling.value = false
  startY = 0
  currentY = 0
}

onMounted(() => {
  container.value?.addEventListener('touchstart', handleTouchStart)
  container.value?.addEventListener('touchmove', handleTouchMove)
  container.value?.addEventListener('touchend', handleTouchEnd)
})
</script>
```

### Responsive Design Checklist

- ✅ Touch targets minimum 44x44px
- ✅ Font size minimum 16px (prevent zoom)
- ✅ Horizontal scrolling disabled
- ✅ Forms work well on mobile keyboards
- ✅ Dropdowns work on touch devices
- ✅ Modals/dialogs full-screen on mobile
- ✅ Tables horizontal scroll or card layout
- ✅ Navigation menu hamburger on mobile
- ✅ Bottom nav on mobile (top nav on desktop)
- ✅ Floating action button (FAB) for primary actions

---

## Risks & Mitigation

### Technical Risks

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| **DynamoDB query complexity** | Medium | High | - Prototype critical queries early<br>- Consider hybrid (RDS Aurora Serverless)<br>- Use OpenSearch for complex searches |
| **PDF generation cold starts** | High | Medium | - Provisioned concurrency for PDF Lambda<br>- Pre-warm function with CloudWatch Events<br>- Async generation (SQS queue) |
| **Data migration issues** | Medium | High | - Multiple dry runs<br>- Validate migrated data<br>- Keep MySQL as fallback for 30 days |
| **Cost overruns** | Low | Medium | - Set billing alarms<br>- Monitor costs daily during launch<br>- Implement cost optimization early |
| **Learning curve** | Medium | Low | - Team training on AWS services<br>- Pair programming<br>- Documentation and runbooks |

### Business Risks

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| **User adoption resistance** | Medium | High | - User training sessions<br>- Gradual rollout<br>- Collect feedback early<br>- Keep UI intuitive |
| **Downtime during migration** | Low | High | - Zero-downtime migration strategy<br>- Dual-write pattern<br>- Rollback plan ready |
| **Loss of historical data** | Low | Critical | - Multiple backups<br>- Validation scripts<br>- Test restores regularly |
| **Regulatory compliance issues** | Low | High | - Legal review of GDPR implementation<br>- SDI XML validation testing<br>- Audit logs |

### Security Risks

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| **Data breach** | Low | Critical | - AWS security best practices<br>- Regular security audits<br>- Penetration testing<br>- MFA enforcement |
| **DDoS attack** | Low | Medium | - AWS WAF rules<br>- Rate limiting<br>- CloudFront protection |
| **Insider threat** | Low | High | - Role-based access<br>- Audit logs<br>- Least privilege principle |

---

## Implementation Roadmap

### Timeline Visualization

```
Month 1        Month 2        Month 3        Month 4
│──────────────│──────────────│──────────────│──────────┤
│ Phase 1      │ Phase 2      │ Phase 3      │ Phase 4  │
│ Preparation  │ Backend Dev  │ Frontend Dev │ Testing  │
│              │              │              │ & Launch │
│              │              │              │          │
Week 1-2       Week 3-6       Week 7-10      Week 11-14
```

### Milestones

**M1: Infrastructure Ready (Week 2)**
- AWS environment configured
- DynamoDB tables created
- Cognito user pool set up
- CI/CD pipeline working

**M2: Backend Complete (Week 6)**
- All API endpoints implemented
- Unit tests passing (80%+ coverage)
- PDF generation working
- Deployed to staging

**M3: Frontend Complete (Week 10)**
- All pages implemented
- Responsive design complete
- E2E tests passing
- Deployed to staging

**M4: Data Migrated (Week 11)**
- All historical data in DynamoDB
- Data validation complete
- No data loss or corruption

**M5: Production Launch (Week 14)**
- Application deployed to production
- Users trained
- Monitoring active
- Launch successful

### Success Criteria

**Technical Success:**
- ✅ All 379 sales + lines migrated successfully
- ✅ Zero data loss or corruption
- ✅ API response time < 200ms (p95)
- ✅ Page load time < 1.5s
- ✅ PDF generation < 8s
- ✅ 99.9% uptime (first month)
- ✅ Zero critical bugs

**Business Success:**
- ✅ 100% user adoption within 2 weeks
- ✅ User satisfaction > 80%
- ✅ No business disruption
- ✅ Improved productivity (faster invoice creation)
- ✅ Cost within budget
- ✅ Scalability for future growth

---

## Comparison Matrix

### Current vs Proposed System

| Feature | Current System | Proposed System | Advantage |
|---------|---------------|-----------------|-----------|
| **Technology** | Java/Jetty | Node.js Lambda | Modern, serverless |
| **Database** | MySQL | DynamoDB | NoSQL, auto-scaling |
| **Frontend** | XSLT | Vue 3 + Nuxt 4 | Modern, reactive |
| **Styling** | Custom CSS | UnoCSS | Utility-first, smaller bundle |
| **Authentication** | Custom | AWS Cognito | Managed, MFA support |
| **File Storage** | Local filesystem | S3 + CloudFront | Scalable, CDN delivery |
| **PDF Generation** | Apache FOP | Puppeteer | HTML/CSS templates |
| **Deployment** | Manual | CI/CD automated | Faster, less error-prone |
| **Scaling** | Vertical (limited) | Horizontal (unlimited) | Handle any traffic |
| **Monitoring** | Basic logs | CloudWatch + X-Ray | Comprehensive observability |
| **Mobile** | Not optimized | PWA + responsive | Native app-like |
| **Development** | XML config | TypeScript code | Type safety, better DX |
| **Cost (small)** | $90-200/mo | $21-43/mo | **50-80% savings** |
| **Cost (large)** | $200-400/mo | $488-658/mo | Higher but scalable |
| **Maintenance** | High (server upkeep) | Low (managed services) | **Focus on features** |
| **Time to Market** | Slow (Java builds) | Fast (hot reload) | **3-5x faster iterations** |

---

## Conclusion

### Recommendation: **Proceed with Migration** ✅

**Rationale:**

1. **Modern Stack**: Vue 3 + Nuxt 4 provides excellent developer experience and user experience
2. **Scalability**: AWS serverless architecture can handle unlimited growth
3. **Cost-Effective**: Lower costs for small deployments, predictable scaling
4. **Performance**: 2-10x faster response times across the board
5. **Mobile-First**: PWA capabilities and responsive design
6. **Maintainability**: Managed services reduce operational overhead
7. **Security**: Enterprise-grade security with Cognito and AWS

**Next Steps:**

1. **Get Stakeholder Buy-In**: Present this evaluation to decision-makers
2. **Secure Budget**: $80K-120K development + $200-500/mo AWS costs
3. **Assemble Team**: 2-3 developers + 1 DevOps engineer
4. **Kick Off Phase 1**: Infrastructure setup and data modeling
5. **Weekly Progress Reviews**: Track against timeline and milestones

**Risk Assessment**: **Medium Risk, High Reward**

While DynamoDB migration adds complexity, the benefits far outweigh the risks. With proper planning, testing, and a rollback strategy, this migration is highly achievable.

---

## Appendix: Additional Resources

### Learning Resources

**Nuxt 4:**
- Official Docs: https://nuxt.com
- Nuxt 3 Masterclass: https://masteringnuxt.com

**AWS Serverless:**
- AWS Lambda: https://docs.aws.amazon.com/lambda
- DynamoDB: https://docs.aws.amazon.com/dynamodb
- Serverless Framework: https://www.serverless.com/framework/docs

**DynamoDB Design:**
- Alex DeBrie's DynamoDB Book: https://www.dynamodbbook.com
- AWS DynamoDB Best Practices: https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/best-practices.html

**Vue 3 + TypeScript:**
- Vue 3 Docs: https://vuejs.org
- TypeScript Handbook: https://www.typescriptlang.org/docs

### Tools and Libraries

**Development:**
- VS Code + Volar (Vue extension)
- AWS Toolkit for VS Code
- DynamoDB Local (for local development)
- LocalStack (local AWS emulation)

**Testing:**
- Vitest (unit tests)
- Playwright (E2E tests)
- AWS SAM CLI (local Lambda testing)

**Deployment:**
- AWS CDK (infrastructure as code)
- GitHub Actions (CI/CD)
- Serverless Framework (alternative to CDK)

### Support

**AWS Support:**
- AWS Support Plans (Developer/Business tier)
- AWS Forums and re:Post
- AWS Technical Account Manager (for large deployments)

**Community:**
- Vue Discord: https://discord.com/invite/vue
- Nuxt Discord: https://discord.com/invite/nuxt
- AWS Discord: https://discord.gg/aws

---

**Document Version:** 1.0
**Last Updated:** 2026-01-27
**Author:** Migration Evaluation Team
**Status:** Ready for Review

