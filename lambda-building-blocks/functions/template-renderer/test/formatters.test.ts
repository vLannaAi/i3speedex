/**
 * Tests for formatting functions
 */

import {
  formatValue,
  formatFlexValue,
  formatVAT,
  formatQty,
  formatDate,
  dateBefore,
} from '../src/formatters';

describe('formatters', () => {
  describe('formatValue', () => {
    it('should format Italian numbers correctly', () => {
      expect(formatValue(1234.56, 'it')).toBe('1.234,56');
      expect(formatValue(0, 'it')).toBe('0,00');
      expect(formatValue(1000000, 'it')).toBe('1.000.000,00');
    });

    it('should format German numbers correctly', () => {
      expect(formatValue(1234.56, 'de')).toBe('1.234,56');
    });

    it('should format English numbers correctly', () => {
      expect(formatValue(1234.56, 'en')).toBe('1,234.56');
    });

    it('should format French numbers correctly', () => {
      expect(formatValue(1234.56, 'fr')).toBe('1,234.56');
    });

    it('should handle string input', () => {
      expect(formatValue('1234.56', 'en')).toBe('1,234.56');
    });

    it('should handle invalid input', () => {
      expect(formatValue('invalid', 'en')).toBe('0,00');
    });
  });

  describe('formatFlexValue', () => {
    it('should format with flexible decimals', () => {
      expect(formatFlexValue(5750.123456, 'en')).toBe('5,750.123456');
      expect(formatFlexValue(100.50, 'en')).toBe('100.50');
      expect(formatFlexValue(100.5, 'en')).toBe('100.50');
    });

    it('should trim trailing zeros after 2 decimals', () => {
      expect(formatFlexValue(100.10, 'en')).toBe('100.10');
      expect(formatFlexValue(100.000001, 'en')).toBe('100.000001');
    });
  });

  describe('formatVAT', () => {
    it('should format VAT percentages', () => {
      expect(formatVAT(22, 'it')).toBe('22');
      expect(formatVAT(22.5, 'it')).toBe('22,5');
      expect(formatVAT(0, 'it')).toBe('0');
    });

    it('should trim trailing zeros', () => {
      expect(formatVAT(22.00, 'en')).toBe('22');
      expect(formatVAT(22.50, 'en')).toBe('22.5');
    });
  });

  describe('formatQty', () => {
    it('should format quantities as integers', () => {
      expect(formatQty(1000, 'it')).toBe('1.000');
      expect(formatQty(1000, 'en')).toBe('1,000');
      expect(formatQty(1, 'en')).toBe('1');
    });

    it('should handle decimals by flooring', () => {
      expect(formatQty(1000.99, 'en')).toBe('1,000');
    });
  });

  describe('formatDate', () => {
    it('should format Italian dates', () => {
      expect(formatDate('20240315', 'it')).toBe('15/03/2024');
    });

    it('should format English dates', () => {
      expect(formatDate('20240315', 'en')).toBe('03/15/2024');
    });

    it('should format German dates', () => {
      expect(formatDate('20240315', 'de')).toBe('15.03.2024');
    });

    it('should format French dates', () => {
      expect(formatDate('20240315', 'fr')).toBe('15/03/2024');
    });

    it('should handle number input', () => {
      expect(formatDate(20240315, 'it')).toBe('15/03/2024');
    });

    it('should handle undefined', () => {
      expect(formatDate(undefined, 'it')).toBe('');
    });

    it('should handle invalid dates', () => {
      expect(formatDate('invalid', 'it')).toBe('invalid');
    });
  });

  describe('dateBefore', () => {
    it('should compare dates correctly', () => {
      expect(dateBefore('20190101', '20200101')).toBe(true);
      expect(dateBefore('20200101', '20190101')).toBe(false);
      expect(dateBefore('20200101', '20200101')).toBe(false);
    });

    it('should handle number input', () => {
      expect(dateBefore(20190101, 20200101)).toBe(true);
    });
  });
});
