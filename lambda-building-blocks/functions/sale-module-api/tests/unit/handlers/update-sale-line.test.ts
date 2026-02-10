/**
 * Unit tests for update-sale-line handler
 */

import { handler } from '../../../src/handlers/sales/update-sale-line';
import { createAuthenticatedEvent, createEventWithPathParams, createEventWithBody } from '../../fixtures/event.fixture';
import { mockSale, mockSaleLine } from '../../fixtures/sale.fixture';
import * as dynamodb from '../../../src/common/clients/dynamodb';

// Mock DynamoDB client - partial mock to preserve utility functions
jest.mock('../../../src/common/clients/dynamodb', () => ({
  ...jest.requireActual('../../../src/common/clients/dynamodb'),
  getItem: jest.fn(),
  updateItem: jest.fn(),
  queryItems: jest.fn(),
}));

describe('Update Sale Line Handler', () => {
  const mockGetItem = dynamodb.getItem as jest.MockedFunction<typeof dynamodb.getItem>;
  const mockUpdateItem = dynamodb.updateItem as jest.MockedFunction<typeof dynamodb.updateItem>;
  const mockQueryItems = dynamodb.queryItems as jest.MockedFunction<typeof dynamodb.queryItems>;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should update sale line successfully', async () => {
    // Arrange
    mockGetItem
      .mockResolvedValueOnce(mockSale)      // Get sale
      .mockResolvedValueOnce(mockSaleLine); // Get line

    const updatedLine = {
      ...mockSaleLine,
      productDescription: 'Updated Product',
      updatedAt: '2026-01-30T12:00:00.000Z',
    };
    mockUpdateItem.mockResolvedValueOnce(updatedLine);

    const requestBody = {
      productDescription: 'Updated Product',
    };

    const event = createEventWithBody(
      requestBody,
      createEventWithPathParams(
        { id: 'SALE001', lineId: 'LINE001' },
        createAuthenticatedEvent('admin@i2speedex.com')
      )
    );

    // Act
    const response = await handler(event);

    // Assert
    expect(response.statusCode).toBe(200);

    const body = JSON.parse(response.body!);
    expect(body.success).toBe(true);
    expect(body.data.productDescription).toBe('Updated Product');

    // Verify line was updated
    expect(mockUpdateItem).toHaveBeenCalledWith(
      expect.objectContaining({
        TableName: expect.any(String),
        Key: {
          PK: 'SALE#SALE001',
          SK: 'LINE#LINE001',
        },
      })
    );
  });

  it('should recalculate amounts when quantity changes', async () => {
    // Arrange
    mockGetItem
      .mockResolvedValueOnce(mockSale)
      .mockResolvedValueOnce(mockSaleLine);

    const updatedLine = {
      ...mockSaleLine,
      quantity: 20, // Changed from 10
      netAmount: 2000.00,
      taxAmount: 440.00,
      totalAmount: 2440.00,
    };
    mockUpdateItem.mockResolvedValueOnce(updatedLine);

    mockQueryItems.mockResolvedValueOnce({
      items: [updatedLine],
      lastEvaluatedKey: undefined,
      count: 1,
    });

    mockUpdateItem.mockResolvedValueOnce(undefined); // Sale totals update

    const requestBody = {
      quantity: 20,
    };

    const event = createEventWithBody(
      requestBody,
      createEventWithPathParams(
        { id: 'SALE001', lineId: 'LINE001' },
        createAuthenticatedEvent('admin@i2speedex.com')
      )
    );

    // Act
    const response = await handler(event);

    // Assert
    expect(response.statusCode).toBe(200);

    const body = JSON.parse(response.body!);
    expect(body.data.quantity).toBe(20);
    expect(body.data.netAmount).toBe(2000.00);
    expect(body.data.taxAmount).toBe(440.00);
    expect(body.data.totalAmount).toBe(2440.00);

    // Verify sale totals were recalculated
    expect(mockQueryItems).toHaveBeenCalled();
    expect(mockUpdateItem).toHaveBeenCalledTimes(2); // Line update + sale totals update
  });

  it('should recalculate amounts with discount', async () => {
    // Arrange
    mockGetItem
      .mockResolvedValueOnce(mockSale)
      .mockResolvedValueOnce(mockSaleLine);

    const updatedLine = {
      ...mockSaleLine,
      discount: 10, // Add 10% discount
      discountAmount: 100.00,
      netAmount: 900.00,
      taxAmount: 198.00,
      totalAmount: 1098.00,
    };
    mockUpdateItem.mockResolvedValueOnce(updatedLine);

    mockQueryItems.mockResolvedValueOnce({
      items: [updatedLine],
      lastEvaluatedKey: undefined,
      count: 1,
    });

    mockUpdateItem.mockResolvedValueOnce(undefined); // Sale totals update

    const requestBody = {
      discount: 10,
    };

    const event = createEventWithBody(
      requestBody,
      createEventWithPathParams(
        { id: 'SALE001', lineId: 'LINE001' },
        createAuthenticatedEvent('admin@i2speedex.com')
      )
    );

    // Act
    const response = await handler(event);

    // Assert
    expect(response.statusCode).toBe(200);

    const body = JSON.parse(response.body!);
    expect(body.data.discountAmount).toBe(100.00);
    expect(body.data.netAmount).toBe(900.00);
    expect(body.data.taxAmount).toBe(198.00);
    expect(body.data.totalAmount).toBe(1098.00);
  });

  it('should return existing line when no updates provided', async () => {
    // Arrange
    mockGetItem
      .mockResolvedValueOnce(mockSale)
      .mockResolvedValueOnce(mockSaleLine);

    const event = createEventWithBody(
      {}, // No updates
      createEventWithPathParams(
        { id: 'SALE001', lineId: 'LINE001' },
        createAuthenticatedEvent('admin@i2speedex.com')
      )
    );

    // Act
    const response = await handler(event);

    // Assert
    expect(response.statusCode).toBe(200);

    const body = JSON.parse(response.body!);
    expect(body.data.lineId).toBe('LINE001');

    // updateItem should NOT be called
    expect(mockUpdateItem).not.toHaveBeenCalled();
  });

  it('should return 404 when sale not found', async () => {
    // Arrange
    mockGetItem.mockResolvedValueOnce(null);

    const requestBody = {
      productDescription: 'Updated',
    };

    const event = createEventWithBody(
      requestBody,
      createEventWithPathParams(
        { id: 'NONEXISTENT', lineId: 'LINE001' },
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

  it('should return 404 when line not found', async () => {
    // Arrange
    mockGetItem
      .mockResolvedValueOnce(mockSale)
      .mockResolvedValueOnce(null); // Line not found

    const requestBody = {
      productDescription: 'Updated',
    };

    const event = createEventWithBody(
      requestBody,
      createEventWithPathParams(
        { id: 'SALE001', lineId: 'NONEXISTENT' },
        createAuthenticatedEvent('admin@i2speedex.com')
      )
    );

    // Act
    const response = await handler(event);

    // Assert
    expect(response.statusCode).toBe(404);

    const body = JSON.parse(response.body!);
    expect(body.message).toContain('Line');
  });

  it('should return 404 when line is soft deleted', async () => {
    // Arrange
    const deletedLine = {
      ...mockSaleLine,
      deletedAt: '2026-01-29T12:00:00.000Z',
    };

    mockGetItem
      .mockResolvedValueOnce(mockSale)
      .mockResolvedValueOnce(deletedLine);

    const requestBody = {
      productDescription: 'Updated',
    };

    const event = createEventWithBody(
      requestBody,
      createEventWithPathParams(
        { id: 'SALE001', lineId: 'LINE001' },
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
    const requestBody = {
      productDescription: 'Updated',
    };

    const event = createEventWithBody(
      requestBody,
      createEventWithPathParams(
        { id: 'SALE001', lineId: 'LINE001' },
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

  it('should return 403 when operator tries to modify another user\'s sale', async () => {
    // Arrange
    mockGetItem.mockResolvedValueOnce(mockSale); // Created by admin@i2speedex.com

    const requestBody = {
      productDescription: 'Updated',
    };

    const event = createEventWithBody(
      requestBody,
      createEventWithPathParams(
        { id: 'SALE001', lineId: 'LINE001' },
        createAuthenticatedEvent('operator@i2speedex.com', ['operator'])
      )
    );

    // Act
    const response = await handler(event);

    // Assert
    expect(response.statusCode).toBe(403);

    const body = JSON.parse(response.body!);
    expect(body.error).toBe('Forbidden');
    expect(body.message).toContain('permission');
  });

  it('should return 403 when trying to update line in invoiced sale', async () => {
    // Arrange
    const invoicedSale = {
      ...mockSale,
      status: 'invoiced' as const,
      invoiceGenerated: true,
    };
    mockGetItem.mockResolvedValueOnce(invoicedSale);

    const requestBody = {
      productDescription: 'Updated',
    };

    const event = createEventWithBody(
      requestBody,
      createEventWithPathParams(
        { id: 'SALE001', lineId: 'LINE001' },
        createAuthenticatedEvent('admin@i2speedex.com')
      )
    );

    // Act
    const response = await handler(event);

    // Assert
    expect(response.statusCode).toBe(403);

    const body = JSON.parse(response.body!);
    expect(body.error).toBe('Forbidden');
    expect(body.message).toContain('invoiced');
  });

  it('should handle DynamoDB error', async () => {
    // Arrange
    mockGetItem.mockRejectedValueOnce(new Error('DynamoDB error'));

    const requestBody = {
      productDescription: 'Updated',
    };

    const event = createEventWithBody(
      requestBody,
      createEventWithPathParams(
        { id: 'SALE001', lineId: 'LINE001' },
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
