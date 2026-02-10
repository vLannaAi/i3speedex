/**
 * Unit tests for list-attachments handler
 */

import { handler } from '../../../src/handlers/attachments/list-attachments';
import { createAuthenticatedEvent, createEventWithPathParams } from '../../fixtures/event.fixture';
import { mockSale, mockAttachment } from '../../fixtures/sale.fixture';
import * as dynamodb from '../../../src/common/clients/dynamodb';
import * as s3 from '../../../src/common/clients/s3';

// Mock clients - partial mock to preserve utility functions
jest.mock('../../../src/common/clients/dynamodb', () => ({
  ...jest.requireActual('../../../src/common/clients/dynamodb'),
  getItem: jest.fn(),
  queryItems: jest.fn(),
}));

jest.mock('../../../src/common/clients/s3', () => ({
  ...jest.requireActual('../../../src/common/clients/s3'),
  generateDownloadUrl: jest.fn(),
}));

describe('List Attachments Handler', () => {
  const mockGetItem = dynamodb.getItem as jest.MockedFunction<typeof dynamodb.getItem>;
  const mockQueryItems = dynamodb.queryItems as jest.MockedFunction<typeof dynamodb.queryItems>;
  const mockGenerateDownloadUrl = s3.generateDownloadUrl as jest.MockedFunction<typeof s3.generateDownloadUrl>;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should list attachments successfully', async () => {
    // Arrange
    mockGetItem.mockResolvedValueOnce(mockSale);
    mockQueryItems.mockResolvedValueOnce({
      items: [mockAttachment],
      lastEvaluatedKey: undefined,
      count: 1,
    });
    mockGenerateDownloadUrl.mockResolvedValue(
      'https://s3.amazonaws.com/bucket/download?signed=true'
    );

    const event = createEventWithPathParams(
      { id: 'SALE001' },
      createAuthenticatedEvent('admin@i2speedex.com')
    );

    // Act
    const response = await handler(event);

    // Assert
    expect(response.statusCode).toBe(200);

    const body = JSON.parse(response.body!);
    expect(body.success).toBe(true);
    expect(body.data.attachments).toHaveLength(1);
    expect(body.data.count).toBe(1);
    expect(body.data.attachments[0]).toMatchObject({
      attachmentId: 'ATT001',
      fileName: 'invoice-document.pdf',
      fileType: 'application/pdf',
      downloadUrl: expect.any(String),
    });

    // Verify download URL was generated
    expect(mockGenerateDownloadUrl).toHaveBeenCalledWith({
      bucket: expect.any(String),
      key: 'attachments/2026/SALE001/ATT001.pdf',
      expiresIn: 3600,
    });
  });

  it('should list multiple attachments sorted by date', async () => {
    // Arrange
    const attachment1 = {
      ...mockAttachment,
      attachmentId: 'ATT001',
      createdAt: '2026-01-29T10:00:00.000Z',
    };
    const attachment2 = {
      ...mockAttachment,
      attachmentId: 'ATT002',
      fileName: 'photo.jpg',
      createdAt: '2026-01-29T12:00:00.000Z', // Newer
    };

    mockGetItem.mockResolvedValueOnce(mockSale);
    mockQueryItems.mockResolvedValueOnce({
      items: [attachment1, attachment2],
      lastEvaluatedKey: undefined,
      count: 2,
    });
    mockGenerateDownloadUrl.mockResolvedValue(
      'https://s3.amazonaws.com/bucket/download?signed=true'
    );

    const event = createEventWithPathParams(
      { id: 'SALE001' },
      createAuthenticatedEvent('admin@i2speedex.com')
    );

    // Act
    const response = await handler(event);

    // Assert
    expect(response.statusCode).toBe(200);

    const body = JSON.parse(response.body!);
    expect(body.data.attachments).toHaveLength(2);

    // Verify sorted by date (newest first)
    expect(body.data.attachments[0].attachmentId).toBe('ATT002');
    expect(body.data.attachments[1].attachmentId).toBe('ATT001');
  });

  it('should return empty list when no attachments', async () => {
    // Arrange
    mockGetItem.mockResolvedValueOnce(mockSale);
    mockQueryItems.mockResolvedValueOnce({
      items: [],
      lastEvaluatedKey: undefined,
      count: 0,
    });

    const event = createEventWithPathParams(
      { id: 'SALE001' },
      createAuthenticatedEvent('admin@i2speedex.com')
    );

    // Act
    const response = await handler(event);

    // Assert
    expect(response.statusCode).toBe(200);

    const body = JSON.parse(response.body!);
    expect(body.data.attachments).toEqual([]);
    expect(body.data.count).toBe(0);
  });

  it('should return 404 when sale not found', async () => {
    // Arrange
    mockGetItem.mockResolvedValueOnce(null);

    const event = createEventWithPathParams(
      { id: 'NONEXISTENT' },
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
      { id: 'SALE001' },
      createAuthenticatedEvent('admin@i2speedex.com')
    );

    // Act
    const response = await handler(event);

    // Assert
    expect(response.statusCode).toBe(404);
  });

  it('should return 404 when operator accesses another user sale', async () => {
    // Arrange
    const operatorSale = {
      ...mockSale,
      createdBy: 'operator1@i2speedex.com',
    };

    mockGetItem.mockResolvedValueOnce(operatorSale);

    const event = createEventWithPathParams(
      { id: 'SALE001' },
      createAuthenticatedEvent('operator2@i2speedex.com', ['operator'])
    );

    // Act
    const response = await handler(event);

    // Assert
    expect(response.statusCode).toBe(404);

    const body = JSON.parse(response.body!);
    expect(body.error).toBe('Not Found');
  });

  it('should allow admin to access any sale', async () => {
    // Arrange
    const operatorSale = {
      ...mockSale,
      createdBy: 'operator1@i2speedex.com',
    };

    mockGetItem.mockResolvedValueOnce(operatorSale);
    mockQueryItems.mockResolvedValueOnce({
      items: [mockAttachment],
      lastEvaluatedKey: undefined,
      count: 1,
    });
    mockGenerateDownloadUrl.mockResolvedValue(
      'https://s3.amazonaws.com/bucket/download?signed=true'
    );

    const event = createEventWithPathParams(
      { id: 'SALE001' },
      createAuthenticatedEvent('admin@i2speedex.com')
    );

    // Act
    const response = await handler(event);

    // Assert
    expect(response.statusCode).toBe(200);
  });

  it('should handle DynamoDB error', async () => {
    // Arrange
    mockGetItem.mockRejectedValueOnce(new Error('DynamoDB error'));

    const event = createEventWithPathParams(
      { id: 'SALE001' },
      createAuthenticatedEvent('admin@i2speedex.com')
    );

    // Act
    const response = await handler(event);

    // Assert
    expect(response.statusCode).toBe(500);

    const body = JSON.parse(response.body!);
    expect(body.error).toBe('Internal Server Error');
  });

  it('should handle S3 error when generating download URL', async () => {
    // Arrange
    mockGetItem.mockResolvedValueOnce(mockSale);
    mockQueryItems.mockResolvedValueOnce({
      items: [mockAttachment],
      lastEvaluatedKey: undefined,
      count: 1,
    });
    mockGenerateDownloadUrl.mockRejectedValueOnce(new Error('S3 error'));

    const event = createEventWithPathParams(
      { id: 'SALE001' },
      createAuthenticatedEvent('admin@i2speedex.com')
    );

    // Act
    const response = await handler(event);

    // Assert
    expect(response.statusCode).toBe(500);
  });
});
