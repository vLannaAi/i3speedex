/**
 * Unit tests for get-buyer handler
 */

import { handler } from '../../../src/handlers/buyers/get-buyer';
import { createAuthenticatedEvent, createEventWithPathParams } from '../../fixtures/event.fixture';
import { mockBuyer } from '../../fixtures/sale.fixture';
import * as dynamodb from '../../../src/common/clients/dynamodb';

// Mock DynamoDB client - partial mock to preserve utility functions
jest.mock('../../../src/common/clients/dynamodb', () => ({
  ...jest.requireActual('../../../src/common/clients/dynamodb'),
  getItem: jest.fn(),
}));

describe('Get Buyer Handler', () => {
  const mockGetItem = dynamodb.getItem as jest.MockedFunction<typeof dynamodb.getItem>;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return buyer when found', async () => {
    // Arrange
    mockGetItem.mockResolvedValueOnce(mockBuyer);

    const event = createEventWithPathParams(
      { id: 'BUYER001' },
      createAuthenticatedEvent('admin@i2speedex.com')
    );

    // Act
    const response = await handler(event);

    // Assert
    expect(response.statusCode).toBe(200);

    const body = JSON.parse(response.body!);
    expect(body.success).toBe(true);
    expect(body.data).toMatchObject({
      buyerId: 'BUYER001',
      companyName: 'Acme Corp',
      vatNumber: 'IT12345678901',
    });

    // Verify DynamoDB was called correctly
    expect(mockGetItem).toHaveBeenCalledWith({
      TableName: expect.any(String),
      Key: {
        PK: 'BUYER#BUYER001',
        SK: 'METADATA',
      },
    });
  });

  it('should return 404 when buyer not found', async () => {
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

  it('should return 404 when buyer is soft deleted', async () => {
    // Arrange
    const deletedBuyer = {
      ...mockBuyer,
      deletedAt: '2026-01-29T12:00:00.000Z',
    };
    mockGetItem.mockResolvedValueOnce(deletedBuyer);

    const event = createEventWithPathParams(
      { id: 'BUYER001' },
      createAuthenticatedEvent('admin@i2speedex.com')
    );

    // Act
    const response = await handler(event);

    // Assert
    expect(response.statusCode).toBe(404);

    const body = JSON.parse(response.body!);
    expect(body.error).toBe('Not Found');
  });

  it('should handle DynamoDB error', async () => {
    // Arrange
    mockGetItem.mockRejectedValueOnce(new Error('DynamoDB error'));

    const event = createEventWithPathParams(
      { id: 'BUYER001' },
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
