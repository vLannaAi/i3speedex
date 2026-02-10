/**
 * Unit tests for register-attachment handler
 */

import { handler } from '../../../src/handlers/attachments/register-attachment';
import { createAuthenticatedEvent, createEventWithPathParams, createEventWithBody } from '../../fixtures/event.fixture';
import { mockSale } from '../../fixtures/sale.fixture';
import * as dynamodb from '../../../src/common/clients/dynamodb';

// Mock clients - partial mock to preserve utility functions
jest.mock('../../../src/common/clients/dynamodb', () => ({
  ...jest.requireActual('../../../src/common/clients/dynamodb'),
  getItem: jest.fn(),
  putItem: jest.fn(),
}));

describe('Register Attachment Handler', () => {
  const mockGetItem = dynamodb.getItem as jest.MockedFunction<typeof dynamodb.getItem>;
  const mockPutItem = dynamodb.putItem as jest.MockedFunction<typeof dynamodb.putItem>;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should register attachment successfully', async () => {
    // Arrange
    mockGetItem.mockResolvedValueOnce(mockSale);
    mockPutItem.mockResolvedValueOnce(undefined);

    const requestBody = {
      attachmentId: 'ATT001',
      fileName: 'document.pdf',
      fileType: 'application/pdf',
      fileSize: 1024000,
      s3Key: 'attachments/2026/SALE001/ATT001.pdf',
      description: 'Invoice supporting document',
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
    expect(body.data.attachmentId).toBe('ATT001');
    expect(body.data.fileName).toBe('document.pdf');
    expect(body.data.description).toBe('Invoice supporting document');

    // Verify attachment was saved
    expect(mockPutItem).toHaveBeenCalledWith({
      TableName: expect.any(String),
      Item: expect.objectContaining({
        PK: 'SALE#SALE001',
        SK: 'ATTACHMENT#ATT001',
        attachmentId: 'ATT001',
        saleId: 'SALE001',
        fileName: 'document.pdf',
        s3Key: 'attachments/2026/SALE001/ATT001.pdf',
      }),
    });
  });

  it('should register attachment without description', async () => {
    // Arrange
    mockGetItem.mockResolvedValueOnce(mockSale);
    mockPutItem.mockResolvedValueOnce(undefined);

    const requestBody = {
      attachmentId: 'ATT002',
      fileName: 'photo.jpg',
      fileType: 'image/jpeg',
      fileSize: 512000,
      s3Key: 'attachments/2026/SALE001/ATT002.jpg',
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
    expect(body.data.description).toBeUndefined();
  });

  it('should return 404 when sale not found', async () => {
    // Arrange
    mockGetItem.mockResolvedValueOnce(null);

    const requestBody = {
      attachmentId: 'ATT001',
      fileName: 'document.pdf',
      fileType: 'application/pdf',
      fileSize: 1024000,
      s3Key: 'attachments/2026/SALE001/ATT001.pdf',
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
      attachmentId: 'ATT001',
      fileName: 'document.pdf',
      fileType: 'application/pdf',
      fileSize: 1024000,
      s3Key: 'attachments/2026/SALE001/ATT001.pdf',
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
      attachmentId: 'ATT001',
      fileName: 'document.pdf',
      // Missing fileType, fileSize, s3Key
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

  it('should return 403 when user lacks permission to access sale', async () => {
    // Arrange
    const operatorSale = {
      ...mockSale,
      createdBy: 'operator1@i2speedex.com',
    };

    mockGetItem.mockResolvedValueOnce(operatorSale);

    const requestBody = {
      attachmentId: 'ATT001',
      fileName: 'document.pdf',
      fileType: 'application/pdf',
      fileSize: 1024000,
      s3Key: 'attachments/2026/SALE001/ATT001.pdf',
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
      attachmentId: 'ATT001',
      fileName: 'document.pdf',
      fileType: 'application/pdf',
      fileSize: 1024000,
      s3Key: 'attachments/2026/SALE001/ATT001.pdf',
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

  it('should handle DynamoDB error', async () => {
    // Arrange
    mockGetItem.mockRejectedValueOnce(new Error('DynamoDB error'));

    const requestBody = {
      attachmentId: 'ATT001',
      fileName: 'document.pdf',
      fileType: 'application/pdf',
      fileSize: 1024000,
      s3Key: 'attachments/2026/SALE001/ATT001.pdf',
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
