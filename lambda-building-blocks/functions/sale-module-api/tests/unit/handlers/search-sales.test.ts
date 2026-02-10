/**
 * Unit tests for search-sales handler
 */

import { handler } from '../../../src/handlers/search/search-sales';
import { createAuthenticatedEvent, createEventWithQueryParams } from '../../fixtures/event.fixture';
import { mockSale } from '../../fixtures/sale.fixture';
import * as dynamodb from '../../../src/common/clients/dynamodb';

// Mock DynamoDB client - partial mock to preserve utility functions
jest.mock('../../../src/common/clients/dynamodb', () => ({
  ...jest.requireActual('../../../src/common/clients/dynamodb'),
  scanItems: jest.fn(),
}));

describe('Search Sales Handler', () => {
  const mockScanItems = dynamodb.scanItems as jest.MockedFunction<typeof dynamodb.scanItems>;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should search sales by keyword successfully', async () => {
    // Arrange
    const salesWithDifferentNames = [
      { ...mockSale, saleId: 'SALE001', buyerName: 'Acme Corp' },
      { ...mockSale, saleId: 'SALE002', buyerName: 'Beta Industries' },
      { ...mockSale, saleId: 'SALE003', buyerName: 'Acme Solutions' },
    ];

    mockScanItems.mockResolvedValueOnce({
      items: salesWithDifferentNames,
      lastEvaluatedKey: undefined,
      count: 3,
    });

    const event = createEventWithQueryParams(
      { q: 'Acme' },
      createAuthenticatedEvent('admin@i2speedex.com')
    );

    // Act
    const response = await handler(event);

    // Assert
    expect(response.statusCode).toBe(200);

    const body = JSON.parse(response.body!);
    expect(body.success).toBe(true);
    expect(body.data.sales).toHaveLength(2);
    expect(body.data.totalMatches).toBe(2);
    expect(body.data.keyword).toBe('Acme');

    // Verify case-insensitive search
    expect(body.data.sales.every((s: any) =>
      s.buyerName.toLowerCase().includes('acme')
    )).toBe(true);
  });

  it('should search in multiple fields', async () => {
    // Arrange
    const salesWithDifferentData = [
      { ...mockSale, saleId: 'SALE001', invoiceNumber: 'INV-2024-001' },
      { ...mockSale, saleId: 'SALE002', producerName: 'Test Factory' },
      { ...mockSale, saleId: 'SALE003', referenceNumber: 'REF-2024' },
      { ...mockSale, saleId: 'SALE004', notes: 'Important note about 2024' },
      { ...mockSale, saleId: 'SALE005', buyerName: 'Unrelated Company' },
    ];

    mockScanItems.mockResolvedValueOnce({
      items: salesWithDifferentData,
      lastEvaluatedKey: undefined,
      count: 5,
    });

    const event = createEventWithQueryParams(
      { q: '2024' },
      createAuthenticatedEvent('admin@i2speedex.com')
    );

    // Act
    const response = await handler(event);

    // Assert
    expect(response.statusCode).toBe(200);

    const body = JSON.parse(response.body!);
    expect(body.data.sales).toHaveLength(3);
    expect(body.data.totalMatches).toBe(3);
  });

  it('should sort results by sale date (newest first)', async () => {
    // Arrange
    const salesWithDifferentDates = [
      { ...mockSale, saleId: 'SALE001', saleDate: '2024-01-15', buyerName: 'Acme Corp' },
      { ...mockSale, saleId: 'SALE002', saleDate: '2024-03-20', buyerName: 'Acme Solutions' },
      { ...mockSale, saleId: 'SALE003', saleDate: '2024-02-10', buyerName: 'Acme Industries' },
    ];

    mockScanItems.mockResolvedValueOnce({
      items: salesWithDifferentDates,
      lastEvaluatedKey: undefined,
      count: 3,
    });

    const event = createEventWithQueryParams(
      { q: 'Acme' },
      createAuthenticatedEvent('admin@i2speedex.com')
    );

    // Act
    const response = await handler(event);

    // Assert
    expect(response.statusCode).toBe(200);

    const body = JSON.parse(response.body!);
    expect(body.data.sales[0].saleDate).toBe('2024-03-20');
    expect(body.data.sales[1].saleDate).toBe('2024-02-10');
    expect(body.data.sales[2].saleDate).toBe('2024-01-15');
  });

  it('should filter by user access (operators see only their sales)', async () => {
    // Arrange
    const mixedSales = [
      { ...mockSale, saleId: 'SALE001', buyerName: 'Test Corp', createdBy: 'operator1@i2speedex.com' },
      { ...mockSale, saleId: 'SALE002', buyerName: 'Test Industries', createdBy: 'operator2@i2speedex.com' },
      { ...mockSale, saleId: 'SALE003', buyerName: 'Test Solutions', createdBy: 'operator1@i2speedex.com' },
    ];

    mockScanItems.mockResolvedValueOnce({
      items: mixedSales,
      lastEvaluatedKey: undefined,
      count: 3,
    });

    const event = createEventWithQueryParams(
      { q: 'Test' },
      createAuthenticatedEvent('operator1@i2speedex.com', ['operator'])
    );

    // Act
    const response = await handler(event);

    // Assert
    expect(response.statusCode).toBe(200);

    const body = JSON.parse(response.body!);
    expect(body.data.sales).toHaveLength(2);
    expect(body.data.sales.every((s: any) =>
      s.createdBy === 'operator1@i2speedex.com'
    )).toBe(true);
  });

  it('should allow admin to see all sales', async () => {
    // Arrange
    const mixedSales = [
      { ...mockSale, saleId: 'SALE001', buyerName: 'Test Corp', producerName: 'Factory A', createdBy: 'operator1@i2speedex.com' },
      { ...mockSale, saleId: 'SALE002', buyerName: 'Test Industries', producerName: 'Factory B', createdBy: 'operator2@i2speedex.com' },
      { ...mockSale, saleId: 'SALE003', buyerName: 'Test Solutions', producerName: 'Factory C', createdBy: 'admin@i2speedex.com' },
    ];

    mockScanItems.mockResolvedValueOnce({
      items: mixedSales,
      lastEvaluatedKey: undefined,
      count: 3,
    });

    const event = createEventWithQueryParams(
      { q: 'Test' },
      createAuthenticatedEvent('admin@i2speedex.com', ['Admin'])
    );

    // Act
    const response = await handler(event);

    // Assert
    expect(response.statusCode).toBe(200);

    const body = JSON.parse(response.body!);
    expect(body.data.sales).toHaveLength(3);
  });

  it('should paginate results', async () => {
    // Arrange
    const manySales = Array.from({ length: 25 }, (_, i) => ({
      ...mockSale,
      saleId: `SALE${i.toString().padStart(3, '0')}`,
      buyerName: 'Test Corp',
    }));

    mockScanItems.mockResolvedValueOnce({
      items: manySales,
      lastEvaluatedKey: undefined,
      count: 25,
    });

    const event = createEventWithQueryParams(
      { q: 'Test', pageSize: '10' },
      createAuthenticatedEvent('admin@i2speedex.com')
    );

    // Act
    const response = await handler(event);

    // Assert
    expect(response.statusCode).toBe(200);

    const body = JSON.parse(response.body!);
    expect(body.data.sales).toHaveLength(10);
    expect(body.data.totalMatches).toBe(25);
    expect(body.data.hasMore).toBe(true);
  });

  it('should return empty array when no matches', async () => {
    // Arrange
    mockScanItems.mockResolvedValueOnce({
      items: [mockSale],
      lastEvaluatedKey: undefined,
      count: 1,
    });

    const event = createEventWithQueryParams(
      { q: 'NonExistentKeyword' },
      createAuthenticatedEvent('admin@i2speedex.com')
    );

    // Act
    const response = await handler(event);

    // Assert
    expect(response.statusCode).toBe(200);

    const body = JSON.parse(response.body!);
    expect(body.data.sales).toEqual([]);
    expect(body.data.totalMatches).toBe(0);
    expect(body.data.message).toContain('Found 0 sale(s)');
  });

  it('should return 422 when keyword is missing', async () => {
    // Arrange
    const event = createEventWithQueryParams(
      {},
      createAuthenticatedEvent('admin@i2speedex.com')
    );

    // Act
    const response = await handler(event);

    // Assert
    expect(response.statusCode).toBe(422);

    const body = JSON.parse(response.body!);
    expect(body.error).toBe('Validation Error');
    expect(body.message).toContain('at least 2 characters');
  });

  it('should return 422 when keyword is too short', async () => {
    // Arrange
    const event = createEventWithQueryParams(
      { q: 'a' },
      createAuthenticatedEvent('admin@i2speedex.com')
    );

    // Act
    const response = await handler(event);

    // Assert
    expect(response.statusCode).toBe(422);

    const body = JSON.parse(response.body!);
    expect(body.message).toContain('at least 2 characters');
  });

  it('should handle DynamoDB scan error', async () => {
    // Arrange
    mockScanItems.mockRejectedValueOnce(new Error('DynamoDB error'));

    const event = createEventWithQueryParams(
      { q: 'Test' },
      createAuthenticatedEvent('admin@i2speedex.com')
    );

    // Act
    const response = await handler(event);

    // Assert
    expect(response.statusCode).toBe(500);

    const body = JSON.parse(response.body!);
    expect(body.error).toBe('Internal Server Error');
  });
});
