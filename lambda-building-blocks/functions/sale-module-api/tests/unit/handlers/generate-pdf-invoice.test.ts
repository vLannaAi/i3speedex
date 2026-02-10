/**
 * Unit tests for generate-pdf-invoice handler
 */

import { handler } from '../../../src/handlers/invoices/generate-pdf-invoice';
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
  convertHtmlToPdf: jest.fn(),
}));

jest.mock('../../../src/common/clients/s3', () => ({
  ...jest.requireActual('../../../src/common/clients/s3'),
  uploadInvoicePDF: jest.fn(),
}));

describe('Generate PDF Invoice Handler', () => {
  const mockGetItem = dynamodb.getItem as jest.MockedFunction<typeof dynamodb.getItem>;
  const mockQueryItems = dynamodb.queryItems as jest.MockedFunction<typeof dynamodb.queryItems>;
  const mockUpdateItem = dynamodb.updateItem as jest.MockedFunction<typeof dynamodb.updateItem>;
  const mockRenderTemplate = lambda.renderTemplate as jest.MockedFunction<typeof lambda.renderTemplate>;
  const mockConvertHtmlToPdf = lambda.convertHtmlToPdf as jest.MockedFunction<typeof lambda.convertHtmlToPdf>;
  const mockUploadInvoicePDF = s3.uploadInvoicePDF as jest.MockedFunction<typeof s3.uploadInvoicePDF>;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should generate PDF invoice successfully', async () => {
    // Arrange
    const confirmedSale = {
      ...mockSale,
      status: 'confirmed' as const,
    };

    const mockPdfBuffer = Buffer.from('PDF content');

    mockGetItem.mockResolvedValueOnce(confirmedSale);
    mockQueryItems.mockResolvedValueOnce({
      items: [mockSaleLine],
      lastEvaluatedKey: undefined,
      count: 1,
    });
    mockRenderTemplate.mockResolvedValueOnce('<html><body>Invoice</body></html>');
    mockConvertHtmlToPdf.mockResolvedValueOnce(mockPdfBuffer);
    mockUploadInvoicePDF.mockResolvedValueOnce('pdfs/2026/SALE001/invoice-SALE001-it.pdf');
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
    expect(body.data.format).toBe('pdf');
    expect(body.data.s3Key).toBeDefined();

    // Verify template was rendered
    expect(mockRenderTemplate).toHaveBeenCalled();

    // Verify HTML was converted to PDF
    expect(mockConvertHtmlToPdf).toHaveBeenCalledWith({
      html: '<html><body>Invoice</body></html>',
      options: expect.objectContaining({
        format: 'A4',
        printBackground: true,
      }),
    });

    // Verify PDF was uploaded
    expect(mockUploadInvoicePDF).toHaveBeenCalledWith({
      saleId: 'SALE001',
      pdfBuffer: mockPdfBuffer,
      language: 'it',
    });

    // Verify sale was updated
    expect(mockUpdateItem).toHaveBeenCalledWith(
      expect.objectContaining({
        ExpressionAttributeValues: expect.objectContaining({
          ':invoiceGenerated': true,
        }),
      })
    );
  });

  it('should generate PDF invoice with custom language', async () => {
    // Arrange
    const confirmedSale = {
      ...mockSale,
      status: 'confirmed' as const,
    };

    const mockPdfBuffer = Buffer.from('PDF content');

    mockGetItem.mockResolvedValueOnce(confirmedSale);
    mockQueryItems.mockResolvedValueOnce({
      items: [mockSaleLine],
      lastEvaluatedKey: undefined,
      count: 1,
    });
    mockRenderTemplate.mockResolvedValueOnce('<html><body>Invoice DE</body></html>');
    mockConvertHtmlToPdf.mockResolvedValueOnce(mockPdfBuffer);
    mockUploadInvoicePDF.mockResolvedValueOnce('pdfs/2026/SALE001/invoice-SALE001-de.pdf');
    mockUpdateItem.mockResolvedValueOnce(undefined);

    const requestBody = {
      language: 'de',
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
    expect(body.data.language).toBe('de');

    // Verify correct language was used
    expect(mockRenderTemplate).toHaveBeenCalledWith(
      expect.objectContaining({
        language: 'de',
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

  it('should handle PDF conversion error', async () => {
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
    mockConvertHtmlToPdf.mockRejectedValueOnce(new Error('PDF conversion failed'));

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

    const mockPdfBuffer = Buffer.from('PDF content');

    mockGetItem.mockResolvedValueOnce(confirmedSale);
    mockQueryItems.mockResolvedValueOnce({
      items: [mockSaleLine],
      lastEvaluatedKey: undefined,
      count: 1,
    });
    mockRenderTemplate.mockResolvedValueOnce('<html><body>Invoice</body></html>');
    mockConvertHtmlToPdf.mockResolvedValueOnce(mockPdfBuffer);
    mockUploadInvoicePDF.mockRejectedValueOnce(new Error('S3 upload failed'));

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
