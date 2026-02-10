/**
 * Unit tests for update-buyer handler
 */

import { handler } from '../../../src/handlers/buyers/update-buyer';
import { createAuthenticatedEvent, createEventWithPathParams, createEventWithBody } from '../../fixtures/event.fixture';
import { mockBuyer } from '../../fixtures/sale.fixture';
import * as dynamodb from '../../../src/common/clients/dynamodb';

// Mock DynamoDB client - partial mock to preserve utility functions
jest.mock('../../../src/common/clients/dynamodb', () => ({
  ...jest.requireActual('../../../src/common/clients/dynamodb'),
  getItem: jest.fn(),
  updateItem: jest.fn(),
}));

describe('Update Buyer Handler', () => {
  const mockGetItem = dynamodb.getItem as jest.MockedFunction<typeof dynamodb.getItem>;
  const mockUpdateItem = dynamodb.updateItem as jest.MockedFunction<typeof dynamodb.updateItem>;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should update buyer successfully', async () => {
    // Arrange
    mockGetItem.mockResolvedValueOnce(mockBuyer);
    mockUpdateItem.mockResolvedValueOnce({
      ...mockBuyer,
      email: 'newemail@example.com',
      updatedAt: '2026-01-30T12:00:00.000Z',
    });

    const requestBody = {
      email: 'newemail@example.com',
    };

    const event = createEventWithBody(
      requestBody,
      createEventWithPathParams(
        { id: 'BUYER001' },
        createAuthenticatedEvent('admin@i2speedex.com')
      )
    );

    // Act
    const response = await handler(event);

    // Assert
    expect(response.statusCode).toBe(200);

    const body = JSON.parse(response.body!);
    expect(body.success).toBe(true);
    expect(body.data.email).toBe('newemail@example.com');

    // Verify DynamoDB was called
    expect(mockGetItem).toHaveBeenCalledWith({
      TableName: expect.any(String),
      Key: {
        PK: 'BUYER#BUYER001',
        SK: 'METADATA',
      },
    });

    expect(mockUpdateItem).toHaveBeenCalled();
  });

  it('should return 404 when buyer not found', async () => {
    // Arrange
    mockGetItem.mockResolvedValueOnce(null);

    const event = createEventWithBody(
      { email: 'test@example.com' },
      createEventWithPathParams(
        { id: 'NONEXISTENT' },
        createAuthenticatedEvent('admin@i2speedex.com')
      )
    );

    // Act
    const response = await handler(event);

    // Assert
    expect(response.statusCode).toBe(404);

    const body = JSON.parse(response.body!);
    expect(body.success).toBe(false);
    expect(body.error).toBe('Not Found');
  });

  it('should return 404 when buyer is soft deleted', async () => {
    // Arrange
    const deletedBuyer = {
      ...mockBuyer,
      deletedAt: '2026-01-29T12:00:00.000Z',
    };
    mockGetItem.mockResolvedValueOnce(deletedBuyer);

    const event = createEventWithBody(
      { email: 'test@example.com' },
      createEventWithPathParams(
        { id: 'BUYER001' },
        createAuthenticatedEvent('admin@i2speedex.com')
      )
    );

    // Act
    const response = await handler(event);

    // Assert
    expect(response.statusCode).toBe(404);

    const body = JSON.parse(response.body!);
    expect(body.error).toBe('Not Found');
  });

  it('should return 403 when user lacks write permission', async () => {
    // Arrange
    const event = createEventWithBody(
      { email: 'test@example.com' },
      createEventWithPathParams(
        { id: 'BUYER001' },
        createAuthenticatedEvent('viewer@i2speedex.com', ['viewer'])
      )
    );

    // Act
    const response = await handler(event);

    // Assert
    expect(response.statusCode).toBe(403);

    const body = JSON.parse(response.body!);
    expect(body.error).toBe('Forbidden');
  });

  it('should return existing buyer when no updates provided', async () => {
    // Arrange
    mockGetItem.mockResolvedValueOnce(mockBuyer);

    const event = createEventWithBody(
      {}, // No updates
      createEventWithPathParams(
        { id: 'BUYER001' },
        createAuthenticatedEvent('admin@i2speedex.com')
      )
    );

    // Act
    const response = await handler(event);

    // Assert
    expect(response.statusCode).toBe(200);

    const body = JSON.parse(response.body!);
    expect(body.data.buyerId).toBe('BUYER001');

    // updateItem should NOT be called
    expect(mockUpdateItem).not.toHaveBeenCalled();
  });

  it('should handle DynamoDB error', async () => {
    // Arrange
    mockGetItem.mockRejectedValueOnce(new Error('DynamoDB error'));

    const event = createEventWithBody(
      { email: 'test@example.com' },
      createEventWithPathParams(
        { id: 'BUYER001' },
        createAuthenticatedEvent('admin@i2speedex.com')
      )
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
