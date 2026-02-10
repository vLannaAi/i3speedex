/**
 * Unit tests for validation utilities
 */

import {
  ValidationError,
  NotFoundError,
  UnauthorizedError,
  ForbiddenError,
  ConflictError,
  isNonEmptyString,
  isValidNumber,
  isPositiveNumber,
  isNonNegativeNumber,
  isValidEmail,
  isValidISODate,
  isValidVatNumber,
  isValidFiscalCode,
  isValidSdiCode,
  isValidPostalCode,
  isValidCurrencyCode,
  validateRequired,
  validateStringLength,
  validateNumberRange,
  validateEnum,
  validateSaleData,
  validateSaleLineData,
  validateBuyerData,
  validateProducerData,
  validatePaginationParams,
} from '../../../src/common/utils/validation';

describe('Validation Utilities', () => {
  // ========================================
  // Custom Error Classes
  // ========================================

  describe('Custom Error Classes', () => {
    it('should create ValidationError with correct name', () => {
      const error = new ValidationError('Test error');
      expect(error.name).toBe('ValidationError');
      expect(error.message).toBe('Test error');
    });

    it('should create NotFoundError with correct name', () => {
      const error = new NotFoundError('Not found');
      expect(error.name).toBe('NotFoundError');
    });

    it('should create UnauthorizedError with correct name', () => {
      const error = new UnauthorizedError('Unauthorized');
      expect(error.name).toBe('UnauthorizedError');
    });

    it('should create ForbiddenError with correct name', () => {
      const error = new ForbiddenError('Forbidden');
      expect(error.name).toBe('ForbiddenError');
    });

    it('should create ConflictError with correct name', () => {
      const error = new ConflictError('Conflict');
      expect(error.name).toBe('ConflictError');
    });
  });

  // ========================================
  // Type Validators
  // ========================================

  describe('Type Validators', () => {
    describe('isNonEmptyString', () => {
      it('should return true for non-empty strings', () => {
        expect(isNonEmptyString('test')).toBe(true);
        expect(isNonEmptyString('  test  ')).toBe(true);
      });

      it('should return false for empty or whitespace strings', () => {
        expect(isNonEmptyString('')).toBe(false);
        expect(isNonEmptyString('   ')).toBe(false);
      });

      it('should return false for non-strings', () => {
        expect(isNonEmptyString(123)).toBe(false);
        expect(isNonEmptyString(null)).toBe(false);
        expect(isNonEmptyString(undefined)).toBe(false);
      });
    });

    describe('isValidNumber', () => {
      it('should return true for valid numbers', () => {
        expect(isValidNumber(0)).toBe(true);
        expect(isValidNumber(123)).toBe(true);
        expect(isValidNumber(-45.67)).toBe(true);
      });

      it('should return false for invalid numbers', () => {
        expect(isValidNumber(NaN)).toBe(false);
        expect(isValidNumber(Infinity)).toBe(false);
        expect(isValidNumber('123')).toBe(false);
      });
    });

    describe('isPositiveNumber', () => {
      it('should return true for positive numbers', () => {
        expect(isPositiveNumber(1)).toBe(true);
        expect(isPositiveNumber(0.01)).toBe(true);
      });

      it('should return false for zero and negative numbers', () => {
        expect(isPositiveNumber(0)).toBe(false);
        expect(isPositiveNumber(-1)).toBe(false);
      });
    });

    describe('isNonNegativeNumber', () => {
      it('should return true for non-negative numbers', () => {
        expect(isNonNegativeNumber(0)).toBe(true);
        expect(isNonNegativeNumber(1)).toBe(true);
      });

      it('should return false for negative numbers', () => {
        expect(isNonNegativeNumber(-1)).toBe(false);
      });
    });

    describe('isValidEmail', () => {
      it('should return true for valid emails', () => {
        expect(isValidEmail('test@example.com')).toBe(true);
        expect(isValidEmail('user+tag@domain.co.uk')).toBe(true);
      });

      it('should return false for invalid emails', () => {
        expect(isValidEmail('invalid')).toBe(false);
        expect(isValidEmail('test@')).toBe(false);
        expect(isValidEmail('@example.com')).toBe(false);
      });
    });

    describe('isValidISODate', () => {
      it('should return true for valid ISO dates', () => {
        expect(isValidISODate('2026-01-29')).toBe(true);
        expect(isValidISODate('2026-01-29T12:00:00Z')).toBe(true);
      });

      it('should return false for invalid dates', () => {
        expect(isValidISODate('invalid')).toBe(false);
        expect(isValidISODate('2026-13-01')).toBe(false);
      });
    });

    describe('isValidVatNumber', () => {
      it('should return true for valid VAT numbers', () => {
        expect(isValidVatNumber('IT12345678901')).toBe(true);
        expect(isValidVatNumber('DE123456789')).toBe(true);
      });

      it('should return false for invalid VAT numbers', () => {
        expect(isValidVatNumber('123')).toBe(false);
        expect(isValidVatNumber('INVALID')).toBe(false);
      });
    });

    describe('isValidFiscalCode', () => {
      it('should return true for valid fiscal codes', () => {
        expect(isValidFiscalCode('RSSMRA80A01H501Z')).toBe(true);
      });

      it('should return false for invalid fiscal codes', () => {
        expect(isValidFiscalCode('INVALID')).toBe(false);
        expect(isValidFiscalCode('123456789')).toBe(false);
      });
    });

    describe('isValidSdiCode', () => {
      it('should return true for valid SDI codes', () => {
        expect(isValidSdiCode('ABCDE12')).toBe(true);
        expect(isValidSdiCode('1234567')).toBe(true);
      });

      it('should return false for invalid SDI codes', () => {
        expect(isValidSdiCode('ABC')).toBe(false);
        expect(isValidSdiCode('ABCDEFGH')).toBe(false);
      });
    });

    describe('isValidPostalCode', () => {
      it('should return true for valid Italian postal codes', () => {
        expect(isValidPostalCode('12345', 'IT')).toBe(true);
      });

      it('should return true for valid US postal codes', () => {
        expect(isValidPostalCode('12345', 'US')).toBe(true);
        expect(isValidPostalCode('12345-6789', 'US')).toBe(true);
      });

      it('should return false for invalid postal codes', () => {
        expect(isValidPostalCode('ABC', 'IT')).toBe(false);
        expect(isValidPostalCode('1234', 'IT')).toBe(false);
      });
    });

    describe('isValidCurrencyCode', () => {
      it('should return true for valid currency codes', () => {
        expect(isValidCurrencyCode('USD')).toBe(true);
        expect(isValidCurrencyCode('EUR')).toBe(true);
      });

      it('should return false for invalid currency codes', () => {
        expect(isValidCurrencyCode('US')).toBe(false);
        expect(isValidCurrencyCode('usd')).toBe(false);
        expect(isValidCurrencyCode('EURO')).toBe(false);
      });
    });
  });

  // ========================================
  // Field Validators
  // ========================================

  describe('Field Validators', () => {
    describe('validateRequired', () => {
      it('should not throw for valid values', () => {
        expect(() => validateRequired('test', 'field')).not.toThrow();
        expect(() => validateRequired(123, 'field')).not.toThrow();
        expect(() => validateRequired(false, 'field')).not.toThrow();
      });

      it('should throw ValidationError for missing values', () => {
        expect(() => validateRequired(undefined, 'field')).toThrow(ValidationError);
        expect(() => validateRequired(null, 'field')).toThrow(ValidationError);
        expect(() => validateRequired('', 'field')).toThrow(ValidationError);
        expect(() => validateRequired('   ', 'field')).toThrow(ValidationError);
      });
    });

    describe('validateStringLength', () => {
      it('should not throw for valid string lengths', () => {
        expect(() => validateStringLength('test', 'field', 1, 10)).not.toThrow();
      });

      it('should throw ValidationError for strings too short', () => {
        expect(() => validateStringLength('ab', 'field', 3)).toThrow(ValidationError);
      });

      it('should throw ValidationError for strings too long', () => {
        expect(() => validateStringLength('abcdef', 'field', undefined, 5)).toThrow(ValidationError);
      });
    });

    describe('validateNumberRange', () => {
      it('should not throw for valid number ranges', () => {
        expect(() => validateNumberRange(5, 'field', 1, 10)).not.toThrow();
      });

      it('should throw ValidationError for numbers too small', () => {
        expect(() => validateNumberRange(0, 'field', 1)).toThrow(ValidationError);
      });

      it('should throw ValidationError for numbers too large', () => {
        expect(() => validateNumberRange(11, 'field', undefined, 10)).toThrow(ValidationError);
      });
    });

    describe('validateEnum', () => {
      it('should not throw for valid enum values', () => {
        expect(() => validateEnum('draft', 'status', ['draft', 'confirmed'])).not.toThrow();
      });

      it('should throw ValidationError for invalid enum values', () => {
        expect(() => validateEnum('invalid', 'status', ['draft', 'confirmed'])).toThrow(ValidationError);
      });
    });
  });

  // ========================================
  // Object Validators
  // ========================================

  describe('Object Validators', () => {
    describe('validateSaleData', () => {
      const validSaleData = {
        saleDate: '2026-01-29',
        buyerId: 'BUYER001',
        producerId: 'PROD001',
        currency: 'EUR',
        status: 'draft',
      };

      it('should not throw for valid sale data', () => {
        expect(() => validateSaleData(validSaleData)).not.toThrow();
      });

      it('should throw ValidationError when saleDate is missing', () => {
        const data = { ...validSaleData, saleDate: undefined };
        expect(() => validateSaleData(data)).toThrow(ValidationError);
      });

      it('should throw ValidationError when buyerId is missing', () => {
        const data = { ...validSaleData, buyerId: undefined };
        expect(() => validateSaleData(data)).toThrow(ValidationError);
      });

      it('should throw ValidationError when producerId is missing', () => {
        const data = { ...validSaleData, producerId: undefined };
        expect(() => validateSaleData(data)).toThrow(ValidationError);
      });

      it('should throw ValidationError for invalid currency code', () => {
        const data = { ...validSaleData, currency: 'INVALID' };
        expect(() => validateSaleData(data)).toThrow(ValidationError);
      });

      it('should throw ValidationError for invalid status', () => {
        const data = { ...validSaleData, status: 'invalid' };
        expect(() => validateSaleData(data)).toThrow(ValidationError);
      });

      it('should throw ValidationError for invalid date format', () => {
        const data = { ...validSaleData, saleDate: 'invalid-date' };
        expect(() => validateSaleData(data)).toThrow(ValidationError);
      });
    });

    describe('validateSaleLineData', () => {
      const validLineData = {
        productDescription: 'Test Product',
        quantity: 10,
        unitPrice: 50.00,
        taxRate: 22,
      };

      it('should not throw for valid sale line data', () => {
        expect(() => validateSaleLineData(validLineData)).not.toThrow();
      });

      it('should throw ValidationError for missing productDescription', () => {
        const data = { ...validLineData, productDescription: undefined };
        expect(() => validateSaleLineData(data)).toThrow(ValidationError);
      });

      it('should throw ValidationError for invalid quantity', () => {
        const data = { ...validLineData, quantity: 0 };
        expect(() => validateSaleLineData(data)).toThrow(ValidationError);
      });

      it('should throw ValidationError for negative unitPrice', () => {
        const data = { ...validLineData, unitPrice: -10 };
        expect(() => validateSaleLineData(data)).toThrow(ValidationError);
      });

      it('should throw ValidationError for negative taxRate', () => {
        const data = { ...validLineData, taxRate: -5 };
        expect(() => validateSaleLineData(data)).toThrow(ValidationError);
      });

      it('should throw ValidationError for taxRate over 100', () => {
        const data = { ...validLineData, taxRate: 150 };
        expect(() => validateSaleLineData(data)).toThrow(ValidationError);
      });

      it('should throw ValidationError for negative discount', () => {
        const data = { ...validLineData, discount: -10 };
        expect(() => validateSaleLineData(data)).toThrow(ValidationError);
      });

      it('should throw ValidationError for discount over 100', () => {
        const data = { ...validLineData, discount: 150 };
        expect(() => validateSaleLineData(data)).toThrow(ValidationError);
      });
    });

    describe('validateBuyerData', () => {
      const validBuyerData = {
        companyName: 'Test Company',
        address: '123 Test St',
        city: 'Test City',
        postalCode: '12345',
        country: 'IT',
      };

      it('should not throw for valid buyer data', () => {
        expect(() => validateBuyerData(validBuyerData)).not.toThrow();
      });

      it('should throw ValidationError for missing companyName', () => {
        const data = { ...validBuyerData, companyName: undefined };
        expect(() => validateBuyerData(data)).toThrow(ValidationError);
      });

      it('should throw ValidationError for invalid email', () => {
        const data = { ...validBuyerData, email: 'invalid-email' };
        expect(() => validateBuyerData(data)).toThrow(ValidationError);
      });

      it('should throw ValidationError for invalid VAT number', () => {
        const data = { ...validBuyerData, vatNumber: 'INVALID' };
        expect(() => validateBuyerData(data)).toThrow(ValidationError);
      });

      it('should throw ValidationError for invalid postal code', () => {
        const data = { ...validBuyerData, postalCode: 'ABC' };
        expect(() => validateBuyerData(data)).toThrow(ValidationError);
      });

      it('should not throw for valid email', () => {
        const data = { ...validBuyerData, email: 'test@example.com' };
        expect(() => validateBuyerData(data)).not.toThrow();
      });
    });

    describe('validateProducerData', () => {
      const validProducerData = {
        companyName: 'Producer Inc',
        address: '456 Producer Ave',
        city: 'Producer City',
        postalCode: '54321',
        country: 'IT',
      };

      it('should not throw for valid producer data', () => {
        expect(() => validateProducerData(validProducerData)).not.toThrow();
      });

      it('should throw ValidationError for missing companyName', () => {
        const data = { ...validProducerData, companyName: undefined };
        expect(() => validateProducerData(data)).toThrow(ValidationError);
      });

      it('should throw ValidationError for invalid email', () => {
        const data = { ...validProducerData, email: 'invalid-email' };
        expect(() => validateProducerData(data)).toThrow(ValidationError);
      });

      it('should not throw for valid VAT number', () => {
        const data = { ...validProducerData, vatNumber: 'IT12345678901' };
        expect(() => validateProducerData(data)).not.toThrow();
      });
    });
  });

  // ========================================
  // Pagination Validators
  // ========================================

  describe('Pagination Validators', () => {
    describe('validatePaginationParams', () => {
      it('should return default values for empty params', () => {
        const result = validatePaginationParams({});
        expect(result.page).toBe(1);
        expect(result.pageSize).toBe(20);
      });

      it('should parse string parameters', () => {
        const result = validatePaginationParams({ page: '2', pageSize: '50' });
        expect(result.page).toBe(2);
        expect(result.pageSize).toBe(50);
      });

      it('should accept number parameters', () => {
        const result = validatePaginationParams({ page: 3, pageSize: 100 });
        expect(result.page).toBe(3);
        expect(result.pageSize).toBe(100);
      });

      it('should include nextToken when provided', () => {
        const result = validatePaginationParams({ nextToken: 'token123' });
        expect(result.nextToken).toBe('token123');
      });

      it('should use defaults for zero values (falsy check)', () => {
        // Note: page: 0 and pageSize: 0 are falsy, so they're treated as not provided
        const result1 = validatePaginationParams({ page: 0 });
        expect(result1.page).toBe(1); // Uses default

        const result2 = validatePaginationParams({ pageSize: 0 });
        expect(result2.pageSize).toBe(20); // Uses default
      });

      it('should throw ValidationError for invalid page', () => {
        expect(() => validatePaginationParams({ page: -1 })).toThrow(ValidationError);
      });

      it('should throw ValidationError for invalid pageSize', () => {
        expect(() => validatePaginationParams({ pageSize: 101 })).toThrow(ValidationError);
      });
    });
  });
});
