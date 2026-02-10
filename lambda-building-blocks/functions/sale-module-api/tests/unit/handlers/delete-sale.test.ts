/**
 * Unit tests for delete-sale handler
 */

import { handler } from '../../../src/handlers/sales/delete-sale';
import { createAuthenticatedEvent, createEventWithPathParams } from '../../fixtures/event.fixture';
import { mockSale } from '../../fixtures/sale.fixture';
import * as dynamodb from '../../../src/common/clients/dynamodb';

// Mock DynamoDB client - partial mock to preserve utility functions
jest.mock('../../../src/common/clients/dynamodb', () => ({
  ...jest.requireActual('../../../src/common/clients/dynamodb'),
  getItem: jest.fn(),
  softDelete: jest.fn(),
}));

describe('Delete Sale Handler', () => {
  const mockGetItem = dynamodb.getItem as jest.MockedFunction<typeof dynamodb.getItem>;
  const mockSoftDelete = dynamodb.softDelete as jest.MockedFunction<typeof dynamodb.softDelete>;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should delete sale successfully', async () => {
    // Arrange
    mockGetItem.mockResolvedValueOnce(mockSale);
    mockSoftDelete.mockResolvedValueOnce(undefined);

    const event = createEventWithPathParams(
      { id: 'SALE001' },
      createAuthenticatedEvent('admin@i2speedex.com')
    );

    // Act
    const response = await handler(event);

    // Assert
    expect(response.statusCode).toBe(204);
    expect(response.body).toBe('');

    // Verify DynamoDB was called correctly
    expect(mockGetItem).toHaveBeenCalledWith({
      TableName: expect.any(String),
      Key: {
        PK: 'SALE#SALE001',
        SK: 'METADATA',
      },
    });

    expect(mockSoftDelete).toHaveBeenCalledWith(
      expect.any(String),
      {
        PK: 'SALE#SALE001',
        SK: 'METADATA',
      },
      'admin@i2speedex.com'
    );
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

  it('should return 404 when sale is already deleted', async () => {
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

    // Soft delete should NOT be called
    expect(mockSoftDelete).not.toHaveBeenCalled();
  });

  it('should return 403 when user lacks write permission', async () => {
    // Arrange
    const event = createEventWithPathParams(
      { id: 'SALE001' },
      createAuthenticatedEvent('viewer@i2speedex.com', ['viewer'])
    );

    // Act
    const response = await handler(event);

    // Assert
    expect(response.statusCode).toBe(403);

    const body = JSON.parse(response.body!);
    expect(body.error).toBe('Forbidden');
  });

  it('should return 403 when operator tries to delete another user\'s sale', async () => {
    // Arrange
    mockGetItem.mockResolvedValueOnce(mockSale); // Created by admin@i2speedex.com

    const event = createEventWithPathParams(
      { id: 'SALE001' },
      createAuthenticatedEvent('operator@i2speedex.com', ['operator'])
    );

    // Act
    const response = await handler(event);

    // Assert
    expect(response.statusCode).toBe(403);

    const body = JSON.parse(response.body!);
    expect(body.error).toBe('Forbidden');
    expect(body.message).toContain('permission');
  });

  it('should allow admin to delete any sale', async () => {
    // Arrange
    mockGetItem.mockResolvedValueOnce(mockSale);
    mockSoftDelete.mockResolvedValueOnce(undefined);

    const event = createEventWithPathParams(
      { id: 'SALE001' },
      createAuthenticatedEvent('admin@i2speedex.com', ['admin'])
    );

    // Act
    const response = await handler(event);

    // Assert
    expect(response.statusCode).toBe(204);
  });

  it('should return 403 when trying to delete invoiced sale', async () => {
    // Arrange
    const invoicedSale = {
      ...mockSale,
      status: 'invoiced' as const,
      invoiceGenerated: true,
    };
    mockGetItem.mockResolvedValueOnce(invoicedSale);

    const event = createEventWithPathParams(
      { id: 'SALE001' },
      createAuthenticatedEvent('admin@i2speedex.com')
    );

    // Act
    const response = await handler(event);

    // Assert
    expect(response.statusCode).toBe(403);

    const body = JSON.parse(response.body!);
    expect(body.error).toBe('Forbidden');
    expect(body.message).toContain('invoiced');

    // Soft delete should NOT be called
    expect(mockSoftDelete).not.toHaveBeenCalled();
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
