/**
 * Unit tests for search-producers handler
 */

import { handler } from '../../../src/handlers/search/search-producers';
import { createAuthenticatedEvent, createEventWithQueryParams } from '../../fixtures/event.fixture';
import { mockProducer } from '../../fixtures/sale.fixture';
import * as dynamodb from '../../../src/common/clients/dynamodb';

// Mock DynamoDB client - partial mock to preserve utility functions
jest.mock('../../../src/common/clients/dynamodb', () => ({
  ...jest.requireActual('../../../src/common/clients/dynamodb'),
  scanItems: jest.fn(),
}));

describe('Search Producers Handler', () => {
  const mockScanItems = dynamodb.scanItems as jest.MockedFunction<typeof dynamodb.scanItems>;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should search producers by company name', async () => {
    // Arrange
    const producers = [
      { ...mockProducer, producerId: 'PROD001', companyName: 'Factory Inc', email: 'info@factory.com', city: 'Berlin' },
      { ...mockProducer, producerId: 'PROD002', companyName: 'Manufacturing Co', email: 'info@mfg.com', city: 'Paris' },
      { ...mockProducer, producerId: 'PROD003', companyName: 'Factory Solutions', email: 'info@factorysol.com', city: 'London' },
    ];

    mockScanItems.mockResolvedValueOnce({
      items: producers,
      lastEvaluatedKey: undefined,
      count: 3,
    });

    const event = createEventWithQueryParams(
      { q: 'Factory' },
      createAuthenticatedEvent('admin@i2speedex.com')
    );

    // Act
    const response = await handler(event);

    // Assert
    expect(response.statusCode).toBe(200);

    const body = JSON.parse(response.body!);
    expect(body.success).toBe(true);
    expect(body.data.producers).toHaveLength(2);
    expect(body.data.totalMatches).toBe(2);
    expect(body.data.keyword).toBe('Factory');
  });

  it('should search in multiple fields', async () => {
    // Arrange
    const producers = [
      { ...mockProducer, producerId: 'PROD001', companyName: 'Company A', vatNumber: 'IT98765432109', city: 'Milan', email: 'info@companya.com', fiscalCode: 'AAAAAA80A01H501U' },
      { ...mockProducer, producerId: 'PROD002', companyName: 'Company B', city: 'Rome', email: 'info@companyb.com', fiscalCode: 'BBBBBB80A01H501U' },
      { ...mockProducer, producerId: 'PROD003', companyName: 'Company C', city: 'Milan', email: 'rome@factory.com', fiscalCode: 'CCCCCC80A01H501U' },
      { ...mockProducer, producerId: 'PROD004', companyName: 'Company D', city: 'Milan', email: 'info@companyd.com', fiscalCode: 'RMXXXX80A01H501U' },
    ];

    mockScanItems.mockResolvedValueOnce({
      items: producers,
      lastEvaluatedKey: undefined,
      count: 4,
    });

    const event = createEventWithQueryParams(
      { q: 'rome' },
      createAuthenticatedEvent('admin@i2speedex.com')
    );

    // Act
    const response = await handler(event);

    // Assert
    expect(response.statusCode).toBe(200);

    const body = JSON.parse(response.body!);
    expect(body.data.producers).toHaveLength(2);
    expect(body.data.totalMatches).toBe(2);
  });

  it('should sort results by company name alphabetically', async () => {
    // Arrange
    const producers = [
      { ...mockProducer, producerId: 'PROD001', companyName: 'Zebra Corp', email: 'info@zebracorp.com', city: 'Berlin' },
      { ...mockProducer, producerId: 'PROD002', companyName: 'Alpha Corp', email: 'info@alphacorp.com', city: 'Paris' },
      { ...mockProducer, producerId: 'PROD003', companyName: 'Beta Corp', email: 'info@betacorp.com', city: 'London' },
    ];

    mockScanItems.mockResolvedValueOnce({
      items: producers,
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
    expect(body.data.producers[0].companyName).toBe('Alpha Corp');
    expect(body.data.producers[1].companyName).toBe('Beta Corp');
    expect(body.data.producers[2].companyName).toBe('Zebra Corp');
  });

  it('should paginate results', async () => {
    // Arrange
    const manyProducers = Array.from({ length: 25 }, (_, i) => ({
      ...mockProducer,
      producerId: `PROD${i.toString().padStart(3, '0')}`,
      companyName: `Test Factory ${i}`,
    }));

    mockScanItems.mockResolvedValueOnce({
      items: manyProducers,
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
    expect(body.data.producers).toHaveLength(10);
    expect(body.data.totalMatches).toBe(25);
    expect(body.data.hasMore).toBe(true);
  });

  it('should return empty array when no matches', async () => {
    // Arrange
    mockScanItems.mockResolvedValueOnce({
      items: [mockProducer],
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
    expect(body.data.producers).toEqual([]);
    expect(body.data.totalMatches).toBe(0);
    expect(body.data.message).toContain('Found 0 producer(s)');
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
      { q: 'y' },
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
