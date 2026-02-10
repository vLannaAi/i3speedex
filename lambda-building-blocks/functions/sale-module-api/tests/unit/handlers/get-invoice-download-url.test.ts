/**
 * Unit tests for get-invoice-download-url handler
 */

import { handler } from '../../../src/handlers/invoices/get-invoice-download-url';
import { createAuthenticatedEvent, createEventWithPathParams, createEventWithQueryParams } from '../../fixtures/event.fixture';
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
  generateInvoiceDownloadUrl: jest.fn(),
}));

describe('Get Invoice Download URL Handler', () => {
  const mockGetItem = dynamodb.getItem as jest.MockedFunction<typeof dynamodb.getItem>;
  const mockGenerateInvoiceDownloadUrl = s3.generateInvoiceDownloadUrl as jest.MockedFunction<typeof s3.generateInvoiceDownloadUrl>;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should generate PDF download URL successfully', async () => {
    // Arrange
    const saleWithInvoice = {
      ...mockSale,
      invoiceGenerated: true,
      invoiceNumber: 'INV-2024-001',
    };

    mockGetItem.mockResolvedValueOnce(saleWithInvoice);
    mockGenerateInvoiceDownloadUrl.mockResolvedValueOnce(
      'https://s3.amazonaws.com/bucket/invoice.pdf?signed=true'
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
    expect(body.data.downloadUrl).toBeDefined();
    expect(body.data.format).toBe('pdf');
    expect(body.data.expiresIn).toBe(3600);

    // Verify download URL was generated
    expect(mockGenerateInvoiceDownloadUrl).toHaveBeenCalledWith({
      saleId: 'SALE001',
      format: 'pdf',
      language: 'it',
      expiresIn: 3600,
    });
  });

  it('should generate HTML download URL with custom language', async () => {
    // Arrange
    const saleWithInvoice = {
      ...mockSale,
      invoiceGenerated: true,
      invoiceNumber: 'INV-2024-001',
    };

    mockGetItem.mockResolvedValueOnce(saleWithInvoice);
    mockGenerateInvoiceDownloadUrl.mockResolvedValueOnce(
      'https://s3.amazonaws.com/bucket/invoice.html?signed=true'
    );

    const event = createEventWithQueryParams(
      { format: 'html', language: 'en' },
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
    expect(body.data.format).toBe('html');
    expect(body.data.language).toBe('en');

    // Verify correct format and language
    expect(mockGenerateInvoiceDownloadUrl).toHaveBeenCalledWith({
      saleId: 'SALE001',
      format: 'html',
      language: 'en',
      expiresIn: 3600,
    });
  });

  it('should generate XML download URL', async () => {
    // Arrange
    const saleWithInvoice = {
      ...mockSale,
      invoiceGenerated: true,
      invoiceNumber: 'INV-2024-001',
    };

    mockGetItem.mockResolvedValueOnce(saleWithInvoice);
    mockGenerateInvoiceDownloadUrl.mockResolvedValueOnce(
      'https://s3.amazonaws.com/bucket/invoice.xml?signed=true'
    );

    const event = createEventWithQueryParams(
      { format: 'xml' },
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
    expect(body.data.format).toBe('xml');
    expect(body.data.language).toBeUndefined();

    // Verify language is undefined for XML
    expect(mockGenerateInvoiceDownloadUrl).toHaveBeenCalledWith({
      saleId: 'SALE001',
      format: 'xml',
      language: undefined,
      expiresIn: 3600,
    });
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
      invoiceGenerated: true,
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

  it('should return 422 when invoice not generated', async () => {
    // Arrange
    const saleWithoutInvoice = {
      ...mockSale,
      invoiceGenerated: false,
    };

    mockGetItem.mockResolvedValueOnce(saleWithoutInvoice);

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
    expect(body.message).toContain('not been generated yet');
  });

  it('should return 422 for invalid format', async () => {
    // Arrange
    const event = createEventWithQueryParams(
      { format: 'invalid' },
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
    expect(body.message).toContain('format must be one of');
  });

  it('should return 422 for invalid language', async () => {
    // Arrange
    const event = createEventWithQueryParams(
      { language: 'invalid' },
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

  it('should handle S3 error when file not found', async () => {
    // Arrange
    const saleWithInvoice = {
      ...mockSale,
      invoiceGenerated: true,
      invoiceNumber: 'INV-2024-001',
    };

    mockGetItem.mockResolvedValueOnce(saleWithInvoice);
    mockGenerateInvoiceDownloadUrl.mockRejectedValueOnce(
      new Error('Invoice PDF not found for sale SALE001')
    );

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
