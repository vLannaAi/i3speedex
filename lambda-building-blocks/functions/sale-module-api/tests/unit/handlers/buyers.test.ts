/**
 * Unit tests for the consolidated buyers handler (buyers.ts)
 */

import {
  listBuyers,
  getBuyer,
  createBuyer,
  updateBuyer,
  deleteBuyer,
} from '../../../src/handlers/buyers/buyers';
import {
  createAuthenticatedEvent,
  createEventWithQueryParams,
  createEventWithPathParams,
  createEventWithBody,
} from '../../fixtures/event.fixture';
import { mockBuyer, mockSale } from '../../fixtures/sale.fixture';
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
// listBuyers
// ============================================================

describe('listBuyers', () => {
  it('should list buyers with default pagination', async () => {
    mockScanAllItems.mockResolvedValueOnce([mockBuyer]);

    const response = await listBuyers(createAuthenticatedEvent('admin@i2speedex.com'));

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

  it('should list buyers with custom pagination', async () => {
    mockScanAllItems.mockResolvedValueOnce([mockBuyer, { ...mockBuyer, buyerId: 'BUYER002', companyName: 'Buyer 2' }]);
    const event = createEventWithQueryParams({ page: '1', pageSize: '50' }, createAuthenticatedEvent('admin@i2speedex.com'));
    const response = await listBuyers(event);
    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body!).pagination.pageSize).toBe(50);
  });

  it('should filter by status', async () => {
    mockScanAllItems.mockResolvedValueOnce([{ ...mockBuyer, status: 'active' }]);
    const event = createEventWithQueryParams({ status: 'active' }, createAuthenticatedEvent('admin@i2speedex.com'));
    const response = await listBuyers(event);
    expect(response.statusCode).toBe(200);
    expect(mockScanAllItems).toHaveBeenCalledWith(
      expect.objectContaining({
        ExpressionAttributeNames: expect.objectContaining({ '#status': 'status' }),
        ExpressionAttributeValues: expect.objectContaining({ ':status': 'active' }),
      })
    );
  });

  it('should filter by country', async () => {
    mockScanAllItems.mockResolvedValueOnce([mockBuyer]);
    const event = createEventWithQueryParams({ country: 'IT' }, createAuthenticatedEvent('admin@i2speedex.com'));
    const response = await listBuyers(event);
    expect(response.statusCode).toBe(200);
    expect(mockScanAllItems).toHaveBeenCalledWith(
      expect.objectContaining({ ExpressionAttributeValues: expect.objectContaining({ ':country': 'IT' }) })
    );
  });

  it('should search by company name', async () => {
    mockScanAllItems.mockResolvedValueOnce([mockBuyer]);
    const event = createEventWithQueryParams({ search: 'Acme' }, createAuthenticatedEvent('admin@i2speedex.com'));
    const response = await listBuyers(event);
    expect(response.statusCode).toBe(200);
    expect(mockScanAllItems).toHaveBeenCalledWith(
      expect.objectContaining({
        FilterExpression: expect.stringContaining('contains(companyName, :search)'),
        ExpressionAttributeValues: expect.objectContaining({ ':search': 'Acme' }),
      })
    );
  });

  it('should sort buyers by company name', async () => {
    mockScanAllItems.mockResolvedValueOnce([
      { ...mockBuyer, buyerId: 'BUYER002', companyName: 'Zebra Corp' },
      { ...mockBuyer, buyerId: 'BUYER001', companyName: 'Acme Corp' },
      { ...mockBuyer, buyerId: 'BUYER003', companyName: 'Beta Inc' },
    ]);
    const response = await listBuyers(createAuthenticatedEvent('admin@i2speedex.com'));
    expect(response.statusCode).toBe(200);
    const data = JSON.parse(response.body!).data;
    expect(data[0].companyName).toBe('Acme Corp');
    expect(data[1].companyName).toBe('Beta Inc');
    expect(data[2].companyName).toBe('Zebra Corp');
  });

  it('should return empty list when no buyers found', async () => {
    mockScanAllItems.mockResolvedValueOnce([]);
    const response = await listBuyers(createAuthenticatedEvent('admin@i2speedex.com'));
    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body!).data).toEqual([]);
  });

  it('should handle DynamoDB error', async () => {
    mockScanAllItems.mockRejectedValueOnce(new Error('DynamoDB error'));
    const response = await listBuyers(createAuthenticatedEvent('admin@i2speedex.com'));
    expect(response.statusCode).toBe(500);
    expect(JSON.parse(response.body!).error).toBe('Internal Server Error');
  });
});

// ============================================================
// getBuyer
// ============================================================

describe('getBuyer', () => {
  it('should return buyer when found', async () => {
    mockGetItem.mockResolvedValueOnce(mockBuyer);
    const event = createEventWithPathParams({ id: 'BUYER001' }, createAuthenticatedEvent('admin@i2speedex.com'));
    const response = await getBuyer(event);
    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body!);
    expect(body.success).toBe(true);
    expect(body.data).toMatchObject({ buyerId: 'BUYER001', companyName: 'Acme Corp', vatNumber: 'IT12345678901' });
    expect(mockGetItem).toHaveBeenCalledWith({ TableName: expect.any(String), Key: { PK: 'BUYER#BUYER001', SK: 'METADATA' } });
  });

  it('should return 404 when buyer not found', async () => {
    mockGetItem.mockResolvedValueOnce(null);
    const event = createEventWithPathParams({ id: 'NONEXISTENT' }, createAuthenticatedEvent('admin@i2speedex.com'));
    const response = await getBuyer(event);
    expect(response.statusCode).toBe(404);
    expect(JSON.parse(response.body!).error).toBe('Not Found');
  });

  it('should return 404 when buyer is soft deleted', async () => {
    mockGetItem.mockResolvedValueOnce({ ...mockBuyer, deletedAt: '2026-01-29T12:00:00.000Z' });
    const event = createEventWithPathParams({ id: 'BUYER001' }, createAuthenticatedEvent('admin@i2speedex.com'));
    const response = await getBuyer(event);
    expect(response.statusCode).toBe(404);
    expect(JSON.parse(response.body!).error).toBe('Not Found');
  });

  it('should handle DynamoDB error', async () => {
    mockGetItem.mockRejectedValueOnce(new Error('DynamoDB error'));
    const event = createEventWithPathParams({ id: 'BUYER001' }, createAuthenticatedEvent('admin@i2speedex.com'));
    const response = await getBuyer(event);
    expect(response.statusCode).toBe(500);
    expect(JSON.parse(response.body!).error).toBe('Internal Server Error');
  });
});

// ============================================================
// createBuyer
// ============================================================

describe('createBuyer', () => {
  const validBody = {
    companyName: 'Test Company',
    address: '123 Test St',
    city: 'Test City',
    postalCode: '12345',
    country: 'IT',
  };

  it('should create buyer successfully', async () => {
    mockPutItem.mockResolvedValueOnce(undefined);
    const event = createEventWithBody(validBody, createAuthenticatedEvent('admin@i2speedex.com'));
    const response = await createBuyer(event);
    expect(response.statusCode).toBe(201);
    const body = JSON.parse(response.body!);
    expect(body.success).toBe(true);
    expect(body.data).toMatchObject({ companyName: 'Test Company', status: 'active' });
    expect(mockPutItem).toHaveBeenCalled();
  });

  it('should return 422 when required fields are missing', async () => {
    const event = createEventWithBody({ companyName: 'Test Company' }, createAuthenticatedEvent('admin@i2speedex.com'));
    const response = await createBuyer(event);
    expect(response.statusCode).toBe(422);
    expect(JSON.parse(response.body!).error).toBe('Validation Error');
  });

  it('should return 403 when user lacks write permission', async () => {
    const event = createEventWithBody(validBody, createAuthenticatedEvent('viewer@i2speedex.com', ['viewer']));
    const response = await createBuyer(event);
    expect(response.statusCode).toBe(403);
    expect(JSON.parse(response.body!).error).toBe('Forbidden');
  });

  it('should handle DynamoDB error', async () => {
    mockPutItem.mockRejectedValueOnce(new Error('DynamoDB error'));
    const event = createEventWithBody(validBody, createAuthenticatedEvent('admin@i2speedex.com'));
    const response = await createBuyer(event);
    expect(response.statusCode).toBe(500);
    expect(JSON.parse(response.body!).error).toBe('Internal Server Error');
  });
});

// ============================================================
// updateBuyer
// ============================================================

describe('updateBuyer', () => {
  it('should update buyer successfully', async () => {
    mockGetItem.mockResolvedValueOnce(mockBuyer);
    mockUpdateItem.mockResolvedValueOnce({ ...mockBuyer, email: 'newemail@example.com', updatedAt: '2026-01-30T12:00:00.000Z' });
    const event = createEventWithBody(
      { email: 'newemail@example.com' },
      createEventWithPathParams({ id: 'BUYER001' }, createAuthenticatedEvent('admin@i2speedex.com'))
    );
    const response = await updateBuyer(event);
    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body!).data.email).toBe('newemail@example.com');
    expect(mockGetItem).toHaveBeenCalledWith({ TableName: expect.any(String), Key: { PK: 'BUYER#BUYER001', SK: 'METADATA' } });
    expect(mockUpdateItem).toHaveBeenCalled();
  });

  it('should return 404 when buyer not found', async () => {
    mockGetItem.mockResolvedValueOnce(null);
    const event = createEventWithBody(
      { email: 'test@example.com' },
      createEventWithPathParams({ id: 'NONEXISTENT' }, createAuthenticatedEvent('admin@i2speedex.com'))
    );
    const response = await updateBuyer(event);
    expect(response.statusCode).toBe(404);
    expect(JSON.parse(response.body!).error).toBe('Not Found');
  });

  it('should return 404 when buyer is soft deleted', async () => {
    mockGetItem.mockResolvedValueOnce({ ...mockBuyer, deletedAt: '2026-01-29T12:00:00.000Z' });
    const event = createEventWithBody(
      { email: 'test@example.com' },
      createEventWithPathParams({ id: 'BUYER001' }, createAuthenticatedEvent('admin@i2speedex.com'))
    );
    const response = await updateBuyer(event);
    expect(response.statusCode).toBe(404);
    expect(JSON.parse(response.body!).error).toBe('Not Found');
  });

  it('should return 403 when user lacks write permission', async () => {
    const event = createEventWithBody(
      { email: 'test@example.com' },
      createEventWithPathParams({ id: 'BUYER001' }, createAuthenticatedEvent('viewer@i2speedex.com', ['viewer']))
    );
    const response = await updateBuyer(event);
    expect(response.statusCode).toBe(403);
    expect(JSON.parse(response.body!).error).toBe('Forbidden');
  });

  it('should return existing buyer when no updates provided', async () => {
    mockGetItem.mockResolvedValueOnce(mockBuyer);
    const event = createEventWithBody(
      {},
      createEventWithPathParams({ id: 'BUYER001' }, createAuthenticatedEvent('admin@i2speedex.com'))
    );
    const response = await updateBuyer(event);
    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body!).data.buyerId).toBe('BUYER001');
    expect(mockUpdateItem).not.toHaveBeenCalled();
  });

  it('should handle DynamoDB error', async () => {
    mockGetItem.mockRejectedValueOnce(new Error('DynamoDB error'));
    const event = createEventWithBody(
      { email: 'test@example.com' },
      createEventWithPathParams({ id: 'BUYER001' }, createAuthenticatedEvent('admin@i2speedex.com'))
    );
    const response = await updateBuyer(event);
    expect(response.statusCode).toBe(500);
    expect(JSON.parse(response.body!).error).toBe('Internal Server Error');
  });
});

// ============================================================
// deleteBuyer
// ============================================================

describe('deleteBuyer', () => {
  it('should delete buyer successfully when no associated sales', async () => {
    mockGetItem.mockResolvedValueOnce(mockBuyer);
    mockQueryItems.mockResolvedValueOnce({ items: [], lastEvaluatedKey: undefined, count: 0 });
    mockSoftDelete.mockResolvedValueOnce(undefined);

    const event = createEventWithPathParams({ id: 'BUYER001' }, createAuthenticatedEvent('admin@i2speedex.com'));
    const response = await deleteBuyer(event);

    expect(response.statusCode).toBe(204);
    expect(response.body).toBe('');
    expect(mockQueryItems).toHaveBeenCalledWith({
      TableName: expect.any(String),
      IndexName: 'GSI2',
      KeyConditionExpression: 'GSI2PK = :gsi2pk',
      ExpressionAttributeValues: { ':gsi2pk': 'BUYER#BUYER001' },
      FilterExpression: 'attribute_not_exists(deletedAt)',
      Limit: 1,
    });
    expect(mockSoftDelete).toHaveBeenCalledWith(
      expect.any(String),
      { PK: 'BUYER#BUYER001', SK: 'METADATA' },
      'admin@i2speedex.com'
    );
  });

  it('should return 403 when buyer has associated sales', async () => {
    mockGetItem.mockResolvedValueOnce(mockBuyer);
    mockQueryItems.mockResolvedValueOnce({ items: [mockSale], lastEvaluatedKey: undefined, count: 1 });

    const event = createEventWithPathParams({ id: 'BUYER001' }, createAuthenticatedEvent('admin@i2speedex.com'));
    const response = await deleteBuyer(event);

    expect(response.statusCode).toBe(403);
    const body = JSON.parse(response.body!);
    expect(body.error).toBe('Forbidden');
    expect(body.message).toContain('associated sales');
    expect(mockSoftDelete).not.toHaveBeenCalled();
  });

  it('should return 404 when buyer not found', async () => {
    mockGetItem.mockResolvedValueOnce(null);
    const event = createEventWithPathParams({ id: 'NONEXISTENT' }, createAuthenticatedEvent('admin@i2speedex.com'));
    const response = await deleteBuyer(event);
    expect(response.statusCode).toBe(404);
    expect(JSON.parse(response.body!).error).toBe('Not Found');
  });

  it('should return 404 when buyer is already deleted', async () => {
    mockGetItem.mockResolvedValueOnce({ ...mockBuyer, deletedAt: '2026-01-29T12:00:00.000Z' });
    const event = createEventWithPathParams({ id: 'BUYER001' }, createAuthenticatedEvent('admin@i2speedex.com'));
    const response = await deleteBuyer(event);
    expect(response.statusCode).toBe(404);
    expect(JSON.parse(response.body!).error).toBe('Not Found');
    expect(mockSoftDelete).not.toHaveBeenCalled();
  });

  it('should return 403 when user lacks write permission', async () => {
    const event = createEventWithPathParams({ id: 'BUYER001' }, createAuthenticatedEvent('viewer@i2speedex.com', ['viewer']));
    const response = await deleteBuyer(event);
    expect(response.statusCode).toBe(403);
    expect(JSON.parse(response.body!).error).toBe('Forbidden');
  });

  it('should handle DynamoDB error', async () => {
    mockGetItem.mockRejectedValueOnce(new Error('DynamoDB error'));
    const event = createEventWithPathParams({ id: 'BUYER001' }, createAuthenticatedEvent('admin@i2speedex.com'));
    const response = await deleteBuyer(event);
    expect(response.statusCode).toBe(500);
    expect(JSON.parse(response.body!).error).toBe('Internal Server Error');
  });
});
