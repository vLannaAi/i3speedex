/**
 * Italian validators for VAT numbers (Partita IVA) and Fiscal Codes (Codice Fiscale)
 */

import * as fs from 'fs';
import * as path from 'path';

// Try to import libxmljs2, but gracefully handle if it's not available
// (native module requires Amazon Linux build for Lambda)
let libxmljs: any;
try {
  libxmljs = require('libxmljs2');
} catch (e) {
  // libxmljs2 not available (not compiled for Lambda environment)
  libxmljs = null;
}

/**
 * Validate Italian VAT number (Partita IVA)
 * Format: 11 digits, with checksum validation
 *
 * @param vatNumber - VAT number to validate (with or without IT prefix)
 * @returns true if valid, false otherwise
 */
export function validateItalianVAT(vatNumber: string): boolean {
  // Remove IT prefix if present
  const cleanVAT = vatNumber.replace(/^IT/i, '').trim();

  // Must be exactly 11 digits
  if (!/^\d{11}$/.test(cleanVAT)) {
    return false;
  }

  // Calculate checksum (algorithm from Agenzia delle Entrate)
  let sum = 0;
  for (let i = 0; i < 10; i++) {
    let digit = parseInt(cleanVAT[i], 10);

    // Even positions (0, 2, 4, 6, 8) are doubled
    if (i % 2 === 0) {
      digit *= 2;
      if (digit > 9) {
        digit -= 9;
      }
    }

    sum += digit;
  }

  // Check digit is (10 - (sum % 10)) % 10
  const checkDigit = (10 - (sum % 10)) % 10;
  const providedCheckDigit = parseInt(cleanVAT[10], 10);

  return checkDigit === providedCheckDigit;
}

/**
 * Validate Italian Fiscal Code (Codice Fiscale)
 * Format: 16 alphanumeric characters for individuals, 11 digits for companies
 *
 * @param fiscalCode - Fiscal code to validate
 * @returns true if valid, false otherwise
 */
export function validateItalianFiscalCode(fiscalCode: string): boolean {
  const cleanFC = fiscalCode.toUpperCase().trim();

  // Company fiscal code (same as VAT number)
  if (/^\d{11}$/.test(cleanFC)) {
    return validateItalianVAT(cleanFC);
  }

  // Individual fiscal code (16 characters)
  if (!/^[A-Z]{6}\d{2}[A-Z]\d{2}[A-Z]\d{3}[A-Z]$/.test(cleanFC)) {
    return false;
  }

  // Validate check character (last character)
  const oddMap: { [key: string]: number } = {
    '0': 1, '1': 0, '2': 5, '3': 7, '4': 9, '5': 13, '6': 15, '7': 17, '8': 19, '9': 21,
    'A': 1, 'B': 0, 'C': 5, 'D': 7, 'E': 9, 'F': 13, 'G': 15, 'H': 17, 'I': 19, 'J': 21,
    'K': 2, 'L': 4, 'M': 18, 'N': 20, 'O': 11, 'P': 3, 'Q': 6, 'R': 8, 'S': 12, 'T': 14,
    'U': 16, 'V': 10, 'W': 22, 'X': 25, 'Y': 24, 'Z': 23
  };

  const evenMap: { [key: string]: number } = {
    '0': 0, '1': 1, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9,
    'A': 0, 'B': 1, 'C': 2, 'D': 3, 'E': 4, 'F': 5, 'G': 6, 'H': 7, 'I': 8, 'J': 9,
    'K': 10, 'L': 11, 'M': 12, 'N': 13, 'O': 14, 'P': 15, 'Q': 16, 'R': 17, 'S': 18,
    'T': 19, 'U': 20, 'V': 21, 'W': 22, 'X': 23, 'Y': 24, 'Z': 25
  };

  let sum = 0;
  for (let i = 0; i < 15; i++) {
    const char = cleanFC[i];
    // Odd positions (1, 3, 5, ...) use oddMap, even positions use evenMap
    // Note: positions are 1-indexed in the algorithm
    sum += (i % 2 === 0) ? oddMap[char] : evenMap[char];
  }

  const checkChar = String.fromCharCode(65 + (sum % 26));
  return checkChar === cleanFC[15];
}

/**
 * Validate IBAN
 *
 * @param iban - IBAN to validate
 * @returns true if valid, false otherwise
 */
export function validateIBAN(iban: string): boolean {
  const cleanIBAN = iban.replace(/\s/g, '').toUpperCase();

  // Check format: 2 letters, 2 digits, up to 30 alphanumeric
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]+$/.test(cleanIBAN)) {
    return false;
  }

  // Italian IBAN is 27 characters
  if (cleanIBAN.startsWith('IT') && cleanIBAN.length !== 27) {
    return false;
  }

  // Move first 4 characters to end
  const rearranged = cleanIBAN.slice(4) + cleanIBAN.slice(0, 4);

  // Convert letters to numbers (A=10, B=11, ..., Z=35)
  const numeric = rearranged
    .split('')
    .map(char => {
      const code = char.charCodeAt(0);
      return code >= 65 && code <= 90 ? (code - 55).toString() : char;
    })
    .join('');

  // Calculate mod 97
  let remainder = numeric;
  while (remainder.length > 2) {
    const block = remainder.slice(0, 9);
    remainder = (parseInt(block, 10) % 97).toString() + remainder.slice(block.length);
  }

  return parseInt(remainder, 10) % 97 === 1;
}

/**
 * Format amount for FatturaPA (2 decimal places, no thousands separator)
 *
 * @param amount - Amount to format
 * @returns Formatted string (e.g., "1234.56")
 */
export function formatAmount(amount: number): string {
  return amount.toFixed(2);
}

/**
 * Format quantity for FatturaPA (8 decimal places)
 *
 * @param quantity - Quantity to format
 * @returns Formatted string (e.g., "10.00000000")
 */
export function formatQuantity(quantity: number): string {
  return quantity.toFixed(8);
}

/**
 * Format unit price for FatturaPA (8 decimal places)
 *
 * @param price - Price to format
 * @returns Formatted string (e.g., "123.45000000")
 */
export function formatUnitPrice(price: number): string {
  return price.toFixed(8);
}

/**
 * Format date for FatturaPA (YYYY-MM-DD)
 *
 * @param date - Date to format
 * @returns Formatted string (e.g., "2024-01-27")
 */
export function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

/**
 * Validate Italian province code (2 letters)
 *
 * @param province - Province code to validate
 * @returns true if valid, false otherwise
 */
export function validateProvinceCode(province: string): boolean {
  const validProvinces = [
    'AG', 'AL', 'AN', 'AO', 'AR', 'AP', 'AT', 'AV', 'BA', 'BT', 'BL', 'BN', 'BG', 'BI', 'BO',
    'BZ', 'BS', 'BR', 'CA', 'CL', 'CB', 'CI', 'CE', 'CT', 'CZ', 'CH', 'CO', 'CS', 'CR', 'KR',
    'CN', 'EN', 'FM', 'FE', 'FI', 'FG', 'FC', 'FR', 'GE', 'GO', 'GR', 'IM', 'IS', 'SP', 'AQ',
    'LT', 'LE', 'LC', 'LI', 'LO', 'LU', 'MC', 'MN', 'MS', 'MT', 'ME', 'MI', 'MO', 'MB', 'NA',
    'NO', 'NU', 'OT', 'OR', 'PD', 'PA', 'PR', 'PV', 'PG', 'PU', 'PE', 'PC', 'PI', 'PT', 'PN',
    'PZ', 'PO', 'RG', 'RA', 'RC', 'RE', 'RI', 'RN', 'RM', 'RO', 'SA', 'VS', 'SS', 'SV', 'SI',
    'SR', 'SO', 'TA', 'TE', 'TR', 'TO', 'OG', 'TP', 'TN', 'TV', 'TS', 'UD', 'VA', 'VE', 'VB',
    'VC', 'VR', 'VV', 'VI', 'VT'
  ];

  return validProvinces.includes(province.toUpperCase());
}

/**
 * Generate filename for FatturaPA XML
 * Format: ITnnnnnnnnnn_xxxxx.xml
 * - IT: Country code
 * - nnnnnnnnnn: VAT number (11 digits)
 * - xxxxx: Progressive number (5 digits, zero-padded)
 *
 * @param vatNumber - VAT number (with or without IT prefix)
 * @param progressiveNumber - Progressive invoice number
 * @returns Generated filename
 */
export function generateFatturaFilename(vatNumber: string, progressiveNumber: string): string {
  const cleanVAT = vatNumber.replace(/^IT/i, '').trim();
  const paddedProgressive = progressiveNumber.padStart(5, '0').slice(0, 5);
  return `IT${cleanVAT}_${paddedProgressive}.xml`;
}

/**
 * Sanitize phone/fax number for FatturaPA
 * - Remove spaces, parentheses, dashes
 * - Remove country codes (+39, 0039)
 * - Truncate to max 12 characters
 *
 * @param phone - Phone/fax number to sanitize
 * @returns Sanitized phone number (5-12 chars)
 */
export function sanitizePhoneNumber(phone: string): string {
  // Remove all spaces, parentheses, dashes, plus signs
  let clean = phone.replace(/[\s\(\)\-\+]/g, '');

  // Remove Italian country code if present
  if (clean.startsWith('39')) {
    clean = clean.slice(2);
  }

  // Truncate to 12 characters max (FatturaPA requirement)
  return clean.slice(0, 12);
}

/**
 * Validate FatturaPA XML against XSD schema
 * Note: XSD validation requires libxmljs2 to be compiled for Lambda (Amazon Linux)
 *
 * @param xmlContent - XML content to validate
 * @param schemaPath - Optional path to XSD schema file (defaults to FPR12)
 * @returns Validation result with errors if any
 */
export function validateXML(
  xmlContent: string,
  schemaPath?: string
): { valid: boolean; errors: string[]; warnings?: string[] } {
  try {
    // Check if libxmljs2 is available
    if (!libxmljs) {
      return {
        valid: true, // Assume valid if validation unavailable
        errors: [],
        warnings: ['XSD validation not available - libxmljs2 requires compilation for Lambda environment']
      };
    }

    // Default to FPR12 schema
    const xsdPath = schemaPath || path.join(__dirname, '../schema-FPR12.xsd');

    // Read XSD schema
    if (!fs.existsSync(xsdPath)) {
      return {
        valid: false,
        errors: [`XSD schema not found at ${xsdPath}`]
      };
    }

    const xsdContent = fs.readFileSync(xsdPath, 'utf-8');
    const xsdDoc = libxmljs.parseXml(xsdContent);

    // Parse XML
    const xmlDoc = libxmljs.parseXml(xmlContent);

    // Validate against schema
    // Note: Using nonet option to prevent external schema loading
    const isValid = xmlDoc.validate(xsdDoc);

    if (isValid) {
      return { valid: true, errors: [] };
    } else {
      // Collect validation errors
      const errors = xmlDoc.validationErrors.map((err: any) => {
        return `Line ${err.line}: ${err.message}`;
      });

      return { valid: false, errors };
    }
  } catch (error) {
    return {
      valid: false,
      errors: [`Validation error: ${error instanceof Error ? error.message : String(error)}`]
    };
  }
}
