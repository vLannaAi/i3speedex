# Speedex Sales App - Development Plan

**Project:** i3speedex - Sale Module modernization
**Started:** 2026-01-27
**Last Updated:** 2026-02-11
**Repository:** https://github.com/vLannaAi/i3speedex

---

## Goal

Complete modernization of the i2speedex Sale module, migrating from a legacy Java/MySQL/XSLT stack to a serverless AWS architecture with a modern frontend.

---

## Architecture

| Layer | Technology |
|-------|-----------|
| Frontend | Nuxt 4 + Vue 3 + UnoCSS (planned) |
| API | AWS API Gateway (REST) + Lambda (Node.js 18) |
| Auth | AWS Cognito (User Pool + JWT) |
| Database | DynamoDB (single-table, GSI1-GSI4) |
| Storage | S3 (attachments + invoices) |
| CDN | CloudFront + custom domain (app.speedex.it) |
| Security | WAF + HTTPS + CORS |
| IaC | SAM (API/Lambda) + CloudFormation (CloudFront) |
| PDF | Puppeteer Lambda (html-to-pdf) |
| E-invoicing | SDI XML generator Lambda |

---

## Phase 1: Infrastructure Setup (2 weeks) - DONE

- [x] AWS account and billing alerts
- [x] Cognito user pool (`us-east-1_BXA8AaNt5`) with admin group
- [x] DynamoDB tables: SalesTable, BuyersTable, ProducersTable (PAY_PER_REQUEST)
- [x] DynamoDB GSIs: GSI1 (status), GSI2 (buyer), GSI3 (producer), GSI4 (date)
- [x] S3 buckets: `sale-module-attachments-production`, `sale-module-invoices-production`
- [x] CloudFront distribution (`E1NHXA2KW6ECJ8`) with custom domain `app.speedex.it`
- [x] WAF enabled on CloudFront
- [x] ACM certificate for `app.speedex.it`
- [x] API Gateway with Cognito authorizer (default on all methods)
- [x] CORS configured with unauthenticated preflight (`AddDefaultAuthorizerToCorsPreflight: false`)
- [x] CloudFront uses legacy `ForwardedValues` to forward `Authorization` header to API Gateway

---

## Phase 2: Backend Development (4 weeks) - PARTIALLY DONE

### Core API (SAM stack: `sale-module-api-production`)

**Sales CRUD:**
- [x] `POST /api/sales` - Create sale
- [x] `GET /api/sales` - List sales (pagination, filtering by status/buyer/producer/date)
- [x] `GET /api/sales/{id}` - Get single sale
- [x] `PUT /api/sales/{id}` - Update sale
- [x] `DELETE /api/sales/{id}` - Soft delete sale
- [x] `POST /api/sales/{id}/confirm` - Confirm sale
- [x] `POST /api/sales/{id}/invoice` - Generate invoice
- [x] `GET /api/sales/{id}/invoice/html` - Get invoice HTML

**Buyers CRUD:**
- [x] `GET /api/buyers` - List buyers
- [x] `GET /api/buyers/{id}` - Get single buyer
- [x] `POST /api/buyers` - Create buyer
- [x] `PUT /api/buyers/{id}` - Update buyer
- [x] `DELETE /api/buyers/{id}` - Soft delete buyer

**Search & Dashboard:**
- [x] `GET /api/search/sales` - Advanced search
- [x] `GET /api/dashboard/stats` - Dashboard statistics

**Demo & Auth:**
- [x] `GET /` - Demo page (no auth, served by Lambda)
- [x] Role-based permissions: admin, operator, viewer
- [x] User `vicio` in admin group

### Advanced Features:
- [x] HTML-to-PDF Lambda (Puppeteer + Chromium)
- [x] SDI XML invoice generator Lambda
- [x] Template renderer Lambda
- [x] Email reconciler Lambda (LLM-based extraction)
- [ ] Sale Lines CRUD (line items for each sale)
- [ ] File upload/download via S3 presigned URLs
- [ ] Reporting endpoints (sales by period, by buyer)
- [ ] Unit tests (target: 80%+ coverage)

### Known Issues Fixed (this session):
- CloudFront cannot forward `Authorization` header via cache/origin-request policies (restricted header) - solved with legacy `ForwardedValues`
- `AllViewerExceptHostHeader` policy forwards `Host` header causing API Gateway 403 - not used
- Env var mismatch: code uses `SALES_TABLE_NAME` but SAM was setting `DYNAMODB_SALES_TABLE` - fixed
- CORS preflight blocked by Cognito authorizer on OPTIONS - fixed with `AddDefaultAuthorizerToCorsPreflight: false`
- API Gateway stage not redeployed after auth changes - forced redeployment

---

## Phase 3: Frontend Development (4 weeks) - NOT STARTED

- [ ] Set up Nuxt 4 project structure
- [ ] UnoCSS + component library
- [ ] Authentication pages (login, forgot password, MFA)
- [ ] Dashboard page with charts
- [ ] Sales list page with search/filter/sort
- [ ] Sale detail/edit page with line items
- [ ] Buyers list and detail pages
- [ ] Producers list and detail pages
- [ ] PDF viewer/download
- [ ] File upload components
- [ ] Responsive mobile layouts
- [ ] PWA support

---

## Phase 4: Data Migration (1 week) - NOT STARTED

- [ ] MySQL to DynamoDB migration scripts
- [ ] Migrate ~379 sales + lines from legacy database
- [ ] Migrate buyers and producers
- [ ] Validate data integrity
- [ ] Dual-write pattern during transition

---

## Phase 5: Testing & QA (2 weeks) - NOT STARTED

- [ ] End-to-end testing (critical workflows)
- [ ] Load testing (concurrent users)
- [ ] Security audit (OWASP Top 10)
- [ ] PDF generation testing (all invoice types)
- [ ] SDI XML validation testing
- [ ] Cross-browser + mobile testing
- [ ] User acceptance testing

---

## Phase 6: Deployment & Hypercare (3 weeks) - NOT STARTED

- [ ] Production deployment
- [ ] CloudWatch monitoring + alarms
- [ ] User training
- [ ] 2-week hypercare period
- [ ] Decommission legacy MySQL after 30-day safety period

---

## Key Configuration Reference

| Resource | Value |
|----------|-------|
| API Gateway ID | `gzpkiqmh49` |
| API Gateway URL | `https://gzpkiqmh49.execute-api.us-east-1.amazonaws.com/production` |
| CloudFront Distribution | `E1NHXA2KW6ECJ8` |
| CloudFront Domain | `dipr9inpl6w06.cloudfront.net` |
| Custom Domain | `https://app.speedex.it` |
| Cognito User Pool | `us-east-1_BXA8AaNt5` |
| Cognito Client ID | `2vgogh2jvr7nlk2sdho6qljaau` |
| SAM Stack | `sale-module-api-production` |
| CloudFormation Stack | `sale-module-cloudfront-production` |
| Region | `us-east-1` |

---

## Estimated Timeline

| Phase | Duration | Status |
|-------|----------|--------|
| Phase 1: Infrastructure | 2 weeks | DONE |
| Phase 2: Backend | 4 weeks | ~70% done |
| Phase 3: Frontend | 4 weeks | Not started |
| Phase 4: Data Migration | 1 week | Not started |
| Phase 5: Testing | 2 weeks | Not started |
| Phase 6: Deploy + Hypercare | 3 weeks | Not started |
| **Total** | **16 weeks** | |
