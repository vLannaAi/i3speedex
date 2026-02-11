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

    // 9. Prepare template data (mapped to legacy template format)
    const saleYear = sale.saleDate ? new Date(sale.saleDate).getFullYear() : new Date().getFullYear();
    const statusMap: Record<string, string> = {
      draft: 'new',
      confirmed: 'proforma',
      invoiced: 'sent',
      paid: 'paid',
      cancelled: 'deleted',
    };

    const templateData = {
      sale: {
        id: sale.saleNumber,
        number: sale.saleNumber,
        year: saleYear,
        full_id: `${sale.saleNumber}`,
        reg_date: sale.saleDate,
        status: statusMap[sale.status] || 'new',
        currency: sale.currency || 'EUR',
        eur_amount: sale.subtotal || 0,
        vat: sale.taxAmount || 0,
        to_pay: sale.total || 0,
        pay_load: sale.total || 0,
        payment: sale.paymentMethod || '',
        payment_note: sale.paymentTerms || '',
        payment_date: sale.deliveryDate || '',
        sale_note: sale.notes || '',
        reference: sale.referenceNumber || '',
        buyer_ref: '',
      },
      buyer: {
        id: sale.buyerId || 0,
        name: sale.buyerName || '',
        country: sale.buyerCountry || 'IT',
        lang: language,
        address: sale.buyerAddress || '',
        zip: sale.buyerPostalCode || '',
        city: sale.buyerCity || '',
        prov: sale.buyerProvince || '',
        vat: sale.buyerVatNumber || '',
        taxid: sale.buyerFiscalCode || '',
      },
      sale_lines: lines.map((line) => ({
        description: line.productDescription,
        code: line.productCode || '',
        qty: line.quantity,
        price: line.unitPrice,
        discount: line.discount || 0,
        vat: line.taxRate,
      })),
      countries: [
        { code: 'IT', name: 'Italia' },
        { code: 'DE', name: 'Germania' },
        { code: 'FR', name: 'Francia' },
        { code: 'AT', name: 'Austria' },
        { code: 'CH', name: 'Svizzera' },
      ],
      banks: [],
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
