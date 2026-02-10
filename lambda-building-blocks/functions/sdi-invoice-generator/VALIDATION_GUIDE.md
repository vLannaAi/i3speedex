# FatturaPA Validation Guide

This guide documents the critical requirements for generating valid FatturaPA XML invoices that pass both XSD schema validation and FATTURACHECK.it validation.

## Validation Status

✅ **Successfully Validated** - All generated invoices pass:
- Local XSD validation with official FPR12 schema
- FATTURACHECK.it online validation
- Simple invoices work
- Invoices with PDF attachments work

## Critical Requirements

### 1. Root Element Namespaces

**Minimal Required Namespaces** (as used in working files):

```xml
<FatturaElettronica
  xmlns="http://ivaservizi.agenziaentrate.gov.it/docs/xsd/fatture/v1.2"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  versione="FPR12">
```

**Do NOT include:**
- ❌ `xmlns:ds="http://www.w3.org/2000/09/xmldsig#"` - Only needed for digital signatures
- ❌ `xsi:schemaLocation="..."` - Causes FATTURACHECK to apply stricter validation

**Attribute Order:**
1. `xmlns` (default namespace)
2. `xmlns:xsi` (schema instance namespace)
3. `versione` (format version)

### 2. Format Version

Use **FPR12** for simplified invoices (B2B private sector):
```json
"formatoTrasmissione": "FPR12"
```

**Not FPA12** (which is for public administration).

### 3. Decimal Formatting

All monetary values and percentages **MUST be strings** with exact decimal places:

| Field | Pattern | Example | Notes |
|-------|---------|---------|-------|
| `importoTotaleDocumento` | `[\-]?[0-9]{1,11}\.[0-9]{2}` | `"122.00"` | Exactly 2 decimals |
| `quantita` | `[0-9]{1,12}\.[0-9]{2,8}` | `"1.00"` | 2-8 decimals |
| `prezzoUnitario` | `[\-]?[0-9]{1,11}\.[0-9]{2,8}` | `"100.00"` | 2-8 decimals |
| `prezzoTotale` | `[\-]?[0-9]{1,11}\.[0-9]{2,8}` | `"100.00"` | 2-8 decimals |
| `aliquotaIVA` | `[0-9]{1,3}\.[0-9]{2}` | `"22.00"` | Exactly 2 decimals |
| `imponibileImporto` | `[\-]?[0-9]{1,11}\.[0-9]{2}` | `"100.00"` | Exactly 2 decimals |
| `imposta` | `[\-]?[0-9]{1,11}\.[0-9]{2}` | `"22.00"` | Exactly 2 decimals |

**Common Mistakes:**

```json
// ❌ WRONG - Will fail XSD validation
"importoTotaleDocumento": 122,
"aliquotaIVA": 22,
"quantita": 1

// ✅ CORRECT
"importoTotaleDocumento": "122.00",
"aliquotaIVA": "22.00",
"quantita": "1.00"
```

### 4. VAT Number Structure (IdFiscaleIVA)

**CRITICAL**: Split country code from VAT number:

```json
// ✅ CORRECT
"idFiscaleIVA": {
  "idPaese": "IT",              // 2-letter ISO country code only
  "idCodice": "05056450157"     // 11 digits, NO country prefix
}

// ❌ WRONG - Will fail FATTURACHECK validation
"idFiscaleIVA": {
  "idPaese": "IT",
  "idCodice": "IT05056450157"   // Don't include IT prefix here!
}
```

**Error Message:**
> "The specified condition was not met for 'Cessionario Committente Dati Anagrafici Id Fiscale IV A Id Paese'"

This error occurs when:
- `idPaese` is missing or empty
- `idCodice` contains the country prefix
- `idPaese` doesn't match the actual country

### 5. Required vs Optional Fields

#### CessionarioCommittente (Customer) - Required Structure

```json
{
  "datiAnagrafici": {
    "idFiscaleIVA": {           // REQUIRED for Italian companies
      "idPaese": "IT",
      "idCodice": "01507200937"
    },
    "codiceFiscale": "01507200937",  // RECOMMENDED for Italian companies
    "anagrafica": {             // REQUIRED
      "denominazione": "Company Name"  // For companies
      // OR "nome" + "cognome" for individuals
    }
  },
  "sede": {                     // REQUIRED
    "indirizzo": "Street address",    // REQUIRED
    "numeroCivico": "12",             // OPTIONAL
    "cap": "00144",                   // REQUIRED
    "comune": "Roma",                 // REQUIRED
    "provincia": "RM",                // OPTIONAL but recommended
    "nazione": "IT"                   // REQUIRED, must match idPaese
  }
}
```

#### CedentePrestatore (Supplier) - Required Structure

Same structure as CessionarioCommittente, plus:

```json
{
  "datiAnagrafici": {
    // ... same as above
    "regimeFiscale": "RF01"     // REQUIRED - tax regime code
  },
  "sede": {
    // ... same as above
  },
  "contatti": {                 // OPTIONAL but recommended
    "telefono": "0289121816",   // Max 12 characters
    "email": "info@company.com"
  }
}
```

### 6. Element Order

XML element order **MUST** follow XSD schema specification:

#### CessionarioCommittente Order:
1. `DatiAnagrafici` (required)
   - `IdFiscaleIVA` (optional)
   - `CodiceFiscale` (optional)
   - `Anagrafica` (required)
2. `Sede` (required)
3. `StabileOrganizzazione` (optional)
4. `RappresentanteFiscale` (optional)

#### DatiGeneraliDocumento Order:
1. `TipoDocumento` (required)
2. `Divisa` (required)
3. `Data` (required)
4. `Numero` (required)
5. `ImportoTotaleDocumento` (optional but recommended)

### 7. Phone Number Sanitization

Phone numbers **MUST** be max 12 characters, numeric only:

```typescript
// Implementation in validators.ts
function sanitizePhoneNumber(phone: string): string {
  return phone.replace(/[^0-9]/g, '').substring(0, 12);
}

// Examples
"02 8912 1816"     → "0289121816"
"+39 02 891218"    → "390289121"
"02-891-218-16"    → "0289121816"
```

### 8. Codice Destinatario

For B2B invoices (FPR12), use 7-character alphanumeric code:

```json
// ✅ Valid examples
"codiceDestinatario": "USAL8PV"    // Customer's SDI code
"codiceDestinatario": "0000000"    // When using PEC instead

// If using PEC email instead:
"pecDestinatario": "customer@pec.it"
```

**One of these MUST be present:**
- `codiceDestinatario` (7 chars)
- `pecDestinatario` (email)

### 9. Invoice Body Details

#### DettaglioLinee (Line Items)

```json
{
  "numeroLinea": 1,                    // Sequential, starting from 1
  "descrizione": "Service description", // REQUIRED
  "quantita": "1.00",                  // REQUIRED (string with 2-8 decimals)
  "unitaMisura": "pz",                 // OPTIONAL but recommended
  "prezzoUnitario": "100.00",          // REQUIRED (string with 2-8 decimals)
  "prezzoTotale": "100.00",            // REQUIRED (string with 2 decimals)
  "aliquotaIVA": "22.00"               // REQUIRED (string with 2 decimals)
}
```

#### DatiRiepilogo (VAT Summary)

```json
{
  "aliquotaIVA": "22.00",              // REQUIRED (string with 2 decimals)
  "imponibileImporto": "100.00",       // REQUIRED (string with 2 decimals)
  "imposta": "22.00",                  // REQUIRED (string with 2 decimals)
  "esigibilitaIVA": "I"                // REQUIRED: I=immediate, D=deferred, S=split
}
```

### 10. PDF Attachments

```json
{
  "allegati": [
    {
      "nomeAttachment": "invoice.pdf",           // Filename
      "formatoAttachment": "PDF",                // Format code (PDF, XML, etc.)
      "descrizioneAttachment": "Invoice PDF",    // Description
      "attachment": "JVBERi0xLjQK..."           // Base64 encoded file content
    }
  ]
}
```

**Requirements:**
- Base64 encode the file without line breaks
- Place attachments in `fatturaElettronicaBody[].allegati` array
- Multiple attachments are supported

## Validation Workflow

### Local Validation (Fast)

```bash
# Generate XML from test JSON
curl -s -X POST https://szyecnp476p4ymog2o4gdudp3m0kfvww.lambda-url.eu-west-1.on.aws/ \
  -H "Content-Type: application/json" \
  -d @test-from-working-fixed.json | jq -r '.xml' > invoice.xml

# Validate against XSD schema
cd /Users/vicio/i2speedex/lambda-building-blocks/cdk
node validate-xml-local.js invoice.xml
```

**Expected Output (Success):**
```
✅ VALIDATION PASSED

The XML file is valid according to the FatturaPA FPR12 schema.

📊 Invoice Summary:
   Format: FPR12
   Supplier: Speedex Srl
   Customer: Cimolai S.p.A.
```

### Online Validation (Comprehensive)

1. Open [FATTURACHECK.it](https://www.fatturacheck.it/)
2. Upload the generated XML file
3. Review validation results

**Expected Output (Success):**
```
File valido
Cedente prestatore: Speedex Srl
Cessionario committente: Cimolai S.p.A.
Numero: TEST001
Data: 01/28/2026
Tipo documento: TD01
Totale documento: 122.00 EUR
```

## Working Test Templates

### Simple Invoice

File: `/Users/vicio/i2speedex/lambda-building-blocks/cdk/test-from-working-fixed.json`

```json
{
  "invoice": {
    "fatturaElettronicaHeader": {
      "datiTrasmissione": {
        "idTrasmittente": {
          "idPaese": "IT",
          "idCodice": "05056450157"
        },
        "progressivoInvio": "00001",
        "formatoTrasmissione": "FPR12",
        "codiceDestinatario": "USAL8PV"
      },
      "cedentePrestatore": {
        "datiAnagrafici": {
          "idFiscaleIVA": {
            "idPaese": "IT",
            "idCodice": "05056450157"
          },
          "codiceFiscale": "05056450157",
          "anagrafica": {
            "denominazione": "Speedex Srl"
          },
          "regimeFiscale": "RF01"
        },
        "sede": {
          "indirizzo": "Via Lago di Nemi, 25",
          "cap": "20142",
          "comune": "Milano",
          "provincia": "MI",
          "nazione": "IT"
        },
        "contatti": {
          "telefono": "0289121816"
        }
      },
      "cessionarioCommittente": {
        "datiAnagrafici": {
          "idFiscaleIVA": {
            "idPaese": "IT",
            "idCodice": "01507200937"
          },
          "codiceFiscale": "01507200937",
          "anagrafica": {
            "denominazione": "Cimolai S.p.A."
          }
        },
        "sede": {
          "indirizzo": "Viale Pasteur 49 - scala C piano 4 int 8",
          "cap": "00144",
          "comune": "Roma",
          "provincia": "RM",
          "nazione": "IT"
        }
      }
    },
    "fatturaElettronicaBody": [
      {
        "datiGenerali": {
          "datiGeneraliDocumento": {
            "tipoDocumento": "TD01",
            "divisa": "EUR",
            "data": "2026-01-28",
            "numero": "TEST001",
            "importoTotaleDocumento": "122.00"
          }
        },
        "datiBeniServizi": {
          "dettaglioLinee": [
            {
              "numeroLinea": 1,
              "descrizione": "Test Service",
              "quantita": "1.00",
              "unitaMisura": "pz",
              "prezzoUnitario": "100.00",
              "prezzoTotale": "100.00",
              "aliquotaIVA": "22.00"
            }
          ],
          "datiRiepilogo": [
            {
              "aliquotaIVA": "22.00",
              "imponibileImporto": "100.00",
              "imposta": "22.00",
              "esigibilitaIVA": "I"
            }
          ]
        }
      }
    ]
  }
}
```

### Invoice with PDF Attachment

File: `/Users/vicio/i2speedex/lambda-building-blocks/cdk/test-with-attachment.json`

Same structure as above, plus:

```json
{
  "fatturaElettronicaBody": [
    {
      // ... datiGenerali and datiBeniServizi ...
      "allegati": [
        {
          "nomeAttachment": "TEST002.pdf",
          "formatoAttachment": "PDF",
          "descrizioneAttachment": "Invoice PDF",
          "attachment": "JVBERi0xLjQKJeLjz9MK..."
        }
      ]
    }
  ]
}
```

## Troubleshooting

### Problem: IdFiscaleIVA validation error

**Error:**
```
The specified condition was not met for 'Cessionario Committente Dati Anagrafici Id Fiscale IV A Id Paese'
```

**Solution:**
1. Check `idPaese` is exactly "IT" (2 letters)
2. Check `idCodice` contains ONLY the 11 digits (no "IT" prefix)
3. Check both fields are present and not null/empty
4. Check `nazione` in `sede` matches `idPaese`

### Problem: Decimal pattern validation errors

**Error:**
```
Element 'AliquotaIVA': [facet 'pattern'] The value '22' is not accepted by the pattern '[0-9]{1,3}\.[0-9]{2}'.
```

**Solution:** Use strings with decimal places:
```json
// ❌ Wrong
"aliquotaIVA": 22

// ✅ Correct
"aliquotaIVA": "22.00"
```

### Problem: XSD schema validation fails locally

**Error:**
```
Invalid XSD schema
```

**Solution:** Use xmllint instead of libxmljs2. The validation script has been updated to use xmllint which handles external schema imports correctly.

## Reference Files

- **Working XML**: `/Users/vicio/i2speedex/lambda-building-blocks/cdk/sale_sdi_2219.xml`
  - Confirmed to pass FATTURACHECK.it validation
  - Use as reference for structure

- **XSD Schema**: `/Users/vicio/i2speedex/lambda-building-blocks/functions/sdi-invoice-generator/schema-FPR12.xsd`
  - Official FatturaPA v1.2 schema
  - Used for local validation

- **Validation Script**: `/Users/vicio/i2speedex/lambda-building-blocks/cdk/validate-xml-local.js`
  - Uses xmllint for robust validation
  - Handles external schema imports

## Key Lessons Learned

1. **Root element attributes matter** - Extra namespaces can cause validation to fail even if structurally correct

2. **Decimal formatting is strict** - XSD patterns require exact decimal places as strings, not numbers

3. **VAT number split is critical** - Country code and number must be separate fields

4. **Element order matters** - XML elements must follow XSD schema order exactly

5. **Local validation is essential** - Iterate quickly with local XSD validation before testing online

6. **Reference files are valuable** - Having a working XML example from production is critical for comparison

7. **Error messages can be misleading** - The FATTURACHECK error about CessionarioCommittente was actually about IdFiscaleIVA structure, not the entire section

## Resources

- [FatturaPA Official Documentation](https://www.fatturapa.gov.it/)
- [FATTURACHECK.it](https://www.fatturacheck.it/) - Online validator
- [Sistema di Interscambio (SDI)](https://www.fatturapa.gov.it/it/sdi/)
- [FatturaPA v1.2 Specifications](http://www.fatturapa.gov.it/export/documenti/fatturapa/v1.2/Specifiche_tecniche_del_formato_FatturaPA_v1.2.pdf)

---

**Last Updated**: 2026-01-28
**Status**: ✅ All validations passing
