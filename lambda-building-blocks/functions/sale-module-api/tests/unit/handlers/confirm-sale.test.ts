/**
 * Unit tests for confirm-sale handler
 */

import { handler } from '../../../src/handlers/sales/confirm-sale';
import { createAuthenticatedEvent, createEventWithPathParams } from '../../fixtures/event.fixture';
import { mockSale, mockSaleLine } from '../../fixtures/sale.fixture';
import * as dynamodb from '../../../src/common/clients/dynamodb';

// Mock DynamoDB client - partial mock to preserve utility functions
jest.mock('../../../src/common/clients/dynamodb', () => ({
  ...jest.requireActual('../../../src/common/clients/dynamodb'),
  getItem: jest.fn(),
  updateItem: jest.fn(),
  queryItems: jest.fn(),
}));

describe('Confirm Sale Handler', () => {
  const mockGetItem = dynamodb.getItem as jest.MockedFunction<typeof dynamodb.getItem>;
  const mockUpdateItem = dynamodb.updateItem as jest.MockedFunction<typeof dynamodb.updateItem>;
  const mockQueryItems = dynamodb.queryItems as jest.MockedFunction<typeof dynamodb.queryItems>;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should confirm sale successfully', async () => {
    // Arrange
    const draftSale = {
      ...mockSale,
      status: 'draft' as const,
      linesCount: 1,
    };

    mockGetItem.mockResolvedValueOnce(draftSale);

    mockQueryItems.mockResolvedValueOnce({
      items: [mockSaleLine],
      lastEvaluatedKey: undefined,
      count: 1,
    });

    const confirmedSale = {
      ...draftSale,
      status: 'confirmed' as const,
      updatedAt: '2026-01-30T12:00:00.000Z',
    };
    mockUpdateItem.mockResolvedValueOnce(confirmedSale);

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
    expect(body.data.status).toBe('confirmed');

    // Verify status was updated
    expect(mockUpdateItem).toHaveBeenCalledWith(
      expect.objectContaining({
        UpdateExpression: expect.stringContaining('status'),
        ExpressionAttributeValues: expect.objectContaining({
          ':status': 'confirmed',
          ':gsi1pk': 'STATUS#confirmed',
        }),
      })
    );
  });

  it('should recalculate totals if they do not match', async () => {
    // Arrange
    const draftSale = {
      ...mockSale,
      status: 'draft' as const,
      linesCount: 1,
      subtotal: 900.00, // Incorrect - should be 1000.00
      taxAmount: 198.00, // Incorrect - should be 220.00
      total: 1098.00, // Incorrect - should be 1220.00
    };

    mockGetItem.mockResolvedValueOnce(draftSale);

    mockQueryItems.mockResolvedValueOnce({
      items: [mockSaleLine], // Has correct amounts
      lastEvaluatedKey: undefined,
      count: 1,
    });

    mockUpdateItem
      .mockResolvedValueOnce(undefined) // Totals recalculation
      .mockResolvedValueOnce({ ...draftSale, status: 'confirmed' }); // Status update

    const event = createEventWithPathParams(
      { id: 'SALE001' },
      createAuthenticatedEvent('admin@i2speedex.com')
    );

    // Act
    const response = await handler(event);

    // Assert
    expect(response.statusCode).toBe(200);

    // Verify totals were recalculated first
    expect(mockUpdateItem).toHaveBeenCalledTimes(2);
    expect(mockUpdateItem).toHaveBeenNthCalledWith(1,
      expect.objectContaining({
        UpdateExpression: expect.stringContaining('subtotal'),
        ExpressionAttributeValues: expect.objectContaining({
          ':subtotal': 1000.00, // Corrected
          ':taxAmount': 220.00, // Corrected
          ':total': 1220.00, // Corrected
        }),
      })
    );

    // Then status was updated
    expect(mockUpdateItem).toHaveBeenNthCalledWith(2,
      expect.objectContaining({
        ExpressionAttributeValues: expect.objectContaining({
          ':status': 'confirmed',
        }),
      })
    );
  });

  it('should return 422 when sale is already confirmed', async () => {
    // Arrange
    const confirmedSale = {
      ...mockSale,
      status: 'confirmed' as const,
    };
    mockGetItem.mockResolvedValueOnce(confirmedSale);

    const event = createEventWithPathParams(
      { id: 'SALE001' },
      createAuthenticatedEvent('admin@i2speedex.com')
    );

    // Act
    const response = await handler(event);

    // Assert
    expect(response.statusCode).toBe(422);

    const body = JSON.parse(response.body!);
    expect(body.error).toBe('Validation Error');
    expect(body.message).toContain('already confirmed');
  });

  it('should return 422 when sale has no lines', async () => {
    // Arrange
    const draftSale = {
      ...mockSale,
      status: 'draft' as const,
      linesCount: 0,
    };
    mockGetItem.mockResolvedValueOnce(draftSale);

    const event = createEventWithPathParams(
      { id: 'SALE001' },
      createAuthenticatedEvent('admin@i2speedex.com')
    );

    // Act
    const response = await handler(event);

    // Assert
    expect(response.statusCode).toBe(422);

    const body = JSON.parse(response.body!);
    expect(body.error).toBe('Validation Error');
    expect(body.message).toContain('no lines');
  });

  it('should return 422 when linesCount does not match actual lines', async () => {
    // Arrange
    const draftSale = {
      ...mockSale,
      status: 'draft' as const,
      linesCount: 1, // Says 1 line
    };

    mockGetItem.mockResolvedValueOnce(draftSale);

    // But no lines exist
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
    expect(response.statusCode).toBe(422);

    const body = JSON.parse(response.body!);
    expect(body.error).toBe('Validation Error');
    expect(body.message).toContain('no lines');
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

  it('should return 403 when operator tries to confirm another user\'s sale', async () => {
    // Arrange
    const draftSale = {
      ...mockSale,
      status: 'draft' as const,
      createdBy: 'admin@i2speedex.com', // Created by admin
    };
    mockGetItem.mockResolvedValueOnce(draftSale);

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

  it('should allow admin to confirm any sale', async () => {
    // Arrange
    const draftSale = {
      ...mockSale,
      status: 'draft' as const,
      linesCount: 1,
      createdBy: 'operator@i2speedex.com',
    };

    mockGetItem.mockResolvedValueOnce(draftSale);
    mockQueryItems.mockResolvedValueOnce({
      items: [mockSaleLine],
      lastEvaluatedKey: undefined,
      count: 1,
    });
    mockUpdateItem.mockResolvedValueOnce({ ...draftSale, status: 'confirmed' });

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
