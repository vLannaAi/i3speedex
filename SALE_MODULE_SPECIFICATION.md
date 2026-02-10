# i2speedex Sale Module - Complete Specification Document

**Document Version:** 1.0
**Date:** 2026-01-27
**Purpose:** Complete technical specification for rebuilding the Sale module from scratch with modern workflow

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [System Overview](#system-overview)
3. [Database Schema](#database-schema)
4. [Data Models](#data-models)
5. [Business Logic](#business-logic)
6. [User Workflows](#user-workflows)
7. [Features and Functionality](#features-and-functionality)
8. [Validations and Constraints](#validations-and-constraints)
9. [Reports and Exports](#reports-and-exports)
10. [Integration Points](#integration-points)
11. [Technical Requirements](#technical-requirements)

---

## Executive Summary

The **Sale Module** is a comprehensive invoice and sales management system for i2speedex. It manages sales transactions (invoices, proformas, credit notes) between producers and buyers, with complete product line-item tracking, payment management, and document generation capabilities.

### Key Entities
- **Sales** (Invoices/Proformas/Credit Notes)
- **Sale Lines** (Product line items)
- **Buyers** (Customers)
- **Producers** (Suppliers/Manufacturers)

### Core Capabilities
- Create and manage sales invoices with multi-line products
- Track invoice status from creation through payment
- Generate PDF invoices and XML SDI (Sistema di Interscambio - Italian e-invoicing)
- Search and filter sales with advanced criteria
- Export data to Excel
- Manage buyer and producer information
- Handle multi-currency transactions with EUR conversion
- Support VAT calculations with various exemptions
- Track delivery notes, payment terms, and attachments

---

## System Overview

### Architecture
The current system uses:
- **Backend:** Java/Jetty web server with XML-based configuration (WPS files)
- **Database:** MySQL 5.x+
- **Presentation:** XSLT transformations generating HTML
- **Document Generation:** Apache FOP for PDF generation
- **Data Format:** XML for configuration, data exchange, and document templates

### Technology Stack (Current)
- Jetty 6.x web server
- MySQL database (i2_speedex)
- XSLT 2.0 for presentation
- Custom XML framework (i2.namue.com)
- HikariCP connection pooling
- Apache FOP for PDF generation

---

## Database Schema

### 1. `sales` Table

**Primary entity for invoices, proformas, and credit notes**

| Field | Type | Null | Key | Default | Description |
|-------|------|------|-----|---------|-------------|
| id | int | NO | PRI | auto_increment | Primary key |
| vat_perc | int | YES | | 22 | VAT percentage (default 22%) |
| code | varchar(16) | YES | | NULL | Producer code reference |
| name | varchar(128) | YES | | "Unnamed" | Producer name |
| country | char(3) | YES | | "ITA" | Country code (ISO 3166) |
| vat_off | mediumtext | YES | | NULL | VAT exemption XML data |
| currency | char(3) | YES | | "EUR" | Currency code |
| vat_on | int | YES | | 0 | VAT application flag |
| tax_on | int | NO | | 0 | Tax application flag |
| amount | decimal(34,2) | YES | | NULL | Base amount (before VAT/tax) |
| eur_amount | decimal(45,2) | YES | | NULL | Amount in EUR |
| total | decimal(37,2) | YES | | NULL | Calculated total |
| vat | decimal(49,2) | YES | | NULL | VAT amount |
| tax | decimal(48,2) | YES | | NULL | Tax amount (e.g., revenue stamp) |
| to_pay | decimal(50,2) | YES | | NULL | Total to pay (calculated) |
| pay_load | decimal(52,2) | YES | | NULL | Actual payment amount |
| eur_pay_load | decimal(52,2) | YES | | NULL | Payment amount in EUR |
| buyer_ue | varchar(16) | YES | | NULL | Buyer EU VAT number |
| number | int unsigned | YES | | NULL | Invoice sequential number |
| pag | varchar(255) | YES | | NULL | Payment terms (legacy) |
| year | int | YES | | NULL | Invoice year |
| producer_id | int | YES | | NULL | FK to producers.id |
| status | char(32) | YES | | NULL | Invoice status (see status values) |
| buyer_id | int | YES | MUL | NULL | FK to buyers.id |
| reg_date | int | YES | | NULL | Registration date (YYYYMMDD format) |
| reg_date_input | date | YES | | NULL | Registration date (DATE format) |
| buyer_ref | varchar(64) | YES | | NULL | Buyer reference/order number |
| package | mediumtext | YES | | NULL | Package description |
| delivery | mediumtext | YES | | NULL | Delivery note text |
| dn_number | varchar(64) | YES | | NULL | Delivery note number |
| dn_date | int | YES | | NULL | Delivery note date (YYYYMMDD) |
| dn_number2 | varchar(64) | YES | | NULL | Second delivery note number |
| dn_date2 | int | YES | | NULL | Second delivery note date |
| dn_number3 | varchar(64) | YES | | NULL | Third delivery note number |
| dn_date3 | int | YES | | NULL | Third delivery note date |
| payment | varchar(16) | YES | | NULL | Payment method code |
| bank_id | varchar(16) | YES | | NULL | Bank ID for bank transfer |
| payment_bank | varchar(255) | YES | | NULL | C/O bank description |
| payment_bank_iban | varchar(255) | YES | | NULL | C/O bank IBAN |
| payment_date | int | YES | | NULL | Payment date (YYYYMMDD) |
| payment_note | mediumtext | YES | | NULL | Payment notes |
| sale_note | mediumtext | YES | | NULL | Note printed on invoice |
| note | mediumtext | YES | | NULL | Internal note (not printed) |
| po_number | varchar(255) | YES | | NULL | Purchase order number |
| po_date | int | YES | | NULL | Purchase order date |
| cup_contract_id | varchar(255) | YES | | NULL | CUP contract ID (Italian PA) |
| cig_contract_id | varchar(255) | YES | | NULL | CIG contract ID (Italian PA) |
| stamp | int | YES | | 0 | Revenue stamp flag |
| attachs | mediumtext | YES | | NULL | Attachments XML data |
| invoice_attach | int | YES | | 0 | Attach invoice to SDI flag |
| font_base | tinyint | YES | | 12 | PDF font base size |

**Indexes:**
- PRIMARY KEY: `id`
- INDEX: `buyer_id`

**Status Values:**
- `new` - Newly created, can be edited/deleted
- `to verify` - Ready for verification, can be edited/deleted
- `proforma` - Proforma invoice, excluded from reports
- `ready` - Verified and ready to send
- `sent` - Sent to customer
- `paid` - Payment received
- `deleted` - Soft deleted, excluded from reports

**Date Format:** Integer dates stored as YYYYMMDD (e.g., 20100407 = April 7, 2010)

---

### 2. `sale_lines` Table

**Product line items for each sale**

| Field | Type | Null | Key | Default | Description |
|-------|------|------|-----|---------|-------------|
| id | int unsigned | NO | PRI | auto_increment | Primary key |
| sale_id | int unsigned | NO | MUL | NULL | FK to sales.id |
| pos | int | NO | | NULL | Position/order in list |
| code | varchar(64) | YES | MUL | NULL | Product code |
| description | varchar(255) | YES | MUL | NULL | Product description |
| qty | int | YES | | NULL | Quantity |
| price | decimal(18,6) | YES | | NULL | Unit price (6 decimal places) |
| shipping | varchar(255) | YES | | NULL | Shipping information |
| lfz | varchar(255) | YES | | NULL | Lead time zone |
| import_id | int | YES | | NULL | Import reference |
| test | int | YES | | NULL | Test flag |
| standard | varchar(128) | YES | | NULL | Standard specification |
| strength | varchar(64) | YES | | NULL | Strength specification |
| drive | varchar(64) | YES | | NULL | Drive type |
| length | varchar(64) | YES | | NULL | Length specification |
| finish | varchar(255) | YES | | NULL | Finish type |
| sorting | varchar(255) | YES | | NULL | Sorting specification |
| certificate | varchar(255) | YES | | NULL | Certificate information |
| vat | decimal(6,4) | YES | | NULL | VAT percentage (per line) |
| vat_off | varchar(16) | YES | | NULL | VAT exemption code |
| vat_off_desc | varchar(255) | YES | | NULL | VAT exemption description |
| discount | decimal(6,4) | YES | | NULL | Discount percentage (4 decimals) |

**Indexes:**
- PRIMARY KEY: `id`
- INDEX: `main_key` (sale_id, pos) - Composite key
- INDEX: `code`
- INDEX: `sale_id`
- FULLTEXT INDEX: `description`

**Calculations:**
- Line Total = (qty × price) × (1 - discount) × (1 + vat)
- The system recalculates totals in real-time when qty, price, discount, or vat changes

---

### 3. `buyers` Table

**Customer/Client information**

| Field | Type | Null | Key | Default | Description |
|-------|------|------|-----|---------|-------------|
| id | int unsigned | NO | PRI | auto_increment | Primary key |
| status | char(16) | YES | MUL | "new" | Status (new/online/offline/deleted) |
| name | varchar(150) | YES | | "Unnamed" | Company name |
| country | char(3) | YES | | NULL | Country code (ISO 3166) |
| prov | varchar(64) | YES | | NULL | Province/State |
| address | varchar(128) | YES | | NULL | Street address |
| zip | char(16) | YES | | NULL | Postal code |
| city | varchar(64) | YES | | NULL | City |
| box | varchar(64) | YES | | NULL | PO Box |
| note | text | YES | | NULL | Internal notes |
| vat | varchar(32) | YES | | NULL | VAT number |
| taxid | varchar(32) | YES | | NULL | Tax ID |
| vatoff | char(16) | YES | | NULL | VAT exemption code |
| sdi_code | varchar(8) | YES | | NULL | SDI recipient code (Italian e-invoicing) |
| tel | varchar(64) | YES | | NULL | Telephone |
| currency | char(3) | NO | | "EUR" | Default currency |
| code | varchar(32) | NO | UNI | "no code" | Unique buyer code |
| sub_name | varchar(64) | YES | | NULL | Department/division name |
| operator_id | smallint unsigned | YES | MUL | NULL | Assigned operator/salesperson |
| industrial_group | varchar(64) | YES | | NULL | Industrial group/parent company |
| sector | char(32) | YES | | NULL | Business sector |
| lang | char(2) | YES | | NULL | Language code (it/en/de/fr) |
| fax | varchar(64) | YES | | NULL | Fax number |
| email | varchar(64) | YES | MUL | NULL | Email address |
| email_domain | varchar(32) | YES | | NULL | Email domain |
| pec | varchar(64) | YES | | NULL | PEC (Italian certified email) |
| web | varchar(64) | YES | | NULL | Website |
| payment | varchar(128) | YES | | NULL | Default payment terms |
| bank | varchar(255) | YES | | NULL | Bank information |
| ship | text | YES | | NULL | Shipping addresses (XML format) |
| new_date | datetime | YES | | NULL | Creation date |
| ue | varchar(16) | YES | | NULL | EU registration date |
| contact | varchar(128) | YES | | NULL | Contact person |

**Indexes:**
- PRIMARY KEY: `id`
- UNIQUE KEY: `code`
- INDEX: `email`
- INDEX: `operator_id`
- INDEX: `status`

**Status Values:**
- `new` - Newly created
- `online` - Active customer
- `offline` - Inactive customer
- `deleted` - Soft deleted

**Shipping XML Format:**
```xml
<ships>
  <ship date="YYYYMMDD" mode="delivery_mode">Address details</ship>
</ships>
```

---

### 4. `producers` Table

**Manufacturer/Supplier information**

| Field | Type | Null | Key | Default | Description |
|-------|------|------|-----|---------|-------------|
| id | int | NO | PRI | auto_increment | Primary key |
| status | char(16) | YES | MUL | "new" | Status (new/online/offline/deleted) |
| code | varchar(16) | NO | UNI | | Unique producer code |
| name | varchar(128) | YES | | "Unnamed" | Company name |
| sub_name | varchar(64) | YES | | NULL | Department/division |
| address | varchar(128) | YES | | NULL | Street address |
| city | varchar(255) | YES | | NULL | City |
| prov | varchar(255) | YES | | NULL | Province/State |
| box | varchar(64) | YES | | NULL | PO Box |
| zip | varchar(128) | YES | | NULL | Postal code |
| country | char(3) | YES | | "ITA" | Country code |
| revenue | decimal(4,2) | YES | | NULL | Revenue commission percentage |
| note | mediumtext | YES | | NULL | Internal notes |
| vat | varchar(64) | YES | | NULL | VAT number |
| sdi_code | varchar(8) | YES | | NULL | SDI code |
| contact | varchar(64) | YES | | NULL | Contact person |
| lang | char(2) | YES | | NULL | Language code |
| operator_id | smallint unsigned | YES | MUL | NULL | Assigned operator |
| tel | varchar(64) | YES | | NULL | Telephone |
| fax | varchar(64) | YES | | NULL | Fax |
| banks | mediumtext | YES | | NULL | Bank information (XML format) |
| ue | int | YES | | NULL | EU registration |
| vat_off | mediumtext | YES | | NULL | VAT exemption data |
| commission_invoice | char(12) | YES | | NULL | Commission invoice type |
| commission_bank | varchar(64) | YES | | NULL | Commission bank |
| new_date | datetime | YES | | NULL | Creation date |
| web | varchar(64) | YES | | NULL | Website |
| email | varchar(255) | YES | | NULL | Email |
| pec | varchar(128) | YES | | NULL | PEC email |
| operator | int | YES | | NULL | Operator ID (legacy) |
| quality_assurance | varchar(32) | YES | | NULL | QA certification |
| production_area | varchar(64) | YES | | NULL | Production area |
| automotive | enum('yes') | YES | | NULL | Automotive flag |
| markets | varchar(64) | YES | | NULL | Target markets |
| materials | varchar(128) | YES | | NULL | Materials used |
| products | mediumtext | YES | | NULL | Product description |
| standard_products | mediumtext | YES | | NULL | Standard products |
| diameter_range | mediumtext | YES | | NULL | Diameter range |
| max_length | mediumtext | YES | | NULL | Maximum length |
| quantity | varchar(32) | YES | | NULL | Production quantity |

**Indexes:**
- PRIMARY KEY: `id`
- UNIQUE KEY: `code`
- INDEX: `operator_id`
- INDEX: `status`

**Banks XML Format:**
```xml
<banks>
  <bank name="Bank Name" branch="Branch Info" account="Account Number" date="YYYYMMDD"/>
</banks>
```

---

## Data Models

### Relationships

```
buyers (1) -----> (*) sales
producers (1) ---> (*) sales
sales (1) -------> (*) sale_lines
```

**Cardinality:**
- One buyer can have many sales (1:N)
- One producer can have many sales (1:N)
- One sale has many sale_lines (1:N)
- Sale lines cannot exist without a sale (dependent entity)

### Entity-Relationship Diagram

```
┌──────────────┐
│   buyers     │
│              │
│ - id (PK)    │
│ - code (UQ)  │
│ - name       │
│ - country    │
│ - vat        │
│ - ...        │
└──────┬───────┘
       │ 1
       │
       │ N
┌──────▼───────┐         ┌──────────────┐
│    sales     │         │  producers   │
│              │         │              │
│ - id (PK)    │         │ - id (PK)    │
│ - buyer_id   │◄────────┤ - code (UQ)  │
│ - producer_id├─────────┤ - name       │
│ - number     │       1 │ - country    │
│ - year       │         │ - revenue    │
│ - status     │         │ - ...        │
│ - amount     │         └──────────────┘
│ - vat        │
│ - ...        │
└──────┬───────┘
       │ 1
       │
       │ N
┌──────▼───────┐
│ sale_lines   │
│              │
│ - id (PK)    │
│ - sale_id    │
│ - pos        │
│ - code       │
│ - description│
│ - qty        │
│ - price      │
│ - discount   │
│ - vat        │
└──────────────┘
```

---

## Business Logic

### Sale Lifecycle

```
┌─────────┐
│   NEW   │  Initial creation
└────┬────┘
     │
     │ User edits sale
     ▼
┌─────────────┐
│ TO VERIFY   │  Ready for review
└─────┬───────┘
      │
      │ Generate PDF/XML
      ▼
┌─────────┐
│  READY  │  Approved, ready to send
└────┬────┘
     │
     │ Send to customer
     ▼
┌─────────┐
│  SENT   │  Sent to customer
└────┬────┘
     │
     │ Payment received
     ▼
┌─────────┐
│  PAID   │  Final status
└─────────┘

  Alternative paths:
  NEW/TO VERIFY ──────> DELETED (soft delete)
  Any status ─────────> PROFORMA (special status)
```

### Sale Number Generation

When creating a new sale:
1. Query the last sale number for the current year (excluding proforma and deleted)
2. Increment the number by 1
3. Assign the current year
4. Format: `YYYY/TNNN` where:
   - YYYY = year
   - T = literal "T" (after 2018)
   - NNN = zero-padded 3-digit number

**Example:** 2024/T042 (42nd sale in 2024)

### Amount Calculations

**Sale Line Calculation:**
```
line_subtotal = qty × price
line_discount_amount = line_subtotal × discount
line_after_discount = line_subtotal - line_discount_amount
line_vat_amount = line_after_discount × vat
line_total = line_after_discount + line_vat_amount
```

**Sale Total Calculation:**
```
amount = SUM(all line_after_discount)
vat = SUM(all line_vat_amount)
tax = stamp amount (if applicable)
total = amount + vat + tax
to_pay = total
pay_load = total (can be negative for credit notes)
```

### VAT Handling

**VAT Application:**
- Default VAT percentage: 22% (Italian standard rate)
- Can be set per sale (overrides all lines)
- Can be set per line (overrides sale default)
- VAT exemptions stored in `vat_off` field (XML format)

**VAT Exemption Codes:**
Stored in expand data, examples:
- N1 - Excluded from VAT per Art.15
- N2 - Not subject to VAT
- N3 - Not taxable
- etc.

### Payment Management

**Payment Methods:**
Stored in `payment` field, configured in expand data:
- Bank Transfer
- Cash on Delivery (C/O)
- Wire Transfer
- Check
- etc.

**Payment Date Tracking:**
- `payment_date`: When payment was received
- Used to determine if invoice is paid
- Status changes from SENT to PAID

### Document Generation

**PDF Invoice Generation:**
1. Load sale data with buyer and producer details
2. Load sale_lines
3. Load dictionary based on buyer language
4. Apply XSLT transformation to generate HTML
5. Convert CSS to XSL-FO
6. Generate PDF using Apache FOP
7. Store in `media/pdf/sales/sale_{id}.pdf`

**XML SDI Generation (Italian E-Invoicing):**
1. Load sale data with attachments
2. Generate XML in FatturaPA format
3. Store in `media/sdi/sales/sale_sdi_{id}.xml`
4. Optional: include PDF and attachments

### File Management

**Attachments:**
- Stored in `media/sale_attachs/T{folder}/T{id}/x/`
- Folder structure: first 2 digits of ID (e.g., T20 for sale 2001)
- Stored as XML in `attachs` field
- Can be attached to SDI XML

**Document Paths:**
- PDF: `media/pdf/sales/sale_{id}.pdf`
- SDI XML: `media/sdi/sales/sale_sdi_{id}.xml`
- Attachments: `media/sale_attachs/T{folder}/T{id}/x/{filename}`

---

## User Workflows

### 1. Create New Sale

**Steps:**
1. User clicks "New Sale" button
2. System generates new sale number
3. System creates new sale record with:
   - Current date as `reg_date`
   - Current year
   - Next available number
   - Status: "new"
4. System redirects to sale detail page
5. User fills in:
   - Producer (required)
   - Buyer (required)
   - VAT percentage
   - Payment terms
   - Delivery information
   - PO reference
6. User adds sale lines (products):
   - Description
   - Code
   - Quantity
   - Price
   - Discount (optional)
   - VAT % (optional, overrides sale VAT)
7. System calculates totals in real-time
8. User saves sale
9. System validates and stores sale + sale_lines

**Validation:**
- Number must be unique within year
- Producer or Buyer should be selected (can be null for special cases)
- At least one sale line should exist (warning, not error)
- Numeric fields must be valid

### 2. Edit Existing Sale

**Steps:**
1. User searches for sale (by ID, number, date, status, buyer, producer, etc.)
2. User clicks on sale in list
3. System loads sale detail page
4. User modifies fields
5. System recalculates totals on field change
6. User can:
   - Add/remove sale lines
   - Modify sale lines
   - Upload attachments
   - Change status
7. User saves changes
8. System validates and updates sale + sale_lines

**Restrictions:**
- Sales with status READY, SENT, or PAID have limited editability
- Sales must be regenerated (PDF/XML) after significant changes

### 3. Generate Invoice PDF

**Steps:**
1. User opens sale detail
2. User clicks "Ri-generate PDF"
3. System:
   - Loads sale, buyer, producer data
   - Loads sale lines
   - Determines buyer language for localization
   - Applies invoice template transformation
   - Generates PDF
   - Stores in media/pdf/sales/
4. System returns to sale detail
5. PDF appears in "Documents" section
6. User can download/view PDF

**Available for status:** to verify, ready, sent, paid, proforma

### 4. Generate SDI XML

**Steps:**
1. User opens sale detail
2. User clicks "Ri-generate XML"
3. System:
   - Loads sale data with attachments
   - Generates FatturaPA XML format
   - Optionally includes PDF and attachments
   - Stores in media/sdi/sales/
4. System returns to sale detail
5. XML appears in "Documents" section
6. User can download XML for transmission to SDI

**Available for status:** to verify, ready, sent, paid (not proforma)

### 5. Delete Sale

**Steps:**
1. User opens sale detail
2. User clicks "Delete" (if available)
3. System confirms deletion
4. System updates status to "deleted" (soft delete)
5. System redirects to sale detail
6. Sale no longer appears in search results (unless explicitly searching deleted)

**Restrictions:**
- Only sales with status "new" or "to verify" can be deleted
- Deletion is soft (status change), not permanent

### 6. Search and Filter Sales

**Search Criteria:**
- ID
- Registration Number (YYYY/TNNN)
- Registration Date
- Status
- Currency
- Producer
- Buyer
- Item Description (full-text search in sale_lines)
- Item Code (partial match in sale_lines)
- Note

**Search Features:**
- Pagination (configurable page size)
- Sorting (by multiple fields)
- Total counts and summaries
- Excel export

**Results Display:**
- List view with key information
- Totals row showing aggregates
- Click to open detail
- Delete action for eligible sales

### 7. View Sales Reports

**Report Types:**

**Monthly/Yearly Report:**
- Aggregated by buyer, status, and date
- Shows amount by status
- Configurable year/all years
- Filterable by buyer
- Export to Excel

**Summary Counts:**
- Total sales count
- Total EUR amount
- Total VAT
- Total tax
- Total to pay
- Distinct producer count
- Distinct buyer count
- Distinct currency count

---

## Features and Functionality

### Core Features

1. **Sale Management**
   - Create, read, update, delete sales
   - Multi-status workflow
   - Soft delete functionality
   - Invoice numbering per year
   - Support for Invoices, Proformas, Credit Notes

2. **Line Item Management**
   - Multiple products per sale
   - Dynamic add/remove lines
   - Real-time calculation
   - Position ordering
   - Rich product specifications

3. **Customer (Buyer) Management**
   - Full contact information
   - VAT/Tax ID tracking
   - Multi-address support (XML)
   - Status management
   - Operator assignment
   - Industry categorization

4. **Supplier (Producer) Management**
   - Full contact information
   - Bank details (XML)
   - Commission tracking
   - Quality certifications
   - Product specifications
   - Status management

5. **Multi-Currency Support**
   - Transaction currency
   - EUR conversion
   - Display both currencies

6. **VAT Management**
   - Configurable VAT percentage
   - Per-sale or per-line VAT
   - VAT exemptions with codes
   - VAT-off descriptions

7. **Payment Tracking**
   - Payment methods
   - Payment dates
   - Payment notes
   - Bank transfer details
   - Cash on delivery details

8. **Document Management**
   - PDF invoice generation
   - XML SDI generation (Italian e-invoicing)
   - File attachments
   - Document versioning
   - Attachment to SDI

9. **Delivery Note Tracking**
   - Up to 3 delivery notes per sale
   - DN numbers and dates
   - Package descriptions

10. **Public Administration (PA) Support**
    - CUP contract ID
    - CIG contract ID
    - SDI codes
    - PEC email

### Search and Reporting

1. **Advanced Search**
   - Multiple criteria
   - Full-text search on descriptions
   - Partial match on codes
   - Date range search
   - Status filtering
   - Buyer/Producer filtering

2. **Pagination and Sorting**
   - Configurable page size (default 100)
   - Multiple sort options
   - Navigation controls

3. **Summary Reports**
   - Sales count by status
   - Amount aggregations
   - VAT and tax totals
   - Entity counts

4. **Time-Based Reports**
   - Monthly reports
   - Yearly reports
   - Custom date ranges
   - Rollup summaries

5. **Export Capabilities**
   - Sales list to Excel
   - Invoice list to Excel
   - Report data to Excel

### Document Generation

1. **PDF Invoices**
   - Multi-language support (IT, EN, DE, FR)
   - Buyer-specific formatting
   - Configurable font size
   - Logo and branding
   - Line item details
   - Payment terms
   - Bank details

2. **XML SDI (FatturaPA)**
   - Italian standard format
   - Embedded attachments
   - Digital signature ready
   - Validation compliant

### User Interface Features (Current)

1. **List Views**
   - Sortable columns
   - Row highlighting on hover
   - Click to open detail
   - Quick delete action
   - Status indicators
   - Icons for notes and files

2. **Detail Forms**
   - Tabbed sections
   - Dynamic field validation
   - Real-time calculations
   - File upload
   - Gallery view for attachments
   - Collapsible sections

3. **Search Forms**
   - Expandable search panel
   - Dropdown filters
   - Date pickers
   - Auto-complete (for some fields)

---

## Validations and Constraints

### Database Constraints

1. **Primary Keys**
   - All tables have auto-incrementing integer PKs
   - Ensures unique record identification

2. **Unique Constraints**
   - buyers.code - Must be unique
   - producers.code - Must be unique

3. **Foreign Key Behavior**
   - sales.buyer_id → buyers.id (can be NULL)
   - sales.producer_id → producers.id (can be NULL)
   - sale_lines.sale_id → sales.id (CASCADE delete recommended)

4. **Not Null Constraints**
   - buyers.currency - Must have currency
   - buyers.code - Must have code
   - producers.code - Must have code
   - sale_lines.sale_id - Must be linked to sale
   - sale_lines.pos - Must have position

### Business Rules

1. **Sale Creation**
   - Year must be current year or explicitly set
   - Number must be unique within year
   - Number is auto-generated as last_number + 1
   - reg_date defaults to current date

2. **Sale Deletion**
   - Only "new" or "to verify" status can be deleted
   - Deletion is soft (status change to "deleted")
   - Deleted sales excluded from searches (unless explicitly requested)
   - Deleted sales excluded from reports

3. **Sale Lines**
   - Must have sale_id
   - Position (pos) determines order
   - When sale is saved, all existing lines are deleted and recreated
   - Minimum line validation (warning if no lines)

4. **Status Transitions**
   - Valid statuses: new, to verify, proforma, ready, sent, paid, deleted
   - Proforma sales excluded from reports
   - Deleted sales excluded from standard queries

5. **PDF/XML Generation**
   - Only available for: to verify, ready, sent, paid, proforma
   - Requires buyer or producer to be set
   - PDF generation can be re-triggered to update

6. **Numeric Validations**
   - Prices support 6 decimal places
   - Discounts and VAT support 4 decimal places
   - Amounts are decimal with 2 decimal places
   - Negative amounts allowed for credit notes

7. **Date Validations**
   - Dates stored as integers (YYYYMMDD format)
   - Registration date required
   - Payment date optional
   - Delivery note dates optional

8. **Currency Rules**
   - Default currency is EUR
   - All amounts converted to EUR for reporting
   - eur_amount calculated for cross-currency analysis

### Field Validations

1. **Required Fields (Recommended)**
   - Sale: year, number, reg_date, status
   - Sale Line: sale_id, pos, description, qty, price
   - Buyer: code, name, currency
   - Producer: code, name

2. **Format Validations**
   - Email: Valid email format
   - VAT: Country-specific format
   - Currency: 3-letter ISO code
   - Country: 3-letter ISO code
   - Dates: YYYYMMDD integer format

3. **Range Validations**
   - VAT percentage: 0-100
   - Discount: 0-1 (0-100%)
   - Quantity: Positive integer
   - Price: Positive decimal
   - Year: 4-digit year

---

## Reports and Exports

### Sales List Export

**File:** sales_list.xls
**Format:** Excel (XLS)

**Columns:**
- ID
- Document Type (Invoice/ProForma/Credit Note)
- Registration Number
- Registration Date
- Status
- Note indicator
- Buyer Code/Country
- Producer Code/Country
- Currency
- Amount (EUR)
- VAT (EUR)
- Tax (EUR)
- To Pay
- Payment Date

**Features:**
- All search filters applied
- No pagination (all results)
- Formatted numbers with 2 decimals
- Date formatting (DD/MM/YYYY)

### Invoice List Export

**File:** invoices_list.xls
**Format:** Excel (XLS)

**Content:** Detailed invoice information for selected sales

### Sale Report Export

**File:** sale_report.xls
**Format:** Excel (XLS)

**Aggregations:**
- By buyer, status, date (month/year)
- Amount summaries
- Status breakdown
- Time-based analysis
- Rollup totals

**Features:**
- Filterable by year/buyer
- Monthly or yearly grouping
- Status-based summation

### Summary Counts

**Displayed in list header:**
- Total sales found
- Total EUR amount
- Total VAT
- Total tax
- Total to pay
- Distinct buyers
- Distinct producers
- Distinct currencies

---

## Integration Points

### External Systems

1. **SDI (Sistema di Interscambio)**
   - Italian e-invoicing system
   - XML generation in FatturaPA format
   - Recipient codes (sdi_code)
   - PEC email addresses

2. **Banking Systems**
   - IBAN formatting
   - Bank transfer details
   - Commission banking

3. **Email Systems**
   - Invoice delivery
   - Notifications
   - PEC certified email

### Internal Integrations

1. **User Management**
   - Operator assignment
   - User permissions
   - Activity tracking

2. **Commission Module**
   - Links to producer commissions
   - Revenue calculations

3. **Order Module**
   - Links to orders
   - Order-to-invoice flow

4. **Invoice Module**
   - Related invoicing
   - Payment tracking

### File System Integration

**Directory Structure:**
```
webapps/sp/
  media/
    pdf/
      sales/
        sale_{id}.pdf
    sdi/
      sales/
        sale_sdi_{id}.xml
    sale_attachs/
      T{folder}/
        T{id}/
          x/
            {filename}
```

**File Operations:**
- Upload attachments
- Generate PDFs
- Generate XMLs
- Relocate temporary files
- Serve files for download

---

## Technical Requirements

### Database Requirements

1. **MySQL Version:** 5.7 or higher (8.0 recommended)
2. **Storage Engine:** InnoDB (for foreign key support)
3. **Character Set:** UTF-8 (utf8mb4 recommended)
4. **Connection Pooling:** Required for performance
5. **Indexes:** As defined in schema
6. **Full-Text Search:** Enabled on sale_lines.description

### Performance Requirements

1. **Search Response Time:** < 2 seconds for typical queries
2. **PDF Generation:** < 5 seconds per invoice
3. **XML Generation:** < 3 seconds per invoice
4. **Page Load:** < 1 second for detail pages
5. **Concurrent Users:** Support 20+ simultaneous users
6. **Database Connections:** Pool of 10-30 connections

### Security Requirements

1. **Authentication**
   - User login required
   - Session management
   - Operator-based access control

2. **Authorization**
   - Role-based permissions
   - Operator assignment for data isolation
   - Delete restrictions by status

3. **Data Protection**
   - SQL injection prevention (prepared statements)
   - XSS prevention
   - CSRF protection
   - Secure file uploads

4. **Audit Trail**
   - Track creation dates
   - Track modifications (implement if needed)
   - Track deletions (soft delete)

### Localization Requirements

1. **Multi-Language Support**
   - Italian (IT) - Primary
   - English (EN)
   - German (DE)
   - French (FR)

2. **Language Selection**
   - Based on buyer language preference
   - Dictionary-based translations
   - PDF/XML localization

3. **Date Formats**
   - Internal: YYYYMMDD (integer)
   - Display: Localized (DD/MM/YYYY for IT)

4. **Number Formats**
   - Decimal separator: Locale-specific
   - Thousands separator: Locale-specific
   - Currency symbols: Locale-specific

### Backup and Recovery

1. **Database Backup**
   - Daily full backups
   - Transaction log backups
   - Point-in-time recovery capability

2. **File System Backup**
   - PDF archive backups
   - XML archive backups
   - Attachment backups

3. **Disaster Recovery**
   - Recovery time objective (RTO): 4 hours
   - Recovery point objective (RPO): 24 hours
   - Tested recovery procedures

---

## Migration Considerations

### Data Migration

1. **Sales Table**
   - Preserve all historical sales
   - Maintain sale numbers and years
   - Convert XML fields to JSON (recommended)
   - Map status values

2. **Sale Lines**
   - Preserve all line items
   - Maintain position ordering
   - Ensure sale_id integrity

3. **Buyers**
   - Migrate all buyer records
   - Preserve unique codes
   - Convert shipping XML to structured format
   - Map status values

4. **Producers**
   - Migrate all producer records
   - Preserve unique codes
   - Convert banks XML to structured format
   - Map status values

### File Migration

1. **PDF Files**
   - Copy all existing PDFs
   - Maintain directory structure
   - Verify file integrity

2. **XML SDI Files**
   - Copy all existing XMLs
   - Validate XML structure
   - Maintain directory structure

3. **Attachments**
   - Copy all attachments
   - Maintain folder structure
   - Update file paths if needed

---

## Appendix A: Expand Data (Configuration)

**Expand data** is configuration data loaded from XML files. Here are the key expand tables for the Sale module:

### sales_status
- new
- to verify
- proforma
- ready
- sent
- paid
- deleted

### sales_payment
- Bank Transfer
- Cash on Delivery
- Wire Transfer
- Check
- PayPal
- Credit Card
- etc.

### sales_vat_off (VAT Exemption Codes)
- N1: Excluded from VAT
- N2: Not subject
- N3: Not taxable
- N4: Exempt
- N5: Reverse charge
- etc.

### sale_currencies
Loaded dynamically from z_countries table based on sales data

### sale_buyers
Loaded dynamically from buyers table (only buyers with sales)

### sale_producers
Loaded dynamically from producers table (only producers with sales)

### sales_sort (Sort Options)
- id desc
- id asc
- number desc
- number asc
- reg_date desc
- reg_date asc
- buyer_code
- producer_code
- amount desc

### sales_num (Page Size Options)
- 10
- 20
- 50
- 100 (default)
- 200
- 500

---

## Appendix B: SQL Queries

### Key Queries Used by the System

**1. Get Sales List with Filters:**
```sql
SELECT
    sales.id, sales.number, sales.year, sales.status,
    sales.producer_id, sales.reg_date, sales.note,
    sales.code, sales.country, sales.currency,
    sales.eur_amount, sales.amount, sales.eur_pay_load,
    sales.vat_perc, sales.vat, sales.tax, sales.total, sales.pay_load,
    sales.payment_date,
    buyers.name as buyer_name,
    buyers.code as buyer_code,
    buyers.country as buyer_country,
    producers.name as prod_name,
    producers.code as prod_code,
    producers.country as prod_country
FROM sales
    LEFT JOIN sale_lines ON sales.id = sale_lines.sale_id
    LEFT JOIN buyers ON (sales.buyer_id = buyers.id)
    LEFT JOIN producers ON (sales.producer_id = producers.id)
WHERE 1=1
    AND NOT (status IN ('proforma', 'deleted'))
    -- Filters applied dynamically based on search criteria
GROUP BY sales.id
ORDER BY id DESC
LIMIT 100;
```

**2. Get Sales Summary Counts:**
```sql
SELECT
    COUNT(DISTINCT id) as sales_count,
    IFNULL(SUM(eur_amount), 0) as eur_amount,
    IFNULL(SUM(vat), 0) as total_vat,
    IFNULL(SUM(tax), 0) as total_tax,
    IFNULL(SUM(pay_load), 0) as total_to_pay,
    COUNT(DISTINCT(producer_id)) as producer_num,
    COUNT(DISTINCT(buyer_id)) as buyer_num,
    COUNT(DISTINCT(currency)) as cur_num
FROM (
    SELECT sales.id, sales.eur_amount, sales.vat, sales.tax,
           sales.pay_load, sales.producer_id, sales.buyer_id, sales.currency
    FROM sales
        LEFT JOIN sale_lines ON sales.id = sale_lines.sale_id
    WHERE NOT (status IN ('proforma', 'deleted'))
    GROUP BY sales.id
) s1;
```

**3. Create New Sale:**
```sql
-- Get last number
SELECT number, year FROM sales
WHERE NOT (status IN ('proforma', 'deleted'))
ORDER BY year DESC, number DESC
LIMIT 1;

-- Insert new sale
INSERT INTO sales (reg_date, year, number)
VALUES (DATE_FORMAT(NOW(), '%Y%m%d'), 2024, 43);
```

**4. Get Sale Detail:**
```sql
SELECT * FROM sales WHERE sales.id = ?;
SELECT * FROM sale_lines WHERE sale_id = ? ORDER BY pos;
SELECT id, name, country, code FROM buyers WHERE status='online' ORDER BY name, country;
SELECT id, name, country, code FROM producers WHERE status='online' ORDER BY name, country;
```

**5. Save Sale and Lines:**
```sql
-- Update sale
UPDATE sales SET
    status = ?,
    producer_id = ?,
    buyer_id = ?,
    -- ... other fields
WHERE id = ?;

-- Delete existing lines
DELETE FROM sale_lines WHERE sale_id = ?;

-- Insert new lines
INSERT INTO sale_lines
    (sale_id, pos, description, code, qty, price, discount, vat)
VALUES
    (?, 1, ?, ?, ?, ?, ?, ?),
    (?, 2, ?, ?, ?, ?, ?, ?),
    -- ... more lines
;
```

**6. Sales Report (Monthly):**
```sql
SELECT
    sales.buyer_id, sales.status,
    buyers.code,
    DATE_FORMAT(reg_date, '%Y%m') as date,
    DATE_FORMAT(reg_date, '%c') as month,
    SUM(sales.eur_amount) as amount,
    status_order
FROM sales
    LEFT JOIN buyers ON sales.buyer_id = buyers.id
    LEFT JOIN z_order_status ON sales.status = z_order_status.status
        AND z_order_status.module='sales'
WHERE
    reg_date > 20190101 AND
    NOT (sales.status IN ('deleted', 'new', 'proforma', 'to verify'))
    AND YEAR(reg_date) = ?
GROUP BY buyer_id, status, DATE_FORMAT(reg_date, '%Y%m')
WITH ROLLUP;
```

---

## Appendix C: API Endpoints (Current System)

The current system uses URL-based routing:

### Sale Module Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| sale_home.xhtml | GET | Sales list/search page |
| sale_home_xls.xhtml | GET | Export sales list to Excel |
| sale_detail.xhtml?sale_id={id} | GET | Sale detail page |
| sale_new.xhtml | GET | Create new sale (script) |
| sale_save.xhtml | POST | Save sale (AJAX) |
| sale_delete.xhtml?delete_sale_id={id} | GET | Delete sale (script) |
| sale_home_delete.xhtml?delete_sale_id={id} | GET | Delete sale from list |
| sale_print.xhtml?sale_id={id} | GET | Generate PDF |
| sale_sdi.xhtml?sale_id={id} | GET | Generate SDI XML |
| sale_report.xhtml?year={year}&buyer={id}&mode={mode} | GET | Sales report |
| sale_report_xls.xhtml | GET | Export sales report to Excel |
| sale_invoices_xls.xhtml | GET | Export invoices to Excel |

### Buyer Module Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| buyer_home.xhtml | GET | Buyers list/search page |
| buyer_home_xls.xhtml | GET | Export buyers list to Excel |
| buyer_detail.xhtml?buyer_id={id} | GET | Buyer detail page |
| buyer_new.xhtml | GET | Create new buyer (script) |
| buyer_save.xhtml | POST | Save buyer |
| buyer_delete.xhtml?delete_buyer_id={id} | GET | Delete buyer (script) |

### Producer Module Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| producer_home.xhtml | GET | Producers list/search page |
| producer_home_xls.xhtml | GET | Export producers list to Excel |
| producer_detail.xhtml?producer_id={id} | GET | Producer detail page |
| producer_new.xhtml | GET | Create new producer (script) |
| producer_save.xhtml | POST | Save producer |
| producer_delete.xhtml?delete_producer_id={id} | GET | Delete producer (script) |

---

## Appendix D: Recommended Modern Architecture

For rebuilding the application from scratch, consider:

### Technology Stack

**Backend:**
- Node.js + Express or Python + FastAPI or Java + Spring Boot
- RESTful API architecture
- JWT authentication
- ORM (Sequelize, SQLAlchemy, or Hibernate)

**Frontend:**
- React, Vue.js, or Angular
- Component-based UI
- State management (Redux, Vuex, etc.)
- Modern UI library (Material-UI, Ant Design, etc.)

**Database:**
- MySQL 8.0+ or PostgreSQL
- Schema as documented
- Migration scripts

**File Storage:**
- Local filesystem or S3-compatible storage
- Organized directory structure

**Document Generation:**
- PDF: Puppeteer, wkhtmltopdf, or Apache PDFBox
- XML: Native language libraries

### API Design (RESTful)

```
GET    /api/sales                 - List sales (with filters)
POST   /api/sales                 - Create new sale
GET    /api/sales/{id}            - Get sale detail
PUT    /api/sales/{id}            - Update sale
DELETE /api/sales/{id}            - Delete sale (soft)

GET    /api/sales/{id}/lines      - Get sale lines
POST   /api/sales/{id}/lines      - Add line
PUT    /api/sales/{id}/lines/{id} - Update line
DELETE /api/sales/{id}/lines/{id} - Delete line

POST   /api/sales/{id}/generate-pdf  - Generate PDF
POST   /api/sales/{id}/generate-xml  - Generate SDI XML
GET    /api/sales/{id}/documents     - List documents

GET    /api/sales/report          - Get sales report

GET    /api/buyers                - List buyers
POST   /api/buyers                - Create buyer
GET    /api/buyers/{id}           - Get buyer detail
PUT    /api/buyers/{id}           - Update buyer
DELETE /api/buyers/{id}           - Delete buyer

GET    /api/producers             - List producers
POST   /api/producers             - Create producer
GET    /api/producers/{id}        - Get producer detail
PUT    /api/producers/{id}        - Update producer
DELETE /api/producers/{id}        - Delete producer

GET    /api/config/statuses       - Get status options
GET    /api/config/payments       - Get payment options
GET    /api/config/vat-exemptions - Get VAT exemption codes
GET    /api/config/currencies     - Get currency options
```

### Frontend Structure

```
src/
  components/
    sales/
      SaleList.jsx
      SaleDetail.jsx
      SaleForm.jsx
      SaleLineEditor.jsx
      SaleSearch.jsx
    buyers/
      BuyerList.jsx
      BuyerDetail.jsx
      BuyerForm.jsx
    producers/
      ProducerList.jsx
      ProducerDetail.jsx
      ProducerForm.jsx
    common/
      Layout.jsx
      Navbar.jsx
      Pagination.jsx
      DataTable.jsx
  services/
    salesService.js
    buyersService.js
    producersService.js
    documentService.js
  store/
    salesSlice.js
    buyersSlice.js
    producersSlice.js
  utils/
    formatters.js
    validators.js
    calculations.js
```

### Modern Workflow Improvements

1. **Real-Time Validation**
   - Immediate field validation
   - Async validation for unique checks
   - Form-level validation

2. **Auto-Save**
   - Draft saving
   - Prevent data loss
   - Version control

3. **Inline Editing**
   - Edit fields directly in list
   - Quick updates without full form

4. **Batch Operations**
   - Bulk status changes
   - Bulk exports
   - Bulk deletions

5. **Advanced Search**
   - Saved searches
   - Quick filters
   - Search history

6. **Dashboard**
   - Sales metrics
   - Status breakdown
   - Recent activity
   - Charts and graphs

7. **Notifications**
   - Real-time updates
   - Email notifications
   - Status change alerts

8. **Mobile Responsive**
   - Mobile-first design
   - Touch-friendly interface
   - Progressive Web App (PWA)

9. **Accessibility**
   - WCAG 2.1 compliance
   - Keyboard navigation
   - Screen reader support

10. **Performance**
    - Lazy loading
    - Virtual scrolling for large lists
    - Optimistic UI updates
    - Caching strategies

---

## Document History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-01-27 | Analysis Team | Initial comprehensive specification |

---

## End of Document
