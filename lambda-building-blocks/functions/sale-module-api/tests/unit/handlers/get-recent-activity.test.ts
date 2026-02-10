/**
 * Unit tests for get-recent-activity handler
 */

import { handler } from '../../../src/handlers/dashboard/get-recent-activity';
import { createAuthenticatedEvent, createEventWithQueryParams } from '../../fixtures/event.fixture';
import { mockSale, mockBuyer, mockProducer } from '../../fixtures/sale.fixture';
import * as dynamodb from '../../../src/common/clients/dynamodb';

// Mock DynamoDB client - partial mock to preserve utility functions
jest.mock('../../../src/common/clients/dynamodb', () => ({
  ...jest.requireActual('../../../src/common/clients/dynamodb'),
  scanItems: jest.fn(),
}));

describe('Get Recent Activity Handler', () => {
  const mockScanItems = dynamodb.scanItems as jest.MockedFunction<typeof dynamodb.scanItems>;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should get recent activities for all types (default)', async () => {
    // Arrange
    const sales = [
      {
        ...mockSale,
        saleId: 'SALE001',
        status: 'confirmed' as const,
        createdAt: '2026-01-20T10:00:00.000Z',
        updatedAt: '2026-01-20T12:00:00.000Z',
      },
    ];

    const buyers = [
      { ...mockBuyer, buyerId: 'BUYER001', companyName: 'Acme Corp', createdAt: '2026-01-21T10:00:00.000Z', updatedAt: '2026-01-21T10:00:00.000Z' },
    ];

    const producers = [
      { ...mockProducer, producerId: 'PROD001', companyName: 'Factory Inc', createdAt: '2026-01-19T10:00:00.000Z', updatedAt: '2026-01-19T10:00:00.000Z' },
    ];

    mockScanItems
      .mockResolvedValueOnce({ items: sales, count: 1 })
      .mockResolvedValueOnce({ items: buyers, count: 1 })
      .mockResolvedValueOnce({ items: producers, count: 1 });

    const event = createAuthenticatedEvent('admin@i2speedex.com', ['Admin']);

    // Act
    const response = await handler(event);

    // Assert
    expect(response.statusCode).toBe(200);

    const body = JSON.parse(response.body!);
    expect(body.success).toBe(true);
    expect(body.data.activities.length).toBeGreaterThan(0);
    expect(body.data.totalActivities).toBeGreaterThan(0);
  });

  it('should filter by type (sale only)', async () => {
    // Arrange
    const sales = [
      { ...mockSale, saleId: 'SALE001', createdAt: '2026-01-20T10:00:00.000Z', updatedAt: '2026-01-20T10:00:00.000Z' },
    ];

    mockScanItems.mockResolvedValueOnce({ items: sales, count: 1 });

    const event = createEventWithQueryParams(
      { type: 'sale' },
      createAuthenticatedEvent('admin@i2speedex.com', ['Admin'])
    );

    // Act
    const response = await handler(event);

    // Assert
    expect(response.statusCode).toBe(200);

    const body = JSON.parse(response.body!);
    expect(body.data.activities.every((a: any) => a.type === 'sale')).toBe(true);
    expect(mockScanItems).toHaveBeenCalledTimes(1); // Only sales table scanned
  });

  it('should filter by type (buyer only)', async () => {
    // Arrange
    const buyers = [
      { ...mockBuyer, buyerId: 'BUYER001', companyName: 'Acme Corp', createdAt: '2026-01-20T10:00:00.000Z', updatedAt: '2026-01-20T10:00:00.000Z' },
    ];

    mockScanItems.mockResolvedValueOnce({ items: buyers, count: 1 });

    const event = createEventWithQueryParams(
      { type: 'buyer' },
      createAuthenticatedEvent('admin@i2speedex.com', ['Admin'])
    );

    // Act
    const response = await handler(event);

    // Assert
    expect(response.statusCode).toBe(200);

    const body = JSON.parse(response.body!);
    expect(body.data.activities.every((a: any) => a.type === 'buyer')).toBe(true);
  });

  it('should filter by type (producer only)', async () => {
    // Arrange
    const producers = [
      { ...mockProducer, producerId: 'PROD001', companyName: 'Factory Inc', createdAt: '2026-01-20T10:00:00.000Z', updatedAt: '2026-01-20T10:00:00.000Z' },
    ];

    mockScanItems.mockResolvedValueOnce({ items: producers, count: 1 });

    const event = createEventWithQueryParams(
      { type: 'producer' },
      createAuthenticatedEvent('admin@i2speedex.com', ['Admin'])
    );

    // Act
    const response = await handler(event);

    // Assert
    expect(response.statusCode).toBe(200);

    const body = JSON.parse(response.body!);
    expect(body.data.activities.every((a: any) => a.type === 'producer')).toBe(true);
  });

  it('should include sale created activity', async () => {
    // Arrange
    const sales = [
      {
        ...mockSale,
        saleId: 'SALE001',
        buyerName: 'Acme Corp',
        total: 1000,
        currency: 'EUR',
        status: 'draft' as const,
        createdAt: '2026-01-20T10:00:00.000Z',
        updatedAt: '2026-01-20T10:00:00.000Z',
        createdBy: 'admin@i2speedex.com',
      },
    ];

    mockScanItems.mockResolvedValueOnce({ items: sales, count: 1 });

    const event = createEventWithQueryParams(
      { type: 'sale' },
      createAuthenticatedEvent('admin@i2speedex.com', ['Admin'])
    );

    // Act
    const response = await handler(event);

    // Assert
    expect(response.statusCode).toBe(200);

    const body = JSON.parse(response.body!);
    const createdActivity = body.data.activities.find((a: any) => a.action === 'created');
    expect(createdActivity).toBeDefined();
    expect(createdActivity.title).toContain('SALE001');
    expect(createdActivity.description).toContain('Acme Corp');
    expect(createdActivity.description).toContain('1000.00 EUR');
  });

  it('should include sale confirmed activity when updated', async () => {
    // Arrange
    const sales = [
      {
        ...mockSale,
        saleId: 'SALE001',
        buyerName: 'Acme Corp',
        status: 'confirmed' as const,
        createdAt: '2026-01-20T10:00:00.000Z',
        updatedAt: '2026-01-20T12:00:00.000Z', // Different from createdAt
        createdBy: 'admin@i2speedex.com',
        updatedBy: 'admin@i2speedex.com',
      },
    ];

    mockScanItems.mockResolvedValueOnce({ items: sales, count: 1 });

    const event = createEventWithQueryParams(
      { type: 'sale' },
      createAuthenticatedEvent('admin@i2speedex.com', ['Admin'])
    );

    // Act
    const response = await handler(event);

    // Assert
    expect(response.statusCode).toBe(200);

    const body = JSON.parse(response.body!);
    const confirmedActivity = body.data.activities.find((a: any) => a.action === 'confirmed');
    expect(confirmedActivity).toBeDefined();
    expect(confirmedActivity.title).toContain('confirmed');
  });

  it('should include sale invoiced activity', async () => {
    // Arrange
    const sales = [
      {
        ...mockSale,
        saleId: 'SALE001',
        invoiceGenerated: true,
        invoiceGeneratedAt: '2026-01-20T14:00:00.000Z',
        invoiceNumber: 'INV-2026-001',
        createdAt: '2026-01-20T10:00:00.000Z',
        updatedAt: '2026-01-20T14:00:00.000Z',
        updatedBy: 'admin@i2speedex.com',
      },
    ];

    mockScanItems.mockResolvedValueOnce({ items: sales, count: 1 });

    const event = createEventWithQueryParams(
      { type: 'sale' },
      createAuthenticatedEvent('admin@i2speedex.com', ['Admin'])
    );

    // Act
    const response = await handler(event);

    // Assert
    expect(response.statusCode).toBe(200);

    const body = JSON.parse(response.body!);
    const invoicedActivity = body.data.activities.find((a: any) => a.action === 'invoiced');
    expect(invoicedActivity).toBeDefined();
    expect(invoicedActivity.title).toContain('INV-2026-001');
  });

  it('should include buyer created and updated activities', async () => {
    // Arrange
    const buyers = [
      {
        ...mockBuyer,
        buyerId: 'BUYER001',
        companyName: 'Acme Corp',
        city: 'Rome',
        country: 'IT',
        createdAt: '2026-01-20T10:00:00.000Z',
        updatedAt: '2026-01-21T15:00:00.000Z', // Updated after creation
        createdBy: 'admin@i2speedex.com',
        updatedBy: 'admin@i2speedex.com',
      },
    ];

    mockScanItems.mockResolvedValueOnce({ items: buyers, count: 1 });

    const event = createEventWithQueryParams(
      { type: 'buyer' },
      createAuthenticatedEvent('admin@i2speedex.com', ['Admin'])
    );

    // Act
    const response = await handler(event);

    // Assert
    expect(response.statusCode).toBe(200);

    const body = JSON.parse(response.body!);
    expect(body.data.activities).toHaveLength(2); // Created + updated
    expect(body.data.activities.some((a: any) => a.action === 'created')).toBe(true);
    expect(body.data.activities.some((a: any) => a.action === 'updated')).toBe(true);
  });

  it('should include producer created and updated activities', async () => {
    // Arrange
    const producers = [
      {
        ...mockProducer,
        producerId: 'PROD001',
        companyName: 'Factory Inc',
        city: 'Milan',
        country: 'IT',
        createdAt: '2026-01-20T10:00:00.000Z',
        updatedAt: '2026-01-21T16:00:00.000Z', // Updated after creation
        createdBy: 'admin@i2speedex.com',
        updatedBy: 'admin@i2speedex.com',
      },
    ];

    mockScanItems.mockResolvedValueOnce({ items: producers, count: 1 });

    const event = createEventWithQueryParams(
      { type: 'producer' },
      createAuthenticatedEvent('admin@i2speedex.com', ['Admin'])
    );

    // Act
    const response = await handler(event);

    // Assert
    expect(response.statusCode).toBe(200);

    const body = JSON.parse(response.body!);
    expect(body.data.activities).toHaveLength(2); // Created + updated
  });

  it('should sort activities by timestamp (newest first)', async () => {
    // Arrange
    const sales = [
      { ...mockSale, saleId: 'SALE001', createdAt: '2026-01-15T10:00:00.000Z', updatedAt: '2026-01-15T10:00:00.000Z' },
      { ...mockSale, saleId: 'SALE002', createdAt: '2026-01-20T10:00:00.000Z', updatedAt: '2026-01-20T10:00:00.000Z' },
      { ...mockSale, saleId: 'SALE003', createdAt: '2026-01-18T10:00:00.000Z', updatedAt: '2026-01-18T10:00:00.000Z' },
    ];

    mockScanItems.mockResolvedValueOnce({ items: sales, count: 3 });

    const event = createEventWithQueryParams(
      { type: 'sale' },
      createAuthenticatedEvent('admin@i2speedex.com', ['Admin'])
    );

    // Act
    const response = await handler(event);

    // Assert
    expect(response.statusCode).toBe(200);

    const body = JSON.parse(response.body!);
    expect(body.data.activities[0].id).toBe('SALE002'); // Most recent
    expect(body.data.activities[1].id).toBe('SALE003');
    expect(body.data.activities[2].id).toBe('SALE001'); // Oldest
  });

  it('should limit results to specified count', async () => {
    // Arrange
    const sales = Array.from({ length: 30 }, (_, i) => ({
      ...mockSale,
      saleId: `SALE${i.toString().padStart(3, '0')}`,
      createdAt: `2026-01-${String(i + 1).padStart(2, '0')}T10:00:00.000Z`,
      updatedAt: `2026-01-${String(i + 1).padStart(2, '0')}T10:00:00.000Z`,
    }));

    mockScanItems.mockResolvedValueOnce({ items: sales, count: 30 });

    const event = createEventWithQueryParams(
      { type: 'sale', limit: '10' },
      createAuthenticatedEvent('admin@i2speedex.com', ['Admin'])
    );

    // Act
    const response = await handler(event);

    // Assert
    expect(response.statusCode).toBe(200);

    const body = JSON.parse(response.body!);
    expect(body.data.activities).toHaveLength(10);
    expect(body.data.count).toBe(10);
    expect(body.data.totalActivities).toBe(30);
  });

  it('should filter by user access (operators see only their sales)', async () => {
    // Arrange
    const sales = [
      { ...mockSale, saleId: 'SALE001', createdBy: 'operator1@i2speedex.com', createdAt: '2026-01-20T10:00:00.000Z', updatedAt: '2026-01-20T10:00:00.000Z' },
      { ...mockSale, saleId: 'SALE002', createdBy: 'operator2@i2speedex.com', createdAt: '2026-01-20T11:00:00.000Z', updatedAt: '2026-01-20T11:00:00.000Z' },
    ];

    mockScanItems.mockResolvedValueOnce({ items: sales, count: 2 });

    const event = createEventWithQueryParams(
      { type: 'sale' },
      createAuthenticatedEvent('operator1@i2speedex.com', ['operator'])
    );

    // Act
    const response = await handler(event);

    // Assert
    expect(response.statusCode).toBe(200);

    const body = JSON.parse(response.body!);
    expect(body.data.activities.every((a: any) => a.user === 'operator1@i2speedex.com')).toBe(true);
  });

  it('should return 422 when type is invalid', async () => {
    // Arrange
    const event = createEventWithQueryParams(
      { type: 'invalid' },
      createAuthenticatedEvent('admin@i2speedex.com', ['Admin'])
    );

    // Act
    const response = await handler(event);

    // Assert
    expect(response.statusCode).toBe(500);

    const body = JSON.parse(response.body!);
    expect(body.error).toBe('Internal Server Error');
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
    expect(response.statusCode).toBe(500);

    const body = JSON.parse(response.body!);
    expect(body.error).toBe('Internal Server Error');
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
    expect(response.statusCode).toBe(500);

    const body = JSON.parse(response.body!);
    expect(body.error).toBe('Internal Server Error');
  });

  it('should handle empty results', async () => {
    // Arrange
    mockScanItems
      .mockResolvedValueOnce({ items: [], count: 0 })
      .mockResolvedValueOnce({ items: [], count: 0 })
      .mockResolvedValueOnce({ items: [], count: 0 });

    const event = createAuthenticatedEvent('admin@i2speedex.com', ['Admin']);

    // Act
    const response = await handler(event);

    // Assert
    expect(response.statusCode).toBe(200);

    const body = JSON.parse(response.body!);
    expect(body.data.activities).toEqual([]);
    expect(body.data.count).toBe(0);
  });

  it('should handle DynamoDB error', async () => {
    // Arrange
    mockScanItems.mockRejectedValueOnce(new Error('DynamoDB error'));

    const event = createEventWithQueryParams(
      { type: 'sale' },
      createAuthenticatedEvent('admin@i2speedex.com', ['Admin'])
    );

    // Act
    const response = await handler(event);

    // Assert
    expect(response.statusCode).toBe(500);

    const body = JSON.parse(response.body!);
    expect(body.error).toBe('Internal Server Error');
  });
});
