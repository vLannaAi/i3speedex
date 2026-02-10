/**
 * Unit tests for get-dashboard-stats handler
 */

import { handler } from '../../../src/handlers/dashboard/get-dashboard-stats';
import { createAuthenticatedEvent, createEventWithQueryParams } from '../../fixtures/event.fixture';
import { mockSale, mockBuyer, mockProducer } from '../../fixtures/sale.fixture';
import * as dynamodb from '../../../src/common/clients/dynamodb';

// Mock DynamoDB client - partial mock to preserve utility functions
jest.mock('../../../src/common/clients/dynamodb', () => ({
  ...jest.requireActual('../../../src/common/clients/dynamodb'),
  scanItems: jest.fn(),
}));

describe('Get Dashboard Stats Handler', () => {
  const mockScanItems = dynamodb.scanItems as jest.MockedFunction<typeof dynamodb.scanItems>;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should calculate comprehensive dashboard statistics', async () => {
    // Arrange
    const confirmedSale = { ...mockSale, saleId: 'SALE001', status: 'confirmed' as const, invoiceGenerated: true, total: 1000 };
    const draftSale = { ...mockSale, saleId: 'SALE002', status: 'draft' as const, invoiceGenerated: false, total: 500 };
    const sales = [confirmedSale, draftSale];

    const buyers = [
      { ...mockBuyer, buyerId: 'BUYER001', status: 'active' as const },
      { ...mockBuyer, buyerId: 'BUYER002', status: 'inactive' as const },
    ];

    const producers = [
      { ...mockProducer, producerId: 'PROD001', status: 'active' as const },
    ];

    mockScanItems
      .mockResolvedValueOnce({ items: sales, count: 2 })
      .mockResolvedValueOnce({ items: buyers, count: 2 })
      .mockResolvedValueOnce({ items: producers, count: 1 });

    const event = createAuthenticatedEvent('admin@i2speedex.com', ['Admin']);

    // Act
    const response = await handler(event);

    // Assert
    expect(response.statusCode).toBe(200);

    const body = JSON.parse(response.body!);
    expect(body.success).toBe(true);
    expect(body.data.stats.totalSales).toBe(2);
    expect(body.data.stats.confirmedSales).toBe(1);
    expect(body.data.stats.draftSales).toBe(1);
    expect(body.data.stats.invoicedSales).toBe(1);
    expect(body.data.stats.totalRevenue).toBe(1500);
    expect(body.data.stats.totalBuyers).toBe(2);
    expect(body.data.stats.activeBuyers).toBe(1);
    expect(body.data.stats.totalProducers).toBe(1);
    expect(body.data.stats.activeProducers).toBe(1);
  });

  it('should calculate current and previous month statistics', async () => {
    // Arrange
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;

    // Current month sale
    const currentMonthDate = new Date(currentYear, currentMonth - 1, 15);
    const currentSale = {
      ...mockSale,
      saleId: 'SALE001',
      saleDate: currentMonthDate.toISOString().split('T')[0],
      total: 1000,
    };

    // Previous month sale
    const previousMonthDate = new Date(currentYear, currentMonth - 2, 15);
    const previousSale = {
      ...mockSale,
      saleId: 'SALE002',
      saleDate: previousMonthDate.toISOString().split('T')[0],
      total: 800,
    };

    mockScanItems
      .mockResolvedValueOnce({ items: [currentSale, previousSale], count: 2 })
      .mockResolvedValueOnce({ items: [], count: 0 })
      .mockResolvedValueOnce({ items: [], count: 0 });

    const event = createAuthenticatedEvent('admin@i2speedex.com', ['Admin']);

    // Act
    const response = await handler(event);

    // Assert
    expect(response.statusCode).toBe(200);

    const body = JSON.parse(response.body!);
    expect(body.data.stats.currentMonth.sales).toBe(1);
    expect(body.data.stats.currentMonth.revenue).toBe(1000);
    expect(body.data.stats.previousMonth.sales).toBe(1);
    expect(body.data.stats.previousMonth.revenue).toBe(800);
  });

  it('should calculate positive growth percentages', async () => {
    // Arrange
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;

    // Current month: 2 sales, 2000 revenue
    const currentSales = [
      {
        ...mockSale,
        saleId: 'SALE001',
        saleDate: new Date(currentYear, currentMonth - 1, 10).toISOString().split('T')[0],
        total: 1000,
      },
      {
        ...mockSale,
        saleId: 'SALE002',
        saleDate: new Date(currentYear, currentMonth - 1, 20).toISOString().split('T')[0],
        total: 1000,
      },
    ];

    // Previous month: 1 sale, 1000 revenue
    const previousSale = {
      ...mockSale,
      saleId: 'SALE003',
      saleDate: new Date(currentYear, currentMonth - 2, 15).toISOString().split('T')[0],
      total: 1000,
    };

    mockScanItems
      .mockResolvedValueOnce({ items: [...currentSales, previousSale], count: 3 })
      .mockResolvedValueOnce({ items: [], count: 0 })
      .mockResolvedValueOnce({ items: [], count: 0 });

    const event = createAuthenticatedEvent('admin@i2speedex.com', ['Admin']);

    // Act
    const response = await handler(event);

    // Assert
    expect(response.statusCode).toBe(200);

    const body = JSON.parse(response.body!);
    expect(body.data.stats.salesGrowth).toBe(100); // (2-1)/1 * 100
    expect(body.data.stats.revenueGrowth).toBe(100); // (2000-1000)/1000 * 100
  });

  it('should calculate negative growth percentages', async () => {
    // Arrange
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;

    // Current month: 1 sale, 500 revenue
    const currentSale = {
      ...mockSale,
      saleId: 'SALE001',
      saleDate: new Date(currentYear, currentMonth - 1, 10).toISOString().split('T')[0],
      total: 500,
    };

    // Previous month: 2 sales, 1000 revenue
    const previousSales = [
      {
        ...mockSale,
        saleId: 'SALE002',
        saleDate: new Date(currentYear, currentMonth - 2, 10).toISOString().split('T')[0],
        total: 500,
      },
      {
        ...mockSale,
        saleId: 'SALE003',
        saleDate: new Date(currentYear, currentMonth - 2, 20).toISOString().split('T')[0],
        total: 500,
      },
    ];

    mockScanItems
      .mockResolvedValueOnce({ items: [currentSale, ...previousSales], count: 3 })
      .mockResolvedValueOnce({ items: [], count: 0 })
      .mockResolvedValueOnce({ items: [], count: 0 });

    const event = createAuthenticatedEvent('admin@i2speedex.com', ['Admin']);

    // Act
    const response = await handler(event);

    // Assert
    expect(response.statusCode).toBe(200);

    const body = JSON.parse(response.body!);
    expect(body.data.stats.salesGrowth).toBe(-50); // (1-2)/2 * 100
    expect(body.data.stats.revenueGrowth).toBe(-50); // (500-1000)/1000 * 100
  });

  it('should handle zero growth when previous month has no sales', async () => {
    // Arrange
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;

    const currentSale = {
      ...mockSale,
      saleId: 'SALE001',
      saleDate: new Date(currentYear, currentMonth - 1, 15).toISOString().split('T')[0],
      total: 1000,
    };

    mockScanItems
      .mockResolvedValueOnce({ items: [currentSale], count: 1 })
      .mockResolvedValueOnce({ items: [], count: 0 })
      .mockResolvedValueOnce({ items: [], count: 0 });

    const event = createAuthenticatedEvent('admin@i2speedex.com', ['Admin']);

    // Act
    const response = await handler(event);

    // Assert
    expect(response.statusCode).toBe(200);

    const body = JSON.parse(response.body!);
    expect(body.data.stats.salesGrowth).toBe(0);
    expect(body.data.stats.revenueGrowth).toBe(0);
  });

  it('should support custom year and month parameters', async () => {
    // Arrange
    mockScanItems
      .mockResolvedValueOnce({ items: [], count: 0 })
      .mockResolvedValueOnce({ items: [], count: 0 })
      .mockResolvedValueOnce({ items: [], count: 0 });

    const event = createEventWithQueryParams(
      { year: '2025', month: '6' },
      createAuthenticatedEvent('admin@i2speedex.com', ['Admin'])
    );

    // Act
    const response = await handler(event);

    // Assert
    expect(response.statusCode).toBe(200);

    const body = JSON.parse(response.body!);
    expect(body.data.period.year).toBe(2025);
    expect(body.data.period.month).toBe(6);
  });

  it('should filter sales by user access (operators see only their sales)', async () => {
    // Arrange
    const operator1Sale = {
      ...mockSale,
      saleId: 'SALE001',
      createdBy: 'operator1@i2speedex.com',
      total: 1000,
    };

    const operator2Sale = {
      ...mockSale,
      saleId: 'SALE002',
      createdBy: 'operator2@i2speedex.com',
      total: 500,
    };

    mockScanItems
      .mockResolvedValueOnce({ items: [operator1Sale, operator2Sale], count: 2 })
      .mockResolvedValueOnce({ items: [], count: 0 })
      .mockResolvedValueOnce({ items: [], count: 0 });

    const event = createAuthenticatedEvent('operator1@i2speedex.com', ['operator']);

    // Act
    const response = await handler(event);

    // Assert
    expect(response.statusCode).toBe(200);

    const body = JSON.parse(response.body!);
    expect(body.data.stats.totalSales).toBe(1);
    expect(body.data.stats.totalRevenue).toBe(1000);
  });

  it('should allow admin to see all sales', async () => {
    // Arrange
    const sales = [
      { ...mockSale, saleId: 'SALE001', createdBy: 'operator1@i2speedex.com', total: 1000 },
      { ...mockSale, saleId: 'SALE002', createdBy: 'operator2@i2speedex.com', total: 500 },
      { ...mockSale, saleId: 'SALE003', createdBy: 'admin@i2speedex.com', total: 750 },
    ];

    mockScanItems
      .mockResolvedValueOnce({ items: sales, count: 3 })
      .mockResolvedValueOnce({ items: [], count: 0 })
      .mockResolvedValueOnce({ items: [], count: 0 });

    const event = createAuthenticatedEvent('admin@i2speedex.com', ['Admin']);

    // Act
    const response = await handler(event);

    // Assert
    expect(response.statusCode).toBe(200);

    const body = JSON.parse(response.body!);
    expect(body.data.stats.totalSales).toBe(3);
    expect(body.data.stats.totalRevenue).toBe(2250);
  });

  it('should exclude soft-deleted items', async () => {
    // Arrange - DynamoDB filter already excludes soft-deleted items
    const activeSale = { ...mockSale, saleId: 'SALE001', total: 1000 };

    mockScanItems
      .mockResolvedValueOnce({ items: [activeSale], count: 1 })
      .mockResolvedValueOnce({ items: [], count: 0 })
      .mockResolvedValueOnce({ items: [], count: 0 });

    const event = createAuthenticatedEvent('admin@i2speedex.com', ['Admin']);

    // Act
    const response = await handler(event);

    // Assert
    expect(response.statusCode).toBe(200);
    expect(mockScanItems).toHaveBeenCalledWith(
      expect.objectContaining({
        FilterExpression: expect.stringContaining('attribute_not_exists(deletedAt)'),
      })
    );
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
