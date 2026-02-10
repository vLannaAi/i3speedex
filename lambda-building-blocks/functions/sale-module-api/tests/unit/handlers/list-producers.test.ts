/**
 * Unit tests for list-producers handler
 */

import { handler } from '../../../src/handlers/producers/list-producers';
import { createAuthenticatedEvent, createEventWithQueryParams } from '../../fixtures/event.fixture';
import { mockProducer } from '../../fixtures/sale.fixture';
import * as dynamodb from '../../../src/common/clients/dynamodb';

// Mock DynamoDB client - partial mock to preserve utility functions
jest.mock('../../../src/common/clients/dynamodb', () => ({
  ...jest.requireActual('../../../src/common/clients/dynamodb'),
  scanItems: jest.fn(),
}));

describe('List Producers Handler', () => {
  const mockScanItems = dynamodb.scanItems as jest.MockedFunction<typeof dynamodb.scanItems>;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should list producers with default pagination', async () => {
    // Arrange
    mockScanItems.mockResolvedValueOnce({
      items: [mockProducer],
      lastEvaluatedKey: undefined,
      count: 1,
    });

    const event = createAuthenticatedEvent('admin@i2speedex.com');

    // Act
    const response = await handler(event);

    // Assert
    expect(response.statusCode).toBe(200);

    const body = JSON.parse(response.body!);
    expect(body.success).toBe(true);
    expect(body.data).toHaveLength(1);
    expect(body.pagination).toBeDefined();

    // Verify scan was called with correct filters
    expect(mockScanItems).toHaveBeenCalledWith(
      expect.objectContaining({
        TableName: expect.any(String),
        FilterExpression: expect.stringContaining('attribute_not_exists(deletedAt)'),
        ExpressionAttributeValues: expect.objectContaining({
          ':sk': 'METADATA',
        }),
      })
    );
  });

  it('should list producers with custom pagination', async () => {
    // Arrange
    const producers = [
      mockProducer,
      { ...mockProducer, producerId: 'PROD002', companyName: 'Producer 2' },
    ];

    mockScanItems.mockResolvedValueOnce({
      items: producers,
      lastEvaluatedKey: undefined,
      count: 2,
    });

    const event = createEventWithQueryParams(
      { page: '1', pageSize: '50' },
      createAuthenticatedEvent('admin@i2speedex.com')
    );

    // Act
    const response = await handler(event);

    // Assert
    expect(response.statusCode).toBe(200);

    const body = JSON.parse(response.body!);
    expect(body.pagination.pageSize).toBe(50);
  });

  it('should filter by status', async () => {
    // Arrange
    const activeProducers = [
      { ...mockProducer, status: 'active' },
    ];

    mockScanItems.mockResolvedValueOnce({
      items: activeProducers,
      lastEvaluatedKey: undefined,
      count: 1,
    });

    const event = createEventWithQueryParams(
      { status: 'active' },
      createAuthenticatedEvent('admin@i2speedex.com')
    );

    // Act
    const response = await handler(event);

    // Assert
    expect(response.statusCode).toBe(200);

    // Verify status filter was applied
    expect(mockScanItems).toHaveBeenCalledWith(
      expect.objectContaining({
        ExpressionAttributeNames: expect.objectContaining({
          '#status': 'status',
        }),
        ExpressionAttributeValues: expect.objectContaining({
          ':status': 'active',
        }),
      })
    );
  });

  it('should filter by country', async () => {
    // Arrange
    mockScanItems.mockResolvedValueOnce({
      items: [mockProducer],
      lastEvaluatedKey: undefined,
      count: 1,
    });

    const event = createEventWithQueryParams(
      { country: 'IT' },
      createAuthenticatedEvent('admin@i2speedex.com')
    );

    // Act
    const response = await handler(event);

    // Assert
    expect(response.statusCode).toBe(200);

    // Verify country filter was applied
    expect(mockScanItems).toHaveBeenCalledWith(
      expect.objectContaining({
        ExpressionAttributeValues: expect.objectContaining({
          ':country': 'IT',
        }),
      })
    );
  });

  it('should search by company name', async () => {
    // Arrange
    mockScanItems.mockResolvedValueOnce({
      items: [mockProducer],
      lastEvaluatedKey: undefined,
      count: 1,
    });

    const event = createEventWithQueryParams(
      { search: 'Factory' },
      createAuthenticatedEvent('admin@i2speedex.com')
    );

    // Act
    const response = await handler(event);

    // Assert
    expect(response.statusCode).toBe(200);

    // Verify search filter was applied
    expect(mockScanItems).toHaveBeenCalledWith(
      expect.objectContaining({
        FilterExpression: expect.stringContaining('contains(companyName, :search)'),
        ExpressionAttributeValues: expect.objectContaining({
          ':search': 'Factory',
        }),
      })
    );
  });

  it('should sort producers by company name', async () => {
    // Arrange
    const unsortedProducers = [
      { ...mockProducer, producerId: 'PROD002', companyName: 'Zebra Factory' },
      { ...mockProducer, producerId: 'PROD001', companyName: 'Alpha Factory' },
      { ...mockProducer, producerId: 'PROD003', companyName: 'Beta Factory' },
    ];

    mockScanItems.mockResolvedValueOnce({
      items: unsortedProducers,
      lastEvaluatedKey: undefined,
      count: 3,
    });

    const event = createAuthenticatedEvent('admin@i2speedex.com');

    // Act
    const response = await handler(event);

    // Assert
    expect(response.statusCode).toBe(200);

    const body = JSON.parse(response.body!);
    expect(body.data).toHaveLength(3);

    // Verify sorted alphabetically
    expect(body.data[0].companyName).toBe('Alpha Factory');
    expect(body.data[1].companyName).toBe('Beta Factory');
    expect(body.data[2].companyName).toBe('Zebra Factory');
  });

  it('should return empty list when no producers found', async () => {
    // Arrange
    mockScanItems.mockResolvedValueOnce({
      items: [],
      lastEvaluatedKey: undefined,
      count: 0,
    });

    const event = createAuthenticatedEvent('admin@i2speedex.com');

    // Act
    const response = await handler(event);

    // Assert
    expect(response.statusCode).toBe(200);

    const body = JSON.parse(response.body!);
    expect(body.success).toBe(true);
    expect(body.data).toEqual([]);
  });

  it('should handle DynamoDB error', async () => {
    // Arrange
    mockScanItems.mockRejectedValueOnce(new Error('DynamoDB error'));

    const event = createAuthenticatedEvent('admin@i2speedex.com');

    // Act
    const response = await handler(event);

    // Assert
    expect(response.statusCode).toBe(500);

    const body = JSON.parse(response.body!);
    expect(body.success).toBe(false);
    expect(body.error).toBe('Internal Server Error');
  });
});
