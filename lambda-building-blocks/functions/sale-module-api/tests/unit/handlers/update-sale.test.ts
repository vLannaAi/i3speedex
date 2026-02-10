/**
 * Unit tests for update-sale handler
 */

import { handler } from '../../../src/handlers/sales/update-sale';
import { createAuthenticatedEvent, createEventWithPathParams, createEventWithBody } from '../../fixtures/event.fixture';
import { mockSale, mockBuyer, mockProducer } from '../../fixtures/sale.fixture';
import * as dynamodb from '../../../src/common/clients/dynamodb';

// Mock DynamoDB client - partial mock to preserve utility functions
jest.mock('../../../src/common/clients/dynamodb', () => ({
  ...jest.requireActual('../../../src/common/clients/dynamodb'),
  getItem: jest.fn(),
  updateItem: jest.fn(),
}));

describe('Update Sale Handler', () => {
  const mockGetItem = dynamodb.getItem as jest.MockedFunction<typeof dynamodb.getItem>;
  const mockUpdateItem = dynamodb.updateItem as jest.MockedFunction<typeof dynamodb.updateItem>;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should update sale successfully', async () => {
    // Arrange
    mockGetItem.mockResolvedValueOnce(mockSale);
    mockUpdateItem.mockResolvedValueOnce({
      ...mockSale,
      notes: 'Updated notes',
      updatedAt: '2026-01-30T12:00:00.000Z',
    });

    const requestBody = {
      notes: 'Updated notes',
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
    expect(response.statusCode).toBe(200);

    const body = JSON.parse(response.body!);
    expect(body.success).toBe(true);
    expect(body.data.notes).toBe('Updated notes');

    // Verify DynamoDB was called
    expect(mockGetItem).toHaveBeenCalledWith({
      TableName: expect.any(String),
      Key: {
        PK: 'SALE#SALE001',
        SK: 'METADATA',
      },
    });

    expect(mockUpdateItem).toHaveBeenCalled();
  });

  it('should return 404 when sale not found', async () => {
    // Arrange
    mockGetItem.mockResolvedValueOnce(null);

    const event = createEventWithBody(
      { notes: 'Test' },
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

  it('should return 404 when sale is soft deleted', async () => {
    // Arrange
    const deletedSale = {
      ...mockSale,
      deletedAt: '2026-01-29T12:00:00.000Z',
    };
    mockGetItem.mockResolvedValueOnce(deletedSale);

    const event = createEventWithBody(
      { notes: 'Test' },
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
    const event = createEventWithBody(
      { notes: 'Test' },
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

  it('should return 403 when operator tries to update another user\'s sale', async () => {
    // Arrange
    mockGetItem.mockResolvedValueOnce(mockSale); // Created by admin@i2speedex.com

    const event = createEventWithBody(
      { notes: 'Test' },
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

  it('should allow admin to update any sale', async () => {
    // Arrange
    mockGetItem.mockResolvedValueOnce(mockSale);
    mockUpdateItem.mockResolvedValueOnce({
      ...mockSale,
      notes: 'Admin update',
    });

    const event = createEventWithBody(
      { notes: 'Admin update' },
      createEventWithPathParams(
        { id: 'SALE001' },
        createAuthenticatedEvent('admin@i2speedex.com', ['admin'])
      )
    );

    // Act
    const response = await handler(event);

    // Assert
    expect(response.statusCode).toBe(200);
  });

  it('should return 403 when trying to update invoiced sale', async () => {
    // Arrange
    const invoicedSale = {
      ...mockSale,
      status: 'invoiced' as const,
      invoiceGenerated: true,
    };
    mockGetItem.mockResolvedValueOnce(invoicedSale);

    const event = createEventWithBody(
      { notes: 'Test' },
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

  it('should update buyer when buyerId is changed', async () => {
    // Arrange
    mockGetItem
      .mockResolvedValueOnce(mockSale)           // Get existing sale
      .mockResolvedValueOnce(mockBuyer);         // Get new buyer

    mockUpdateItem.mockResolvedValueOnce({
      ...mockSale,
      buyerId: 'BUYER002',
      buyerName: mockBuyer.companyName,
    });

    const event = createEventWithBody(
      { buyerId: 'BUYER002' },
      createEventWithPathParams(
        { id: 'SALE001' },
        createAuthenticatedEvent('admin@i2speedex.com')
      )
    );

    // Act
    const response = await handler(event);

    // Assert
    expect(response.statusCode).toBe(200);

    // Verify buyer was fetched
    expect(mockGetItem).toHaveBeenCalledTimes(2);
    expect(mockGetItem).toHaveBeenNthCalledWith(2, {
      TableName: expect.any(String),
      Key: {
        PK: 'BUYER#BUYER002',
        SK: 'METADATA',
      },
    });
  });

  it('should return 404 when new buyer not found', async () => {
    // Arrange
    mockGetItem
      .mockResolvedValueOnce(mockSale)  // Get existing sale
      .mockResolvedValueOnce(null);      // Buyer not found

    const event = createEventWithBody(
      { buyerId: 'NONEXISTENT' },
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
    expect(body.message).toContain('Buyer');
  });

  it('should update producer when producerId is changed', async () => {
    // Arrange
    mockGetItem
      .mockResolvedValueOnce(mockSale)           // Get existing sale
      .mockResolvedValueOnce(mockProducer);      // Get new producer

    mockUpdateItem.mockResolvedValueOnce({
      ...mockSale,
      producerId: 'PROD002',
      producerName: mockProducer.companyName,
    });

    const event = createEventWithBody(
      { producerId: 'PROD002' },
      createEventWithPathParams(
        { id: 'SALE001' },
        createAuthenticatedEvent('admin@i2speedex.com')
      )
    );

    // Act
    const response = await handler(event);

    // Assert
    expect(response.statusCode).toBe(200);

    // Verify producer was fetched
    expect(mockGetItem).toHaveBeenCalledTimes(2);
    expect(mockGetItem).toHaveBeenNthCalledWith(2, {
      TableName: expect.any(String),
      Key: {
        PK: 'PRODUCER#PROD002',
        SK: 'METADATA',
      },
    });
  });

  it('should return 404 when new producer not found', async () => {
    // Arrange
    mockGetItem
      .mockResolvedValueOnce(mockSale)  // Get existing sale
      .mockResolvedValueOnce(null);      // Producer not found

    const event = createEventWithBody(
      { producerId: 'NONEXISTENT' },
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
    expect(body.message).toContain('Producer');
  });

  it('should return existing sale when no updates provided', async () => {
    // Arrange
    mockGetItem.mockResolvedValueOnce(mockSale);

    const event = createEventWithBody(
      {}, // No updates
      createEventWithPathParams(
        { id: 'SALE001' },
        createAuthenticatedEvent('admin@i2speedex.com')
      )
    );

    // Act
    const response = await handler(event);

    // Assert
    expect(response.statusCode).toBe(200);

    const body = JSON.parse(response.body!);
    expect(body.data.saleId).toBe('SALE001');

    // updateItem should NOT be called
    expect(mockUpdateItem).not.toHaveBeenCalled();
  });

  it('should handle DynamoDB error', async () => {
    // Arrange
    mockGetItem.mockRejectedValueOnce(new Error('DynamoDB error'));

    const event = createEventWithBody(
      { notes: 'Test' },
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
