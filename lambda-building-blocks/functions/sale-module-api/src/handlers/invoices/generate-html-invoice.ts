/**
 * Generate HTML Invoice Handler
 * POST /api/sales/{id}/invoice/html
 *
 * Generate HTML invoice for a sale
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { getUserContext, requireWritePermission, getPathParameter, parseRequestBody, canAccessResource } from '../../common/middleware/auth';
import { successResponse, handleError } from '../../common/utils/response';
import { NotFoundError, ForbiddenError, ValidationError } from '../../common/utils/validation';
import { getItem, queryItems, updateItem, updateTimestamp, TableNames } from '../../common/clients/dynamodb';
import { renderTemplate } from '../../common/clients/lambda';
import { uploadInvoiceHTML } from '../../common/clients/s3';
import { Sale, SaleLine, InvoiceGenerationRequest } from '../../common/types';

/**
 * Generate HTML invoice handler
 */
export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;
  const path = event.path;

  try {
    // 1. Extract user context
    const user = getUserContext(event);

    // 2. Check permissions
    requireWritePermission(user);

    // 3. Get sale ID from path
    const saleId = getPathParameter(event, 'id');

    // 4. Parse request body (optional language parameter)
    const body = event.body ? parseRequestBody<InvoiceGenerationRequest>(event) : {};
    const language = body.language || 'it';

    // Validate language
    if (!['it', 'en', 'de', 'fr'].includes(language)) {
      throw new ValidationError('language must be one of: it, en, de, fr');
    }

    // 5. Get sale from DynamoDB
    const sale = await getItem<Sale>({
      TableName: TableNames.Sales,
      Key: {
        PK: `SALE#${saleId}`,
        SK: 'METADATA',
      },
    });

    if (!sale || sale.deletedAt) {
      throw new NotFoundError(`Sale ${saleId} not found`);
    }

    // 6. Check access permissions
    if (!canAccessResource(user, sale.createdBy)) {
      throw new ForbiddenError('You do not have permission to generate invoices for this sale');
    }

    // 7. Validate sale is confirmed
    if (sale.status === 'draft') {
      throw new ValidationError('Cannot generate invoice for draft sale. Please confirm the sale first.');
    }

    // 8. Get sale lines
    const { items: lines } = await queryItems<SaleLine>({
      TableName: TableNames.Sales,
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :skPrefix)',
      ExpressionAttributeValues: {
        ':pk': `SALE#${saleId}`,
        ':skPrefix': 'LINE#',
      },
      FilterExpression: 'attribute_not_exists(deletedAt)',
    });

    if (lines.length === 0) {
      throw new ValidationError('Cannot generate invoice for sale with no lines');
    }

    // Sort lines by line number
    lines.sort((a, b) => a.lineNumber - b.lineNumber);

    // 9. Prepare template data
    const templateData = {
      sale: {
        saleId: sale.saleId,
        saleNumber: sale.saleNumber,
        saleDate: sale.saleDate,
        invoiceNumber: sale.invoiceNumber || `INV-${sale.saleNumber}-${new Date().getFullYear()}`,
        currency: sale.currency,
        paymentMethod: sale.paymentMethod,
        paymentTerms: sale.paymentTerms,
        deliveryMethod: sale.deliveryMethod,
        deliveryDate: sale.deliveryDate,
        notes: sale.notes,
        referenceNumber: sale.referenceNumber,
      },
      buyer: {
        companyName: sale.buyerName,
        vatNumber: sale.buyerVatNumber,
        fiscalCode: sale.buyerFiscalCode,
        address: sale.buyerAddress,
        city: sale.buyerCity,
        province: sale.buyerProvince,
        postalCode: sale.buyerPostalCode,
        country: sale.buyerCountry,
      },
      producer: {
        companyName: sale.producerName,
        vatNumber: sale.producerVatNumber,
        fiscalCode: sale.producerFiscalCode,
        address: sale.producerAddress,
        city: sale.producerCity,
        province: sale.producerProvince,
        postalCode: sale.producerPostalCode,
        country: sale.producerCountry,
      },
      lines: lines.map((line) => ({
        lineNumber: line.lineNumber,
        productCode: line.productCode,
        productDescription: line.productDescription,
        quantity: line.quantity,
        unitPrice: line.unitPrice,
        discount: line.discount,
        discountAmount: line.discountAmount,
        netAmount: line.netAmount,
        taxRate: line.taxRate,
        taxAmount: line.taxAmount,
        totalAmount: line.totalAmount,
        unitOfMeasure: line.unitOfMeasure,
      })),
      totals: {
        subtotal: sale.subtotal,
        taxAmount: sale.taxAmount,
        total: sale.total,
      },
    };

    // 10. Render HTML template
    const html = await renderTemplate({
      template: 'invoice',
      language,
      data: templateData,
    });

    // 11. Upload HTML to S3
    const s3Key = await uploadInvoiceHTML({
      saleId,
      htmlContent: html,
      language,
    });

    // 12. Update sale with invoice generation info
    const timestamp = updateTimestamp(user.username);
    const invoiceNumber = sale.invoiceNumber || `INV-${sale.saleNumber}-${new Date().getFullYear()}`;

    await updateItem({
      TableName: TableNames.Sales,
      Key: {
        PK: `SALE#${saleId}`,
        SK: 'METADATA',
      },
      UpdateExpression: 'SET invoiceGenerated = :invoiceGenerated, invoiceGeneratedAt = :invoiceGeneratedAt, invoiceNumber = :invoiceNumber, updatedAt = :updatedAt, updatedBy = :updatedBy',
      ExpressionAttributeValues: {
        ':invoiceGenerated': true,
        ':invoiceGeneratedAt': timestamp.updatedAt,
        ':invoiceNumber': invoiceNumber,
        ':updatedAt': timestamp.updatedAt,
        ':updatedBy': timestamp.updatedBy,
      },
    });

    // 13. Return success response
    return successResponse({
      saleId,
      format: 'html',
      language,
      s3Key,
      invoiceNumber,
      message: 'HTML invoice generated successfully',
    });

  } catch (error) {
    return handleError(error, requestId, path);
  }
}
