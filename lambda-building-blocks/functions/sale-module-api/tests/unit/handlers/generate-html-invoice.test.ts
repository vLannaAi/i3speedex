/**
 * Unit tests for generate-html-invoice handler
 */

import { handler } from '../../../src/handlers/invoices/generate-html-invoice';
import { createAuthenticatedEvent, createEventWithPathParams, createEventWithBody } from '../../fixtures/event.fixture';
import { mockSale, mockSaleLine } from '../../fixtures/sale.fixture';
import * as dynamodb from '../../../src/common/clients/dynamodb';
import * as lambda from '../../../src/common/clients/lambda';
import * as s3 from '../../../src/common/clients/s3';

// Mock clients - partial mock to preserve utility functions
jest.mock('../../../src/common/clients/dynamodb', () => ({
  ...jest.requireActual('../../../src/common/clients/dynamodb'),
  getItem: jest.fn(),
  queryItems: jest.fn(),
  updateItem: jest.fn(),
}));

jest.mock('../../../src/common/clients/lambda', () => ({
  ...jest.requireActual('../../../src/common/clients/lambda'),
  renderTemplate: jest.fn(),
}));

jest.mock('../../../src/common/clients/s3', () => ({
  ...jest.requireActual('../../../src/common/clients/s3'),
  uploadInvoiceHTML: jest.fn(),
}));

describe('Generate HTML Invoice Handler', () => {
  const mockGetItem = dynamodb.getItem as jest.MockedFunction<typeof dynamodb.getItem>;
  const mockQueryItems = dynamodb.queryItems as jest.MockedFunction<typeof dynamodb.queryItems>;
  const mockUpdateItem = dynamodb.updateItem as jest.MockedFunction<typeof dynamodb.updateItem>;
  const mockRenderTemplate = lambda.renderTemplate as jest.MockedFunction<typeof lambda.renderTemplate>;
  const mockUploadInvoiceHTML = s3.uploadInvoiceHTML as jest.MockedFunction<typeof s3.uploadInvoiceHTML>;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should generate HTML invoice successfully', async () => {
    // Arrange
    const confirmedSale = {
      ...mockSale,
      status: 'confirmed' as const,
    };

    mockGetItem.mockResolvedValueOnce(confirmedSale);
    mockQueryItems.mockResolvedValueOnce({
      items: [mockSaleLine],
      lastEvaluatedKey: undefined,
      count: 1,
    });
    mockRenderTemplate.mockResolvedValueOnce('<html><body>Invoice</body></html>');
    mockUploadInvoiceHTML.mockResolvedValueOnce('html/2026/SALE001/invoice-SALE001-it.html');
    mockUpdateItem.mockResolvedValueOnce(undefined);

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
    expect(body.data.format).toBe('html');
    expect(body.data.s3Key).toBeDefined();

    // Verify template was rendered
    expect(mockRenderTemplate).toHaveBeenCalledWith({
      template: 'invoice',
      language: 'it',
      data: expect.objectContaining({
        sale: expect.any(Object),
        buyer: expect.any(Object),
        producer: expect.any(Object),
        lines: expect.any(Array),
        totals: expect.any(Object),
      }),
    });

    // Verify HTML was uploaded
    expect(mockUploadInvoiceHTML).toHaveBeenCalled();

    // Verify sale was updated
    expect(mockUpdateItem).toHaveBeenCalledWith(
      expect.objectContaining({
        ExpressionAttributeValues: expect.objectContaining({
          ':invoiceGenerated': true,
          ':invoiceNumber': expect.any(String),
        }),
      })
    );
  });

  it('should generate HTML invoice with custom language', async () => {
    // Arrange
    const confirmedSale = {
      ...mockSale,
      status: 'confirmed' as const,
    };

    mockGetItem.mockResolvedValueOnce(confirmedSale);
    mockQueryItems.mockResolvedValueOnce({
      items: [mockSaleLine],
      lastEvaluatedKey: undefined,
      count: 1,
    });
    mockRenderTemplate.mockResolvedValueOnce('<html><body>Invoice EN</body></html>');
    mockUploadInvoiceHTML.mockResolvedValueOnce('html/2026/SALE001/invoice-SALE001-en.html');
    mockUpdateItem.mockResolvedValueOnce(undefined);

    const requestBody = {
      language: 'en',
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
    expect(body.data.language).toBe('en');

    // Verify correct language was used
    expect(mockRenderTemplate).toHaveBeenCalledWith(
      expect.objectContaining({
        language: 'en',
      })
    );
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

  it('should return 422 when sale is draft', async () => {
    // Arrange
    const draftSale = {
      ...mockSale,
      status: 'draft' as const,
    };
    mockGetItem.mockResolvedValueOnce(draftSale);

    const event = createEventWithPathParams(
      { id: 'SALE001' },
      createAuthenticatedEvent('admin@i2speedex.com')
    );

    // Act
    const response = await handler(event);

    // Assert
    expect(response.statusCode).toBe(422);

    const body = JSON.parse(response.body!);
    expect(body.error).toBe('Validation Error');
    expect(body.message).toContain('draft sale');
  });

  it('should return 422 when sale has no lines', async () => {
    // Arrange
    const confirmedSale = {
      ...mockSale,
      status: 'confirmed' as const,
    };

    mockGetItem.mockResolvedValueOnce(confirmedSale);
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
    expect(response.statusCode).toBe(422);

    const body = JSON.parse(response.body!);
    expect(body.message).toContain('no lines');
  });

  it('should return 422 for invalid language', async () => {
    // Arrange
    const requestBody = {
      language: 'invalid',
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
    expect(body.message).toContain('language must be one of');
  });

  it('should return 403 when user lacks permission to access sale', async () => {
    // Arrange
    const operatorSale = {
      ...mockSale,
      status: 'confirmed' as const,
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
    expect(response.statusCode).toBe(403);

    const body = JSON.parse(response.body!);
    expect(body.error).toBe('Forbidden');
  });

  it('should return 403 when user lacks write permission', async () => {
    // Arrange
    const event = createEventWithPathParams(
      { id: 'SALE001' },
      createAuthenticatedEvent('viewer@i2speedex.com', ['viewer'])
    );

    // Act
    const response = await handler(event);

    // Assert
    expect(response.statusCode).toBe(403);

    const body = JSON.parse(response.body!);
    expect(body.error).toBe('Forbidden');
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

  it('should handle Lambda rendering error', async () => {
    // Arrange
    const confirmedSale = {
      ...mockSale,
      status: 'confirmed' as const,
    };

    mockGetItem.mockResolvedValueOnce(confirmedSale);
    mockQueryItems.mockResolvedValueOnce({
      items: [mockSaleLine],
      lastEvaluatedKey: undefined,
      count: 1,
    });
    mockRenderTemplate.mockRejectedValueOnce(new Error('Template rendering failed'));

    const event = createEventWithPathParams(
      { id: 'SALE001' },
      createAuthenticatedEvent('admin@i2speedex.com')
    );

    // Act
    const response = await handler(event);

    // Assert
    expect(response.statusCode).toBe(500);
  });

  it('should handle S3 upload error', async () => {
    // Arrange
    const confirmedSale = {
      ...mockSale,
      status: 'confirmed' as const,
    };

    mockGetItem.mockResolvedValueOnce(confirmedSale);
    mockQueryItems.mockResolvedValueOnce({
      items: [mockSaleLine],
      lastEvaluatedKey: undefined,
      count: 1,
    });
    mockRenderTemplate.mockResolvedValueOnce('<html><body>Invoice</body></html>');
    mockUploadInvoiceHTML.mockRejectedValueOnce(new Error('S3 upload failed'));

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
