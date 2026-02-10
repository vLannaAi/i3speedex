/**
 * Unit tests for create-sale handler
 */

import { handler } from '../../../src/handlers/sales/create-sale';
import { createAuthenticatedEvent, createEventWithBody } from '../../fixtures/event.fixture';
import { mockBuyer, mockProducer } from '../../fixtures/sale.fixture';
import * as dynamodb from '../../../src/common/clients/dynamodb';

// Mock DynamoDB client
jest.mock('../../../src/common/clients/dynamodb');

describe('Create Sale Handler', () => {
  const mockGetItem = dynamodb.getItem as jest.MockedFunction<typeof dynamodb.getItem>;
  const mockPutItem = dynamodb.putItem as jest.MockedFunction<typeof dynamodb.putItem>;
  const mockQueryItems = dynamodb.queryItems as jest.MockedFunction<typeof dynamodb.queryItems>;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should create sale successfully', async () => {
    // Arrange
    mockQueryItems.mockResolvedValueOnce({
      items: [], // No existing sales
      lastEvaluatedKey: undefined,
      count: 0,
    });
    mockGetItem
      .mockResolvedValueOnce(mockBuyer)  // First call for buyer
      .mockResolvedValueOnce(mockProducer); // Second call for producer
    mockPutItem.mockResolvedValueOnce(undefined);

    const requestBody = {
      saleDate: '2026-01-29',
      buyerId: 'BUYER001',
      producerId: 'PROD001',
      currency: 'EUR',
    };

    const event = createEventWithBody(
      requestBody,
      createAuthenticatedEvent('admin@i2speedex.com')
    );

    // Act
    const response = await handler(event);

    // Assert
    expect(response.statusCode).toBe(201);

    const body = JSON.parse(response.body);
    expect(body.success).toBe(true);
    expect(body.data).toMatchObject({
      saleDate: '2026-01-29',
      buyerName: 'Acme Corp',
      producerName: 'Factory Inc',
      currency: 'EUR',
      status: 'draft',
      subtotal: 0,
      taxAmount: 0,
      total: 0,
      linesCount: 0,
      invoiceGenerated: false,
    });

    // Verify buyer was fetched
    expect(mockGetItem).toHaveBeenNthCalledWith(1, {
      TableName: expect.any(String),
      Key: {
        PK: 'BUYER#BUYER001',
        SK: 'METADATA',
      },
    });

    // Verify producer was fetched
    expect(mockGetItem).toHaveBeenNthCalledWith(2, {
      TableName: expect.any(String),
      Key: {
        PK: 'PRODUCER#PROD001',
        SK: 'METADATA',
      },
    });

    // Verify sale was saved
    expect(mockPutItem).toHaveBeenCalled();
  });

  it('should return 422 when saleDate is missing', async () => {
    // Arrange
    const requestBody = {
      buyerId: 'BUYER001',
      producerId: 'PROD001',
    };

    const event = createEventWithBody(
      requestBody,
      createAuthenticatedEvent('admin@i2speedex.com')
    );

    // Act
    const response = await handler(event);

    // Assert
    expect(response.statusCode).toBe(422);

    const body = JSON.parse(response.body);
    expect(body.error).toBe('Validation Error');
    expect(body.message).toContain('saleDate');
  });

  it('should return 404 when buyer not found', async () => {
    // Arrange
    mockQueryItems.mockResolvedValueOnce({
      items: [],
      count: 0,
      lastEvaluatedKey: undefined,
    });
    mockGetItem.mockResolvedValueOnce(null); // Buyer not found

    const requestBody = {
      saleDate: '2026-01-29',
      buyerId: 'NONEXISTENT',
      producerId: 'PROD001',
    };

    const event = createEventWithBody(
      requestBody,
      createAuthenticatedEvent('admin@i2speedex.com')
    );

    // Act
    const response = await handler(event);

    // Assert
    expect(response.statusCode).toBe(404);

    const body = JSON.parse(response.body);
    expect(body.error).toBe('Not Found');
    expect(body.message).toContain('Buyer');
  });

  it('should return 404 when producer not found', async () => {
    // Arrange
    mockQueryItems.mockResolvedValueOnce({
      items: [],
      count: 0,
      lastEvaluatedKey: undefined,
    });
    mockGetItem
      .mockResolvedValueOnce(mockBuyer)  // Buyer found
      .mockResolvedValueOnce(null);       // Producer not found

    const requestBody = {
      saleDate: '2026-01-29',
      buyerId: 'BUYER001',
      producerId: 'NONEXISTENT',
    };

    const event = createEventWithBody(
      requestBody,
      createAuthenticatedEvent('admin@i2speedex.com')
    );

    // Act
    const response = await handler(event);

    // Assert
    expect(response.statusCode).toBe(404);

    const body = JSON.parse(response.body);
    expect(body.message).toContain('Producer');
  });

  it('should return 403 when user lacks write permission', async () => {
    // Arrange
    const requestBody = {
      saleDate: '2026-01-29',
      buyerId: 'BUYER001',
      producerId: 'PROD001',
    };

    const event = createEventWithBody(
      requestBody,
      createAuthenticatedEvent('viewer@i2speedex.com', ['viewer'])
    );

    // Act
    const response = await handler(event);

    // Assert
    expect(response.statusCode).toBe(403);

    const body = JSON.parse(response.body);
    expect(body.error).toBe('Forbidden');
  });

  it('should generate auto-incrementing sale number', async () => {
    // Arrange
    const existingSale = {
      saleNumber: 5,
    };

    mockQueryItems.mockResolvedValueOnce({
      items: [existingSale],
      count: 1,
      lastEvaluatedKey: undefined,
    });
    mockGetItem
      .mockResolvedValueOnce(mockBuyer)
      .mockResolvedValueOnce(mockProducer);
    mockPutItem.mockResolvedValueOnce(undefined);

    const requestBody = {
      saleDate: '2026-01-29',
      buyerId: 'BUYER001',
      producerId: 'PROD001',
    };

    const event = createEventWithBody(
      requestBody,
      createAuthenticatedEvent('admin@i2speedex.com')
    );

    // Act
    const response = await handler(event);

    // Assert
    expect(response.statusCode).toBe(201);

    const body = JSON.parse(response.body);
    expect(body.data.saleNumber).toBe(6); // Next number
  });

  it('should denormalize buyer and producer data', async () => {
    // Arrange
    mockQueryItems.mockResolvedValueOnce({
      items: [],
      count: 0,
      lastEvaluatedKey: undefined,
    });
    mockGetItem
      .mockResolvedValueOnce(mockBuyer)
      .mockResolvedValueOnce(mockProducer);
    mockPutItem.mockResolvedValueOnce(undefined);

    const requestBody = {
      saleDate: '2026-01-29',
      buyerId: 'BUYER001',
      producerId: 'PROD001',
    };

    const event = createEventWithBody(
      requestBody,
      createAuthenticatedEvent('admin@i2speedex.com')
    );

    // Act
    const response = await handler(event);

    // Assert
    const body = JSON.parse(response.body);
    expect(body.data.buyerName).toBe(mockBuyer.companyName);
    expect(body.data.buyerVatNumber).toBe(mockBuyer.vatNumber);
    expect(body.data.buyerCity).toBe(mockBuyer.city);
    expect(body.data.buyerCountry).toBe(mockBuyer.country);

    expect(body.data.producerName).toBe(mockProducer.companyName);
    expect(body.data.producerVatNumber).toBe(mockProducer.vatNumber);
    expect(body.data.producerCity).toBe(mockProducer.city);
    expect(body.data.producerCountry).toBe(mockProducer.country);
  });
});
