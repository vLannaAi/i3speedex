/**
 * Unit tests for delete-attachment handler
 */

import { handler } from '../../../src/handlers/attachments/delete-attachment';
import { createAuthenticatedEvent, createEventWithPathParams } from '../../fixtures/event.fixture';
import { mockSale, mockAttachment } from '../../fixtures/sale.fixture';
import * as dynamodb from '../../../src/common/clients/dynamodb';
import * as s3 from '../../../src/common/clients/s3';

// Mock clients - partial mock to preserve utility functions
jest.mock('../../../src/common/clients/dynamodb', () => ({
  ...jest.requireActual('../../../src/common/clients/dynamodb'),
  getItem: jest.fn(),
  softDelete: jest.fn(),
}));

jest.mock('../../../src/common/clients/s3', () => ({
  ...jest.requireActual('../../../src/common/clients/s3'),
  deleteFile: jest.fn(),
}));

// Mock console.warn to suppress warnings in tests
const mockConsoleWarn = jest.spyOn(console, 'warn').mockImplementation();

describe('Delete Attachment Handler', () => {
  const mockGetItem = dynamodb.getItem as jest.MockedFunction<typeof dynamodb.getItem>;
  const mockSoftDelete = dynamodb.softDelete as jest.MockedFunction<typeof dynamodb.softDelete>;
  const mockDeleteFile = s3.deleteFile as jest.MockedFunction<typeof s3.deleteFile>;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterAll(() => {
    mockConsoleWarn.mockRestore();
  });

  it('should delete attachment successfully', async () => {
    // Arrange
    mockGetItem
      .mockResolvedValueOnce(mockSale) // First call: get sale
      .mockResolvedValueOnce(mockAttachment); // Second call: get attachment
    mockSoftDelete.mockResolvedValueOnce(undefined);
    mockDeleteFile.mockResolvedValueOnce(undefined);

    const event = createEventWithPathParams(
      { id: 'SALE001', attachmentId: 'ATT001' },
      createAuthenticatedEvent('admin@i2speedex.com')
    );

    // Act
    const response = await handler(event);

    // Assert
    expect(response.statusCode).toBe(200);

    const body = JSON.parse(response.body!);
    expect(body.success).toBe(true);
    expect(body.data.attachmentId).toBe('ATT001');
    expect(body.data.message).toContain('deleted successfully');

    // Verify soft delete was called
    expect(mockSoftDelete).toHaveBeenCalledWith(
      expect.any(String),
      {
        PK: 'SALE#SALE001',
        SK: 'ATTACHMENT#ATT001',
      },
      'admin@i2speedex.com'
    );

    // Verify S3 file was deleted
    expect(mockDeleteFile).toHaveBeenCalledWith({
      bucket: expect.any(String),
      key: 'attachments/2026/SALE001/ATT001.pdf',
    });
  });

  it('should continue if S3 deletion fails', async () => {
    // Arrange
    mockGetItem
      .mockResolvedValueOnce(mockSale)
      .mockResolvedValueOnce(mockAttachment);
    mockSoftDelete.mockResolvedValueOnce(undefined);
    mockDeleteFile.mockRejectedValueOnce(new Error('S3 file not found'));

    const event = createEventWithPathParams(
      { id: 'SALE001', attachmentId: 'ATT001' },
      createAuthenticatedEvent('admin@i2speedex.com')
    );

    // Act
    const response = await handler(event);

    // Assert
    expect(response.statusCode).toBe(200);

    const body = JSON.parse(response.body!);
    expect(body.success).toBe(true);

    // Verify warning was logged
    expect(mockConsoleWarn).toHaveBeenCalledWith(
      expect.stringContaining('Failed to delete file from S3'),
      expect.any(Error)
    );
  });

  it('should return 404 when sale not found', async () => {
    // Arrange
    mockGetItem.mockResolvedValueOnce(null);

    const event = createEventWithPathParams(
      { id: 'NONEXISTENT', attachmentId: 'ATT001' },
      createAuthenticatedEvent('admin@i2speedex.com')
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

    const event = createEventWithPathParams(
      { id: 'SALE001', attachmentId: 'ATT001' },
      createAuthenticatedEvent('admin@i2speedex.com')
    );

    // Act
    const response = await handler(event);

    // Assert
    expect(response.statusCode).toBe(404);
  });

  it('should return 404 when attachment not found', async () => {
    // Arrange
    mockGetItem
      .mockResolvedValueOnce(mockSale)
      .mockResolvedValueOnce(null); // Attachment not found

    const event = createEventWithPathParams(
      { id: 'SALE001', attachmentId: 'NONEXISTENT' },
      createAuthenticatedEvent('admin@i2speedex.com')
    );

    // Act
    const response = await handler(event);

    // Assert
    expect(response.statusCode).toBe(404);

    const body = JSON.parse(response.body!);
    expect(body.message).toContain('Attachment');
  });

  it('should return 404 when attachment is soft deleted', async () => {
    // Arrange
    const deletedAttachment = {
      ...mockAttachment,
      deletedAt: '2026-01-29T12:00:00.000Z',
    };
    mockGetItem
      .mockResolvedValueOnce(mockSale)
      .mockResolvedValueOnce(deletedAttachment);

    const event = createEventWithPathParams(
      { id: 'SALE001', attachmentId: 'ATT001' },
      createAuthenticatedEvent('admin@i2speedex.com')
    );

    // Act
    const response = await handler(event);

    // Assert
    expect(response.statusCode).toBe(404);
  });

  it('should return 403 when user lacks permission to access sale', async () => {
    // Arrange
    const operatorSale = {
      ...mockSale,
      createdBy: 'operator1@i2speedex.com',
    };

    mockGetItem.mockResolvedValueOnce(operatorSale);

    const event = createEventWithPathParams(
      { id: 'SALE001', attachmentId: 'ATT001' },
      createAuthenticatedEvent('operator2@i2speedex.com', ['operator'])
    );

    // Act
    const response = await handler(event);

    // Assert
    expect(response.statusCode).toBe(403);

    const body = JSON.parse(response.body!);
    expect(body.error).toBe('Forbidden');
  });

  it('should return 403 when user lacks write permission', async () => {
    // Arrange
    const event = createEventWithPathParams(
      { id: 'SALE001', attachmentId: 'ATT001' },
      createAuthenticatedEvent('viewer@i2speedex.com', ['viewer'])
    );

    // Act
    const response = await handler(event);

    // Assert
    expect(response.statusCode).toBe(403);
  });

  it('should handle DynamoDB error', async () => {
    // Arrange
    mockGetItem.mockRejectedValueOnce(new Error('DynamoDB error'));

    const event = createEventWithPathParams(
      { id: 'SALE001', attachmentId: 'ATT001' },
      createAuthenticatedEvent('admin@i2speedex.com')
    );

    // Act
    const response = await handler(event);

    // Assert
    expect(response.statusCode).toBe(500);

    const body = JSON.parse(response.body!);
    expect(body.error).toBe('Internal Server Error');
  });

  it('should handle DynamoDB error during soft delete', async () => {
    // Arrange
    mockGetItem
      .mockResolvedValueOnce(mockSale)
      .mockResolvedValueOnce(mockAttachment);
    mockSoftDelete.mockRejectedValueOnce(new Error('DynamoDB soft delete error'));

    const event = createEventWithPathParams(
      { id: 'SALE001', attachmentId: 'ATT001' },
      createAuthenticatedEvent('admin@i2speedex.com')
    );

    // Act
    const response = await handler(event);

    // Assert
    expect(response.statusCode).toBe(500);
  });
});
