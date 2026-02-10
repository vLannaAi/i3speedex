/**
 * Unit tests for generate-sdi-invoice handler
 */

import { handler } from '../../../src/handlers/invoices/generate-sdi-invoice';
import { createAuthenticatedEvent, createEventWithPathParams } from '../../fixtures/event.fixture';
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
  generateSdiXml: jest.fn(),
}));

jest.mock('../../../src/common/clients/s3', () => ({
  ...jest.requireActual('../../../src/common/clients/s3'),
  uploadInvoiceXML: jest.fn(),
}));

describe('Generate SDI Invoice Handler', () => {
  const mockGetItem = dynamodb.getItem as jest.MockedFunction<typeof dynamodb.getItem>;
  const mockQueryItems = dynamodb.queryItems as jest.MockedFunction<typeof dynamodb.queryItems>;
  const mockUpdateItem = dynamodb.updateItem as jest.MockedFunction<typeof dynamodb.updateItem>;
  const mockGenerateSdiXml = lambda.generateSdiXml as jest.MockedFunction<typeof lambda.generateSdiXml>;
  const mockUploadInvoiceXML = s3.uploadInvoiceXML as jest.MockedFunction<typeof s3.uploadInvoiceXML>;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should generate SDI XML invoice successfully for Italian sale', async () => {
    // Arrange
    const italianSale = {
      ...mockSale,
      status: 'confirmed' as const,
      buyerCountry: 'IT',
      producerCountry: 'IT',
    };

    mockGetItem.mockResolvedValueOnce(italianSale);
    mockQueryItems.mockResolvedValueOnce({
      items: [mockSaleLine],
      lastEvaluatedKey: undefined,
      count: 1,
    });
    mockGenerateSdiXml.mockResolvedValueOnce('<?xml version="1.0"?><Invoice></Invoice>');
    mockUploadInvoiceXML.mockResolvedValueOnce('xml/2026/SALE001/invoice-SALE001.xml');
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
    expect(body.data.format).toBe('sdi');
    expect(body.data.s3Key).toBeDefined();

    // Verify SDI XML was generated
    expect(mockGenerateSdiXml).toHaveBeenCalledWith(
      expect.objectContaining({
        sale: expect.objectContaining({
          saleId: 'SALE001',
        }),
        buyer: expect.objectContaining({
          country: 'IT',
        }),
        producer: expect.objectContaining({
          country: 'IT',
        }),
        lines: expect.any(Array),
        totals: expect.any(Object),
      })
    );

    // Verify XML was uploaded
    expect(mockUploadInvoiceXML).toHaveBeenCalled();

    // Verify sale was updated
    expect(mockUpdateItem).toHaveBeenCalledWith(
      expect.objectContaining({
        ExpressionAttributeValues: expect.objectContaining({
          ':invoiceGenerated': true,
        }),
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
      buyerCountry: 'IT',
      producerCountry: 'IT',
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
    expect(body.message).toContain('draft sale');
  });

  it('should return 422 when buyer is not Italian', async () => {
    // Arrange
    const nonItalianBuyerSale = {
      ...mockSale,
      status: 'confirmed' as const,
      buyerCountry: 'DE',
      producerCountry: 'IT',
    };
    mockGetItem.mockResolvedValueOnce(nonItalianBuyerSale);

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
    expect(body.message).toContain('Italian buyers and producers');
  });

  it('should return 422 when producer is not Italian', async () => {
    // Arrange
    const nonItalianProducerSale = {
      ...mockSale,
      status: 'confirmed' as const,
      buyerCountry: 'IT',
      producerCountry: 'FR',
    };
    mockGetItem.mockResolvedValueOnce(nonItalianProducerSale);

    const event = createEventWithPathParams(
      { id: 'SALE001' },
      createAuthenticatedEvent('admin@i2speedex.com')
    );

    // Act
    const response = await handler(event);

    // Assert
    expect(response.statusCode).toBe(422);

    const body = JSON.parse(response.body!);
    expect(body.message).toContain('Italian buyers and producers');
  });

  it('should return 422 when sale has no lines', async () => {
    // Arrange
    const italianSale = {
      ...mockSale,
      status: 'confirmed' as const,
      buyerCountry: 'IT',
      producerCountry: 'IT',
    };

    mockGetItem.mockResolvedValueOnce(italianSale);
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

  it('should return 403 when user lacks permission to access sale', async () => {
    // Arrange
    const operatorSale = {
      ...mockSale,
      status: 'confirmed' as const,
      buyerCountry: 'IT',
      producerCountry: 'IT',
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
  });

  it('should handle SDI generation error', async () => {
    // Arrange
    const italianSale = {
      ...mockSale,
      status: 'confirmed' as const,
      buyerCountry: 'IT',
      producerCountry: 'IT',
    };

    mockGetItem.mockResolvedValueOnce(italianSale);
    mockQueryItems.mockResolvedValueOnce({
      items: [mockSaleLine],
      lastEvaluatedKey: undefined,
      count: 1,
    });
    mockGenerateSdiXml.mockRejectedValueOnce(new Error('SDI generation failed'));

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

  it('should handle S3 upload error', async () => {
    // Arrange
    const italianSale = {
      ...mockSale,
      status: 'confirmed' as const,
      buyerCountry: 'IT',
      producerCountry: 'IT',
    };

    mockGetItem.mockResolvedValueOnce(italianSale);
    mockQueryItems.mockResolvedValueOnce({
      items: [mockSaleLine],
      lastEvaluatedKey: undefined,
      count: 1,
    });
    mockGenerateSdiXml.mockResolvedValueOnce('<?xml version="1.0"?><Invoice></Invoice>');
    mockUploadInvoiceXML.mockRejectedValueOnce(new Error('S3 upload failed'));

    const event = createEventWithPathParams(
      { id: 'SALE001' },
      createAuthenticatedEvent('admin@i2speedex.com')
    );

    // Act
    const response = await handler(event);

    // Assert
    expect(response.statusCode).toBe(500);
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
  });
});
