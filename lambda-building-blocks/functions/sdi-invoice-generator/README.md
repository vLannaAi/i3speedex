# SDI Invoice Generator Lambda Function

Generate Italian FatturaPA (SDI) XML invoices compliant with Sistema di Interscambio specifications.

## Features

- ✅ FatturaPA v1.2.2 XML generation
- ✅ Italian VAT number validation
- ✅ Fiscal code (Codice Fiscale) validation
- ✅ IBAN validation
- ✅ Base64 attachment support
- ✅ Multiple output formats (XML, S3, presigned URLs)
- ✅ XSD validation (optional)
- ✅ CloudWatch structured logging
- ✅ S3 integration

## Status

✅ **Deployed to AWS Lambda** - Production Ready

### Deployment Info
- **Environment**: Development
- **Function Name**: `sdi-invoice-generator-dev`
- **Region**: `eu-west-1`
- **Lambda URL**: `https://szyecnp476p4ymog2o4gdudp3m0kfvww.lambda-url.eu-west-1.on.aws/`
- **S3 Bucket**: `sdi-invoice-generator-dev-827562051115`

### Validation Status
- ✅ **XSD Schema Validation**: Passes with official FPR12 schema
- ✅ **FATTURACHECK.it**: Successfully validates
- ✅ **Simple Invoices**: Working
- ✅ **Invoices with PDF Attachments**: Working

## API Reference

### Request Format

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
      "cedentePrestatore": { ... },
      "cessionarioCommittente": { ... }
    },
    "fatturaElettronicaBody": [ ... ]
  },
  "outputFormat": "xml",
  "validate": false,
  "filename": "IT05056450157_00001.xml"
}
```

### Important Notes

**Format Code**: Use `FPR12` for simplified invoices to private sector (B2B), not `FPA12` (public administration).

**Decimal Formatting**: All monetary values and percentages MUST be formatted as strings with the correct number of decimal places:
- ✅ `"122.00"` (correct)
- ❌ `122` or `122.0` (incorrect - will fail validation)
- ✅ `"22.00"` for VAT percentage
- ✅ `"1.00"` for quantities (min 2 decimals, max 8)
- ✅ `"100.00000000"` for unit prices (min 2 decimals, max 8)

**VAT Number Format**: In `idFiscaleIVA`:
- `idPaese`: "IT" (country code only)
- `idCodice`: "05056450157" (11 digits, WITHOUT "IT" prefix)
- ✅ Correct: `{"idPaese": "IT", "idCodice": "05056450157"}`
- ❌ Wrong: `{"idPaese": "IT", "idCodice": "IT05056450157"}`

### Response Format

```json
{
  "success": true,
  "xml": "<?xml version=\"1.0\" encoding=\"UTF-8\"?>...",
  "filename": "IT05056450157_00001.xml",
  "size": 12345,
  "generationTime": 150
}
```

## Validators

### Italian VAT Number (Partita IVA)

```typescript
import { validateItalianVAT } from './validators';

validateItalianVAT('IT05056450157');  // true
validateItalianVAT('05056450157');    // true (IT prefix optional)
validateItalianVAT('12345678901');    // false (invalid checksum)
```

### Fiscal Code (Codice Fiscale)

```typescript
import { validateItalianFiscalCode } from './validators';

validateItalianFiscalCode('RSSMRA85M01H501U');  // true (individual)
validateItalianFiscalCode('05056450157');       // true (company)
validateItalianFiscalCode('INVALID123456');     // false
```

### IBAN

```typescript
import { validateIBAN } from './validators';

validateIBAN('IT32G0533612500000040600342');  // true
validateIBAN('IT32G053361250000004060034X');  // false
```

## Document Types (TipoDocumento)

- **TD01**: Invoice
- **TD02**: Advance payment invoice
- **TD03**: Advance payment invoice (prepayment)
- **TD04**: Credit note
- **TD05**: Debit note
- **TD06**: Fee invoice
- **TD16-TD28**: Various special cases

## Regime Fiscale (Tax Regime)

- **RF01**: Ordinary regime
- **RF02**: Minimum taxpayers (art. 1, c.96-117, L. 244/07)
- **RF04**: Agriculture and related activities
- **RF05**: Sale of salts and tobacco
- **RF06**: Resale of used goods, art objects, antiques
- **RF07**: Ordinary regime (businesses with revenues < €400k/€700k)
- **RF08**: Simplified accounting regime
- **RF09**: Flat-rate regime (art. 1, c.54-89, L. 190/2014)
- **RF10**: Minimum taxpayers (art. 27, c.1-3, DL 98/2011)
- **RF11**: Ordinary regime (revenues > €400k/€700k)
- **RF12**: Ordinary regime (L. 398/91 special regime for small businesses)
- **RF13**: Other
- **RF14**: Split payment
- **RF15**: Regime for tax transparency
- **RF16**: Flat-rate scheme (forfettari)
- **RF17**: Start-ups and innovative PMIs
- **RF18**: Simplified accounting
- **RF19**: Flat rate regime (art. 1, c.54-89, L. 190/2014)

## Payment Methods (ModalitaPagamento)

- **MP01**: Cash
- **MP02**: Check
- **MP03**: Banker's draft
- **MP04**: Treasury cash
- **MP05**: Bank transfer
- **MP06**: Promissory note
- **MP07**: Bank payment slip
- **MP08**: Payment card
- **MP09**: RID (direct debit)
- **MP10**: RID with advance
- **MP11**: RID with bank guarantee
- **MP12**: RIBA (bank collection)
- **MP13**: MAV (payment notification)
- **MP14**: Bank draft
- **MP15**: Automatic debit order
- **MP16**: Automatic debit order with advance
- **MP17**: Automatic debit order with bank guarantee
- **MP18**: Standing order
- **MP19**: SEPA Direct Debit
- **MP20**: SEPA Direct Debit CORE
- **MP21**: SEPA Direct Debit B2B
- **MP22**: Netting
- **MP23**: PagoPA

## VAT Nature Codes (Natura)

For transactions exempt from VAT:

- **N1**: Excluded per art. 15
- **N2.1**: Not subject - other cases
- **N2.2**: Not subject - other cases (with foreign registration)
- **N3.1**: Not taxable - exports
- **N3.2**: Not taxable - intra-EU transfers
- **N3.3**: Not taxable - transfers to San Marino
- **N3.4**: Not taxable - exports (goods sent by private parties)
- **N3.5**: Not taxable - following declarations of intent
- **N3.6**: Not taxable - other transactions not subject
- **N4**: Exempt
- **N5**: Margin regime / VAT not exposed on invoice
- **N6.1**: Reverse charge - transfers of scrap
- **N6.2**: Reverse charge - transfers of gold
- **N6.3**: Reverse charge - subcontracting in construction
- **N6.4**: Reverse charge - transfers of buildings
- **N6.5**: Reverse charge - transfers of mobile phones
- **N6.6**: Reverse charge - transfers of electronic products
- **N6.7**: Reverse charge - construction services
- **N6.8**: Reverse charge - energy sector
- **N6.9**: Reverse charge - other cases
- **N7**: VAT paid in other EU country

## Example: Simple Invoice

```typescript
const invoice: FatturaElettronica = {
  fatturaElettronicaHeader: {
    datiTrasmissione: {
      idTrasmittente: {
        idPaese: 'IT',
        idCodice: '05056450157'
      },
      progressivoInvio: '00001',
      formatoTrasmissione: 'FPR12',
      codiceDestinatario: 'USAL8PV'
    },
    cedentePrestatore: {
      datiAnagrafici: {
        idFiscaleIVA: {
          idPaese: 'IT',
          idCodice: '05056450157'
        },
        codiceFiscale: '05056450157',
        anagrafica: {
          denominazione: 'Speedex Srl'
        },
        regimeFiscale: 'RF01'
      },
      sede: {
        indirizzo: 'Via Lago di Nemi, 25',
        cap: '20142',
        comune: 'Milano',
        provincia: 'MI',
        nazione: 'IT'
      },
      contatti: {
        telefono: '0289121816'
      }
    },
    cessionarioCommittente: {
      datiAnagrafici: {
        idFiscaleIVA: {
          idPaese: 'IT',
          idCodice: '01507200937'
        },
        codiceFiscale: '01507200937',
        anagrafica: {
          denominazione: 'Cimolai S.p.A.'
        }
      },
      sede: {
        indirizzo: 'Viale Pasteur 49 - scala C piano 4 int 8',
        cap: '00144',
        comune: 'Roma',
        provincia: 'RM',
        nazione: 'IT'
      }
    }
  },
  fatturaElettronicaBody: [
    {
      datiGenerali: {
        datiGeneraliDocumento: {
          tipoDocumento: 'TD01',
          divisa: 'EUR',
          data: '2026-01-28',
          numero: 'TEST001',
          importoTotaleDocumento: '122.00'  // Must be string with 2 decimals
        }
      },
      datiBeniServizi: {
        dettaglioLinee: [
          {
            numeroLinea: 1,
            descrizione: 'Professional services',
            quantita: '1.00',              // Must be string with 2-8 decimals
            unitaMisura: 'pz',
            prezzoUnitario: '100.00',      // Must be string with 2-8 decimals
            prezzoTotale: '100.00',        // Must be string with 2 decimals
            aliquotaIVA: '22.00'           // Must be string with 2 decimals
          }
        ],
        datiRiepilogo: [
          {
            aliquotaIVA: '22.00',          // Must be string with 2 decimals
            imponibileImporto: '100.00',   // Must be string with 2 decimals
            imposta: '22.00',              // Must be string with 2 decimals
            esigibilitaIVA: 'I'            // I = immediate, D = deferred, S = split payment
          }
        ]
      }
    }
  ]
};
```

## Attachments

Attach PDF invoices or other documents as base64:

```typescript
const attachments: Allegati[] = [
  {
    nomeAttachment: 'invoice.pdf',
    formatoAttachment: 'PDF',
    descrizioneAttachment: 'Invoice PDF',
    attachment: 'JVBERi0xLjQKJeLjz9MKMy...' // Base64 encoded PDF
  }
];

// Add to fatturaElettronicaBody
invoice.fatturaElettronicaBody[0].allegati = attachments;
```

## Filename Convention

FatturaPA filenames follow this format:

```
ITnnnnnnnnnn_xxxxx.xml
```

- **IT**: Country code (always IT for Italy)
- **nnnnnnnnnn**: VAT number (11 digits, no IT prefix)
- **xxxxx**: Progressive number (5 digits, zero-padded)

Examples:
- `IT05056450157_00001.xml`
- `IT01507200937_12345.xml`

## Development

### Install Dependencies

```bash
cd /Users/vicio/i2speedex/lambda-building-blocks/functions/sdi-invoice-generator
npm install
```

### Build

```bash
npm run build
```

### Test Validators

```bash
npm test
```

### Local XSD Validation

Use the local validation script to test XML files against the official FPR12 schema:

```bash
cd /Users/vicio/i2speedex/lambda-building-blocks/cdk
node validate-xml-local.js <xml-file>
```

Examples:
```bash
# Validate working reference file
node validate-xml-local.js sale_sdi_2219.xml

# Generate and validate a new invoice
curl -s -X POST https://szyecnp476p4ymog2o4gdudp3m0kfvww.lambda-url.eu-west-1.on.aws/ \
  -H "Content-Type: application/json" \
  -d @test-from-working-fixed.json | jq -r '.xml' > new-invoice.xml

node validate-xml-local.js new-invoice.xml
```

### Online Validation

Test generated invoices at [FATTURACHECK.it](https://www.fatturacheck.it/) for comprehensive validation including business rules.

## Test Files

Working test templates are available in `/Users/vicio/i2speedex/lambda-building-blocks/cdk/`:

- **test-from-working-fixed.json** - Simple invoice template (validated ✅)
- **test-with-attachment.json** - Invoice with PDF attachment template (validated ✅)
- **sale_sdi_2219.xml** - Reference working XML from production

## Common Issues & Solutions

### Issue: "The specified condition was not met for 'Cessionario Committente Dati Anagrafici Id Fiscale IV A Id Paese'"

**Cause**: Missing or invalid `idPaese` in `idFiscaleIVA`

**Solution**: Ensure `idFiscaleIVA` structure is correct:
```json
"idFiscaleIVA": {
  "idPaese": "IT",              // 2-letter country code
  "idCodice": "01507200937"     // VAT number WITHOUT country prefix
}
```

### Issue: XSD validation fails with pattern errors on decimal values

**Cause**: Numbers provided as numeric types instead of formatted strings

**Solution**: Use strings with proper decimal places:
```json
// ❌ Wrong
"importoTotaleDocumento": 122

// ✅ Correct
"importoTotaleDocumento": "122.00"
```

### Issue: Generated XML root element has extra namespaces

**Fix Applied**: Root element now uses minimal required namespaces:
- `xmlns="http://ivaservizi.agenziaentrate.gov.it/docs/xsd/fatture/v1.2"`
- `xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"`
- `versione="FPR12"`

The following were removed as they caused validation issues:
- ❌ `xmlns:ds` (digital signature namespace - only needed if signing)
- ❌ `xsi:schemaLocation` (causes stricter validation)

## References

- [FatturaPA Official Documentation](https://www.fatturapa.gov.it/)
- [FatturaPA v1.2.2 XSD Schema](http://www.fatturapa.gov.it/export/fatturazione/sdi/fatturapa/v1.2/Schema_del_file_xml_FatturaPA_versione_1.2.xsd)
- [Agenzia delle Entrate](https://www.agenziaentrate.gov.it/)
- [Sistema di Interscambio (SDI)](https://www.fatturapa.gov.it/it/sdi/)

## License

MIT
