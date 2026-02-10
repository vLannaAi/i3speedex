/**
 * Unit tests for get-sale handler
 */

import { handler } from '../../../src/handlers/sales/get-sale';
import { createAuthenticatedEvent, createEventWithPathParams } from '../../fixtures/event.fixture';
import { mockSale } from '../../fixtures/sale.fixture';
import * as dynamodb from '../../../src/common/clients/dynamodb';

// Mock DynamoDB client
jest.mock('../../../src/common/clients/dynamodb');

describe('Get Sale Handler', () => {
  const mockGetItem = dynamodb.getItem as jest.MockedFunction<typeof dynamodb.getItem>;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return sale when found', async () => {
    // Arrange
    mockGetItem.mockResolvedValueOnce(mockSale);

    const event = createEventWithPathParams(
      { id: 'SALE001' },
      createAuthenticatedEvent('admin@i2speedex.com')
    );

    // Act
    const response = await handler(event);

    // Assert
    expect(response.statusCode).toBe(200);

    const body = JSON.parse(response.body);
    expect(body.success).toBe(true);
    expect(body.data).toMatchObject({
      saleId: 'SALE001',
      saleNumber: 1,
      buyerName: 'Acme Corp',
      producerName: 'Factory Inc',
      total: 1220.00,
    });

    // Verify DynamoDB was called correctly
    expect(mockGetItem).toHaveBeenCalledWith({
      TableName: expect.any(String),
      Key: {
        PK: 'SALE#SALE001',
        SK: 'METADATA',
      },
    });
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

    const body = JSON.parse(response.body);
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

    const body = JSON.parse(response.body);
    expect(body.error).toBe('Not Found');
  });

  it('should return 403 when operator tries to access another user\'s sale', async () => {
    // Arrange
    mockGetItem.mockResolvedValueOnce(mockSale);

    const event = createEventWithPathParams(
      { id: 'SALE001' },
      createAuthenticatedEvent('operator@i2speedex.com', ['operator'])
    );

    // Act
    const response = await handler(event);

    // Assert
    expect(response.statusCode).toBe(404); // Returns 404 to hide existence
  });

  it('should allow admin to access any sale', async () => {
    // Arrange
    mockGetItem.mockResolvedValueOnce(mockSale);

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

    const body = JSON.parse(response.body);
    expect(body.success).toBe(false);
    expect(body.error).toBe('Internal Server Error');
  });

  it('should return 500 when sale ID is missing', async () => {
    // Arrange
    const event = createAuthenticatedEvent('admin@i2speedex.com');
    // No pathParameters

    // Act
    const response = await handler(event);

    // Assert
    expect(response.statusCode).toBe(500);

    const body = JSON.parse(response.body);
    expect(body.success).toBe(false);
  });
});
