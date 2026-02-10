/**
 * Unit tests for search-buyers handler
 */

import { handler } from '../../../src/handlers/search/search-buyers';
import { createAuthenticatedEvent, createEventWithQueryParams } from '../../fixtures/event.fixture';
import { mockBuyer } from '../../fixtures/sale.fixture';
import * as dynamodb from '../../../src/common/clients/dynamodb';

// Mock DynamoDB client - partial mock to preserve utility functions
jest.mock('../../../src/common/clients/dynamodb', () => ({
  ...jest.requireActual('../../../src/common/clients/dynamodb'),
  scanItems: jest.fn(),
}));

describe('Search Buyers Handler', () => {
  const mockScanItems = dynamodb.scanItems as jest.MockedFunction<typeof dynamodb.scanItems>;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should search buyers by company name', async () => {
    // Arrange
    const buyers = [
      { ...mockBuyer, buyerId: 'BUYER001', companyName: 'Acme Corp', email: 'info@acmecorp.com', city: 'New York' },
      { ...mockBuyer, buyerId: 'BUYER002', companyName: 'Beta Industries', email: 'info@beta.com', city: 'London' },
      { ...mockBuyer, buyerId: 'BUYER003', companyName: 'Acme Solutions', email: 'info@acmesol.com', city: 'Paris' },
    ];

    mockScanItems.mockResolvedValueOnce({
      items: buyers,
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
    expect(body.data.buyers).toHaveLength(2);
    expect(body.data.totalMatches).toBe(2);
    expect(body.data.keyword).toBe('Acme');
  });

  it('should search in multiple fields', async () => {
    // Arrange
    const buyers = [
      { ...mockBuyer, buyerId: 'BUYER001', companyName: 'Company A', vatNumber: 'IT12345678901', city: 'Rome', email: 'info@companya.com', fiscalCode: 'AAAAAA80A01H501U' },
      { ...mockBuyer, buyerId: 'BUYER002', companyName: 'Company B', city: 'Milan', email: 'info@companyb.com', fiscalCode: 'BBBBBB80A01H501U' },
      { ...mockBuyer, buyerId: 'BUYER003', companyName: 'Company C', city: 'Rome', email: 'milan@company.com', fiscalCode: 'CCCCCC80A01H501U' },
      { ...mockBuyer, buyerId: 'BUYER004', companyName: 'Company D', city: 'Rome', email: 'info@companyd.com', fiscalCode: 'MLNXXX80A01H501U' },
    ];

    mockScanItems.mockResolvedValueOnce({
      items: buyers,
      lastEvaluatedKey: undefined,
      count: 4,
    });

    const event = createEventWithQueryParams(
      { q: 'milan' },
      createAuthenticatedEvent('admin@i2speedex.com')
    );

    // Act
    const response = await handler(event);

    // Assert
    expect(response.statusCode).toBe(200);

    const body = JSON.parse(response.body!);
    expect(body.data.buyers).toHaveLength(2);
    expect(body.data.totalMatches).toBe(2);
  });

  it('should sort results by company name alphabetically', async () => {
    // Arrange
    const buyers = [
      { ...mockBuyer, buyerId: 'BUYER001', companyName: 'Zebra Corp', email: 'info@zebracorp.com', city: 'New York' },
      { ...mockBuyer, buyerId: 'BUYER002', companyName: 'Alpha Industries', email: 'info@alphacorp.com', city: 'London' },
      { ...mockBuyer, buyerId: 'BUYER003', companyName: 'Beta Solutions', email: 'info@betacorp.com', city: 'Paris' },
    ];

    mockScanItems.mockResolvedValueOnce({
      items: buyers,
      lastEvaluatedKey: undefined,
      count: 3,
    });

    const event = createEventWithQueryParams(
      { q: 'Corp' },
      createAuthenticatedEvent('admin@i2speedex.com')
    );

    // Act
    const response = await handler(event);

    // Assert
    expect(response.statusCode).toBe(200);

    const body = JSON.parse(response.body!);
    expect(body.data.buyers[0].companyName).toBe('Alpha Industries');
    expect(body.data.buyers[1].companyName).toBe('Beta Solutions');
    expect(body.data.buyers[2].companyName).toBe('Zebra Corp');
  });

  it('should paginate results', async () => {
    // Arrange
    const manyBuyers = Array.from({ length: 25 }, (_, i) => ({
      ...mockBuyer,
      buyerId: `BUYER${i.toString().padStart(3, '0')}`,
      companyName: `Test Corp ${i}`,
    }));

    mockScanItems.mockResolvedValueOnce({
      items: manyBuyers,
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
    expect(body.data.buyers).toHaveLength(10);
    expect(body.data.totalMatches).toBe(25);
    expect(body.data.hasMore).toBe(true);
  });

  it('should return empty array when no matches', async () => {
    // Arrange
    mockScanItems.mockResolvedValueOnce({
      items: [mockBuyer],
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
    expect(body.data.buyers).toEqual([]);
    expect(body.data.totalMatches).toBe(0);
    expect(body.data.message).toContain('Found 0 buyer(s)');
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
      { q: 'x' },
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
