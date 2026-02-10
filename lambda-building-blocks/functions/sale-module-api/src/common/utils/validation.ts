/**
 * Validation Utilities
 * Input validation helpers for API requests
 */

// ========================================
// Custom Error Classes
// ========================================

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

export class NotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NotFoundError';
  }
}

export class UnauthorizedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UnauthorizedError';
  }
}

export class ForbiddenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ForbiddenError';
  }
}

export class ConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConflictError';
  }
}

// ========================================
// Type Validators
// ========================================

/**
 * Check if value is a non-empty string
 */
export function isNonEmptyString(value: any): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

/**
 * Check if value is a valid number
 */
export function isValidNumber(value: any): value is number {
  return typeof value === 'number' && !isNaN(value) && isFinite(value);
}

/**
 * Check if value is a positive number
 */
export function isPositiveNumber(value: any): boolean {
  return isValidNumber(value) && value > 0;
}

/**
 * Check if value is a non-negative number
 */
export function isNonNegativeNumber(value: any): boolean {
  return isValidNumber(value) && value >= 0;
}

/**
 * Check if value is a valid email
 */
export function isValidEmail(value: any): boolean {
  if (!isNonEmptyString(value)) return false;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(value);
}

/**
 * Check if value is a valid ISO 8601 date string
 */
export function isValidISODate(value: any): boolean {
  if (!isNonEmptyString(value)) return false;
  const date = new Date(value);
  return !isNaN(date.getTime());
}

/**
 * Check if value is a valid VAT number (basic check)
 */
export function isValidVatNumber(value: any): boolean {
  if (!isNonEmptyString(value)) return false;
  // Basic VAT format: 2 letter country code + 8-12 digits
  const vatRegex = /^[A-Z]{2}[0-9]{8,12}$/;
  return vatRegex.test(value.toUpperCase().replace(/\s/g, ''));
}

/**
 * Check if value is a valid Italian fiscal code
 */
export function isValidFiscalCode(value: any): boolean {
  if (!isNonEmptyString(value)) return false;
  // Italian fiscal code: 16 alphanumeric characters
  const fiscalCodeRegex = /^[A-Z]{6}[0-9]{2}[A-Z][0-9]{2}[A-Z][0-9]{3}[A-Z]$/;
  return fiscalCodeRegex.test(value.toUpperCase());
}

/**
 * Check if value is a valid Italian SDI code
 */
export function isValidSdiCode(value: any): boolean {
  if (!isNonEmptyString(value)) return false;
  // SDI code: 7 alphanumeric characters
  const sdiRegex = /^[A-Z0-9]{7}$/;
  return sdiRegex.test(value.toUpperCase());
}

/**
 * Check if value is a valid postal code
 */
export function isValidPostalCode(value: any, country?: string): boolean {
  if (!isNonEmptyString(value)) return false;

  // Country-specific validation
  if (country) {
    switch (country.toUpperCase()) {
      case 'IT': // Italy: 5 digits
        return /^[0-9]{5}$/.test(value);
      case 'US': // USA: 5 digits or 5+4 format
        return /^[0-9]{5}(-[0-9]{4})?$/.test(value);
      case 'GB': // UK: complex format
        return /^[A-Z]{1,2}[0-9]{1,2}[A-Z]?\s?[0-9][A-Z]{2}$/i.test(value);
      case 'DE': // Germany: 5 digits
        return /^[0-9]{5}$/.test(value);
      case 'FR': // France: 5 digits
        return /^[0-9]{5}$/.test(value);
    }
  }

  // Generic: 3-10 alphanumeric characters
  return /^[A-Z0-9]{3,10}$/i.test(value.replace(/[\s-]/g, ''));
}

/**
 * Check if value is a valid currency code (ISO 4217)
 */
export function isValidCurrencyCode(value: any): boolean {
  if (!isNonEmptyString(value)) return false;
  // Must be 3 uppercase letters
  const currencyRegex = /^[A-Z]{3}$/;
  return currencyRegex.test(value);
}

// ========================================
// Field Validators
// ========================================

/**
 * Validate required field
 */
export function validateRequired(value: any, fieldName: string): void {
  if (value === undefined || value === null) {
    throw new ValidationError(`${fieldName} is required`);
  }

  if (typeof value === 'string' && value.trim().length === 0) {
    throw new ValidationError(`${fieldName} cannot be empty`);
  }
}

/**
 * Validate string length
 */
export function validateStringLength(
  value: string,
  fieldName: string,
  min?: number,
  max?: number
): void {
  if (min !== undefined && value.length < min) {
    throw new ValidationError(`${fieldName} must be at least ${min} characters`);
  }

  if (max !== undefined && value.length > max) {
    throw new ValidationError(`${fieldName} must be at most ${max} characters`);
  }
}

/**
 * Validate number range
 */
export function validateNumberRange(
  value: number,
  fieldName: string,
  min?: number,
  max?: number
): void {
  if (min !== undefined && value < min) {
    throw new ValidationError(`${fieldName} must be at least ${min}`);
  }

  if (max !== undefined && value > max) {
    throw new ValidationError(`${fieldName} must be at most ${max}`);
  }
}

/**
 * Validate enum value
 */
export function validateEnum<T extends string>(
  value: any,
  fieldName: string,
  allowedValues: T[]
): asserts value is T {
  if (!allowedValues.includes(value)) {
    throw new ValidationError(
      `${fieldName} must be one of: ${allowedValues.join(', ')}`
    );
  }
}

// ========================================
// Object Validators
// ========================================

/**
 * Validate sale data
 */
export function validateSaleData(data: any): void {
  // Required fields
  validateRequired(data.saleDate, 'saleDate');
  validateRequired(data.buyerId, 'buyerId');
  validateRequired(data.producerId, 'producerId');

  // Date validation
  if (!isValidISODate(data.saleDate)) {
    throw new ValidationError('saleDate must be a valid ISO 8601 date');
  }

  // Optional currency
  if (data.currency && !isValidCurrencyCode(data.currency)) {
    throw new ValidationError('currency must be a valid ISO 4217 currency code');
  }

  // Optional status
  if (data.status) {
    validateEnum(data.status, 'status', [
      'draft',
      'confirmed',
      'invoiced',
      'paid',
      'cancelled',
    ]);
  }

  // String length validations
  if (data.notes) {
    validateStringLength(data.notes, 'notes', 0, 1000);
  }

  if (data.internalNotes) {
    validateStringLength(data.internalNotes, 'internalNotes', 0, 1000);
  }
}

/**
 * Validate sale line data
 */
export function validateSaleLineData(data: any): void {
  // Required fields
  validateRequired(data.productDescription, 'productDescription');
  validateRequired(data.quantity, 'quantity');
  validateRequired(data.unitPrice, 'unitPrice');
  validateRequired(data.taxRate, 'taxRate');

  // Number validations
  if (!isPositiveNumber(data.quantity)) {
    throw new ValidationError('quantity must be a positive number');
  }

  if (!isNonNegativeNumber(data.unitPrice)) {
    throw new ValidationError('unitPrice must be a non-negative number');
  }

  if (!isNonNegativeNumber(data.taxRate)) {
    throw new ValidationError('taxRate must be a non-negative number');
  }

  if (data.taxRate > 100) {
    throw new ValidationError('taxRate cannot exceed 100');
  }

  // Optional discount
  if (data.discount !== undefined) {
    if (!isNonNegativeNumber(data.discount)) {
      throw new ValidationError('discount must be a non-negative number');
    }

    if (data.discount > 100) {
      throw new ValidationError('discount cannot exceed 100');
    }
  }

  // String validations
  validateStringLength(data.productDescription, 'productDescription', 1, 500);

  if (data.productCode) {
    validateStringLength(data.productCode, 'productCode', 0, 100);
  }

  if (data.notes) {
    validateStringLength(data.notes, 'notes', 0, 500);
  }
}

/**
 * Validate buyer data
 */
export function validateBuyerData(data: any): void {
  // Required fields
  validateRequired(data.companyName, 'companyName');
  validateRequired(data.address, 'address');
  validateRequired(data.city, 'city');
  validateRequired(data.postalCode, 'postalCode');
  validateRequired(data.country, 'country');

  // String length validations
  validateStringLength(data.companyName, 'companyName', 1, 200);
  validateStringLength(data.address, 'address', 1, 200);
  validateStringLength(data.city, 'city', 1, 100);
  validateStringLength(data.country, 'country', 2, 2); // ISO country code

  // Optional email
  if (data.email && !isValidEmail(data.email)) {
    throw new ValidationError('email must be a valid email address');
  }

  // Optional VAT number
  if (data.vatNumber && !isValidVatNumber(data.vatNumber)) {
    throw new ValidationError('vatNumber must be a valid VAT number');
  }

  // Optional fiscal code (Italian)
  if (data.fiscalCode && !isValidFiscalCode(data.fiscalCode)) {
    throw new ValidationError('fiscalCode must be a valid Italian fiscal code');
  }

  // Optional SDI code (Italian)
  if (data.sdi && !isValidSdiCode(data.sdi)) {
    throw new ValidationError('sdi must be a valid 7-character SDI code');
  }

  // Postal code validation
  if (!isValidPostalCode(data.postalCode, data.country)) {
    throw new ValidationError('postalCode is not valid for the specified country');
  }

  // Optional status
  if (data.status) {
    validateEnum(data.status, 'status', ['active', 'inactive']);
  }
}

/**
 * Validate producer data
 */
export function validateProducerData(data: any): void {
  // Required fields
  validateRequired(data.companyName, 'companyName');
  validateRequired(data.address, 'address');
  validateRequired(data.city, 'city');
  validateRequired(data.postalCode, 'postalCode');
  validateRequired(data.country, 'country');

  // String length validations
  validateStringLength(data.companyName, 'companyName', 1, 200);
  validateStringLength(data.address, 'address', 1, 200);
  validateStringLength(data.city, 'city', 1, 100);
  validateStringLength(data.country, 'country', 2, 2); // ISO country code

  // Optional email
  if (data.email && !isValidEmail(data.email)) {
    throw new ValidationError('email must be a valid email address');
  }

  // Optional VAT number
  if (data.vatNumber && !isValidVatNumber(data.vatNumber)) {
    throw new ValidationError('vatNumber must be a valid VAT number');
  }

  // Optional fiscal code (Italian)
  if (data.fiscalCode && !isValidFiscalCode(data.fiscalCode)) {
    throw new ValidationError('fiscalCode must be a valid Italian fiscal code');
  }

  // Postal code validation
  if (!isValidPostalCode(data.postalCode, data.country)) {
    throw new ValidationError('postalCode is not valid for the specified country');
  }

  // Optional status
  if (data.status) {
    validateEnum(data.status, 'status', ['active', 'inactive']);
  }
}

// ========================================
// Pagination Validators
// ========================================

/**
 * Validate and normalize pagination parameters
 */
export function validatePaginationParams(params: {
  page?: string | number;
  pageSize?: string | number;
  nextToken?: string;
}): {
  page: number;
  pageSize: number;
  nextToken?: string;
} {
  // Parse page
  let page = 1;
  if (params.page) {
    page = typeof params.page === 'string' ? parseInt(params.page, 10) : params.page;

    if (!isPositiveNumber(page)) {
      throw new ValidationError('page must be a positive number');
    }
  }

  // Parse pageSize
  let pageSize = 20; // default
  if (params.pageSize) {
    pageSize =
      typeof params.pageSize === 'string' ? parseInt(params.pageSize, 10) : params.pageSize;

    if (!isPositiveNumber(pageSize)) {
      throw new ValidationError('pageSize must be a positive number');
    }

    if (pageSize > 100) {
      throw new ValidationError('pageSize cannot exceed 100');
    }
  }

  return {
    page,
    pageSize,
    nextToken: params.nextToken,
  };
}
