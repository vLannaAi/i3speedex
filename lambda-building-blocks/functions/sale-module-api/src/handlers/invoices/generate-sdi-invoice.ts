/**
 * Generate SDI Invoice Handler
 * POST /api/sales/{id}/invoice/sdi
 *
 * Generate Italian SDI XML invoice for a sale
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { getUserContext, requireWritePermission, getPathParameter, canAccessResource } from '../../common/middleware/auth';
import { successResponse, handleError } from '../../common/utils/response';
import { NotFoundError, ForbiddenError, ValidationError } from '../../common/utils/validation';
import { getItem, queryItems, updateItem, updateTimestamp, TableNames } from '../../common/clients/dynamodb';
import { generateSdiXml } from '../../common/clients/lambda';
import { uploadInvoiceXML } from '../../common/clients/s3';
import { Sale, SaleLine } from '../../common/types';

/**
 * Generate SDI XML invoice handler
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

    // 4. Get sale from DynamoDB
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

    // 5. Check access permissions
    if (!canAccessResource(user, sale.createdBy)) {
      throw new ForbiddenError('You do not have permission to generate invoices for this sale');
    }

    // 6. Validate sale is confirmed
    if (sale.status === 'draft') {
      throw new ValidationError('Cannot generate invoice for draft sale. Please confirm the sale first.');
    }

    // 7. Validate buyer and producer are Italian
    if (sale.buyerCountry !== 'IT' || sale.producerCountry !== 'IT') {
      throw new ValidationError('SDI invoices can only be generated for Italian buyers and producers');
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

    // 9. Prepare SDI data
    const invoiceNumber = sale.invoiceNumber || `INV-${sale.saleNumber}-${new Date().getFullYear()}`;

    const sdiData = {
      sale: {
        saleId: sale.saleId,
        saleNumber: sale.saleNumber,
        saleDate: sale.saleDate,
        currency: sale.currency,
        paymentMethod: sale.paymentMethod,
        paymentTerms: sale.paymentTerms,
      },
      buyer: {
        companyName: sale.buyerName,
        vatNumber: sale.buyerVatNumber || '',
        fiscalCode: sale.buyerFiscalCode || '',
        address: sale.buyerAddress || '',
        city: sale.buyerCity || '',
        province: sale.buyerProvince || '',
        postalCode: sale.buyerPostalCode || '',
        country: sale.buyerCountry,
        pec: sale.buyerFiscalCode, // Placeholder - should be from buyer record
        sdi: sale.buyerFiscalCode, // Placeholder - should be from buyer record
      },
      producer: {
        companyName: sale.producerName,
        vatNumber: sale.producerVatNumber || '',
        fiscalCode: sale.producerFiscalCode || '',
        address: sale.producerAddress || '',
        city: sale.producerCity || '',
        province: sale.producerProvince || '',
        postalCode: sale.producerPostalCode || '',
        country: sale.producerCountry,
      },
      lines: lines.map((line) => ({
        lineNumber: line.lineNumber,
        productDescription: line.productDescription,
        quantity: line.quantity,
        unitPrice: line.unitPrice,
        taxRate: line.taxRate,
        totalAmount: line.totalAmount,
      })),
      totals: {
        subtotal: sale.subtotal,
        taxAmount: sale.taxAmount,
        total: sale.total,
      },
    };

    // 10. Generate SDI XML
    const xml = await generateSdiXml(sdiData);

    // 11. Upload XML to S3
    const s3Key = await uploadInvoiceXML({
      saleId,
      xmlContent: xml,
    });

    // 12. Update sale with invoice generation info
    const timestamp = updateTimestamp(user.username);

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
      format: 'sdi',
      s3Key,
      invoiceNumber,
      message: 'SDI XML invoice generated successfully',
    });

  } catch (error) {
    return handleError(error, requestId, path);
  }
}
