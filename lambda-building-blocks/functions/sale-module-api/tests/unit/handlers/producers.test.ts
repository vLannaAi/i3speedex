/**
 * Unit tests for the consolidated producers handler (producers.ts)
 */

import {
  listProducers,
  getProducer,
  createProducer,
  updateProducer,
  deleteProducer,
} from '../../../src/handlers/producers/producers';
import {
  createAuthenticatedEvent,
  createEventWithQueryParams,
  createEventWithPathParams,
  createEventWithBody,
} from '../../fixtures/event.fixture';
import { mockProducer, mockSale } from '../../fixtures/sale.fixture';
import * as dynamodb from '../../../src/common/clients/dynamodb';

jest.mock('../../../src/common/clients/dynamodb', () => ({
  ...jest.requireActual('../../../src/common/clients/dynamodb'),
  scanAllItems: jest.fn(),
  getItem: jest.fn(),
  putItem: jest.fn(),
  updateItem: jest.fn(),
  softDelete: jest.fn(),
  queryItems: jest.fn(),
}));

const mockScanAllItems = dynamodb.scanAllItems as jest.MockedFunction<typeof dynamodb.scanAllItems>;
const mockGetItem = dynamodb.getItem as jest.MockedFunction<typeof dynamodb.getItem>;
const mockPutItem = dynamodb.putItem as jest.MockedFunction<typeof dynamodb.putItem>;
const mockUpdateItem = dynamodb.updateItem as jest.MockedFunction<typeof dynamodb.updateItem>;
const mockSoftDelete = dynamodb.softDelete as jest.MockedFunction<typeof dynamodb.softDelete>;
const mockQueryItems = dynamodb.queryItems as jest.MockedFunction<typeof dynamodb.queryItems>;

beforeEach(() => {
  jest.clearAllMocks();
});

// ============================================================
// listProducers
// ============================================================

describe('listProducers', () => {
  it('should list producers with default pagination', async () => {
    mockScanAllItems.mockResolvedValueOnce([mockProducer]);

    const response = await listProducers(createAuthenticatedEvent('admin@i2speedex.com'));

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body!);
    expect(body.success).toBe(true);
    expect(body.data).toHaveLength(1);
    expect(body.pagination).toBeDefined();
    expect(mockScanAllItems).toHaveBeenCalledWith(
      expect.objectContaining({
        TableName: expect.any(String),
        FilterExpression: expect.stringContaining('attribute_not_exists(deletedAt)'),
        ExpressionAttributeValues: expect.objectContaining({ ':sk': 'METADATA' }),
      })
    );
  });

  it('should list producers with custom pagination', async () => {
    mockScanAllItems.mockResolvedValueOnce([mockProducer, { ...mockProducer, producerId: 'PROD002', companyName: 'Producer 2' }]);
    const event = createEventWithQueryParams({ page: '1', pageSize: '50' }, createAuthenticatedEvent('admin@i2speedex.com'));
    const response = await listProducers(event);
    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body!).pagination.pageSize).toBe(50);
  });

  it('should filter by status', async () => {
    mockScanAllItems.mockResolvedValueOnce([{ ...mockProducer, status: 'active' }]);
    const event = createEventWithQueryParams({ status: 'active' }, createAuthenticatedEvent('admin@i2speedex.com'));
    const response = await listProducers(event);
    expect(response.statusCode).toBe(200);
    expect(mockScanAllItems).toHaveBeenCalledWith(
      expect.objectContaining({
        ExpressionAttributeNames: expect.objectContaining({ '#status': 'status' }),
        ExpressionAttributeValues: expect.objectContaining({ ':status': 'active' }),
      })
    );
  });

  it('should filter by country', async () => {
    mockScanAllItems.mockResolvedValueOnce([mockProducer]);
    const event = createEventWithQueryParams({ country: 'IT' }, createAuthenticatedEvent('admin@i2speedex.com'));
    const response = await listProducers(event);
    expect(response.statusCode).toBe(200);
    expect(mockScanAllItems).toHaveBeenCalledWith(
      expect.objectContaining({ ExpressionAttributeValues: expect.objectContaining({ ':country': 'IT' }) })
    );
  });

  it('should search by company name', async () => {
    mockScanAllItems.mockResolvedValueOnce([mockProducer]);
    const event = createEventWithQueryParams({ search: 'Factory' }, createAuthenticatedEvent('admin@i2speedex.com'));
    const response = await listProducers(event);
    expect(response.statusCode).toBe(200);
    expect(mockScanAllItems).toHaveBeenCalledWith(
      expect.objectContaining({
        FilterExpression: expect.stringContaining('contains(companyName, :search)'),
        ExpressionAttributeValues: expect.objectContaining({ ':search': 'Factory' }),
      })
    );
  });

  it('should sort producers by company name', async () => {
    mockScanAllItems.mockResolvedValueOnce([
      { ...mockProducer, producerId: 'PROD002', companyName: 'Zebra Factory' },
      { ...mockProducer, producerId: 'PROD001', companyName: 'Alpha Factory' },
      { ...mockProducer, producerId: 'PROD003', companyName: 'Beta Factory' },
    ]);
    const response = await listProducers(createAuthenticatedEvent('admin@i2speedex.com'));
    expect(response.statusCode).toBe(200);
    const data = JSON.parse(response.body!).data;
    expect(data[0].companyName).toBe('Alpha Factory');
    expect(data[1].companyName).toBe('Beta Factory');
    expect(data[2].companyName).toBe('Zebra Factory');
  });

  it('should return empty list when no producers found', async () => {
    mockScanAllItems.mockResolvedValueOnce([]);
    const response = await listProducers(createAuthenticatedEvent('admin@i2speedex.com'));
    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body!).data).toEqual([]);
  });

  it('should handle DynamoDB error', async () => {
    mockScanAllItems.mockRejectedValueOnce(new Error('DynamoDB error'));
    const response = await listProducers(createAuthenticatedEvent('admin@i2speedex.com'));
    expect(response.statusCode).toBe(500);
    expect(JSON.parse(response.body!).error).toBe('Internal Server Error');
  });
});

// ============================================================
// getProducer
// ============================================================

describe('getProducer', () => {
  it('should return producer when found', async () => {
    mockGetItem.mockResolvedValueOnce(mockProducer);
    const event = createEventWithPathParams({ id: 'PROD001' }, createAuthenticatedEvent('admin@i2speedex.com'));
    const response = await getProducer(event);
    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body!);
    expect(body.success).toBe(true);
    expect(body.data).toMatchObject({ producerId: 'PROD001', companyName: 'Factory Inc', vatNumber: 'IT98765432109' });
    expect(mockGetItem).toHaveBeenCalledWith({ TableName: expect.any(String), Key: { PK: 'PRODUCER#PROD001', SK: 'METADATA' } });
  });

  it('should return 404 when producer not found', async () => {
    mockGetItem.mockResolvedValueOnce(null);
    const event = createEventWithPathParams({ id: 'NONEXISTENT' }, createAuthenticatedEvent('admin@i2speedex.com'));
    const response = await getProducer(event);
    expect(response.statusCode).toBe(404);
    expect(JSON.parse(response.body!).error).toBe('Not Found');
  });

  it('should return 404 when producer is soft deleted', async () => {
    mockGetItem.mockResolvedValueOnce({ ...mockProducer, deletedAt: '2026-01-29T12:00:00.000Z' });
    const event = createEventWithPathParams({ id: 'PROD001' }, createAuthenticatedEvent('admin@i2speedex.com'));
    const response = await getProducer(event);
    expect(response.statusCode).toBe(404);
    expect(JSON.parse(response.body!).error).toBe('Not Found');
  });

  it('should handle DynamoDB error', async () => {
    mockGetItem.mockRejectedValueOnce(new Error('DynamoDB error'));
    const event = createEventWithPathParams({ id: 'PROD001' }, createAuthenticatedEvent('admin@i2speedex.com'));
    const response = await getProducer(event);
    expect(response.statusCode).toBe(500);
    expect(JSON.parse(response.body!).error).toBe('Internal Server Error');
  });
});

// ============================================================
// createProducer
// ============================================================

describe('createProducer', () => {
  const validBody = {
    companyName: 'Test Factory',
    address: '123 Factory Rd',
    city: 'Factory City',
    postalCode: '54321',
    country: 'IT',
  };

  it('should create producer successfully', async () => {
    mockPutItem.mockResolvedValueOnce(undefined);
    const event = createEventWithBody(validBody, createAuthenticatedEvent('admin@i2speedex.com'));
    const response = await createProducer(event);
    expect(response.statusCode).toBe(201);
    const body = JSON.parse(response.body!);
    expect(body.success).toBe(true);
    expect(body.data).toMatchObject({ companyName: 'Test Factory', status: 'active' });
    expect(mockPutItem).toHaveBeenCalled();
  });

  it('should return 422 when required fields are missing', async () => {
    const event = createEventWithBody({ companyName: 'Test Factory' }, createAuthenticatedEvent('admin@i2speedex.com'));
    const response = await createProducer(event);
    expect(response.statusCode).toBe(422);
    expect(JSON.parse(response.body!).error).toBe('Validation Error');
  });

  it('should return 403 when user lacks write permission', async () => {
    const event = createEventWithBody(validBody, createAuthenticatedEvent('viewer@i2speedex.com', ['viewer']));
    const response = await createProducer(event);
    expect(response.statusCode).toBe(403);
    expect(JSON.parse(response.body!).error).toBe('Forbidden');
  });

  it('should handle DynamoDB error', async () => {
    mockPutItem.mockRejectedValueOnce(new Error('DynamoDB error'));
    const event = createEventWithBody(validBody, createAuthenticatedEvent('admin@i2speedex.com'));
    const response = await createProducer(event);
    expect(response.statusCode).toBe(500);
    expect(JSON.parse(response.body!).error).toBe('Internal Server Error');
  });
});

// ============================================================
// updateProducer
// ============================================================

describe('updateProducer', () => {
  it('should update producer successfully', async () => {
    mockGetItem.mockResolvedValueOnce(mockProducer);
    mockUpdateItem.mockResolvedValueOnce({ ...mockProducer, email: 'newemail@factory.com', updatedAt: '2026-01-30T12:00:00.000Z' });
    const event = createEventWithBody(
      { email: 'newemail@factory.com' },
      createEventWithPathParams({ id: 'PROD001' }, createAuthenticatedEvent('admin@i2speedex.com'))
    );
    const response = await updateProducer(event);
    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body!).data.email).toBe('newemail@factory.com');
    expect(mockGetItem).toHaveBeenCalledWith({ TableName: expect.any(String), Key: { PK: 'PRODUCER#PROD001', SK: 'METADATA' } });
    expect(mockUpdateItem).toHaveBeenCalled();
  });

  it('should return 404 when producer not found', async () => {
    mockGetItem.mockResolvedValueOnce(null);
    const event = createEventWithBody(
      { email: 'test@example.com' },
      createEventWithPathParams({ id: 'NONEXISTENT' }, createAuthenticatedEvent('admin@i2speedex.com'))
    );
    const response = await updateProducer(event);
    expect(response.statusCode).toBe(404);
    expect(JSON.parse(response.body!).error).toBe('Not Found');
  });

  it('should return 404 when producer is soft deleted', async () => {
    mockGetItem.mockResolvedValueOnce({ ...mockProducer, deletedAt: '2026-01-29T12:00:00.000Z' });
    const event = createEventWithBody(
      { email: 'test@example.com' },
      createEventWithPathParams({ id: 'PROD001' }, createAuthenticatedEvent('admin@i2speedex.com'))
    );
    const response = await updateProducer(event);
    expect(response.statusCode).toBe(404);
    expect(JSON.parse(response.body!).error).toBe('Not Found');
  });

  it('should return 403 when user lacks write permission', async () => {
    const event = createEventWithBody(
      { email: 'test@example.com' },
      createEventWithPathParams({ id: 'PROD001' }, createAuthenticatedEvent('viewer@i2speedex.com', ['viewer']))
    );
    const response = await updateProducer(event);
    expect(response.statusCode).toBe(403);
    expect(JSON.parse(response.body!).error).toBe('Forbidden');
  });

  it('should return existing producer when no updates provided', async () => {
    mockGetItem.mockResolvedValueOnce(mockProducer);
    const event = createEventWithBody(
      {},
      createEventWithPathParams({ id: 'PROD001' }, createAuthenticatedEvent('admin@i2speedex.com'))
    );
    const response = await updateProducer(event);
    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body!).data.producerId).toBe('PROD001');
    expect(mockUpdateItem).not.toHaveBeenCalled();
  });

  it('should handle DynamoDB error', async () => {
    mockGetItem.mockRejectedValueOnce(new Error('DynamoDB error'));
    const event = createEventWithBody(
      { email: 'test@example.com' },
      createEventWithPathParams({ id: 'PROD001' }, createAuthenticatedEvent('admin@i2speedex.com'))
    );
    const response = await updateProducer(event);
    expect(response.statusCode).toBe(500);
    expect(JSON.parse(response.body!).error).toBe('Internal Server Error');
  });
});

// ============================================================
// deleteProducer
// ============================================================

describe('deleteProducer', () => {
  it('should delete producer successfully when no associated sales', async () => {
    mockGetItem.mockResolvedValueOnce(mockProducer);
    mockQueryItems.mockResolvedValueOnce({ items: [], lastEvaluatedKey: undefined, count: 0 });
    mockSoftDelete.mockResolvedValueOnce(undefined);

    const event = createEventWithPathParams({ id: 'PROD001' }, createAuthenticatedEvent('admin@i2speedex.com'));
    const response = await deleteProducer(event);

    expect(response.statusCode).toBe(204);
    expect(response.body).toBe('');
    expect(mockQueryItems).toHaveBeenCalledWith({
      TableName: expect.any(String),
      IndexName: 'GSI3',
      KeyConditionExpression: 'GSI3PK = :gsi3pk',
      ExpressionAttributeValues: { ':gsi3pk': 'PRODUCER#PROD001' },
      FilterExpression: 'attribute_not_exists(deletedAt)',
      Limit: 1,
    });
    expect(mockSoftDelete).toHaveBeenCalledWith(
      expect.any(String),
      { PK: 'PRODUCER#PROD001', SK: 'METADATA' },
      'admin@i2speedex.com'
    );
  });

  it('should return 403 when producer has associated sales', async () => {
    mockGetItem.mockResolvedValueOnce(mockProducer);
    mockQueryItems.mockResolvedValueOnce({ items: [mockSale], lastEvaluatedKey: undefined, count: 1 });

    const event = createEventWithPathParams({ id: 'PROD001' }, createAuthenticatedEvent('admin@i2speedex.com'));
    const response = await deleteProducer(event);

    expect(response.statusCode).toBe(403);
    const body = JSON.parse(response.body!);
    expect(body.error).toBe('Forbidden');
    expect(body.message).toContain('associated sales');
    expect(mockSoftDelete).not.toHaveBeenCalled();
  });

  it('should return 404 when producer not found', async () => {
    mockGetItem.mockResolvedValueOnce(null);
    const event = createEventWithPathParams({ id: 'NONEXISTENT' }, createAuthenticatedEvent('admin@i2speedex.com'));
    const response = await deleteProducer(event);
    expect(response.statusCode).toBe(404);
    expect(JSON.parse(response.body!).error).toBe('Not Found');
  });

  it('should return 404 when producer is already deleted', async () => {
    mockGetItem.mockResolvedValueOnce({ ...mockProducer, deletedAt: '2026-01-29T12:00:00.000Z' });
    const event = createEventWithPathParams({ id: 'PROD001' }, createAuthenticatedEvent('admin@i2speedex.com'));
    const response = await deleteProducer(event);
    expect(response.statusCode).toBe(404);
    expect(JSON.parse(response.body!).error).toBe('Not Found');
    expect(mockSoftDelete).not.toHaveBeenCalled();
  });

  it('should return 403 when user lacks write permission', async () => {
    const event = createEventWithPathParams({ id: 'PROD001' }, createAuthenticatedEvent('viewer@i2speedex.com', ['viewer']));
    const response = await deleteProducer(event);
    expect(response.statusCode).toBe(403);
    expect(JSON.parse(response.body!).error).toBe('Forbidden');
  });

  it('should handle DynamoDB error', async () => {
    mockGetItem.mockRejectedValueOnce(new Error('DynamoDB error'));
    const event = createEventWithPathParams({ id: 'PROD001' }, createAuthenticatedEvent('admin@i2speedex.com'));
    const response = await deleteProducer(event);
    expect(response.statusCode).toBe(500);
    expect(JSON.parse(response.body!).error).toBe('Internal Server Error');
  });
});
