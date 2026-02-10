/**
 * Unit tests for create-sale-line handler
 */

import { handler } from '../../../src/handlers/sales/create-sale-line';
import { createAuthenticatedEvent, createEventWithPathParams, createEventWithBody } from '../../fixtures/event.fixture';
import { mockSale, mockSaleLine } from '../../fixtures/sale.fixture';
import * as dynamodb from '../../../src/common/clients/dynamodb';

// Mock DynamoDB client - partial mock to preserve utility functions
jest.mock('../../../src/common/clients/dynamodb', () => ({
  ...jest.requireActual('../../../src/common/clients/dynamodb'),
  getItem: jest.fn(),
  putItem: jest.fn(),
  queryItems: jest.fn(),
  updateItem: jest.fn(),
}));

// Mock uuid
jest.mock('uuid', () => ({
  v4: jest.fn(() => 'LINE001'),
}));

describe('Create Sale Line Handler', () => {
  const mockGetItem = dynamodb.getItem as jest.MockedFunction<typeof dynamodb.getItem>;
  const mockPutItem = dynamodb.putItem as jest.MockedFunction<typeof dynamodb.putItem>;
  const mockQueryItems = dynamodb.queryItems as jest.MockedFunction<typeof dynamodb.queryItems>;
  const mockUpdateItem = dynamodb.updateItem as jest.MockedFunction<typeof dynamodb.updateItem>;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should create sale line successfully', async () => {
    // Arrange
    mockGetItem.mockResolvedValueOnce(mockSale);
    mockQueryItems.mockResolvedValueOnce({
      items: [], // No existing lines
      lastEvaluatedKey: undefined,
      count: 0,
    });
    mockPutItem.mockResolvedValueOnce(undefined);
    mockUpdateItem.mockResolvedValueOnce(undefined);

    const requestBody = {
      productDescription: 'Product A',
      quantity: 10,
      unitPrice: 100.00,
      taxRate: 22,
    };

    const event = createEventWithBody(
      requestBody,
      createEventWithPathParams(
        { id: 'SALE001' },
        createAuthenticatedEvent('admin@i2speedex.com')
      )
    );

    // Act
    const response = await handler(event);

    // Assert
    expect(response.statusCode).toBe(201);

    const body = JSON.parse(response.body!);
    expect(body.success).toBe(true);
    expect(body.data).toMatchObject({
      saleId: 'SALE001',
      lineId: 'LINE001',
      lineNumber: 1,
      productDescription: 'Product A',
      quantity: 10,
      unitPrice: 100.00,
      taxRate: 22,
      netAmount: 1000.00,
      taxAmount: 220.00,
      totalAmount: 1220.00,
    });

    // Verify sale was fetched
    expect(mockGetItem).toHaveBeenCalledWith({
      TableName: expect.any(String),
      Key: {
        PK: 'SALE#SALE001',
        SK: 'METADATA',
      },
    });

    // Verify existing lines were queried
    expect(mockQueryItems).toHaveBeenCalled();

    // Verify line was saved
    expect(mockPutItem).toHaveBeenCalled();

    // Verify sale totals were updated
    expect(mockUpdateItem).toHaveBeenCalled();
  });

  it('should calculate line number correctly when lines exist', async () => {
    // Arrange
    const existingLines = [
      { ...mockSaleLine, lineNumber: 1 },
      { ...mockSaleLine, lineId: 'LINE002', lineNumber: 2 },
    ];

    mockGetItem.mockResolvedValueOnce(mockSale);
    mockQueryItems.mockResolvedValueOnce({
      items: existingLines,
      lastEvaluatedKey: undefined,
      count: 2,
    });
    mockPutItem.mockResolvedValueOnce(undefined);
    mockUpdateItem.mockResolvedValueOnce(undefined);

    const requestBody = {
      productDescription: 'Product C',
      quantity: 5,
      unitPrice: 50.00,
      taxRate: 22,
    };

    const event = createEventWithBody(
      requestBody,
      createEventWithPathParams(
        { id: 'SALE001' },
        createAuthenticatedEvent('admin@i2speedex.com')
      )
    );

    // Act
    const response = await handler(event);

    // Assert
    expect(response.statusCode).toBe(201);

    const body = JSON.parse(response.body!);
    expect(body.data.lineNumber).toBe(3); // Next number after 2
  });

  it('should calculate amounts with discount', async () => {
    // Arrange
    mockGetItem.mockResolvedValueOnce(mockSale);
    mockQueryItems.mockResolvedValueOnce({
      items: [],
      lastEvaluatedKey: undefined,
      count: 0,
    });
    mockPutItem.mockResolvedValueOnce(undefined);
    mockUpdateItem.mockResolvedValueOnce(undefined);

    const requestBody = {
      productDescription: 'Product with discount',
      quantity: 10,
      unitPrice: 100.00,
      discount: 10, // 10% discount
      taxRate: 22,
    };

    const event = createEventWithBody(
      requestBody,
      createEventWithPathParams(
        { id: 'SALE001' },
        createAuthenticatedEvent('admin@i2speedex.com')
      )
    );

    // Act
    const response = await handler(event);

    // Assert
    expect(response.statusCode).toBe(201);

    const body = JSON.parse(response.body!);
    expect(body.data.discountAmount).toBe(100.00); // 10% of 1000
    expect(body.data.netAmount).toBe(900.00); // 1000 - 100
    expect(body.data.taxAmount).toBe(198.00); // 22% of 900
    expect(body.data.totalAmount).toBe(1098.00); // 900 + 198
  });

  it('should return 404 when sale not found', async () => {
    // Arrange
    mockGetItem.mockResolvedValueOnce(null);

    const requestBody = {
      productDescription: 'Product A',
      quantity: 10,
      unitPrice: 100.00,
      taxRate: 22,
    };

    const event = createEventWithBody(
      requestBody,
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
    expect(body.error).toBe('Not Found');
  });

  it('should return 404 when sale is soft deleted', async () => {
    // Arrange
    const deletedSale = {
      ...mockSale,
      deletedAt: '2026-01-29T12:00:00.000Z',
    };
    mockGetItem.mockResolvedValueOnce(deletedSale);

    const requestBody = {
      productDescription: 'Product A',
      quantity: 10,
      unitPrice: 100.00,
      taxRate: 22,
    };

    const event = createEventWithBody(
      requestBody,
      createEventWithPathParams(
        { id: 'SALE001' },
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
      productDescription: 'Product A',
      quantity: 10,
      unitPrice: 100.00,
      taxRate: 22,
    };

    const event = createEventWithBody(
      requestBody,
      createEventWithPathParams(
        { id: 'SALE001' },
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
      productDescription: 'Product A',
      quantity: 10,
      unitPrice: 100.00,
      taxRate: 22,
    };

    const event = createEventWithBody(
      requestBody,
      createEventWithPathParams(
        { id: 'SALE001' },
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

  it('should return 403 when trying to add line to invoiced sale', async () => {
    // Arrange
    const invoicedSale = {
      ...mockSale,
      status: 'invoiced' as const,
      invoiceGenerated: true,
    };
    mockGetItem.mockResolvedValueOnce(invoicedSale);

    const requestBody = {
      productDescription: 'Product A',
      quantity: 10,
      unitPrice: 100.00,
      taxRate: 22,
    };

    const event = createEventWithBody(
      requestBody,
      createEventWithPathParams(
        { id: 'SALE001' },
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

  it('should return 422 for invalid line data', async () => {
    // Arrange
    const requestBody = {
      productDescription: 'Product A',
      quantity: -10, // Invalid: negative quantity
      unitPrice: 100.00,
      taxRate: 22,
    };

    const event = createEventWithBody(
      requestBody,
      createEventWithPathParams(
        { id: 'SALE001' },
        createAuthenticatedEvent('admin@i2speedex.com')
      )
    );

    // Act
    const response = await handler(event);

    // Assert
    expect(response.statusCode).toBe(422);

    const body = JSON.parse(response.body!);
    expect(body.error).toBe('Validation Error');
  });

  it('should handle DynamoDB error', async () => {
    // Arrange
    mockGetItem.mockRejectedValueOnce(new Error('DynamoDB error'));

    const requestBody = {
      productDescription: 'Product A',
      quantity: 10,
      unitPrice: 100.00,
      taxRate: 22,
    };

    const event = createEventWithBody(
      requestBody,
      createEventWithPathParams(
        { id: 'SALE001' },
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
