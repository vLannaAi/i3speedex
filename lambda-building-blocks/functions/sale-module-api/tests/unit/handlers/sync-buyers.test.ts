/**
 * Unit tests for sync-buyers handler
 */

import { handler } from '../../../src/handlers/sync/sync-buyers';
import { createAuthenticatedEvent, createEventWithQueryParams } from '../../fixtures/event.fixture';
import { mockBuyer } from '../../fixtures/sale.fixture';
import * as dynamodb from '../../../src/common/clients/dynamodb';

// Mock DynamoDB client - partial mock to preserve utility functions
jest.mock('../../../src/common/clients/dynamodb', () => ({
  ...jest.requireActual('../../../src/common/clients/dynamodb'),
  scanAllItems: jest.fn(),
}));

describe('Sync Buyers Handler', () => {
  const mockScanAllItems = dynamodb.scanAllItems as jest.MockedFunction<typeof dynamodb.scanAllItems>;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return all non-deleted buyers for initial sync (no since param)', async () => {
    // Arrange
    mockScanAllItems.mockResolvedValueOnce([mockBuyer]);

    const event = createAuthenticatedEvent('admin@i2speedex.com');

    // Act
    const response = await handler(event);

    // Assert
    expect(response.statusCode).toBe(200);

    const body = JSON.parse(response.body!);
    expect(body.success).toBe(true);
    expect(body.data.items).toHaveLength(1);
    expect(body.data.serverTimestamp).toBeDefined();

    // Verify filter excludes soft-deleted records
    expect(mockScanAllItems).toHaveBeenCalledWith(
      expect.objectContaining({
        FilterExpression: expect.stringContaining('attribute_not_exists(deletedAt)'),
      })
    );
  });

  it('should return only updated records for delta sync (with since param)', async () => {
    // Arrange
    const updatedBuyer = { ...mockBuyer, updatedAt: '2026-02-01T00:00:00.000Z' };
    mockScanAllItems.mockResolvedValueOnce([updatedBuyer]);

    const event = createEventWithQueryParams(
      { since: '2026-01-15T00:00:00.000Z' },
      createAuthenticatedEvent('admin@i2speedex.com')
    );

    // Act
    const response = await handler(event);

    // Assert
    expect(response.statusCode).toBe(200);

    const body = JSON.parse(response.body!);
    expect(body.data.items).toHaveLength(1);

    // Verify filter uses updatedAt > since
    expect(mockScanAllItems).toHaveBeenCalledWith(
      expect.objectContaining({
        FilterExpression: expect.stringContaining('updatedAt > :since'),
        ExpressionAttributeValues: expect.objectContaining({
          ':since': '2026-01-15T00:00:00.000Z',
        }),
      })
    );
  });

  it('should include soft-deleted records in delta sync', async () => {
    // Arrange
    const deletedBuyer = {
      ...mockBuyer,
      deletedAt: '2026-02-01T00:00:00.000Z',
      updatedAt: '2026-02-01T00:00:00.000Z',
    };
    mockScanAllItems.mockResolvedValueOnce([deletedBuyer]);

    const event = createEventWithQueryParams(
      { since: '2026-01-15T00:00:00.000Z' },
      createAuthenticatedEvent('admin@i2speedex.com')
    );

    // Act
    const response = await handler(event);

    // Assert
    expect(response.statusCode).toBe(200);

    const body = JSON.parse(response.body!);
    expect(body.data.items).toHaveLength(1);

    // Verify filter does NOT exclude soft-deleted records during delta sync
    const callArgs = mockScanAllItems.mock.calls[0][0];
    expect(callArgs.FilterExpression).not.toContain('attribute_not_exists(deletedAt)');
  });

  it('should not filter by createdBy (all users see all buyers)', async () => {
    // Arrange
    mockScanAllItems.mockResolvedValueOnce([mockBuyer]);

    const event = createAuthenticatedEvent('operator@i2speedex.com', ['operator']);

    // Act
    const response = await handler(event);

    // Assert
    expect(response.statusCode).toBe(200);

    // Verify NO createdBy filter was added
    const callArgs = mockScanAllItems.mock.calls[0][0];
    if (callArgs.ExpressionAttributeValues) {
      expect(callArgs.ExpressionAttributeValues[':createdBy']).toBeUndefined();
    }
  });

  it('should return serverTimestamp', async () => {
    // Arrange
    mockScanAllItems.mockResolvedValueOnce([]);

    const event = createAuthenticatedEvent('admin@i2speedex.com');

    // Act
    const response = await handler(event);

    // Assert
    expect(response.statusCode).toBe(200);

    const body = JSON.parse(response.body!);
    expect(body.data.serverTimestamp).toBeDefined();
    expect(new Date(body.data.serverTimestamp).toISOString()).toBe(body.data.serverTimestamp);
  });

  it('should handle DynamoDB error', async () => {
    // Arrange
    mockScanAllItems.mockRejectedValueOnce(new Error('DynamoDB error'));

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
