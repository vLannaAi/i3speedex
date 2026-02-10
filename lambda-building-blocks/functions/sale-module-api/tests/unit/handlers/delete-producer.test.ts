/**
 * Unit tests for delete-producer handler
 */

import { handler } from '../../../src/handlers/producers/delete-producer';
import { createAuthenticatedEvent, createEventWithPathParams } from '../../fixtures/event.fixture';
import { mockProducer, mockSale } from '../../fixtures/sale.fixture';
import * as dynamodb from '../../../src/common/clients/dynamodb';

// Mock DynamoDB client - partial mock to preserve utility functions
jest.mock('../../../src/common/clients/dynamodb', () => ({
  ...jest.requireActual('../../../src/common/clients/dynamodb'),
  getItem: jest.fn(),
  softDelete: jest.fn(),
  queryItems: jest.fn(),
}));

describe('Delete Producer Handler', () => {
  const mockGetItem = dynamodb.getItem as jest.MockedFunction<typeof dynamodb.getItem>;
  const mockSoftDelete = dynamodb.softDelete as jest.MockedFunction<typeof dynamodb.softDelete>;
  const mockQueryItems = dynamodb.queryItems as jest.MockedFunction<typeof dynamodb.queryItems>;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should delete producer successfully when no associated sales', async () => {
    // Arrange
    mockGetItem.mockResolvedValueOnce(mockProducer);
    mockQueryItems.mockResolvedValueOnce({
      items: [], // No associated sales
      lastEvaluatedKey: undefined,
      count: 0,
    });
    mockSoftDelete.mockResolvedValueOnce(undefined);

    const event = createEventWithPathParams(
      { id: 'PROD001' },
      createAuthenticatedEvent('admin@i2speedex.com')
    );

    // Act
    const response = await handler(event);

    // Assert
    expect(response.statusCode).toBe(204);
    expect(response.body).toBe('');

    // Verify producer was checked for associated sales
    expect(mockQueryItems).toHaveBeenCalledWith({
      TableName: expect.any(String),
      IndexName: 'GSI3',
      KeyConditionExpression: 'GSI3PK = :gsi3pk',
      ExpressionAttributeValues: {
        ':gsi3pk': 'PRODUCER#PROD001',
      },
      FilterExpression: 'attribute_not_exists(deletedAt)',
      Limit: 1,
    });

    // Verify producer was soft deleted
    expect(mockSoftDelete).toHaveBeenCalledWith(
      expect.any(String),
      {
        PK: 'PRODUCER#PROD001',
        SK: 'METADATA',
      },
      'admin@i2speedex.com'
    );
  });

  it('should return 403 when producer has associated sales', async () => {
    // Arrange
    mockGetItem.mockResolvedValueOnce(mockProducer);
    mockQueryItems.mockResolvedValueOnce({
      items: [mockSale], // Has associated sales
      lastEvaluatedKey: undefined,
      count: 1,
    });

    const event = createEventWithPathParams(
      { id: 'PROD001' },
      createAuthenticatedEvent('admin@i2speedex.com')
    );

    // Act
    const response = await handler(event);

    // Assert
    expect(response.statusCode).toBe(403);

    const body = JSON.parse(response.body!);
    expect(body.error).toBe('Forbidden');
    expect(body.message).toContain('associated sales');

    // Soft delete should NOT be called
    expect(mockSoftDelete).not.toHaveBeenCalled();
  });

  it('should return 404 when producer not found', async () => {
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

  it('should return 404 when producer is already deleted', async () => {
    // Arrange
    const deletedProducer = {
      ...mockProducer,
      deletedAt: '2026-01-29T12:00:00.000Z',
    };
    mockGetItem.mockResolvedValueOnce(deletedProducer);

    const event = createEventWithPathParams(
      { id: 'PROD001' },
      createAuthenticatedEvent('admin@i2speedex.com')
    );

    // Act
    const response = await handler(event);

    // Assert
    expect(response.statusCode).toBe(404);

    const body = JSON.parse(response.body!);
    expect(body.error).toBe('Not Found');

    // Soft delete should NOT be called
    expect(mockSoftDelete).not.toHaveBeenCalled();
  });

  it('should return 403 when user lacks write permission', async () => {
    // Arrange
    const event = createEventWithPathParams(
      { id: 'PROD001' },
      createAuthenticatedEvent('viewer@i2speedex.com', ['viewer'])
    );

    // Act
    const response = await handler(event);

    // Assert
    expect(response.statusCode).toBe(403);

    const body = JSON.parse(response.body!);
    expect(body.error).toBe('Forbidden');
  });

  it('should handle DynamoDB error', async () => {
    // Arrange
    mockGetItem.mockRejectedValueOnce(new Error('DynamoDB error'));

    const event = createEventWithPathParams(
      { id: 'PROD001' },
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
