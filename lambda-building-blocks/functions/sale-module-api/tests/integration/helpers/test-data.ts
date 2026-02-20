/**
 * Test Data Factory for Integration Tests
 *
 * Provides factory functions to generate realistic test data
 */

import { CreateSaleRequest, CreateBuyerRequest, CreateProducerRequest, CreateSaleLineRequest } from '../../../src/common/types';

let saleCounter = 0;
let buyerCounter = 0;
let producerCounter = 0;

/**
 * Generate unique buyer data for testing
 */
export function createTestBuyer(overrides?: Partial<CreateBuyerRequest>): CreateBuyerRequest {
  buyerCounter++;

  return {
    companyName: `Test Buyer ${buyerCounter}`,
    vatNumber: `IT${1234567890 + buyerCounter}`,
    fiscalCode: `TSTBYR${String(buyerCounter).padStart(2, '0')}A01H501U`,
    sdiCode: 'ABCDEFG',
    address: `Via Test ${buyerCounter}`,
    city: 'Rome',
    province: 'RM',
    postalCode: '00100',
    country: 'IT',
    email: `buyer${buyerCounter}@test.com`,
    phone: `+39 06 ${1000000 + buyerCounter}`,
    status: 'active',
    ...overrides,
  };
}

/**
 * Generate unique producer data for testing
 */
export function createTestProducer(overrides?: Partial<CreateProducerRequest>): CreateProducerRequest {
  producerCounter++;

  return {
    companyName: `Test Producer ${producerCounter}`,
    vatNumber: `IT${9876543210 + producerCounter}`,
    fiscalCode: `TSTPRD${String(producerCounter).padStart(2, '0')}A01H501U`,
    sdiCode: 'HIJKLMN',
    address: `Viale Factory ${producerCounter}`,
    city: 'Milan',
    province: 'MI',
    postalCode: '20100',
    country: 'IT',
    email: `producer${producerCounter}@test.com`,
    phone: `+39 02 ${2000000 + producerCounter}`,
    status: 'active',
    ...overrides,
  };
}

/**
 * Generate unique sale data for testing
 */
export function createTestSale(
  buyerId: string,
  producerId: string,
  overrides?: Partial<CreateSaleRequest>
): CreateSaleRequest {
  saleCounter++;

  const today = new Date();
  const saleDate = today.toISOString().split('T')[0];

  return {
    buyerId,
    producerId,
    saleDate,
    paymentTerms: 'Net 30',
    referenceNumber: `REF-${saleCounter}`,
    notes: `Test sale ${saleCounter}`,
    currency: 'EUR',
    ...overrides,
  };
}

/**
 * Generate sale line data for testing
 */
export function createTestSaleLine(overrides?: Partial<CreateSaleLineRequest>): CreateSaleLineRequest {
  return {
    productCode: 'PROD-001',
    productDescription: 'Test Product',
    quantity: 10,
    unitPrice: 100.00,
    discountPercent: 0,
    vatRate: 22,
    ...overrides,
  };
}

/**
 * Reset all counters (useful for test isolation)
 */
export function resetCounters(): void {
  saleCounter = 0;
  buyerCounter = 0;
  producerCounter = 0;
}

/**
 * Generate a batch of test buyers
 */
export function createTestBuyers(count: number): CreateBuyerRequest[] {
  return Array.from({ length: count }, (_, i) =>
    createTestBuyer({ companyName: `Batch Buyer ${i + 1}` })
  );
}

/**
 * Generate a batch of test producers
 */
export function createTestProducers(count: number): CreateProducerRequest[] {
  return Array.from({ length: count }, (_, i) =>
    createTestProducer({ companyName: `Batch Producer ${i + 1}` })
  );
}

/**
 * Generate a batch of test sale lines
 */
export function createTestSaleLines(count: number): CreateSaleLineRequest[] {
  return Array.from({ length: count }, (_, i) =>
    createTestSaleLine({
      productCode: `PROD-${String(i + 1).padStart(3, '0')}`,
      productDescription: `Test Product ${i + 1}`,
      quantity: (i + 1) * 5,
      unitPrice: (i + 1) * 50,
    })
  );
}
