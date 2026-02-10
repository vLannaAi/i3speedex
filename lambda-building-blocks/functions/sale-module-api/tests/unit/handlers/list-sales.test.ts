/**
 * Unit tests for list-sales handler
 */

import { handler } from '../../../src/handlers/sales/list-sales';
import { createAuthenticatedEvent, createEventWithQueryParams } from '../../fixtures/event.fixture';
import { mockSale } from '../../fixtures/sale.fixture';
import * as dynamodb from '../../../src/common/clients/dynamodb';

// Mock DynamoDB client - partial mock to preserve utility functions
jest.mock('../../../src/common/clients/dynamodb', () => ({
  ...jest.requireActual('../../../src/common/clients/dynamodb'),
  queryItems: jest.fn(),
  scanItems: jest.fn(),
}));

describe('List Sales Handler', () => {
  const mockQueryItems = dynamodb.queryItems as jest.MockedFunction<typeof dynamodb.queryItems>;
  const mockScanItems = dynamodb.scanItems as jest.MockedFunction<typeof dynamodb.scanItems>;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should list sales with default pagination', async () => {
    // Arrange
    mockScanItems.mockResolvedValueOnce({
      items: [mockSale],
      lastEvaluatedKey: undefined,
      count: 1,
    });

    const event = createAuthenticatedEvent('admin@i2speedex.com');

    // Act
    const response = await handler(event);

    // Assert
    expect(response.statusCode).toBe(200);

    const body = JSON.parse(response.body!);
    expect(body.success).toBe(true);
    expect(body.data).toHaveLength(1);
    expect(body.pagination).toBeDefined();
    expect(body.pagination.page).toBe(1);
    expect(body.pagination.pageSize).toBe(20);

    // Verify scan was called
    expect(mockScanItems).toHaveBeenCalled();
  });

  it('should list sales with custom pagination', async () => {
    // Arrange
    mockScanItems.mockResolvedValueOnce({
      items: [mockSale, { ...mockSale, saleId: 'SALE002' }],
      lastEvaluatedKey: undefined,
      count: 2,
    });


    const event = createEventWithQueryParams(
      { page: '1', pageSize: '50' },
      createAuthenticatedEvent('admin@i2speedex.com')
    );

    // Act
    const response = await handler(event);

    // Assert
    expect(response.statusCode).toBe(200);

    const body = JSON.parse(response.body!);
    expect(body.pagination.pageSize).toBe(50);
  });

  it('should filter by status using GSI1', async () => {
    // Arrange
    const confirmedSales = [
      { ...mockSale, status: 'confirmed' },
      { ...mockSale, saleId: 'SALE002', status: 'confirmed' },
    ];

    mockQueryItems.mockResolvedValueOnce({
      items: confirmedSales,
      lastEvaluatedKey: undefined,
      count: 2,
    });


    const event = createEventWithQueryParams(
      { status: 'confirmed' },
      createAuthenticatedEvent('admin@i2speedex.com')
    );

    // Act
    const response = await handler(event);

    // Assert
    expect(response.statusCode).toBe(200);

    // Verify GSI1 query was used
    expect(mockQueryItems).toHaveBeenCalledWith(
      expect.objectContaining({
        IndexName: 'GSI1',
        KeyConditionExpression: 'GSI1PK = :gsi1pk',
        ExpressionAttributeValues: expect.objectContaining({
          ':gsi1pk': 'STATUS#confirmed',
        }),
      })
    );
  });

  it('should filter by buyerId using GSI2', async () => {
    // Arrange
    mockQueryItems.mockResolvedValueOnce({
      items: [mockSale],
      lastEvaluatedKey: undefined,
      count: 1,
    });

    const event = createEventWithQueryParams(
      { buyerId: 'BUYER001' },
      createAuthenticatedEvent('admin@i2speedex.com')
    );

    // Act
    const response = await handler(event);

    // Assert
    expect(response.statusCode).toBe(200);

    // Verify GSI2 query was used
    expect(mockQueryItems).toHaveBeenCalledWith(
      expect.objectContaining({
        IndexName: 'GSI2',
        KeyConditionExpression: 'GSI2PK = :gsi2pk',
        ExpressionAttributeValues: expect.objectContaining({
          ':gsi2pk': 'BUYER#BUYER001',
        }),
      })
    );
  });

  it('should filter by producerId using GSI3', async () => {
    // Arrange
    mockQueryItems.mockResolvedValueOnce({
      items: [mockSale],
      lastEvaluatedKey: undefined,
      count: 1,
    });

    const event = createEventWithQueryParams(
      { producerId: 'PROD001' },
      createAuthenticatedEvent('admin@i2speedex.com')
    );

    // Act
    const response = await handler(event);

    // Assert
    expect(response.statusCode).toBe(200);

    // Verify GSI3 query was used
    expect(mockQueryItems).toHaveBeenCalledWith(
      expect.objectContaining({
        IndexName: 'GSI3',
        KeyConditionExpression: 'GSI3PK = :gsi3pk',
        ExpressionAttributeValues: expect.objectContaining({
          ':gsi3pk': 'PRODUCER#PROD001',
        }),
      })
    );
  });

  it('should filter by date range', async () => {
    // Arrange
    mockScanItems.mockResolvedValueOnce({
      items: [mockSale],
      lastEvaluatedKey: undefined,
      count: 1,
    });

    const event = createEventWithQueryParams(
      { dateFrom: '2026-01-01', dateTo: '2026-01-31' },
      createAuthenticatedEvent('admin@i2speedex.com')
    );

    // Act
    const response = await handler(event);

    // Assert
    expect(response.statusCode).toBe(200);

    // Verify scan was called with date filters
    expect(mockScanItems).toHaveBeenCalledWith(
      expect.objectContaining({
        ExpressionAttributeValues: expect.objectContaining({
          ':dateFrom': '2026-01-01',
          ':dateTo': '2026-01-31',
        }),
      })
    );
  });

  it('should allow operators to see only their own sales', async () => {
    // Arrange
    const operatorSale = {
      ...mockSale,
      createdBy: 'operator@i2speedex.com',
    };

    mockScanItems.mockResolvedValueOnce({
      items: [operatorSale],
      lastEvaluatedKey: undefined,
      count: 1,
    });


    const event = createAuthenticatedEvent('operator@i2speedex.com', ['operator']);

    // Act
    const response = await handler(event);

    // Assert
    expect(response.statusCode).toBe(200);

    // Verify createdBy filter was added
    expect(mockScanItems).toHaveBeenCalledWith(
      expect.objectContaining({
        ExpressionAttributeValues: expect.objectContaining({
          ':createdBy': 'operator@i2speedex.com',
        }),
      })
    );
  });

  it('should allow admins to see all sales', async () => {
    // Arrange
    mockScanItems.mockResolvedValueOnce({
      items: [
        mockSale,
        { ...mockSale, saleId: 'SALE002', createdBy: 'other@i2speedex.com' },
      ],
      lastEvaluatedKey: undefined,
      count: 2,
    });


    const event = createAuthenticatedEvent('admin@i2speedex.com', ['admin']);

    // Act
    const response = await handler(event);

    // Assert
    expect(response.statusCode).toBe(200);

    const body = JSON.parse(response.body!);
    expect(body.data).toHaveLength(2);

    // Verify NO createdBy filter was added for admin
    const callArgs = mockScanItems.mock.calls[0][0];
    if (callArgs.ExpressionAttributeValues) {
      expect(callArgs.ExpressionAttributeValues[':createdBy']).toBeUndefined();
    }
  });

  it('should allow admin to filter by specific creator', async () => {
    // Arrange
    mockScanItems.mockResolvedValueOnce({
      items: [mockSale],
      lastEvaluatedKey: undefined,
      count: 1,
    });

    const event = createEventWithQueryParams(
      { createdBy: 'operator@i2speedex.com' },
      createAuthenticatedEvent('admin@i2speedex.com', ['admin'])
    );

    // Act
    const response = await handler(event);

    // Assert
    expect(response.statusCode).toBe(200);

    // Verify createdBy filter was added
    expect(mockScanItems).toHaveBeenCalledWith(
      expect.objectContaining({
        ExpressionAttributeValues: expect.objectContaining({
          ':createdBy': 'operator@i2speedex.com',
        }),
      })
    );
  });

  it('should return empty list when no sales found', async () => {
    // Arrange
    mockScanItems.mockResolvedValueOnce({
      items: [],
      lastEvaluatedKey: undefined,
      count: 0,
    });


    const event = createAuthenticatedEvent('admin@i2speedex.com');

    // Act
    const response = await handler(event);

    // Assert
    expect(response.statusCode).toBe(200);

    const body = JSON.parse(response.body!);
    expect(body.success).toBe(true);
    expect(body.data).toEqual([]);
    expect(body.pagination.total).toBe(0);
  });

  it('should handle DynamoDB error', async () => {
    // Arrange
    mockScanItems.mockRejectedValueOnce(new Error('DynamoDB error'));

    const event = createAuthenticatedEvent('admin@i2speedex.com');

    // Act
    const response = await handler(event);

    // Assert
    expect(response.statusCode).toBe(500);

    const body = JSON.parse(response.body!);
    expect(body.success).toBe(false);
    expect(body.error).toBe('Internal Server Error');
  });
});
