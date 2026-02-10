/**
 * Unit tests for list-sale-lines handler
 */

import { handler } from '../../../src/handlers/sales/list-sale-lines';
import { createAuthenticatedEvent, createEventWithPathParams } from '../../fixtures/event.fixture';
import { mockSale, mockSaleLine } from '../../fixtures/sale.fixture';
import * as dynamodb from '../../../src/common/clients/dynamodb';

// Mock DynamoDB client - partial mock to preserve utility functions
jest.mock('../../../src/common/clients/dynamodb', () => ({
  ...jest.requireActual('../../../src/common/clients/dynamodb'),
  getItem: jest.fn(),
  queryItems: jest.fn(),
}));

describe('List Sale Lines Handler', () => {
  const mockGetItem = dynamodb.getItem as jest.MockedFunction<typeof dynamodb.getItem>;
  const mockQueryItems = dynamodb.queryItems as jest.MockedFunction<typeof dynamodb.queryItems>;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should list sale lines successfully', async () => {
    // Arrange
    const line1 = { ...mockSaleLine, lineNumber: 1 };
    const line2 = { ...mockSaleLine, lineId: 'LINE002', lineNumber: 2 };
    const line3 = { ...mockSaleLine, lineId: 'LINE003', lineNumber: 3 };

    mockGetItem.mockResolvedValueOnce(mockSale);
    mockQueryItems.mockResolvedValueOnce({
      items: [line2, line3, line1], // Unsorted
      lastEvaluatedKey: undefined,
      count: 3,
    });

    const event = createEventWithPathParams(
      { id: 'SALE001' },
      createAuthenticatedEvent('admin@i2speedex.com')
    );

    // Act
    const response = await handler(event);

    // Assert
    expect(response.statusCode).toBe(200);

    const body = JSON.parse(response.body!);
    expect(body.success).toBe(true);
    expect(body.data).toHaveLength(3);

    // Verify sorted by line number
    expect(body.data[0].lineNumber).toBe(1);
    expect(body.data[1].lineNumber).toBe(2);
    expect(body.data[2].lineNumber).toBe(3);

    // Verify query was called correctly
    expect(mockQueryItems).toHaveBeenCalledWith({
      TableName: expect.any(String),
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :skPrefix)',
      ExpressionAttributeValues: {
        ':pk': 'SALE#SALE001',
        ':skPrefix': 'LINE#',
      },
      FilterExpression: 'attribute_not_exists(deletedAt)',
    });
  });

  it('should return empty array when sale has no lines', async () => {
    // Arrange
    mockGetItem.mockResolvedValueOnce(mockSale);
    mockQueryItems.mockResolvedValueOnce({
      items: [],
      lastEvaluatedKey: undefined,
      count: 0,
    });

    const event = createEventWithPathParams(
      { id: 'SALE001' },
      createAuthenticatedEvent('admin@i2speedex.com')
    );

    // Act
    const response = await handler(event);

    // Assert
    expect(response.statusCode).toBe(200);

    const body = JSON.parse(response.body!);
    expect(body.success).toBe(true);
    expect(body.data).toEqual([]);
  });

  it('should return 404 when sale not found', async () => {
    // Arrange
    mockGetItem.mockResolvedValueOnce(null);

    const event = createEventWithPathParams(
      { id: 'NONEXISTENT' },
      createAuthenticatedEvent('admin@i2speedex.com')
    );

    // Act
    const response = await handler(event);

    // Assert
    expect(response.statusCode).toBe(404);

    const body = JSON.parse(response.body!);
    expect(body.success).toBe(false);
    expect(body.error).toBe('Not Found');
  });

  it('should return 404 when sale is soft deleted', async () => {
    // Arrange
    const deletedSale = {
      ...mockSale,
      deletedAt: '2026-01-29T12:00:00.000Z',
    };
    mockGetItem.mockResolvedValueOnce(deletedSale);

    const event = createEventWithPathParams(
      { id: 'SALE001' },
      createAuthenticatedEvent('admin@i2speedex.com')
    );

    // Act
    const response = await handler(event);

    // Assert
    expect(response.statusCode).toBe(404);

    const body = JSON.parse(response.body!);
    expect(body.error).toBe('Not Found');
  });

  it('should return 404 when operator tries to access another user\'s sale', async () => {
    // Arrange
    mockGetItem.mockResolvedValueOnce(mockSale); // Created by admin@i2speedex.com

    const event = createEventWithPathParams(
      { id: 'SALE001' },
      createAuthenticatedEvent('operator@i2speedex.com', ['operator'])
    );

    // Act
    const response = await handler(event);

    // Assert
    expect(response.statusCode).toBe(404); // Returns 404 to hide existence

    const body = JSON.parse(response.body!);
    expect(body.error).toBe('Not Found');
  });

  it('should allow admin to access any sale', async () => {
    // Arrange
    mockGetItem.mockResolvedValueOnce(mockSale);
    mockQueryItems.mockResolvedValueOnce({
      items: [mockSaleLine],
      lastEvaluatedKey: undefined,
      count: 1,
    });

    const event = createEventWithPathParams(
      { id: 'SALE001' },
      createAuthenticatedEvent('admin@i2speedex.com', ['admin'])
    );

    // Act
    const response = await handler(event);

    // Assert
    expect(response.statusCode).toBe(200);
  });

  it('should handle DynamoDB error', async () => {
    // Arrange
    mockGetItem.mockRejectedValueOnce(new Error('DynamoDB error'));

    const event = createEventWithPathParams(
      { id: 'SALE001' },
      createAuthenticatedEvent('admin@i2speedex.com')
    );

    // Act
    const response = await handler(event);

    // Assert
    expect(response.statusCode).toBe(500);

    const body = JSON.parse(response.body!);
    expect(body.success).toBe(false);
    expect(body.error).toBe('Internal Server Error');
  });
});
