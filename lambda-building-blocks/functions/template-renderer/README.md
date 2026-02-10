# Template Renderer Lambda Function

Render HTML from templates with multi-language support using Handlebars and i18next.

## Features

- ✅ Handlebars template engine
- ✅ i18next for internationalization (IT, EN, DE, FR)
- ✅ 20+ helper functions (formatting, calculations, logic)
- ✅ Multi-language number/date formatting
- ✅ CloudWatch structured logging
- ✅ Input validation and sanitization
- ✅ Lambda Function URL support
- ✅ CORS enabled
- ✅ TypeScript with strict mode

## Supported Languages

- **Italian (it)**: Primary language
- **English (en)**: Full translation
- **German (de)**: Full translation
- **French (fr)**: Full translation

## API Reference

### Request Format

```json
{
  "template": "invoice",
  "language": "it",
  "data": {
    "sale": { ... },
    "buyer": { ... },
    "producer": { ... },
    "sale_lines": [ ... ],
    "banks": [ ... ],
    "countries": [ ... ]
  }
}
```

### Required Fields

#### `template` (string, required)
Template name to render. Currently supported: `"invoice"`

#### `data` (object, required)
Template data containing:

**`sale` (object, required)**
- `id` (number): Sale ID
- `number` (number): Invoice number
- `year` (number): Invoice year
- `status` (string): One of: `"new"`, `"to verify"`, `"proforma"`, `"ready"`, `"sent"`, `"paid"`, `"deleted"`
- `currency` (string): Currency code (e.g., "EUR", "USD")
- `reg_date` (string): Registration date in YYYYMMDD format
- `amount`, `vat`, `total`, `pay_load` (numbers): Financial amounts

**`buyer` (object, required)**
- `id` (number): Buyer ID
- `name` (string): Company name
- `country` (string): Country code (ISO 3166)
- `lang` (string): Language code (`"it"`, `"en"`, `"de"`, `"fr"`)

**`sale_lines` (array, required)**
Array of line items:
- `id` (number): Line ID
- `description` (string): Product description
- `qty` (number): Quantity
- `price` (number): Unit price
- `vat` (number): VAT percentage
- `discount` (number, optional): Discount percentage
- `code` (string, optional): Product code

#### `language` (string, optional)
Override language (defaults to `buyer.lang`)

#### `outputFormat` (string, optional)
Output format: `"html"` (default) or `"text"`

### Response Format

**Success Response (200)**:
```json
{
  "success": true,
  "html": "<html>...</html>",
  "language": "it",
  "generationTime": 150
}
```

**Error Response (400/500)**:
```json
{
  "success": false,
  "error": "Validation failed",
  "language": "it",
  "generationTime": 0,
  "details": "{\"errors\":[...]}"
}
```

## Handlebars Helpers

### Translation

- `{{t 'key'}}` - Translate a dictionary key

### Formatting

- `{{formatValue num}}` - Format currency (2 decimals)
- `{{formatFlexValue num}}` - Format price (2-8 decimals)
- `{{formatVAT num}}` - Format VAT percentage
- `{{formatQty num}}` - Format quantity (integer)
- `{{formatDate date}}` - Format date (YYYYMMDD → localized)

### Calculations

- `{{calcCost price qty discount}}` - Calculate line cost
- `{{calcVATAmount price qty discount vat}}` - Calculate VAT amount
- `{{calcLineTotal price qty discount vat}}` - Calculate line total

### Logic

- `{{#if (eq a b)}}` - Equality check
- `{{#if (lt a b)}}` - Less than
- `{{#if (gt a b)}}` - Greater than
- `{{#if (and a b)}}` - AND logic
- `{{#if (or a b)}}` - OR logic
- `{{#if (dateBefore date1 date2)}}` - Date comparison

### Array Operations

- `{{hasCode lines}}` - Check if any line has code
- `{{hasDiscount lines}}` - Check if any line has discount
- `{{colSpan lines}}` - Calculate table colspan
- `{{length arr}}` - Array length

### Math

- `{{add a b}}` - Addition
- `{{subtract a b}}` - Subtraction
- `{{multiply a b}}` - Multiplication
- `{{divide a b}}` - Division
- `{{mod a b}}` - Modulo
- `{{negate a}}` - Negate number

### Lookups

- `{{getBank banks id}}` - Get bank by ID
- `{{getCountryName countries code}}` - Get country name

### Utilities

- `{{{nl2br text}}}` - Convert newlines to `<br/>`
- `{{default value defaultValue}}` - Default value

## Development

### Install Dependencies

```bash
cd functions/template-renderer
npm install
```

### Build

```bash
npm run build
```

### Run Tests

```bash
npm test

# With coverage
npm test:coverage
```

### Format Code

```bash
npm run format
```

### Lint

```bash
npm run lint
```

## Testing Locally

### Using Test Events

```bash
# From the function directory
node -e "
const fs = require('fs');
const event = JSON.parse(fs.readFileSync('events/simple-invoice.json'));
const { handler } = require('./dist/index');
handler({ body: JSON.stringify(event), httpMethod: 'POST' }, { requestId: 'test-123' })
  .then(result => console.log(JSON.parse(result.body).html))
  .catch(console.error);
"
```

### Using AWS SAM

```bash
# Install SAM CLI
brew install aws-sam-cli

# Invoke locally
sam local invoke TemplateRendererFunction -e events/simple-invoice.json
```

## Number Formatting by Language

| Language | Format | Example |
|----------|--------|---------|
| Italian (it) | `1.234,56` | Period for thousands, comma for decimal |
| German (de) | `1.234,56` | Period for thousands, comma for decimal |
| English (en) | `1,234.56` | Comma for thousands, period for decimal |
| French (fr) | `1,234.56` | Comma for thousands, period for decimal |

## Date Formatting by Language

| Language | Format | Example |
|----------|--------|---------|
| Italian (it) | `DD/MM/YYYY` | 15/03/2024 |
| German (de) | `DD.MM.YYYY` | 15.03.2024 |
| English (en) | `MM/DD/YYYY` | 03/15/2024 |
| French (fr) | `DD/MM/YYYY` | 15/03/2024 |

## Invoice Template Features

### Document Type Detection

Automatically detects:
- **Invoice**: Regular invoice
- **Proforma**: When `status === 'proforma'`
- **Credit Note**: When `pay_load < 0`

### Dynamic Columns

- **Code column**: Shown only if any line has a code
- **Discount column**: Shown only if any line has a discount

### Special Features

- **Revenue Stamp**: Auto-add €2.00 line if `stamp === 1`
- **Split Payment**: Special handling for `buyer.vatoff === 'split'`
- **Historical Address**: Different Speedex address before February 2019
- **Payment Methods**: Support for MP05, MP12, and bank transfers
- **Multi-line Notes**: Automatic newline to `<br/>` conversion

## Examples

### Simple Invoice (1 line)

```bash
curl -X POST https://your-function-url.lambda-url.eu-west-1.on.aws/ \
  -H "Content-Type: application/json" \
  -d @events/simple-invoice.json
```

### Complex Invoice (6 lines, stamp, delivery notes)

```bash
curl -X POST https://your-function-url.lambda-url.eu-west-1.on.aws/ \
  -H "Content-Type: application/json" \
  -d @events/complex-invoice.json
```

### With Different Language

```javascript
const request = {
  template: 'invoice',
  language: 'de', // Override to German
  data: { /* ... */ }
};

const response = await fetch(functionUrl, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(request)
});

const result = await response.json();
console.log(result.html); // HTML in German
```

## Performance

- **Cold Start**: < 2 seconds
- **Warm Execution**: < 500ms
- **Memory**: 256 MB (configurable)
- **Timeout**: 30 seconds (configurable)

## Cost Estimation

### Monthly Cost (Free Tier)

- **Requests**: 1M/month free (AWS Free Tier)
- **Compute**: 400,000 GB-seconds/month free
- **Estimated cost for 1,000 renders**: $0.00

### Beyond Free Tier

- **Lambda compute**: $0.0000166667 per GB-second
- **Lambda requests**: $0.20 per 1M requests
- **Example**: 10,000 renders/month ≈ $0.50-1.00

## Security

### Input Validation

- Template name validation
- Language validation
- Required field validation
- Type validation

### Sanitization

- Script tag removal
- Event handler removal
- XSS prevention

### Best Practices

1. Enable IAM authentication for production
2. Restrict CORS origins
3. Use secrets manager for sensitive data
4. Enable CloudWatch alarms
5. Monitor for suspicious patterns

## Troubleshooting

### Template not found

**Error**: `Template not found: invoice`

**Solution**: Ensure template file exists at `templates/invoice.hbs`

### Translation missing

**Output**: `??key_name??`

**Solution**: Add translation to dictionaries (it.json, en.json, de.json, fr.json)

### Invalid date format

**Error**: Date shows as `20240315` instead of formatted

**Solution**: Ensure date is in YYYYMMDD format (string or number)

### Numbers not formatting

**Issue**: Numbers show as `1234.56` instead of localized format

**Solution**: Verify language is set correctly and use formatting helpers

## Integration

### With HTML-to-PDF Lambda

```javascript
// 1. Render HTML
const templateResponse = await fetch(templateRendererUrl, {
  method: 'POST',
  body: JSON.stringify({ template: 'invoice', data: saleData })
});
const { html } = await templateResponse.json();

// 2. Generate PDF
const pdfResponse = await fetch(htmlToPdfUrl, {
  method: 'POST',
  body: JSON.stringify({ html, outputFormat: 's3' })
});
const { url } = await pdfResponse.json();

console.log('PDF URL:', url);
```

### With SDI Generator Lambda

```javascript
// Generate both PDF invoice and SDI XML
const [htmlResponse, sdiResponse] = await Promise.all([
  // Render HTML
  fetch(templateRendererUrl, {
    method: 'POST',
    body: JSON.stringify({ template: 'invoice', data: saleData })
  }),
  // Generate SDI XML
  fetch(sdiGeneratorUrl, {
    method: 'POST',
    body: JSON.stringify({ invoice: sdiData })
  })
]);
```

## License

MIT

## References

- [Handlebars Documentation](https://handlebarsjs.com/)
- [i18next Documentation](https://www.i18next.com/)
- [AWS Lambda Documentation](https://docs.aws.amazon.com/lambda/)
- [date-fns Documentation](https://date-fns.org/)
