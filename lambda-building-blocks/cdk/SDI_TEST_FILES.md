# SDI Invoice Generator Test Files

This directory contains test files for the SDI Invoice Generator Lambda function.

## Test Templates (JSON)

### test-from-working-fixed.json
✅ **Validated on FATTURACHECK.it**

Simple B2B invoice template based on working production data.

**Usage:**
```bash
curl -s -X POST https://szyecnp476p4ymog2o4gdudp3m0kfvww.lambda-url.eu-west-1.on.aws/ \
  -H "Content-Type: application/json" \
  -d @test-from-working-fixed.json | jq -r '.xml' > invoice.xml
```

**Details:**
- Supplier: Speedex Srl (VAT: IT05056450157)
- Customer: Cimolai S.p.A. (VAT: IT01507200937)
- Format: FPR12 (B2B simplified)
- Amount: €122.00 (€100.00 + €22.00 VAT)

### test-with-attachment.json
✅ **Validated on FATTURACHECK.it**

Invoice template with embedded PDF attachment.

**Usage:**
```bash
curl -s -X POST https://szyecnp476p4ymog2o4gdudp3m0kfvww.lambda-url.eu-west-1.on.aws/ \
  -H "Content-Type: application/json" \
  -d @test-with-attachment.json | jq -r '.xml' > invoice-with-pdf.xml
```

**Details:**
- Same as above, plus:
- Attachment: TEST002.pdf (742 bytes, base64 encoded)
- PDF contains: "Test PDF" text

## Reference Files (XML)

### sale_sdi_2219.xml
✅ **Working production file**

Real invoice from i2speedex production system that passes all validations.

**Purpose:**
- Reference for correct structure
- Validation baseline
- Comparison when debugging issues

**DO NOT MODIFY** - Keep as reference

## Validation

### Local XSD Validation

```bash
node validate-xml-local.js <xml-file>
```

**Examples:**
```bash
# Validate reference file
node validate-xml-local.js sale_sdi_2219.xml

# Generate and validate new invoice
curl -s -X POST https://szyecnp476p4ymog2o4gdudp3m0kfvww.lambda-url.eu-west-1.on.aws/ \
  -H "Content-Type: application/json" \
  -d @test-from-working-fixed.json | jq -r '.xml' > test.xml

node validate-xml-local.js test.xml
```

### Online Validation

1. Generate XML using one of the test templates
2. Upload to [FATTURACHECK.it](https://www.fatturacheck.it/)
3. Verify it passes validation

## Validation Script

### validate-xml-local.js

Node.js script that validates FatturaPA XML files against the official FPR12 XSD schema.

**Features:**
- Uses xmllint (built into macOS) for robust validation
- Handles external schema imports
- Shows clear pass/fail status
- Extracts invoice summary information

**Requirements:**
- xmllint (pre-installed on macOS)
- XSD schema at: `../functions/sdi-invoice-generator/schema-FPR12.xsd`

## Key Requirements

### Decimal Formatting
All monetary values MUST be strings with exact decimal places:

```json
// ✅ CORRECT
{
  "importoTotaleDocumento": "122.00",
  "aliquotaIVA": "22.00",
  "quantita": "1.00",
  "prezzoUnitario": "100.00"
}

// ❌ WRONG - Will fail validation
{
  "importoTotaleDocumento": 122,
  "aliquotaIVA": 22,
  "quantita": 1,
  "prezzoUnitario": 100
}
```

### VAT Number Structure

```json
// ✅ CORRECT - Split country code and number
{
  "idFiscaleIVA": {
    "idPaese": "IT",
    "idCodice": "05056450157"
  }
}

// ❌ WRONG - Don't include country in idCodice
{
  "idFiscaleIVA": {
    "idPaese": "IT",
    "idCodice": "IT05056450157"
  }
}
```

### Format Code

Use **FPR12** for B2B private sector invoices (not FPA12).

```json
{
  "formatoTrasmissione": "FPR12"
}
```

## Creating New Test Files

### 1. Start with a Template

Copy one of the working templates:
```bash
cp test-from-working-fixed.json my-test.json
```

### 2. Modify Values

Update the invoice data:
- Change `progressivoInvio` (invoice number)
- Change `numero` (document number)
- Update dates
- Modify customer details
- Adjust line items

**IMPORTANT:** Keep decimal formatting as strings!

### 3. Validate Locally

```bash
curl -s -X POST https://szyecnp476p4ymog2o4gdudp3m0kfvww.lambda-url.eu-west-1.on.aws/ \
  -H "Content-Type: application/json" \
  -d @my-test.json | jq -r '.xml' > my-invoice.xml

node validate-xml-local.js my-invoice.xml
```

### 4. Validate Online

Upload to FATTURACHECK.it for final verification.

## Common Errors

### Error: "IdFiscaleIVA IdPaese" validation error

**Cause:** Missing or invalid IdPaese, or IdCodice contains country prefix

**Fix:**
```json
{
  "idFiscaleIVA": {
    "idPaese": "IT",              // Must be present
    "idCodice": "05056450157"     // NO "IT" prefix
  }
}
```

### Error: Pattern validation on decimals

**Cause:** Numbers provided instead of strings with decimals

**Fix:**
```json
{
  "aliquotaIVA": "22.00"  // Not 22 or 22.0
}
```

### Error: Request body validation fails

**Cause:** Missing `"invoice"` wrapper

**Fix:**
```json
{
  "invoice": {
    "fatturaElettronicaHeader": { ... }
  }
}
```

## Documentation

See `/Users/vicio/i2speedex/lambda-building-blocks/functions/sdi-invoice-generator/` for detailed documentation:

- **README.md** - Function overview, API reference, examples
- **VALIDATION_GUIDE.md** - Comprehensive validation requirements and troubleshooting

## Support

For issues or questions about the SDI Invoice Generator:

1. Check VALIDATION_GUIDE.md for common issues
2. Validate locally first before testing online
3. Compare with working reference file (sale_sdi_2219.xml)
4. Test with validated templates before creating custom invoices

---

**Last Updated**: 2026-01-28
