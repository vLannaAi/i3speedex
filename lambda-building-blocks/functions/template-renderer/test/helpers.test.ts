/**
 * Tests for Handlebars helpers
 */

import {
  calcCost,
  calcVATAmount,
  calcLineTotal,
  hasCode,
  hasDiscount,
  colSpan,
  getBank,
} from '../src/helpers';
import { SaleLine, Bank } from '../src/types';

describe('helpers', () => {
  describe('calcCost', () => {
    it('should calculate cost without discount', () => {
      expect(calcCost(100, 10, 0)).toBe(1000);
    });

    it('should calculate cost with discount', () => {
      expect(calcCost(100, 10, 10)).toBe(900);
    });

    it('should handle missing discount', () => {
      expect(calcCost(100, 10)).toBe(1000);
    });
  });

  describe('calcVATAmount', () => {
    it('should calculate VAT amount', () => {
      expect(calcVATAmount(100, 10, 0, 22)).toBe(220);
    });

    it('should calculate VAT with discount', () => {
      expect(calcVATAmount(100, 10, 10, 22)).toBe(198);
    });
  });

  describe('calcLineTotal', () => {
    it('should calculate line total', () => {
      expect(calcLineTotal(100, 10, 0, 22)).toBe(1220);
    });

    it('should calculate total with discount', () => {
      expect(calcLineTotal(100, 10, 10, 22)).toBe(1098);
    });
  });

  describe('hasCode', () => {
    it('should return true if any line has code', () => {
      const lines: SaleLine[] = [
        { id: 1, sale_id: 1, pos: 1, description: 'Item 1', code: 'ABC', qty: 1, price: 100, vat: 22 },
        { id: 2, sale_id: 1, pos: 2, description: 'Item 2', qty: 1, price: 100, vat: 22 },
      ];
      expect(hasCode(lines)).toBe(true);
    });

    it('should return false if no line has code', () => {
      const lines: SaleLine[] = [
        { id: 1, sale_id: 1, pos: 1, description: 'Item 1', qty: 1, price: 100, vat: 22 },
      ];
      expect(hasCode(lines)).toBe(false);
    });
  });

  describe('hasDiscount', () => {
    it('should return true if any line has discount', () => {
      const lines: SaleLine[] = [
        { id: 1, sale_id: 1, pos: 1, description: 'Item 1', qty: 1, price: 100, discount: 10, vat: 22 },
      ];
      expect(hasDiscount(lines)).toBe(true);
    });

    it('should return false if no line has discount', () => {
      const lines: SaleLine[] = [
        { id: 1, sale_id: 1, pos: 1, description: 'Item 1', qty: 1, price: 100, vat: 22 },
      ];
      expect(hasDiscount(lines)).toBe(false);
    });

    it('should return false if discount is 0', () => {
      const lines: SaleLine[] = [
        { id: 1, sale_id: 1, pos: 1, description: 'Item 1', qty: 1, price: 100, discount: 0, vat: 22 },
      ];
      expect(hasDiscount(lines)).toBe(false);
    });
  });

  describe('colSpan', () => {
    it('should return base columns', () => {
      const lines: SaleLine[] = [
        { id: 1, sale_id: 1, pos: 1, description: 'Item 1', qty: 1, price: 100, vat: 22 },
      ];
      expect(colSpan(lines)).toBe(5);
    });

    it('should add 1 for code column', () => {
      const lines: SaleLine[] = [
        { id: 1, sale_id: 1, pos: 1, description: 'Item 1', code: 'ABC', qty: 1, price: 100, vat: 22 },
      ];
      expect(colSpan(lines)).toBe(6);
    });

    it('should add 1 for discount column', () => {
      const lines: SaleLine[] = [
        { id: 1, sale_id: 1, pos: 1, description: 'Item 1', qty: 1, price: 100, discount: 10, vat: 22 },
      ];
      expect(colSpan(lines)).toBe(6);
    });

    it('should add 2 for both code and discount', () => {
      const lines: SaleLine[] = [
        { id: 1, sale_id: 1, pos: 1, description: 'Item 1', code: 'ABC', qty: 1, price: 100, discount: 10, vat: 22 },
      ];
      expect(colSpan(lines)).toBe(7);
    });
  });

  describe('getBank', () => {
    const banks: Bank[] = [
      { id: 'unicredit', name: 'UniCredit', iban: 'IT1234567890', swift: 'UNCRITMM' },
      { id: 'intesa', name: 'Intesa SanPaolo', iban: 'IT0987654321' },
    ];

    it('should return bank by ID', () => {
      const bank = getBank(banks, 'unicredit');
      expect(bank).not.toBeNull();
      expect(bank?.name).toBe('UniCredit');
    });

    it('should return null if bank not found', () => {
      expect(getBank(banks, 'nonexistent')).toBeNull();
    });

    it('should return null if banks is undefined', () => {
      expect(getBank(undefined, 'unicredit')).toBeNull();
    });
  });
});
