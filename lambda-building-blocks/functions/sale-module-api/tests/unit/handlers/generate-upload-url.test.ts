/**
 * Unit tests for generate-upload-url handler
 */

import { handler } from '../../../src/handlers/attachments/generate-upload-url';
import { createAuthenticatedEvent, createEventWithPathParams, createEventWithBody } from '../../fixtures/event.fixture';
import { mockSale } from '../../fixtures/sale.fixture';
import * as dynamodb from '../../../src/common/clients/dynamodb';
import * as s3 from '../../../src/common/clients/s3';

// Mock clients - partial mock to preserve utility functions
jest.mock('../../../src/common/clients/dynamodb', () => ({
  ...jest.requireActual('../../../src/common/clients/dynamodb'),
  getItem: jest.fn(),
}));

jest.mock('../../../src/common/clients/s3', () => ({
  ...jest.requireActual('../../../src/common/clients/s3'),
  generateUploadUrl: jest.fn(),
}));

describe('Generate Upload URL Handler', () => {
  const mockGetItem = dynamodb.getItem as jest.MockedFunction<typeof dynamodb.getItem>;
  const mockGenerateUploadUrl = s3.generateUploadUrl as jest.MockedFunction<typeof s3.generateUploadUrl>;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should generate upload URL successfully', async () => {
    // Arrange
    mockGetItem.mockResolvedValueOnce(mockSale);
    mockGenerateUploadUrl.mockResolvedValueOnce(
      'https://s3.amazonaws.com/bucket/upload?signed=true'
    );

    const requestBody = {
      fileName: 'document.pdf',
      fileType: 'application/pdf',
      fileSize: 1024000,
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
    expect(body.data.uploadUrl).toBeDefined();
    expect(body.data.attachmentId).toBeDefined();
    expect(body.data.s3Key).toBeDefined();
    expect(body.data.expiresIn).toBe(900);

    // Verify upload URL was generated
    expect(mockGenerateUploadUrl).toHaveBeenCalledWith({
      bucket: expect.any(String),
      key: expect.stringContaining('attachments/'),
      contentType: 'application/pdf',
      expiresIn: 900,
    });
  });

  it('should support different file types', async () => {
    // Arrange
    mockGetItem.mockResolvedValueOnce(mockSale);
    mockGenerateUploadUrl.mockResolvedValueOnce(
      'https://s3.amazonaws.com/bucket/upload?signed=true'
    );

    const requestBody = {
      fileName: 'photo.jpg',
      fileType: 'image/jpeg',
      fileSize: 512000,
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
    expect(body.data.s3Key).toContain('.jpg');
  });

  it('should return 404 when sale not found', async () => {
    // Arrange
    mockGetItem.mockResolvedValueOnce(null);

    const requestBody = {
      fileName: 'document.pdf',
      fileType: 'application/pdf',
      fileSize: 1024000,
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
      fileName: 'document.pdf',
      fileType: 'application/pdf',
      fileSize: 1024000,
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
  });

  it('should return 422 when required fields are missing', async () => {
    // Arrange
    const requestBody = {
      fileName: 'document.pdf',
      // Missing fileType and fileSize
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

  it('should return 422 when file size exceeds limit', async () => {
    // Arrange
    mockGetItem.mockResolvedValueOnce(mockSale);

    const requestBody = {
      fileName: 'large-file.pdf',
      fileType: 'application/pdf',
      fileSize: 11 * 1024 * 1024, // 11MB (exceeds 10MB limit)
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
    expect(body.message).toContain('exceeds maximum limit');
  });

  it('should return 422 for invalid file type', async () => {
    // Arrange
    mockGetItem.mockResolvedValueOnce(mockSale);

    const requestBody = {
      fileName: 'script.js',
      fileType: 'application/javascript',
      fileSize: 1024,
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
    expect(body.message).toContain('File type not allowed');
  });

  it('should return 403 when user lacks permission to access sale', async () => {
    // Arrange
    const operatorSale = {
      ...mockSale,
      createdBy: 'operator1@i2speedex.com',
    };

    mockGetItem.mockResolvedValueOnce(operatorSale);

    const requestBody = {
      fileName: 'document.pdf',
      fileType: 'application/pdf',
      fileSize: 1024000,
    };

    const event = createEventWithBody(
      requestBody,
      createEventWithPathParams(
        { id: 'SALE001' },
        createAuthenticatedEvent('operator2@i2speedex.com', ['operator'])
      )
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
    const requestBody = {
      fileName: 'document.pdf',
      fileType: 'application/pdf',
      fileSize: 1024000,
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
  });

  it('should handle S3 error when generating upload URL', async () => {
    // Arrange
    mockGetItem.mockResolvedValueOnce(mockSale);
    mockGenerateUploadUrl.mockRejectedValueOnce(new Error('S3 error'));

    const requestBody = {
      fileName: 'document.pdf',
      fileType: 'application/pdf',
      fileSize: 1024000,
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
    expect(body.error).toBe('Internal Server Error');
  });
});
