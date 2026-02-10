# Invoice Template Analysis - XSLT to Modern Template Engine

**Date**: 2026-01-28
**Purpose**: Analysis of current XSLT-based invoice templates to guide Template Renderer Lambda implementation

---

## Executive Summary

The current system uses **XSLT 2.0** transformations to generate invoice HTML from XML data. The invoice template is **language-agnostic** with a **dictionary-based translation system** supporting IT, EN, DE, FR.

**Key Finding**: There is **ONE base invoice template** with language variations, not separate templates per language. The French template (`sale_invoice_fr.xslt`) appears to be nearly identical to the main template, suggesting they could be unified.

---

## Current Architecture

### Template Files

| File | Purpose | Status |
|------|---------|--------|
| `sale_invoice.xslt` | Main invoice template (all languages) | ✅ Active |
| `sale_invoice_fr.xslt` | French variant (nearly identical) | ⚠️ Duplicate |
| `it.xml` | Italian dictionary | ✅ Active |
| `en.xml` | English dictionary | ✅ Active |
| `de.xml` | German dictionary | ✅ Active |
| `fr.xml` | French dictionary | ✅ Active |

### Data Flow

```
┌─────────────────┐
│   Sale Data     │
│   (XML/JSON)    │
└────────┬────────┘
         │
         │ includes: sale, buyer, producer,
         │ sale_lines, dictionary
         ▼
┌─────────────────┐
│  XSLT Template  │
│  + Dictionary   │
└────────┬────────┘
         │
         │ Transformation
         ▼
┌─────────────────┐
│   HTML Output   │
│  (with CSS)     │
└────────┬────────┘
         │
         │ Apache FOP
         ▼
┌─────────────────┐
│   PDF Invoice   │
└─────────────────┘
```

---

## Template Structure Analysis

### 1. Document Layout

The invoice has these main sections:

```
┌──────────────────────────────────────┐
│           SPEEDEX LOGO               │
├──────────────────────────────────────┤
│  Document Info (Type, Number, Date)  │
├──────────────────────────────────────┤
│  Speedex Info (Seller/Cedente)       │
│  - Company name, address             │
│  - VAT, Email, Phone                 │
├──────────────────────────────────────┤
│  Buyer Info (Cessionario)            │
│  - Company name, address             │
│  - VAT, Tax ID                       │
├──────────────────────────────────────┤
│  Line Items Table                    │
│  - Description, Code, Qty, Price     │
│  - Discount, VAT, Total              │
│  - Subtotals and grand total         │
├──────────────────────────────────────┤
│  Additional Info                     │
│  - VAT notes                         │
│  - Package/Delivery                  │
│  - Payment terms and bank details    │
│  - Sale notes                        │
└──────────────────────────────────────┘
         Footer (page numbers)
```

### 2. Data Model

The template expects this XML structure:

```xml
<cc:data>
  <sales>
    <sale
      id="2001"
      number="42"
      year="2024"
      status="sent"
      reg_date="20240315"
      currency="EUR"
      amount="5750.00"
      vat="1265.00"
      pay_load="7015.00"
      buyer_ref="Customer Order #123"
      payment="MP05"
      bank_id="unicredit"
      payment_date="20240420"
      sale_note="..."
      package="..."
      delivery="..."
      stamp="0"
      font_base="12">

      <buyers
        name="Berrang SE"
        address="Elsa-Brandstroem-Strasse 12"
        city="Mannheim"
        zip="D-68229"
        country="DEU"
        vat="DE364389326"
        lang="de"/>
    </sale>
  </sales>

  <sale_lines>
    <sale_line
      pos="1"
      description="TONE ELECTRIC SHEAR WRENCH"
      code="GV302-EZ"
      qty="1"
      price="5750.000000"
      discount="0"
      vat="0"/>
  </sale_lines>

  <dict>
    <t id="fattura">Rechnung</t>
    <t id="numero">Nummer</t>
    <!-- ... more dictionary entries ... -->
  </dict>

  <banks>
    <bank id="unicredit" iban="IT..." swift="...">UniCredit</bank>
  </banks>

  <table id="countries">
    <label key="DEU">Deutschland</label>
    <label key="DEU" it_name="Germania"/>
  </table>
</cc:data>
```

### 3. Dictionary System

**Structure**: Simple key-value pairs

```xml
<dict>
  <t id="fattura">Invoice</t>
  <t id="numero">Number</t>
  <t id="data">Date</t>
  <!-- ... -->
</dict>
```

**Usage in template**:
```xml
<xsl:value-of select="my:dict('fattura')"/>
<!-- Outputs: "Invoice" (EN) or "Fattura" (IT) -->
```

**Dictionary Keys** (54 total):
- Document labels: `fattura`, `numero`, `data`, `documento`, etc.
- Field labels: `descrizione`, `codice`, `qty`, `prezzo`, etc.
- Totals: `totale_imponibile`, `totale_iva`, `totale_da_pagare`
- Payment methods: `MP05` (Bank Transfer), `MP12` (Collection), etc.
- VAT exemptions: `vat_off_N31`
- Package/Incoterms: `package_bulk`, `incoterms_EXW`, etc.

### 4. Helper Functions

The template uses custom XSLT functions:

| Function | Purpose | Example |
|----------|---------|---------|
| `my:dict($key)` | Get dictionary translation | `my:dict('fattura')` → "Invoice" |
| `my:value($num, $lang)` | Format currency (2 decimals) | `my:value(1234.5, 'de')` → "1.234,50" |
| `my:flex_value($num, $lang)` | Format price (2-8 decimals) | `my:flex_value(5750.123456, 'en')` → "5,750.123456" |
| `my:vat($num, $lang)` | Format VAT percentage | `my:vat(22.5, 'it')` → "22,5" |
| `my:qty($num, $lang)` | Format quantity (no decimals) | `my:qty(100, 'en')` → "100" |
| `my:date($date)` | Format date (YYYYMMDD → localized) | `my:date(20240315)` → "15/03/2024" |

**Number Formatting by Language**:
- **IT/DE**: `1.234,56` (period for thousands, comma for decimals)
- **EN**: `1,234.56` (comma for thousands, period for decimals)

### 5. Business Logic

**Document Type Detection**:
```xml
<xsl:value-of select="if ($sale/@status='proforma')
                      then my:dict('fattura_pro_forma')
                      else (if ($sale/@pay_load &lt; 0)
                            then my:dict('nota_di_credito')
                            else my:dict('fattura'))"/>
```
- Proforma: "Fattura Pro Forma"
- Negative amount: "Nota di Credito" (Credit Note)
- Regular: "Fattura" (Invoice)

**Address History** (Date-based logic):
```xml
<xsl:when test="$sale/@reg_date &#60; '20190201'">
  <td>Via Watt, 37</td>
  <td>2017 Milano (MI)</td>
</xsl:when>
<xsl:otherwise>
  <td>Via Lago di Nemi, 25</td>
  <td>20142 Milano (MI)</td>
</xsl:otherwise>
```
Speedex moved offices in February 2019.

**Conditional Column Display**:
- Show "Code" column only if any line has a code
- Show "Discount" column only if any line has a discount
- Adjust column widths dynamically

**Line Calculations**:
```javascript
discount = if(discount > 0) then discount else 0
vat = if(vat > 0) then vat else 0
cost = price × qty × (100 - discount) / 100
vat_amount = cost × vat / 100
total = cost × (100 + vat) / 100
```

**Revenue Stamp (Marca da Bollo)**:
- If `stamp=1`, add a line item for €2.00
- No VAT on stamp
- Shown after regular line items

**Split Payment** (Scissione dei pagamenti):
- If buyer has `vatoff='split'`
- Show total with VAT, then subtract VAT
- Special note: "Scissione dei pagamenti ex art 17-ter DPR 633/72"

**Payment Method Display**:
Three payment types with different layouts:
1. **MP12** (Ricevuta Bancaria): Shows payment method, due date, bank, IBAN
2. **MP05R** (Bonifico Bancario): Same as MP12
3. **Standard Bank Transfer**: Shows bank from `banks` lookup table

### 6. Styling (CSS)

**Color Scheme**:
- Primary: `#BB0231` (Speedex red)
- Text: `#444` (dark gray)
- Borders: `#777` (medium gray)
- Highlights: `#BB0231` (red labels)

**Fonts**:
- Main: Trebuchet MS
- Base size: Configurable via `@font_base` (default 12px)
- Relative sizing with `em` units

**Page Layout**:
- Size: A4 (21.0cm × 29.7cm)
- Margins: 0.50in (top, left, right), 0.20in (bottom)
- Font: Trebuchet MS

**Table Styling**:
- Header: Red background (`#BB0231`), white text
- Alternating rows: `#f9f9f9` / `#ffffff`
- Borders: Dotted gray (`#777`)
- Column widths: Fixed (px) for precise layout

**Print Features**:
- Page numbers in footer: `page X of Y`
- Page breaks: Avoid breaking line item table
- Header/Footer regions for continuous printing

---

## Multi-Language Support

### Language Detection

Language is determined from buyer:
```xml
<xsl:variable name="lan" select="$buyer/@lang"/>
```

Supported languages: `it`, `en`, `de`, `fr`

### Dictionary Translations

All user-visible text uses `my:dict()`:

```xml
<!-- Italian -->
<xsl:value-of select="my:dict('fattura')"/>  → "Fattura"

<!-- English -->
<xsl:value-of select="my:dict('fattura')"/>  → "Invoice"

<!-- German -->
<xsl:value-of select="my:dict('fattura')"/>  → "Rechnung"

<!-- French -->
<xsl:value-of select="my:dict('fattura')"/>  → "Facture"
```

### Number Formatting

- **IT/DE**: Comma for decimal, period for thousands
- **EN/FR**: Period for decimal, comma for thousands

### Country Names

Special handling for country names:
```xml
<xsl:choose>
  <xsl:when test="$buyer/@lang='en'">
    <!-- Use English name -->
    <xsl:value-of select="//cc:data//table[@id='countries']/label[@key=$buyer/@country]"/>
  </xsl:when>
  <xsl:otherwise>
    <!-- Use Italian name attribute -->
    <xsl:value-of select="//cc:data//table[@id='countries']/label[@key=$buyer/@country]/@it_name"/>
  </xsl:otherwise>
</xsl:choose>
```

---

## Conversion Strategy

### Recommended Template Engine: **Handlebars**

**Reasons**:
1. Simple, logic-less syntax (easy conversion from XSLT)
2. Built-in helpers for formatting
3. Partials for reusable sections
4. No eval/compile security issues
5. Fast rendering
6. Good TypeScript support

**Alternative**: Nunjucks (more powerful, Jinja2-like)

### Template Structure (Handlebars)

```handlebars
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>{{t 'fattura'}} T{{sale.number}}/{{sale.year}}</title>
  <style>
    /* Embedded CSS - same as XSLT */
    html, body { font-size: {{sale.font_base}}px; }
    /* ... rest of CSS ... */
  </style>
</head>
<body>
  <!-- Header/Footer -->
  <div class="footer">
    <table class="footer">
      <tr>
        <td class="left">
          {{t 'fattura'}} T{{sale.number}}/{{sale.year}}
          {{buyer.name}} - {{formatDate sale.reg_date}}
        </td>
        <td class="right">{{t 'pag'}} <span class="page"/> {{t 'di'}} <span class="pages"/></td>
      </tr>
    </table>
  </div>

  <!-- Logo -->
  <div>
    <table width="100%">
      <tr>
        <td class="logo">
          <img src="../../media/_svg/speedex_red_large.svg" />
        </td>
      </tr>
    </table>
  </div>

  <!-- Document Info -->
  <div class="invoice_info">
    <table cellspacing="6">
      <tr>
        <td class="label empty" rowspan="4"></td>
        <td class="label doc">{{t 'documento'}}</td>
        <td class="field big">
          {{#if (eq sale.status 'proforma')}}
            {{t 'fattura_pro_forma'}}
          {{else if (lt sale.pay_load 0)}}
            {{t 'nota_di_credito'}}
          {{else}}
            {{t 'fattura'}}
          {{/if}}
        </td>
      </tr>
      <tr>
        <td class="label">{{t 'numero'}}</td>
        <td class="field"><span class="highlight">T{{sale.number}}/{{sale.year}}</span></td>
      </tr>
      <tr>
        <td class="label">{{t 'data'}}</td>
        <td class="field">{{formatDate sale.reg_date}}</td>
      </tr>
      <tr>
        <td class="label">{{t 'transazione'}}</td>
        <td class="field">D{{sale.full_id}}</td>
      </tr>
    </table>
  </div>

  <!-- Speedex Info (Cedente) -->
  <div class="emessa">
    <table cellspacing="6">
      <tr>
        <td class="label emessa">{{t 'cedente'}}</td>
        <td class="field emessa"><span>Speedex Srl</span></td>
      </tr>
      {{#if (dateBefore sale.reg_date '20190201')}}
        <tr><td class="label small">{{t 'indirizzo'}}</td><td class="field small">Via Watt, 37</td></tr>
        <tr><td class="label small"></td><td class="field small">2017 Milano (MI)</td></tr>
      {{else}}
        <tr><td class="label small">{{t 'indirizzo'}}</td><td class="field small">Via Lago di Nemi, 25</td></tr>
        <tr><td class="label small"></td><td class="field small">20142 Milano (MI)</td></tr>
      {{/if}}
      <tr><td class="label small"></td><td class="field small">Italia</td></tr>
      <tr><td class="label small">{{t 'partita_iva'}}</td><td class="field small">IT05056450157</td></tr>
      <tr><td class="label small">Email</td><td class="field small">info@speedex.it</td></tr>
      <tr><td class="label small">{{t 'tel'}}</td><td class="field small">+39 02 89121816</td></tr>
      <tr><td class="label small">Fax</td><td class="field small">+39 02 36504578</td></tr>
    </table>
  </div>

  <!-- Buyer Info (Cessionario) -->
  <div>
    <table cellspacing="6">
      <tr>
        <td class="label empty"></td>
        <td class="label dict">{{t 'cessionario'}}</td>
        <td class="field"><span class="account">{{buyer.name}}</span></td>
      </tr>
      <tr>
        <td></td>
        <td class="label small">{{t 'indirizzo'}}</td>
        <td class="field small">{{buyer.address}}{{#if buyer.box}} {{buyer.box}}{{/if}}</td>
      </tr>
      <tr>
        <td></td>
        <td class="label"></td>
        <td class="field small">
          {{#if buyer.zip}}{{buyer.zip}} {{/if}}
          {{#if buyer.city}}{{buyer.city}}{{/if}}
          {{#if buyer.prov}} ({{buyer.prov}}){{/if}}
        </td>
      </tr>
      <tr>
        <td></td>
        <td class="label"></td>
        <td class="field small">{{getCountryName buyer.country buyer.lang}}</td>
      </tr>
      {{#if buyer.vat}}
        <tr>
          <td></td>
          <td class="label small">{{t 'partita_iva'}}</td>
          <td class="field small">{{buyer.vat}}</td>
        </tr>
      {{/if}}
      {{#if buyer.taxid}}
        <tr>
          <td></td>
          <td class="label small">{{t 'codice_fiscale'}}</td>
          <td class="field small">{{buyer.taxid}}</td>
        </tr>
      {{/if}}
    </table>
  </div>

  <!-- Line Items -->
  <div class="invoice_list">
    {{#if sale.buyer_ref}}
      <div class="subject">{{nl2br sale.buyer_ref}}</div>
    {{/if}}

    <table class="invoice_list" cellpadding="2" cellspacing="2">
      <thead>
        <tr>
          <th class="empty"></th>
          {{#if hasCode sale_lines}}
            <th class="descr">{{t 'descrizione'}}</th>
            <th class="code">{{t 'codice'}}</th>
          {{else}}
            <th class="description">{{t 'descrizione'}}</th>
          {{/if}}
          <th class="qty">{{t 'qty'}}</th>
          {{#if hasDiscount sale_lines}}
            <th class="price">{{t 'prezzo'}}<br/><span class="small_price">{{sale.currency}}</span></th>
            <th class="discount_perc">{{t 'sconto'}}<br/><span class="small_price">%</span></th>
          {{else}}
            <th class="price_long">{{t 'prezzo'}}<br/><span class="small_price">{{sale.currency}}</span></th>
          {{/if}}
          <th class="cost">{{t 'imponibile'}}<br/><span class="small_price">{{sale.currency}}</span></th>
          <th class="iva_perc">{{t 'iva'}}<br/><span class="small_price">%</span></th>
          <th class="iva_total">{{t 'iva'}}<br/><span class="small_price">{{sale.currency}}</span></th>
          <th class="total">{{t 'totale_line'}}<br/><span class="small_price">{{sale.currency}}</span></th>
        </tr>
      </thead>
      <tbody>
        {{#each sale_lines}}
          <tr class="alt{{mod @index 2}}">
            <td>{{add @index 1}}</td>
            {{#if (hasCode ../sale_lines)}}
              <td class="buyer">{{nl2br description}}</td>
              <td class="buyer">{{code}}</td>
            {{else}}
              <td class="buyer">{{nl2br description}}</td>
            {{/if}}
            <td>{{#if qty}}{{formatQty qty ../buyer.lang}}{{/if}}</td>
            {{#if (hasDiscount ../sale_lines)}}
              <td>{{#if price}}{{formatFlexValue price ../buyer.lang}}{{/if}}</td>
              <td>{{#if discount}}{{formatVAT discount ../buyer.lang}}{{/if}}</td>
            {{else}}
              <td>{{#if price}}{{formatFlexValue price ../buyer.lang}}{{/if}}</td>
            {{/if}}
            <td>{{formatValue (calcCost price qty discount) ../buyer.lang}}</td>
            <td>{{formatVAT vat ../buyer.lang}}%</td>
            <td>{{#if price}}{{formatValue (calcVATAmount price qty discount vat) ../buyer.lang}}{{/if}}</td>
            <td>{{formatValue (calcLineTotal price qty discount vat) ../buyer.lang}}</td>
          </tr>
        {{/each}}

        {{#if sale.stamp}}
          <tr class="alt{{mod (add (length sale_lines) 1) 2}}">
            <td>{{add (length sale_lines) 1}}</td>
            {{#if (hasCode sale_lines)}}
              <td class="buyer">{{t 'marca_da_bollo'}}</td>
              <td class="buyer"></td>
            {{else}}
              <td class="buyer">{{t 'marca_da_bollo'}}</td>
            {{/if}}
            <td>1</td>
            {{#if (hasDiscount sale_lines)}}
              <td>{{formatValue 2 buyer.lang}}</td>
              <td></td>
            {{else}}
              <td>{{formatValue 2 buyer.lang}}</td>
            {{/if}}
            <td>{{formatValue 2 buyer.lang}}</td>
            <td>{{formatVAT 0 buyer.lang}}%</td>
            <td>{{formatValue 0 buyer.lang}}</td>
            <td>{{formatValue 2 buyer.lang}}</td>
          </tr>
        {{/if}}

        <!-- Totals -->
        <tr>
          <th class="semi_total1" colspan="{{colSpan sale_lines}}">
            {{t 'totale_imponibile'}} {{sale.currency}} {{formatValue sale.eur_amount buyer.lang}}
          </th>
          <th class="semi_total1 last_col" colspan="3"></th>
        </tr>
        <tr>
          <th class="semi_total2" colspan="{{add (colSpan sale_lines) 2}}">
            {{t 'totale_iva'}} {{sale.currency}} {{formatValue sale.vat buyer.lang}}
          </th>
          <th class="semi_total2 last_col"></th>
        </tr>
        {{#if (eq buyer.vatoff 'split')}}
          <tr>
            <th class="semi_total1" colspan="{{add (colSpan sale_lines) 3}}">
              {{t 'totale_fattura'}}  {{formatValue sale.to_pay buyer.lang}} {{sale.currency}}
            </th>
          </tr>
          <tr>
            <th class="semi_total2" colspan="{{add (colSpan sale_lines) 3}}">
              {{t 'split_payment'}}  {{formatValue (negate sale.vat) buyer.lang}} {{sale.currency}}
            </th>
          </tr>
        {{/if}}
        <tr>
          <th class="big_total" colspan="{{add (colSpan sale_lines) 3}}">
            {{t 'totale_da_pagare'}}  {{formatValue sale.pay_load buyer.lang}} {{sale.currency}}
          </th>
        </tr>
      </tbody>
    </table>
  </div>

  <!-- Additional Info -->
  <div>
    <table cellspacing="6" class="provvigione">
      {{#if (eq sale.vat_off 'novat')}}
        <tr>
          <td class="label">Annotazioni IVA</td>
          <td class="field">{{t 'vat_off_N31'}}</td>
        </tr>
      {{/if}}

      {{#if sale.package}}
        <tr>
          <td class="label">{{t 'imballo'}}</td>
          <td class="field">{{nl2br sale.package}}</td>
        </tr>
      {{/if}}

      {{#if sale.delivery}}
        <tr>
          <td class="label">{{t 'shipping'}}</td>
          <td class="field">{{nl2br sale.delivery}}</td>
        </tr>
      {{/if}}

      <!-- Payment Methods -->
      {{#if (eq sale.payment 'MP12')}}
        <tr>
          <td class="label">{{t 'pagamento'}}</td>
          <td class="field">{{t sale.payment}}<br/>{{nl2br sale.payment_note}}</td>
        </tr>
        <tr>
          <td class="label">{{t 'scadenza'}}</td>
          <td class="field">{{formatDate sale.payment_date}}</td>
        </tr>
        <tr>
          <td class="label">{{t 'banca'}}</td>
          <td class="field">{{sale.payment_bank}}</td>
        </tr>
        <tr>
          <td class="label">IBAN</td>
          <td class="field">{{sale.payment_bank_iban}}</td>
        </tr>
      {{else if (eq sale.payment 'MP05R')}}
        <tr>
          <td class="label">{{t 'pagamento'}}</td>
          <td class="field">{{t sale.payment}}<br/>{{nl2br sale.payment_note}}</td>
        </tr>
        <tr>
          <td class="label">{{t 'scadenza'}}</td>
          <td class="field">{{formatDate sale.payment_date}}</td>
        </tr>
        <tr>
          <td class="label">{{t 'banca'}}</td>
          <td class="field">{{sale.payment_bank}}</td>
        </tr>
        <tr>
          <td class="label">IBAN</td>
          <td class="field">{{sale.payment_bank_iban}}</td>
        </tr>
      {{else if sale.bank_id}}
        <tr>
          <td class="label">{{t 'pagamento'}}</td>
          <td class="field">{{t 'tramite_bonifico'}}<br/>{{nl2br sale.payment_note}}</td>
        </tr>
        {{#if sale.payment_date}}
          <tr>
            <td class="label">{{t 'scadenza'}}</td>
            <td class="field">{{formatDate sale.payment_date}}</td>
          </tr>
        {{/if}}
        {{#with (getBank banks sale.bank_id)}}
          <tr>
            <td class="label">{{t 'banca'}}</td>
            <td class="field">{{name}}{{#if branch_address}}, {{branch_address}}{{/if}}</td>
          </tr>
          {{#if swift}}
            <tr>
              <td class="label">SWIFT</td>
              <td class="field">{{swift}}</td>
            </tr>
          {{/if}}
          <tr>
            <td class="label">IBAN</td>
            <td class="field">{{iban}}</td>
          </tr>
        {{/with}}
      {{/if}}

      {{#if sale.sale_note}}
        <tr>
          <td class="label">{{t 'note'}}</td>
          <td class="field">{{nl2br sale.sale_note}}</td>
        </tr>
      {{/if}}
    </table>
  </div>
</body>
</html>
```

### Required Handlebars Helpers

```typescript
// Localization
t(key: string, data: any): string  // Dictionary lookup
formatDate(yyyymmdd: number, lang: string): string  // 20240315 → "15/03/2024"
formatValue(num: number, lang: string): string  // 1234.56 → "1.234,56" (IT) or "1,234.56" (EN)
formatFlexValue(num: number, lang: string): string  // 2-8 decimals
formatVAT(num: number, lang: string): string  // VAT percentage
formatQty(num: number, lang: string): string  // Quantity (no decimals)
getCountryName(code: string, lang: string): string  // Country name

// Logic
eq(a: any, b: any): boolean  // Equality check
lt(a: number, b: number): boolean  // Less than
gt(a: number, b: number): boolean  // Greater than
dateBefore(date: string, compare: string): boolean  // Date comparison
hasCode(lines: any[]): boolean  // Any line has code?
hasDiscount(lines: any[]): boolean  // Any line has discount?

// Calculations
calcCost(price: number, qty: number, discount: number): number
calcVATAmount(price: number, qty: number, discount: number, vat: number): number
calcLineTotal(price: number, qty: number, discount: number, vat: number): number
colSpan(lines: any[]): number  // Calculate colspan based on columns

// Utilities
nl2br(text: string): string  // Convert newlines to <br/>
add(a: number, b: number): number  // Addition
mod(a: number, b: number): number  // Modulo
negate(num: number): number  // Negate number
getBank(banks: any[], id: string): any  // Bank lookup
```

---

## Implementation Plan for Template Renderer Lambda

### Phase 1: Setup (Week 1)

1. **Create Lambda Function Structure**
   ```
   /functions/template-renderer/
     src/
       index.ts           - Lambda handler
       template-engine.ts - Handlebars integration
       helpers.ts         - Handlebars helper functions
       i18n.ts           - Dictionary loader
       formatters.ts      - Number/date formatting
       validator.ts       - Input validation
       logger.ts          - Structured logging
     templates/
       invoice.hbs        - Main invoice template
     dictionaries/
       it.json            - Italian dictionary
       en.json            - English dictionary
       de.json            - German dictionary
       fr.json            - French dictionary
     test/
       helpers.test.ts    - Unit tests for helpers
       formatters.test.ts - Unit tests for formatters
     events/
       simple-invoice.json
       complex-invoice.json
     package.json
     tsconfig.json
     README.md
   ```

2. **Convert Dictionaries to JSON**
   - Parse XML dictionaries
   - Convert to simple JSON: `{ "fattura": "Invoice", ... }`
   - Validate all keys present in all languages

3. **Implement Handlebars Helpers**
   - All formatting functions
   - All logic helpers
   - All calculation helpers
   - Unit test each helper

### Phase 2: Template Conversion (Week 2)

1. **Convert XSLT to Handlebars**
   - Start with main template
   - Convert CSS (keep inline for now)
   - Convert logic (if/else, loops)
   - Convert formatting calls

2. **Test with Sample Data**
   - Create test data matching XSLT structure
   - Render HTML
   - Compare visually with current PDFs
   - Iterate until identical

3. **Handle Edge Cases**
   - Empty fields
   - Missing data
   - Split payment
   - Revenue stamp
   - Multiple delivery notes

### Phase 3: Lambda Integration (Week 3)

1. **Build Lambda Handler**
   ```typescript
   interface TemplateRendererRequest {
     template: 'invoice';  // Template name
     language: 'it' | 'en' | 'de' | 'fr';
     data: {
       sale: Sale;
       buyer: Buyer;
       producer?: Producer;
       sale_lines: SaleLine[];
       banks?: Bank[];
       countries?: Country[];
     };
   }

   interface TemplateRendererResponse {
     success: boolean;
     html: string;
     language: string;
     generationTime: number;
   }
   ```

2. **Add Caching**
   - Cache compiled templates (in-memory)
   - Cache dictionaries (in-memory)
   - Warm-up on Lambda initialization

3. **Add Monitoring**
   - CloudWatch structured logging
   - Performance metrics
   - Error tracking
   - Template usage stats

### Phase 4: Testing (Week 3-4)

1. **Unit Tests**
   - All helpers
   - All formatters
   - Dictionary loading
   - Template compilation

2. **Integration Tests**
   - Render actual invoices
   - Test all languages
   - Test edge cases
   - Compare with current system

3. **Performance Tests**
   - Measure render time
   - Memory usage
   - Cold start time
   - Target: < 500ms warm, < 2s cold

### Phase 5: Deployment (Week 4)

1. **CDK Infrastructure**
   - Lambda function definition
   - Function URL
   - Environment variables
   - CloudWatch alarms

2. **Deploy to Dev**
   - Test with real data
   - Visual comparison
   - Performance validation

3. **Deploy to Prod**
   - After validation
   - Monitor closely
   - Ready for integration

---

## Migration Benefits

### Before (XSLT)
- ❌ Requires XSLT processor
- ❌ Limited to XML input
- ❌ Difficult to debug
- ❌ Hard to test
- ❌ Apache FOP dependency
- ❌ Heavy processing

### After (Handlebars + Lambda)
- ✅ Modern template engine
- ✅ JSON input (REST-friendly)
- ✅ Easy to debug (standard HTML)
- ✅ Easy to test (unit tests, snapshots)
- ✅ Puppeteer for PDF (already implemented)
- ✅ Fast rendering (< 500ms)

---

## Estimated Effort

| Task | Effort | Notes |
|------|--------|-------|
| Setup project structure | 0.5 days | Boilerplate |
| Convert dictionaries | 0.5 days | XML → JSON |
| Implement helpers | 2 days | 20+ helper functions |
| Convert template | 3 days | XSLT → Handlebars |
| Unit tests | 2 days | Test all helpers |
| Lambda integration | 1 day | Handler + validation |
| Integration tests | 2 days | End-to-end tests |
| CDK infrastructure | 1 day | Stack definition |
| Documentation | 1 day | API docs, examples |
| **Total** | **13 days** | **~2.5 weeks** |

---

## Success Criteria

✅ **Visual Parity**: Generated PDFs must be visually identical to current system
✅ **All Languages**: IT, EN, DE, FR all working
✅ **All Edge Cases**: Proforma, credit notes, split payment, stamps
✅ **Performance**: < 500ms render time (warm)
✅ **Cost**: $0-2/month (free tier coverage)
✅ **Test Coverage**: > 80% unit test coverage
✅ **Documentation**: Complete API reference and examples

---

## Next Steps

1. ✅ **Task #3 Complete**: Analysis done
2. **Start Task #4**: Design Template Renderer Lambda architecture
3. **Proceed to Task #5**: Implementation

**Decision Point**: Approve this conversion strategy before implementation.
