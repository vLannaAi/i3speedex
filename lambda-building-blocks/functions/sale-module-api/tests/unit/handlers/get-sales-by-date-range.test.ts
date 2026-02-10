/**
 * Unit tests for get-sales-by-date-range handler
 */

import { handler } from '../../../src/handlers/dashboard/get-sales-by-date-range';
import { createAuthenticatedEvent, createEventWithQueryParams } from '../../fixtures/event.fixture';
import { mockSale } from '../../fixtures/sale.fixture';
import * as dynamodb from '../../../src/common/clients/dynamodb';

// Mock DynamoDB client - partial mock to preserve utility functions
jest.mock('../../../src/common/clients/dynamodb', () => ({
  ...jest.requireActual('../../../src/common/clients/dynamodb'),
  scanItems: jest.fn(),
}));

describe('Get Sales By Date Range Handler', () => {
  const mockScanItems = dynamodb.scanItems as jest.MockedFunction<typeof dynamodb.scanItems>;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should group sales by day successfully', async () => {
    // Arrange
    const sales = [
      { ...mockSale, saleId: 'SALE001', saleDate: '2026-01-15', total: 1000 },
      { ...mockSale, saleId: 'SALE002', saleDate: '2026-01-15', total: 500 },
      { ...mockSale, saleId: 'SALE003', saleDate: '2026-01-16', total: 750 },
    ];

    mockScanItems.mockResolvedValueOnce({ items: sales, count: 3 });

    const event = createEventWithQueryParams(
      { startDate: '2026-01-15', endDate: '2026-01-16', groupBy: 'day' },
      createAuthenticatedEvent('admin@i2speedex.com', ['Admin'])
    );

    // Act
    const response = await handler(event);

    // Assert
    expect(response.statusCode).toBe(200);

    const body = JSON.parse(response.body!);
    expect(body.success).toBe(true);
    expect(body.data.data).toHaveLength(2);
    expect(body.data.data[0].date).toBe('2026-01-15');
    expect(body.data.data[0].count).toBe(2);
    expect(body.data.data[0].revenue).toBe(1500);
    expect(body.data.data[1].date).toBe('2026-01-16');
    expect(body.data.data[1].count).toBe(1);
    expect(body.data.data[1].revenue).toBe(750);
  });

  it('should group sales by week successfully', async () => {
    // Arrange - Week starting Monday
    const sales = [
      { ...mockSale, saleId: 'SALE001', saleDate: '2026-01-05', total: 1000 }, // Monday
      { ...mockSale, saleId: 'SALE002', saleDate: '2026-01-07', total: 500 }, // Wednesday (same week)
      { ...mockSale, saleId: 'SALE003', saleDate: '2026-01-12', total: 750 }, // Next Monday
    ];

    mockScanItems.mockResolvedValueOnce({ items: sales, count: 3 });

    const event = createEventWithQueryParams(
      { startDate: '2026-01-01', endDate: '2026-01-31', groupBy: 'week' },
      createAuthenticatedEvent('admin@i2speedex.com', ['Admin'])
    );

    // Act
    const response = await handler(event);

    // Assert
    expect(response.statusCode).toBe(200);

    const body = JSON.parse(response.body!);
    expect(body.data.data).toHaveLength(2);
    expect(body.data.data[0].count).toBe(2); // First week has 2 sales
    expect(body.data.data[0].revenue).toBe(1500);
    expect(body.data.data[1].count).toBe(1); // Second week has 1 sale
    expect(body.data.data[1].revenue).toBe(750);
  });

  it('should group sales by month successfully', async () => {
    // Arrange
    const sales = [
      { ...mockSale, saleId: 'SALE001', saleDate: '2026-01-15', total: 1000 },
      { ...mockSale, saleId: 'SALE002', saleDate: '2026-01-20', total: 500 },
      { ...mockSale, saleId: 'SALE003', saleDate: '2026-02-10', total: 750 },
    ];

    mockScanItems.mockResolvedValueOnce({ items: sales, count: 3 });

    const event = createEventWithQueryParams(
      { startDate: '2026-01-01', endDate: '2026-02-28', groupBy: 'month' },
      createAuthenticatedEvent('admin@i2speedex.com', ['Admin'])
    );

    // Act
    const response = await handler(event);

    // Assert
    expect(response.statusCode).toBe(200);

    const body = JSON.parse(response.body!);
    expect(body.data.data).toHaveLength(2);
    expect(body.data.data[0].date).toBe('2026-01');
    expect(body.data.data[0].count).toBe(2);
    expect(body.data.data[0].revenue).toBe(1500);
    expect(body.data.data[1].date).toBe('2026-02');
    expect(body.data.data[1].count).toBe(1);
    expect(body.data.data[1].revenue).toBe(750);
  });

  it('should calculate summary statistics correctly', async () => {
    // Arrange
    const sales = [
      { ...mockSale, saleId: 'SALE001', saleDate: '2026-01-15', total: 1000 },
      { ...mockSale, saleId: 'SALE002', saleDate: '2026-01-16', total: 500 },
      { ...mockSale, saleId: 'SALE003', saleDate: '2026-01-17', total: 1500 },
    ];

    mockScanItems.mockResolvedValueOnce({ items: sales, count: 3 });

    const event = createEventWithQueryParams(
      { startDate: '2026-01-15', endDate: '2026-01-17', groupBy: 'day' },
      createAuthenticatedEvent('admin@i2speedex.com', ['Admin'])
    );

    // Act
    const response = await handler(event);

    // Assert
    expect(response.statusCode).toBe(200);

    const body = JSON.parse(response.body!);
    expect(body.data.summary.totalSales).toBe(3);
    expect(body.data.summary.totalRevenue).toBe(3000);
    expect(body.data.summary.averageRevenue).toBe(1000); // 3000/3
    expect(body.data.summary.periods).toBe(3);
    expect(body.data.summary.groupBy).toBe('day');
  });

  it('should filter by date range correctly', async () => {
    // Arrange
    const sales = [
      { ...mockSale, saleId: 'SALE001', saleDate: '2026-01-10', total: 1000 }, // Before range
      { ...mockSale, saleId: 'SALE002', saleDate: '2026-01-15', total: 500 }, // In range
      { ...mockSale, saleId: 'SALE003', saleDate: '2026-01-20', total: 750 }, // In range
      { ...mockSale, saleId: 'SALE004', saleDate: '2026-01-25', total: 250 }, // After range
    ];

    mockScanItems.mockResolvedValueOnce({ items: sales, count: 4 });

    const event = createEventWithQueryParams(
      { startDate: '2026-01-15', endDate: '2026-01-20', groupBy: 'day' },
      createAuthenticatedEvent('admin@i2speedex.com', ['Admin'])
    );

    // Act
    const response = await handler(event);

    // Assert
    expect(response.statusCode).toBe(200);

    const body = JSON.parse(response.body!);
    expect(body.data.summary.totalSales).toBe(2);
    expect(body.data.summary.totalRevenue).toBe(1250);
  });

  it('should filter by user access (operators see only their sales)', async () => {
    // Arrange
    const sales = [
      { ...mockSale, saleId: 'SALE001', saleDate: '2026-01-15', createdBy: 'operator1@i2speedex.com', total: 1000 },
      { ...mockSale, saleId: 'SALE002', saleDate: '2026-01-16', createdBy: 'operator2@i2speedex.com', total: 500 },
    ];

    mockScanItems.mockResolvedValueOnce({ items: sales, count: 2 });

    const event = createEventWithQueryParams(
      { startDate: '2026-01-15', endDate: '2026-01-16', groupBy: 'day' },
      createAuthenticatedEvent('operator1@i2speedex.com', ['operator'])
    );

    // Act
    const response = await handler(event);

    // Assert
    expect(response.statusCode).toBe(200);

    const body = JSON.parse(response.body!);
    expect(body.data.summary.totalSales).toBe(1);
    expect(body.data.summary.totalRevenue).toBe(1000);
  });

  it('should sort results by date ascending', async () => {
    // Arrange
    const sales = [
      { ...mockSale, saleId: 'SALE001', saleDate: '2026-01-20', total: 1000 },
      { ...mockSale, saleId: 'SALE002', saleDate: '2026-01-15', total: 500 },
      { ...mockSale, saleId: 'SALE003', saleDate: '2026-01-18', total: 750 },
    ];

    mockScanItems.mockResolvedValueOnce({ items: sales, count: 3 });

    const event = createEventWithQueryParams(
      { startDate: '2026-01-15', endDate: '2026-01-20', groupBy: 'day' },
      createAuthenticatedEvent('admin@i2speedex.com', ['Admin'])
    );

    // Act
    const response = await handler(event);

    // Assert
    expect(response.statusCode).toBe(200);

    const body = JSON.parse(response.body!);
    expect(body.data.data[0].date).toBe('2026-01-15');
    expect(body.data.data[1].date).toBe('2026-01-18');
    expect(body.data.data[2].date).toBe('2026-01-20');
  });

  it('should return 422 when startDate is missing', async () => {
    // Arrange
    const event = createEventWithQueryParams(
      { endDate: '2026-01-31' },
      createAuthenticatedEvent('admin@i2speedex.com', ['Admin'])
    );

    // Act
    const response = await handler(event);

    // Assert
    expect(response.statusCode).toBe(422);

    const body = JSON.parse(response.body!);
    expect(body.error).toBe('Validation Error');
    expect(body.message).toContain('startDate and endDate are required');
  });

  it('should return 422 when endDate is missing', async () => {
    // Arrange
    const event = createEventWithQueryParams(
      { startDate: '2026-01-01' },
      createAuthenticatedEvent('admin@i2speedex.com', ['Admin'])
    );

    // Act
    const response = await handler(event);

    // Assert
    expect(response.statusCode).toBe(422);

    const body = JSON.parse(response.body!);
    expect(body.message).toContain('startDate and endDate are required');
  });

  it('should return 422 when groupBy is invalid', async () => {
    // Arrange
    const event = createEventWithQueryParams(
      { startDate: '2026-01-01', endDate: '2026-01-31', groupBy: 'year' },
      createAuthenticatedEvent('admin@i2speedex.com', ['Admin'])
    );

    // Act
    const response = await handler(event);

    // Assert
    expect(response.statusCode).toBe(422);

    const body = JSON.parse(response.body!);
    expect(body.message).toContain('groupBy must be one of: day, week, month');
  });

  it('should return 422 when date format is invalid', async () => {
    // Arrange
    const event = createEventWithQueryParams(
      { startDate: 'invalid-date', endDate: '2026-01-31' },
      createAuthenticatedEvent('admin@i2speedex.com', ['Admin'])
    );

    // Act
    const response = await handler(event);

    // Assert
    expect(response.statusCode).toBe(422);

    const body = JSON.parse(response.body!);
    expect(body.message).toContain('Invalid date format');
  });

  it('should return 422 when startDate is after endDate', async () => {
    // Arrange
    const event = createEventWithQueryParams(
      { startDate: '2026-02-01', endDate: '2026-01-01' },
      createAuthenticatedEvent('admin@i2speedex.com', ['Admin'])
    );

    // Act
    const response = await handler(event);

    // Assert
    expect(response.statusCode).toBe(422);

    const body = JSON.parse(response.body!);
    expect(body.message).toContain('startDate must be before endDate');
  });

  it('should handle empty results', async () => {
    // Arrange
    mockScanItems.mockResolvedValueOnce({ items: [], count: 0 });

    const event = createEventWithQueryParams(
      { startDate: '2026-01-01', endDate: '2026-01-31', groupBy: 'day' },
      createAuthenticatedEvent('admin@i2speedex.com', ['Admin'])
    );

    // Act
    const response = await handler(event);

    // Assert
    expect(response.statusCode).toBe(200);

    const body = JSON.parse(response.body!);
    expect(body.data.data).toEqual([]);
    expect(body.data.summary.totalSales).toBe(0);
    expect(body.data.summary.totalRevenue).toBe(0);
  });

  it('should handle DynamoDB error', async () => {
    // Arrange
    mockScanItems.mockRejectedValueOnce(new Error('DynamoDB error'));

    const event = createEventWithQueryParams(
      { startDate: '2026-01-01', endDate: '2026-01-31' },
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
