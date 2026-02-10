/**
 * Handlebars helper functions for invoice templates
 */

import Handlebars from 'handlebars';
import { Language, SaleLine, Bank, Country, LineCalculations } from './types';
import {
  formatValue,
  formatFlexValue,
  formatVAT,
  formatQty,
  formatDate,
  dateBefore,
} from './formatters';
import { i18nService } from './i18n';

/**
 * Calculate line cost (price × qty × (1 - discount))
 */
export function calcCost(
  price: number,
  qty: number,
  discount: number = 0
): number {
  return price * qty * (1 - discount / 100);
}

/**
 * Calculate VAT amount for a line
 */
export function calcVATAmount(
  price: number,
  qty: number,
  discount: number = 0,
  vat: number = 0
): number {
  const cost = calcCost(price, qty, discount);
  return (cost * vat) / 100;
}

/**
 * Calculate line total (with VAT)
 */
export function calcLineTotal(
  price: number,
  qty: number,
  discount: number = 0,
  vat: number = 0
): number {
  const cost = calcCost(price, qty, discount);
  return cost * (1 + vat / 100);
}

/**
 * Calculate all line values at once
 */
export function calculateLine(
  price: number,
  qty: number,
  discount: number = 0,
  vat: number = 0
): LineCalculations {
  const cost = calcCost(price, qty, discount);
  const vat_amount = (cost * vat) / 100;
  const total = cost + vat_amount;

  return {
    cost,
    vat_amount,
    total,
  };
}

/**
 * Check if any line has a code
 */
export function hasCode(lines: SaleLine[]): boolean {
  return lines.some((line) => !!line.code);
}

/**
 * Check if any line has a discount
 */
export function hasDiscount(lines: SaleLine[]): boolean {
  return lines.some((line) => line.discount && line.discount > 0);
}

/**
 * Calculate column span based on whether code/discount columns are shown
 */
export function colSpan(lines: SaleLine[]): number {
  let span = 5; // Base columns: empty, description, qty, price, cost
  if (hasCode(lines)) span += 1; // Add code column
  if (hasDiscount(lines)) span += 1; // Add discount column
  return span;
}

/**
 * Get bank by ID
 */
export function getBank(banks: Bank[] | undefined, bankId: string): Bank | null {
  if (!banks) return null;
  return banks.find((b) => b.id === bankId) || null;
}

/**
 * Get country name by code
 */
export function getCountryName(
  countries: Country[] | undefined,
  countryCode: string,
  language: Language
): string {
  if (!countries) return countryCode;

  const country = countries.find((c) => c.code === countryCode);
  if (!country) return countryCode;

  if (language === 'en' && country.name) {
    return country.name;
  } else if (country.it_name) {
    return country.it_name;
  } else if (country.name) {
    return country.name;
  }

  return countryCode;
}

/**
 * Convert newlines to <br/> tags
 */
export function nl2br(text: string | undefined): Handlebars.SafeString {
  if (!text) return new Handlebars.SafeString('');
  const html = text.replace(/\n/g, '<br/>');
  return new Handlebars.SafeString(html);
}

/**
 * Register all Handlebars helpers
 */
export function registerHelpers(language: Language): void {
  // Translation helper
  Handlebars.registerHelper('t', function (key: string, options: any) {
    // Support both {{t 'key'}} and {{t key}}
    const actualKey = typeof key === 'string' ? key : options;
    return i18nService.translate(actualKey, language, options?.hash);
  });

  // Formatting helpers
  Handlebars.registerHelper(
    'formatValue',
    (value: number | string) => formatValue(value, language)
  );

  Handlebars.registerHelper(
    'formatFlexValue',
    (value: number | string) => formatFlexValue(value, language)
  );

  Handlebars.registerHelper(
    'formatVAT',
    (value: number | string) => formatVAT(value, language)
  );

  Handlebars.registerHelper(
    'formatQty',
    (value: number | string) => formatQty(value, language)
  );

  Handlebars.registerHelper(
    'formatDate',
    (value: string | number | undefined) => formatDate(value, language)
  );

  // Calculation helpers
  Handlebars.registerHelper('calcCost', calcCost);
  Handlebars.registerHelper('calcVATAmount', calcVATAmount);
  Handlebars.registerHelper('calcLineTotal', calcLineTotal);

  // Logic helpers
  Handlebars.registerHelper('eq', (a: any, b: any) => a === b);
  Handlebars.registerHelper('ne', (a: any, b: any) => a !== b);
  Handlebars.registerHelper('lt', (a: any, b: any) => a < b);
  Handlebars.registerHelper('gt', (a: any, b: any) => a > b);
  Handlebars.registerHelper('lte', (a: any, b: any) => a <= b);
  Handlebars.registerHelper('gte', (a: any, b: any) => a >= b);
  Handlebars.registerHelper('and', (a: any, b: any) => a && b);
  Handlebars.registerHelper('or', (a: any, b: any) => a || b);
  Handlebars.registerHelper('not', (a: any) => !a);

  // Date comparison
  Handlebars.registerHelper('dateBefore', dateBefore);

  // Array helpers
  Handlebars.registerHelper('hasCode', hasCode);
  Handlebars.registerHelper('hasDiscount', hasDiscount);
  Handlebars.registerHelper('colSpan', colSpan);
  Handlebars.registerHelper('length', (arr: any[]) => (arr ? arr.length : 0));

  // Math helpers
  Handlebars.registerHelper('add', (a: number, b: number) => a + b);
  Handlebars.registerHelper('subtract', (a: number, b: number) => a - b);
  Handlebars.registerHelper('multiply', (a: number, b: number) => a * b);
  Handlebars.registerHelper('divide', (a: number, b: number) => a / b);
  Handlebars.registerHelper('mod', (a: number, b: number) => a % b);
  Handlebars.registerHelper('negate', (a: number) => -a);

  // Lookup helpers
  Handlebars.registerHelper('getBank', getBank);
  Handlebars.registerHelper(
    'getCountryName',
    (countries: Country[] | undefined, code: string) =>
      getCountryName(countries, code, language)
  );

  // Utility helpers
  Handlebars.registerHelper('nl2br', nl2br);

  // Default value helper
  Handlebars.registerHelper('default', (value: any, defaultValue: any) =>
    value !== undefined && value !== null && value !== '' ? value : defaultValue
  );

  // Conditional blocks with multiple conditions
  Handlebars.registerHelper('ifCond', function (
    this: any,
    v1: any,
    operator: string,
    v2: any,
    options: any
  ) {
    switch (operator) {
      case '==':
        return v1 == v2 ? options.fn(this) : options.inverse(this);
      case '===':
        return v1 === v2 ? options.fn(this) : options.inverse(this);
      case '!=':
        return v1 != v2 ? options.fn(this) : options.inverse(this);
      case '!==':
        return v1 !== v2 ? options.fn(this) : options.inverse(this);
      case '<':
        return v1 < v2 ? options.fn(this) : options.inverse(this);
      case '<=':
        return v1 <= v2 ? options.fn(this) : options.inverse(this);
      case '>':
        return v1 > v2 ? options.fn(this) : options.inverse(this);
      case '>=':
        return v1 >= v2 ? options.fn(this) : options.inverse(this);
      case '&&':
        return v1 && v2 ? options.fn(this) : options.inverse(this);
      case '||':
        return v1 || v2 ? options.fn(this) : options.inverse(this);
      default:
        return options.inverse(this);
    }
  });

  // Debug helper (only in development)
  if (process.env.NODE_ENV === 'development' || process.env.LOG_LEVEL === 'DEBUG') {
    Handlebars.registerHelper('debug', function (this: any, optionalValue: any) {
      console.log('Current Context:');
      console.log('====================');
      console.log(this);

      if (optionalValue) {
        console.log('Value:');
        console.log('====================');
        console.log(optionalValue);
      }
    });
  }
}

/**
 * Unregister all helpers (for testing)
 */
export function unregisterAllHelpers(): void {
  // Clear all registered helpers
  const helpers = Object.keys(Handlebars.helpers);
  helpers.forEach((name) => {
    Handlebars.unregisterHelper(name);
  });
}
