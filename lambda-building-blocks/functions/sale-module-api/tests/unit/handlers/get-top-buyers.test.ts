/**
 * Unit tests for get-top-buyers handler
 */

import { handler } from '../../../src/handlers/dashboard/get-top-buyers';
import { createAuthenticatedEvent, createEventWithQueryParams } from '../../fixtures/event.fixture';
import { mockSale } from '../../fixtures/sale.fixture';
import * as dynamodb from '../../../src/common/clients/dynamodb';

// Mock DynamoDB client - partial mock to preserve utility functions
jest.mock('../../../src/common/clients/dynamodb', () => ({
  ...jest.requireActual('../../../src/common/clients/dynamodb'),
  scanItems: jest.fn(),
}));

describe('Get Top Buyers Handler', () => {
  const mockScanItems = dynamodb.scanItems as jest.MockedFunction<typeof dynamodb.scanItems>;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should get top buyers sorted by revenue (default)', async () => {
    // Arrange
    const sales = [
      { ...mockSale, saleId: 'SALE001', buyerId: 'BUYER001', buyerName: 'Acme Corp', total: 3000, saleDate: '2026-01-15' },
      { ...mockSale, saleId: 'SALE002', buyerId: 'BUYER001', buyerName: 'Acme Corp', total: 2000, saleDate: '2026-01-20' },
      { ...mockSale, saleId: 'SALE003', buyerId: 'BUYER002', buyerName: 'Beta Inc', total: 4000, saleDate: '2026-01-18' },
      { ...mockSale, saleId: 'SALE004', buyerId: 'BUYER003', buyerName: 'Gamma Ltd', total: 1000, saleDate: '2026-01-10' },
    ];

    mockScanItems.mockResolvedValueOnce({ items: sales, count: 4 });

    const event = createAuthenticatedEvent('admin@i2speedex.com', ['Admin']);

    // Act
    const response = await handler(event);

    // Assert
    expect(response.statusCode).toBe(200);

    const body = JSON.parse(response.body!);
    expect(body.success).toBe(true);
    expect(body.data.buyers).toHaveLength(3);
    // Sorted by revenue: Acme (5000), Beta (4000), Gamma (1000)
    expect(body.data.buyers[0].buyerId).toBe('BUYER001');
    expect(body.data.buyers[0].totalRevenue).toBe(5000);
    expect(body.data.buyers[0].totalSales).toBe(2);
    expect(body.data.buyers[1].buyerId).toBe('BUYER002');
    expect(body.data.buyers[1].totalRevenue).toBe(4000);
    expect(body.data.buyers[2].buyerId).toBe('BUYER003');
  });

  it('should get top buyers sorted by sales count', async () => {
    // Arrange
    const sales = [
      { ...mockSale, saleId: 'SALE001', buyerId: 'BUYER001', buyerName: 'Acme Corp', total: 1000, saleDate: '2026-01-15' },
      { ...mockSale, saleId: 'SALE002', buyerId: 'BUYER001', buyerName: 'Acme Corp', total: 1000, saleDate: '2026-01-16' },
      { ...mockSale, saleId: 'SALE003', buyerId: 'BUYER001', buyerName: 'Acme Corp', total: 1000, saleDate: '2026-01-17' },
      { ...mockSale, saleId: 'SALE004', buyerId: 'BUYER002', buyerName: 'Beta Inc', total: 5000, saleDate: '2026-01-18' },
      { ...mockSale, saleId: 'SALE005', buyerId: 'BUYER002', buyerName: 'Beta Inc', total: 5000, saleDate: '2026-01-19' },
    ];

    mockScanItems.mockResolvedValueOnce({ items: sales, count: 5 });

    const event = createEventWithQueryParams(
      { sortBy: 'sales' },
      createAuthenticatedEvent('admin@i2speedex.com', ['Admin'])
    );

    // Act
    const response = await handler(event);

    // Assert
    expect(response.statusCode).toBe(200);

    const body = JSON.parse(response.body!);
    // Sorted by sales count: Acme (3 sales), Beta (2 sales)
    expect(body.data.buyers[0].buyerId).toBe('BUYER001');
    expect(body.data.buyers[0].totalSales).toBe(3);
    expect(body.data.buyers[1].buyerId).toBe('BUYER002');
    expect(body.data.buyers[1].totalSales).toBe(2);
  });

  it('should calculate average sale value correctly', async () => {
    // Arrange
    const sales = [
      { ...mockSale, saleId: 'SALE001', buyerId: 'BUYER001', buyerName: 'Acme Corp', total: 3000, saleDate: '2026-01-15' },
      { ...mockSale, saleId: 'SALE002', buyerId: 'BUYER001', buyerName: 'Acme Corp', total: 6000, saleDate: '2026-01-20' },
    ];

    mockScanItems.mockResolvedValueOnce({ items: sales, count: 2 });

    const event = createAuthenticatedEvent('admin@i2speedex.com', ['Admin']);

    // Act
    const response = await handler(event);

    // Assert
    expect(response.statusCode).toBe(200);

    const body = JSON.parse(response.body!);
    expect(body.data.buyers[0].averageSaleValue).toBe(4500); // (3000 + 6000) / 2
  });

  it('should track last sale date correctly', async () => {
    // Arrange
    const sales = [
      { ...mockSale, saleId: 'SALE001', buyerId: 'BUYER001', buyerName: 'Acme Corp', total: 1000, saleDate: '2026-01-15' },
      { ...mockSale, saleId: 'SALE002', buyerId: 'BUYER001', buyerName: 'Acme Corp', total: 1000, saleDate: '2026-01-20' },
      { ...mockSale, saleId: 'SALE003', buyerId: 'BUYER001', buyerName: 'Acme Corp', total: 1000, saleDate: '2026-01-10' },
    ];

    mockScanItems.mockResolvedValueOnce({ items: sales, count: 3 });

    const event = createAuthenticatedEvent('admin@i2speedex.com', ['Admin']);

    // Act
    const response = await handler(event);

    // Assert
    expect(response.statusCode).toBe(200);

    const body = JSON.parse(response.body!);
    expect(body.data.buyers[0].lastSaleDate).toBe('2026-01-20'); // Most recent
  });

  it('should limit results to specified count', async () => {
    // Arrange
    const sales = Array.from({ length: 15 }, (_, i) => ({
      ...mockSale,
      saleId: `SALE${i.toString().padStart(3, '0')}`,
      buyerId: `BUYER${i.toString().padStart(3, '0')}`,
      buyerName: `Buyer ${i}`,
      total: 1000,
      saleDate: '2026-01-15',
    }));

    mockScanItems.mockResolvedValueOnce({ items: sales, count: 15 });

    const event = createEventWithQueryParams(
      { limit: '5' },
      createAuthenticatedEvent('admin@i2speedex.com', ['Admin'])
    );

    // Act
    const response = await handler(event);

    // Assert
    expect(response.statusCode).toBe(200);

    const body = JSON.parse(response.body!);
    expect(body.data.buyers).toHaveLength(5);
    expect(body.data.summary.totalBuyers).toBe(15);
    expect(body.data.summary.topBuyersCount).toBe(5);
  });

  it('should filter by date range', async () => {
    // Arrange
    const sales = [
      { ...mockSale, saleId: 'SALE001', buyerId: 'BUYER001', buyerName: 'Acme Corp', total: 1000, saleDate: '2026-01-10' },
      { ...mockSale, saleId: 'SALE002', buyerId: 'BUYER001', buyerName: 'Acme Corp', total: 2000, saleDate: '2026-01-15' }, // In range
      { ...mockSale, saleId: 'SALE003', buyerId: 'BUYER001', buyerName: 'Acme Corp', total: 3000, saleDate: '2026-01-25' },
    ];

    mockScanItems.mockResolvedValueOnce({ items: sales, count: 3 });

    const event = createEventWithQueryParams(
      { startDate: '2026-01-15', endDate: '2026-01-20' },
      createAuthenticatedEvent('admin@i2speedex.com', ['Admin'])
    );

    // Act
    const response = await handler(event);

    // Assert
    expect(response.statusCode).toBe(200);

    const body = JSON.parse(response.body!);
    expect(body.data.buyers[0].totalRevenue).toBe(2000); // Only sale in range
    expect(body.data.buyers[0].totalSales).toBe(1);
  });

  it('should filter by user access (operators see only their sales)', async () => {
    // Arrange
    const sales = [
      { ...mockSale, saleId: 'SALE001', buyerId: 'BUYER001', buyerName: 'Acme Corp', total: 1000, createdBy: 'operator1@i2speedex.com', saleDate: '2026-01-15' },
      { ...mockSale, saleId: 'SALE002', buyerId: 'BUYER002', buyerName: 'Beta Inc', total: 2000, createdBy: 'operator2@i2speedex.com', saleDate: '2026-01-15' },
    ];

    mockScanItems.mockResolvedValueOnce({ items: sales, count: 2 });

    const event = createAuthenticatedEvent('operator1@i2speedex.com', ['operator']);

    // Act
    const response = await handler(event);

    // Assert
    expect(response.statusCode).toBe(200);

    const body = JSON.parse(response.body!);
    expect(body.data.buyers).toHaveLength(1);
    expect(body.data.buyers[0].buyerId).toBe('BUYER001');
  });

  it('should calculate revenue percentage correctly', async () => {
    // Arrange
    const sales = [
      { ...mockSale, saleId: 'SALE001', buyerId: 'BUYER001', buyerName: 'Top Buyer', total: 6000, saleDate: '2026-01-15' },
      { ...mockSale, saleId: 'SALE002', buyerId: 'BUYER002', buyerName: 'Second Buyer', total: 3000, saleDate: '2026-01-15' },
      { ...mockSale, saleId: 'SALE003', buyerId: 'BUYER003', buyerName: 'Third Buyer', total: 1000, saleDate: '2026-01-15' },
    ];

    mockScanItems.mockResolvedValueOnce({ items: sales, count: 3 });

    const event = createEventWithQueryParams(
      { limit: '2' },
      createAuthenticatedEvent('admin@i2speedex.com', ['Admin'])
    );

    // Act
    const response = await handler(event);

    // Assert
    expect(response.statusCode).toBe(200);

    const body = JSON.parse(response.body!);
    expect(body.data.summary.totalRevenue).toBe(10000);
    expect(body.data.summary.topBuyersRevenue).toBe(9000); // Top 2 buyers
    expect(body.data.summary.revenuePercentage).toBe(90); // 9000/10000 * 100
  });

  it('should handle empty results', async () => {
    // Arrange
    mockScanItems.mockResolvedValueOnce({ items: [], count: 0 });

    const event = createAuthenticatedEvent('admin@i2speedex.com', ['Admin']);

    // Act
    const response = await handler(event);

    // Assert
    expect(response.statusCode).toBe(200);

    const body = JSON.parse(response.body!);
    expect(body.data.buyers).toEqual([]);
    expect(body.data.summary.totalBuyers).toBe(0);
  });

  it('should return 422 when sortBy is invalid', async () => {
    // Arrange
    const event = createEventWithQueryParams(
      { sortBy: 'invalid' },
      createAuthenticatedEvent('admin@i2speedex.com', ['Admin'])
    );

    // Act
    const response = await handler(event);

    // Assert
    expect(response.statusCode).toBe(422);

    const body = JSON.parse(response.body!);
    expect(body.error).toBe('Validation Error');
    expect(body.message).toContain('sortBy must be one of: revenue, sales');
  });

  it('should return 422 when limit is less than 1', async () => {
    // Arrange
    const event = createEventWithQueryParams(
      { limit: '0' },
      createAuthenticatedEvent('admin@i2speedex.com', ['Admin'])
    );

    // Act
    const response = await handler(event);

    // Assert
    expect(response.statusCode).toBe(422);

    const body = JSON.parse(response.body!);
    expect(body.message).toContain('limit must be between 1 and 100');
  });

  it('should return 422 when limit exceeds 100', async () => {
    // Arrange
    const event = createEventWithQueryParams(
      { limit: '101' },
      createAuthenticatedEvent('admin@i2speedex.com', ['Admin'])
    );

    // Act
    const response = await handler(event);

    // Assert
    expect(response.statusCode).toBe(422);

    const body = JSON.parse(response.body!);
    expect(body.message).toContain('limit must be between 1 and 100');
  });

  it('should handle DynamoDB error', async () => {
    // Arrange
    mockScanItems.mockRejectedValueOnce(new Error('DynamoDB error'));

    const event = createAuthenticatedEvent('admin@i2speedex.com', ['Admin']);

    // Act
    const response = await handler(event);

    // Assert
    expect(response.statusCode).toBe(500);

    const body = JSON.parse(response.body!);
    expect(body.error).toBe('Internal Server Error');
  });
});
