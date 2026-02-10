/**
 * Unit tests for list-buyers handler
 */

import { handler } from '../../../src/handlers/buyers/list-buyers';
import { createAuthenticatedEvent, createEventWithQueryParams } from '../../fixtures/event.fixture';
import { mockBuyer } from '../../fixtures/sale.fixture';
import * as dynamodb from '../../../src/common/clients/dynamodb';

// Mock DynamoDB client - partial mock to preserve utility functions
jest.mock('../../../src/common/clients/dynamodb', () => ({
  ...jest.requireActual('../../../src/common/clients/dynamodb'),
  scanItems: jest.fn(),
}));

describe('List Buyers Handler', () => {
  const mockScanItems = dynamodb.scanItems as jest.MockedFunction<typeof dynamodb.scanItems>;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should list buyers with default pagination', async () => {
    // Arrange
    mockScanItems.mockResolvedValueOnce({
      items: [mockBuyer],
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

  it('should list buyers with custom pagination', async () => {
    // Arrange
    const buyers = [
      mockBuyer,
      { ...mockBuyer, buyerId: 'BUYER002', companyName: 'Buyer 2' },
    ];

    mockScanItems.mockResolvedValueOnce({
      items: buyers,
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
    const activeBuyers = [
      { ...mockBuyer, status: 'active' },
    ];

    mockScanItems.mockResolvedValueOnce({
      items: activeBuyers,
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
      items: [mockBuyer],
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
      items: [mockBuyer],
      lastEvaluatedKey: undefined,
      count: 1,
    });

    const event = createEventWithQueryParams(
      { search: 'Acme' },
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
          ':search': 'Acme',
        }),
      })
    );
  });

  it('should sort buyers by company name', async () => {
    // Arrange
    const unsortedBuyers = [
      { ...mockBuyer, buyerId: 'BUYER002', companyName: 'Zebra Corp' },
      { ...mockBuyer, buyerId: 'BUYER001', companyName: 'Acme Corp' },
      { ...mockBuyer, buyerId: 'BUYER003', companyName: 'Beta Inc' },
    ];

    mockScanItems.mockResolvedValueOnce({
      items: unsortedBuyers,
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
    expect(body.data[0].companyName).toBe('Acme Corp');
    expect(body.data[1].companyName).toBe('Beta Inc');
    expect(body.data[2].companyName).toBe('Zebra Corp');
  });

  it('should return empty list when no buyers found', async () => {
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
