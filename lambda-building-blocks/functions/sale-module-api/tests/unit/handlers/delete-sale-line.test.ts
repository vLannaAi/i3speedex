/**
 * Unit tests for delete-sale-line handler
 */

import { handler } from '../../../src/handlers/sales/delete-sale-line';
import { createAuthenticatedEvent, createEventWithPathParams } from '../../fixtures/event.fixture';
import { mockSale, mockSaleLine } from '../../fixtures/sale.fixture';
import * as dynamodb from '../../../src/common/clients/dynamodb';

// Mock DynamoDB client - partial mock to preserve utility functions
jest.mock('../../../src/common/clients/dynamodb', () => ({
  ...jest.requireActual('../../../src/common/clients/dynamodb'),
  getItem: jest.fn(),
  softDelete: jest.fn(),
  queryItems: jest.fn(),
  updateItem: jest.fn(),
}));

describe('Delete Sale Line Handler', () => {
  const mockGetItem = dynamodb.getItem as jest.MockedFunction<typeof dynamodb.getItem>;
  const mockSoftDelete = dynamodb.softDelete as jest.MockedFunction<typeof dynamodb.softDelete>;
  const mockQueryItems = dynamodb.queryItems as jest.MockedFunction<typeof dynamodb.queryItems>;
  const mockUpdateItem = dynamodb.updateItem as jest.MockedFunction<typeof dynamodb.updateItem>;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should delete sale line successfully', async () => {
    // Arrange
    mockGetItem
      .mockResolvedValueOnce(mockSale)      // Get sale
      .mockResolvedValueOnce(mockSaleLine); // Get line

    mockSoftDelete.mockResolvedValueOnce(undefined);

    // Remaining lines after deletion (empty in this case)
    mockQueryItems.mockResolvedValueOnce({
      items: [],
      lastEvaluatedKey: undefined,
      count: 0,
    });

    mockUpdateItem.mockResolvedValueOnce(undefined);

    const event = createEventWithPathParams(
      { id: 'SALE001', lineId: 'LINE001' },
      createAuthenticatedEvent('admin@i2speedex.com')
    );

    // Act
    const response = await handler(event);

    // Assert
    expect(response.statusCode).toBe(204);
    expect(response.body).toBe('');

    // Verify line was soft deleted
    expect(mockSoftDelete).toHaveBeenCalledWith(
      expect.any(String),
      {
        PK: 'SALE#SALE001',
        SK: 'LINE#LINE001',
      },
      'admin@i2speedex.com'
    );

    // Verify sale totals were recalculated
    expect(mockQueryItems).toHaveBeenCalled();
    expect(mockUpdateItem).toHaveBeenCalledWith(
      expect.objectContaining({
        ExpressionAttributeValues: expect.objectContaining({
          ':subtotal': 0,
          ':taxAmount': 0,
          ':total': 0,
          ':linesCount': 0,
        }),
      })
    );
  });

  it('should recalculate totals with remaining lines', async () => {
    // Arrange
    const line2 = {
      ...mockSaleLine,
      lineId: 'LINE002',
      lineNumber: 2,
      netAmount: 500.00,
      taxAmount: 110.00,
      totalAmount: 610.00,
    };

    mockGetItem
      .mockResolvedValueOnce(mockSale)
      .mockResolvedValueOnce(mockSaleLine);

    mockSoftDelete.mockResolvedValueOnce(undefined);

    // One remaining line after deletion
    mockQueryItems.mockResolvedValueOnce({
      items: [line2],
      lastEvaluatedKey: undefined,
      count: 1,
    });

    mockUpdateItem.mockResolvedValueOnce(undefined);

    const event = createEventWithPathParams(
      { id: 'SALE001', lineId: 'LINE001' },
      createAuthenticatedEvent('admin@i2speedex.com')
    );

    // Act
    const response = await handler(event);

    // Assert
    expect(response.statusCode).toBe(204);

    // Verify sale totals were updated with remaining line
    expect(mockUpdateItem).toHaveBeenCalledWith(
      expect.objectContaining({
        ExpressionAttributeValues: expect.objectContaining({
          ':subtotal': 500.00,
          ':taxAmount': 110.00,
          ':total': 610.00,
          ':linesCount': 1,
        }),
      })
    );
  });

  it('should return 404 when sale not found', async () => {
    // Arrange
    mockGetItem.mockResolvedValueOnce(null);

    const event = createEventWithPathParams(
      { id: 'NONEXISTENT', lineId: 'LINE001' },
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

  it('should return 404 when line not found', async () => {
    // Arrange
    mockGetItem
      .mockResolvedValueOnce(mockSale)
      .mockResolvedValueOnce(null); // Line not found

    const event = createEventWithPathParams(
      { id: 'SALE001', lineId: 'NONEXISTENT' },
      createAuthenticatedEvent('admin@i2speedex.com')
    );

    // Act
    const response = await handler(event);

    // Assert
    expect(response.statusCode).toBe(404);

    const body = JSON.parse(response.body!);
    expect(body.message).toContain('Line');
  });

  it('should return 404 when line is already deleted', async () => {
    // Arrange
    const deletedLine = {
      ...mockSaleLine,
      deletedAt: '2026-01-29T12:00:00.000Z',
    };

    mockGetItem
      .mockResolvedValueOnce(mockSale)
      .mockResolvedValueOnce(deletedLine);

    const event = createEventWithPathParams(
      { id: 'SALE001', lineId: 'LINE001' },
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
      { id: 'SALE001', lineId: 'LINE001' },
      createAuthenticatedEvent('viewer@i2speedex.com', ['viewer'])
    );

    // Act
    const response = await handler(event);

    // Assert
    expect(response.statusCode).toBe(403);

    const body = JSON.parse(response.body!);
    expect(body.error).toBe('Forbidden');
  });

  it('should return 403 when operator tries to modify another user\'s sale', async () => {
    // Arrange
    mockGetItem.mockResolvedValueOnce(mockSale); // Created by admin@i2speedex.com

    const event = createEventWithPathParams(
      { id: 'SALE001', lineId: 'LINE001' },
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

  it('should return 403 when trying to delete line from invoiced sale', async () => {
    // Arrange
    const invoicedSale = {
      ...mockSale,
      status: 'invoiced' as const,
      invoiceGenerated: true,
    };
    mockGetItem.mockResolvedValueOnce(invoicedSale);

    const event = createEventWithPathParams(
      { id: 'SALE001', lineId: 'LINE001' },
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
      { id: 'SALE001', lineId: 'LINE001' },
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
