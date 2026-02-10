/**
 * Number and date formatting based on language
 */

import { format, parse } from 'date-fns';
import { it, enUS, de, fr } from 'date-fns/locale';
import { Language } from './types';

const locales = {
  it,
  en: enUS,
  de,
  fr,
};

/**
 * Format a number as currency/value (2 decimals)
 * IT/DE: 1.234,56
 * EN/FR: 1,234.56
 */
export function formatValue(value: number | string, language: Language): string {
  const num = typeof value === 'string' ? parseFloat(value) : value;

  if (isNaN(num)) {
    return '0,00';
  }

  if (language === 'it' || language === 'de') {
    // European format: period for thousands, comma for decimal
    return num
      .toFixed(2)
      .replace('.', ',')
      .replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  } else {
    // US/English format: comma for thousands, period for decimal
    return num.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }
}

/**
 * Format a number with flexible decimals (2-8 decimals for prices)
 * IT/DE: 1.234,123456
 * EN/FR: 1,234.123456
 */
export function formatFlexValue(
  value: number | string,
  language: Language
): string {
  const num = typeof value === 'string' ? parseFloat(value) : value;

  if (isNaN(num)) {
    return '0,00';
  }

  // Use up to 8 decimals, but trim trailing zeros after 2 decimals
  let formatted = num.toFixed(8);

  // Remove trailing zeros after 2 decimal places
  const parts = formatted.split('.');
  let integerPart = parts[0];
  let decimalPart = '';

  if (parts[1]) {
    // Keep at least 2 decimals, remove trailing zeros beyond that
    decimalPart = parts[1].substring(0, 2) + parts[1].substring(2).replace(/0+$/, '');
  }

  // Apply thousand separators only to integer part
  if (language === 'it' || language === 'de') {
    // European format: period for thousands, comma for decimal
    const formattedInteger = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    return decimalPart ? `${formattedInteger},${decimalPart}` : formattedInteger;
  } else {
    // US/English format: comma for thousands, period for decimal
    const formattedInteger = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return decimalPart ? `${formattedInteger}.${decimalPart}` : formattedInteger;
  }
}

/**
 * Format a VAT percentage (2 decimals, trimming trailing zeros)
 * IT/DE: 22,50 or 22
 * EN/FR: 22.50 or 22
 */
export function formatVAT(value: number | string, language: Language): string {
  const num = typeof value === 'string' ? parseFloat(value) : value;

  if (isNaN(num)) {
    return '0';
  }

  // Format with 2 decimals, then trim trailing zeros
  let formatted = num.toFixed(2).replace(/\.?0+$/, '');

  if (language === 'it' || language === 'de') {
    return formatted.replace('.', ',');
  } else {
    return formatted;
  }
}

/**
 * Format quantity (integer, no decimals)
 * IT/DE: 1.234
 * EN/FR: 1,234
 */
export function formatQty(value: number | string, language: Language): string {
  const num = typeof value === 'string' ? parseInt(value) : Math.floor(value);

  if (isNaN(num)) {
    return '0';
  }

  if (language === 'it' || language === 'de') {
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  } else {
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }
}

/**
 * Format a date from YYYYMMDD to localized format
 * IT: 15/03/2024
 * EN: 03/15/2024
 * DE: 15.03.2024
 * FR: 15/03/2024
 */
export function formatDate(
  dateStr: string | number | undefined,
  language: Language
): string {
  if (!dateStr) {
    return '';
  }

  const str = dateStr.toString();

  // Parse YYYYMMDD format
  if (str.length === 8) {
    const year = str.substring(0, 4);
    const month = str.substring(4, 6);
    const day = str.substring(6, 8);

    try {
      const date = new Date(`${year}-${month}-${day}`);

      if (isNaN(date.getTime())) {
        return str;
      }

      const locale = locales[language] || locales.it;

      switch (language) {
        case 'en':
          return format(date, 'MM/dd/yyyy', { locale });
        case 'de':
          return format(date, 'dd.MM.yyyy', { locale });
        case 'it':
        case 'fr':
        default:
          return format(date, 'dd/MM/yyyy', { locale });
      }
    } catch (error) {
      return str;
    }
  }

  // If not in YYYYMMDD format, return as-is
  return str;
}

/**
 * Compare if a date is before another date (both in YYYYMMDD format)
 */
export function dateBefore(date1: string | number, date2: string | number): boolean {
  const d1 = parseInt(date1.toString());
  const d2 = parseInt(date2.toString());
  return d1 < d2;
}

/**
 * Parse a number from a localized string
 */
export function parseLocalizedNumber(value: string, language: Language): number {
  if (language === 'it' || language === 'de') {
    // Remove periods (thousands separator), replace comma with period
    return parseFloat(value.replace(/\./g, '').replace(',', '.'));
  } else {
    // Remove commas (thousands separator)
    return parseFloat(value.replace(/,/g, ''));
  }
}
