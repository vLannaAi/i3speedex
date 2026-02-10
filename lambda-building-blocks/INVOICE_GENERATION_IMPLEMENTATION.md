# Invoice Generation Implementation

## Task #16: Invoice Generation Lambda Functions

**Date**: January 29, 2026
**Status**: ✅ Complete
**Handlers Implemented**: 4

---

## Overview

Implemented complete invoice generation workflow integrating with building block Lambda functions:
- Generate HTML invoices using Template Renderer
- Generate PDF invoices using HTML-to-PDF converter
- Generate Italian SDI XML using SDI Generator
- Provide secure download URLs with pre-signed S3 URLs

---

## Implemented Handlers

### 1. Generate HTML Invoice
**File**: `src/handlers/invoices/generate-html-invoice.ts`
**Route**: `POST /api/sales/{id}/invoice/html`
**Description**: Generate HTML invoice for a sale

**Features**:
- Validate sale is confirmed (not draft)
- Fetch sale and sale lines from DynamoDB
- Prepare template data with buyer, producer, lines, totals
- Invoke Template Renderer Lambda to render HTML
- Upload HTML to S3 documents bucket
- Update sale with invoice metadata
- Multi-language support (it, en, de, fr)

**Request Body**:
```json
{
  "language": "it"
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "saleId": "SALE001",
    "format": "html",
    "language": "it",
    "s3Key": "html/2026/SALE001/invoice-SALE001-it.html",
    "invoiceNumber": "INV-1-2026",
    "message": "HTML invoice generated successfully"
  }
}
```

**Workflow**:
1. Validate user permissions (write)
2. Get sale and lines from DynamoDB
3. Validate sale status (must be confirmed)
4. Prepare template data
5. Call Template Renderer Lambda (`renderTemplate`)
6. Upload HTML to S3 (`uploadInvoiceHTML`)
7. Update sale metadata (invoiceGenerated, invoiceGeneratedAt, invoiceNumber)

---

### 2. Generate PDF Invoice
**File**: `src/handlers/invoices/generate-pdf-invoice.ts`
**Route**: `POST /api/sales/{id}/invoice/pdf`
**Description**: Generate PDF invoice for a sale (HTML → PDF)

**Features**:
- Same validation as HTML generation
- Render HTML template
- Convert HTML to PDF using HTML-to-PDF Lambda
- Upload PDF to S3 documents bucket
- Update sale with invoice metadata
- Multi-language support (it, en, de, fr)

**Request Body**:
```json
{
  "language": "it"
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "saleId": "SALE001",
    "format": "pdf",
    "language": "it",
    "s3Key": "pdfs/2026/SALE001/invoice-SALE001-it.pdf",
    "invoiceNumber": "INV-1-2026",
    "message": "PDF invoice generated successfully"
  }
}
```

**Workflow**:
1. Validate user permissions (write)
2. Get sale and lines from DynamoDB
3. Validate sale status (must be confirmed)
4. Prepare template data
5. Call Template Renderer Lambda (`renderTemplate`)
6. Call HTML-to-PDF Lambda (`convertHtmlToPdf`)
7. Upload PDF to S3 (`uploadInvoicePDF`)
8. Update sale metadata

**PDF Options**:
- Format: A4
- Print Background: true
- Margins: top 20mm, right 15mm, bottom 20mm, left 15mm

---

### 3. Generate SDI Invoice
**File**: `src/handlers/invoices/generate-sdi-invoice.ts`
**Route**: `POST /api/sales/{id}/invoice/sdi`
**Description**: Generate Italian SDI XML invoice for electronic invoicing

**Features**:
- Validate buyer and producer are Italian (country = IT)
- Validate sale is confirmed
- Prepare SDI-compliant data structure
- Invoke SDI Generator Lambda
- Upload XML to S3 documents bucket
- Update sale with invoice metadata

**Request Body**: None required

**Response**:
```json
{
  "success": true,
  "data": {
    "saleId": "SALE001",
    "format": "sdi",
    "s3Key": "xml/2026/SALE001/invoice-SALE001.xml",
    "invoiceNumber": "INV-1-2026",
    "message": "SDI XML invoice generated successfully"
  }
}
```

**Workflow**:
1. Validate user permissions (write)
2. Get sale and lines from DynamoDB
3. Validate sale status (must be confirmed)
4. Validate buyer and producer are Italian
5. Prepare SDI data structure
6. Call SDI Generator Lambda (`generateSdiXml`)
7. Upload XML to S3 (`uploadInvoiceXML`)
8. Update sale metadata

**Italian Requirements**:
- Both buyer and producer must have country = "IT"
- VAT numbers and fiscal codes must be valid
- SDI code or PEC email required for buyer

---

### 4. Get Invoice Download URL
**File**: `src/handlers/invoices/get-invoice-download-url.ts`
**Route**: `GET /api/sales/{id}/invoice/download`
**Description**: Get pre-signed S3 URL for downloading invoice

**Features**:
- Validate invoice has been generated
- Generate pre-signed S3 URL (valid 1 hour)
- Support multiple formats (pdf, html, xml)
- Support multiple languages (it, en, de, fr)

**Query Parameters**:
```
?format=pdf&language=it
```

**Response**:
```json
{
  "success": true,
  "data": {
    "saleId": "SALE001",
    "format": "pdf",
    "language": "it",
    "downloadUrl": "https://i2speedex-documents-dev-827562051115.s3.eu-west-1.amazonaws.com/pdfs/2026/SALE001/invoice-SALE001-it.pdf?X-Amz-Algorithm=...",
    "expiresIn": 3600,
    "invoiceNumber": "INV-1-2026",
    "message": "Download URL generated successfully"
  }
}
```

**Workflow**:
1. Validate user authentication
2. Get sale from DynamoDB
3. Check user access permissions
4. Validate invoice has been generated
5. Generate pre-signed S3 URL (`generateInvoiceDownloadUrl`)
6. Return URL with expiration info

**URL Expiration**: 1 hour (3600 seconds)

---

## Integration with Building Blocks

### Template Renderer Lambda
**Function**: `TemplateRendererLambda-Dev`
**Purpose**: Render HTML invoice from Handlebars template
**Input**:
```typescript
{
  template: 'invoice',
  language: 'it' | 'en' | 'de' | 'fr',
  data: {
    sale: { saleId, saleNumber, saleDate, invoiceNumber, ... },
    buyer: { companyName, vatNumber, address, ... },
    producer: { companyName, vatNumber, address, ... },
    lines: [{ lineNumber, productDescription, quantity, ... }],
    totals: { subtotal, taxAmount, total }
  }
}
```
**Output**: HTML string

### HTML-to-PDF Lambda
**Function**: `HtmlToPdfLambda-Dev`
**Purpose**: Convert HTML to PDF
**Input**:
```typescript
{
  html: string,
  options: {
    format: 'A4',
    printBackground: true,
    margin: { top: '20mm', right: '15mm', bottom: '20mm', left: '15mm' }
  }
}
```
**Output**: PDF Buffer (base64 encoded)

### SDI Generator Lambda
**Function**: `SdiInvoiceGeneratorLambda-Dev`
**Purpose**: Generate Italian SDI XML
**Input**:
```typescript
{
  sale: { saleId, saleNumber, saleDate, currency, ... },
  buyer: { companyName, vatNumber, fiscalCode, address, ... },
  producer: { companyName, vatNumber, fiscalCode, address, ... },
  lines: [{ lineNumber, productDescription, quantity, unitPrice, taxRate, totalAmount }],
  totals: { subtotal, taxAmount, total }
}
```
**Output**: XML string (SDI format)

---

## S3 Storage Structure

### Documents Bucket: `i2speedex-documents-dev-827562051115`

**PDF Invoices**:
```
/pdfs/{year}/{saleId}/invoice-{saleId}-{language}.pdf
Example: /pdfs/2026/SALE001/invoice-SALE001-it.pdf
```

**HTML Invoices**:
```
/html/{year}/{saleId}/invoice-{saleId}-{language}.html
Example: /html/2026/SALE001/invoice-SALE001-it.html
```

**SDI XML**:
```
/xml/{year}/{saleId}/invoice-{saleId}.xml
Example: /xml/2026/SALE001/invoice-SALE001.xml
```

---

## Template Data Structure

```typescript
{
  sale: {
    saleId: string;
    saleNumber: number;
    saleDate: string;          // ISO 8601
    invoiceNumber: string;      // Auto-generated: INV-{saleNumber}-{year}
    currency: string;           // ISO 4217 (EUR, USD, etc.)
    paymentMethod?: string;
    paymentTerms?: string;
    deliveryMethod?: string;
    deliveryDate?: string;
    notes?: string;
    referenceNumber?: string;
  };
  buyer: {
    companyName: string;
    vatNumber?: string;
    fiscalCode?: string;
    address?: string;
    city?: string;
    province?: string;
    postalCode?: string;
    country: string;
  };
  producer: {
    companyName: string;
    vatNumber?: string;
    fiscalCode?: string;
    address?: string;
    city?: string;
    province?: string;
    postalCode?: string;
    country: string;
  };
  lines: Array<{
    lineNumber: number;
    productCode?: string;
    productDescription: string;
    quantity: number;
    unitPrice: number;
    discount: number;
    discountAmount: number;
    netAmount: number;
    taxRate: number;
    taxAmount: number;
    totalAmount: number;
    unitOfMeasure?: string;
  }>;
  totals: {
    subtotal: number;
    taxAmount: number;
    total: number;
  };
}
```

---

## Sale Metadata Updates

After invoice generation, the sale record is updated with:

```typescript
{
  invoiceGenerated: true,
  invoiceGeneratedAt: '2026-01-29T12:00:00.000Z',  // ISO 8601 timestamp
  invoiceNumber: 'INV-1-2026',                       // Auto-generated
  updatedAt: '2026-01-29T12:00:00.000Z',
  updatedBy: 'admin@i2speedex.com'
}
```

**Invoice Number Format**: `INV-{saleNumber}-{year}`
- Example: `INV-1-2026` (first sale of 2026)
- Example: `INV-42-2026` (42nd sale of 2026)

---

## Validation Rules

### All Formats
- ✅ Sale must exist and not be deleted
- ✅ User must have write permission
- ✅ User must have access to the sale (own sale or admin)
- ✅ Sale status must be "confirmed" (not "draft")
- ✅ Sale must have at least one line

### SDI Format Only
- ✅ Buyer country must be "IT" (Italy)
- ✅ Producer country must be "IT" (Italy)
- ✅ Both must have valid VAT numbers and fiscal codes

### Download URL
- ✅ Invoice must have been generated (`invoiceGenerated: true`)
- ✅ Format must be: pdf, html, or xml
- ✅ Language must be: it, en, de, or fr (not applicable for xml)

---

## Error Responses

### 400 Bad Request
- Invalid language (not it, en, de, fr)
- Invalid format (not pdf, html, xml)

### 403 Forbidden
- User doesn't have write permission
- User doesn't have access to the sale

### 404 Not Found
- Sale not found
- Sale is soft deleted
- Invoice file not found in S3

### 422 Validation Error
- Sale status is "draft" (must confirm first)
- Sale has no lines
- Buyer or producer is not Italian (for SDI)
- Invoice not yet generated (for download)

### 500 Internal Server Error
- Template Renderer Lambda failed
- HTML-to-PDF Lambda failed
- SDI Generator Lambda failed
- S3 upload failed

---

## Permissions Matrix

| Operation | Admin | Operator | Viewer |
|-----------|-------|----------|--------|
| Generate HTML | ✅ | ✅ Own | ❌ |
| Generate PDF | ✅ | ✅ Own | ❌ |
| Generate SDI | ✅ | ✅ Own | ❌ |
| Download URL | ✅ | ✅ | ✅ |

---

## Testing

### Generate HTML Invoice
```bash
curl -X POST \
  https://r10lp4qqkg.execute-api.eu-west-1.amazonaws.com/api/sales/SALE001/invoice/html \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"language": "it"}'
```

### Generate PDF Invoice
```bash
curl -X POST \
  https://r10lp4qqkg.execute-api.eu-west-1.amazonaws.com/api/sales/SALE001/invoice/pdf \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"language": "en"}'
```

### Generate SDI Invoice
```bash
curl -X POST \
  https://r10lp4qqkg.execute-api.eu-west-1.amazonaws.com/api/sales/SALE001/invoice/sdi \
  -H "Authorization: Bearer $TOKEN"
```

### Get Download URL
```bash
curl -X GET \
  "https://r10lp4qqkg.execute-api.eu-west-1.amazonaws.com/api/sales/SALE001/invoice/download?format=pdf&language=it" \
  -H "Authorization: Bearer $TOKEN"
```

---

## Complete Workflow Example

### Step 1: Create Sale
```bash
POST /api/sales
{
  "saleDate": "2026-01-29",
  "buyerId": "BUYER001",
  "producerId": "PROD001"
}
# Response: { saleId: "SALE001", status: "draft" }
```

### Step 2: Add Lines
```bash
POST /api/sales/SALE001/lines
{
  "productDescription": "Product A",
  "quantity": 10,
  "unitPrice": 100.00,
  "taxRate": 22
}
# Repeat for more lines
```

### Step 3: Confirm Sale
```bash
POST /api/sales/SALE001/confirm
# Response: { status: "confirmed" }
```

### Step 4: Generate Invoices
```bash
# Generate PDF (Italian)
POST /api/sales/SALE001/invoice/pdf
{ "language": "it" }

# Generate PDF (English)
POST /api/sales/SALE001/invoice/pdf
{ "language": "en" }

# Generate SDI XML (Italian only)
POST /api/sales/SALE001/invoice/sdi
```

### Step 5: Download Invoice
```bash
GET /api/sales/SALE001/invoice/download?format=pdf&language=it
# Response: { downloadUrl: "https://...", expiresIn: 3600 }
```

---

## Next Steps

1. ✅ Task #13: Implement Sales CRUD Lambda functions - **COMPLETE**
2. ✅ Task #14: Implement Buyers CRUD Lambda functions - **COMPLETE**
3. ✅ Task #15: Implement Producers CRUD Lambda functions - **COMPLETE**
4. ✅ Task #16: Implement Invoice Generation Lambda functions - **COMPLETE**
5. ⏳ Task #17: Implement File Upload Lambda functions - **NEXT**
6. ⏳ Task #18: Implement Search and Dashboard Lambda functions
7. ⏳ Task #19: Connect Lambda functions to API Gateway routes
8. ⏳ Task #20: Write unit tests for Lambda functions
9. ⏳ Task #21: Create integration tests for API endpoints

---

**Status**: ✅ Invoice Generation Complete
**Date**: January 29, 2026
**Handlers**: 4/4 implemented
**Build**: ✅ Successful
**Location**: `/Users/vicio/i2speedex/lambda-building-blocks/functions/sale-module-api/src/handlers/invoices/`
**Integration**: ✅ Template Renderer, HTML-to-PDF, SDI Generator
