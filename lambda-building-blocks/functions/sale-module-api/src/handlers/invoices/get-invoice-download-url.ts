/**
 * Get Invoice Download URL Handler
 * GET /api/sales/{id}/invoice/download
 *
 * Get pre-signed download URL for invoice
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { getUserContext, getPathParameter, getQueryParameter, canAccessResource } from '../../common/middleware/auth';
import { successResponse, handleError } from '../../common/utils/response';
import { NotFoundError, ValidationError } from '../../common/utils/validation';
import { getItem, TableNames } from '../../common/clients/dynamodb';
import { generateInvoiceDownloadUrl } from '../../common/clients/s3';
import { Sale } from '../../common/types';

/**
 * Get invoice download URL handler
 */
export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;
  const path = event.path;

  try {
    // 1. Extract user context
    const user = getUserContext(event);

    // 2. Get sale ID from path
    const saleId = getPathParameter(event, 'id');

    // 3. Get format and language from query parameters
    const format = getQueryParameter(event, 'format') || 'pdf';
    const language = getQueryParameter(event, 'language') || 'it';

    // 4. Validate format
    if (!['pdf', 'html', 'xml'].includes(format)) {
      throw new ValidationError('format must be one of: pdf, html, xml');
    }

    // 5. Validate language (not applicable for xml)
    if (format !== 'xml' && !['it', 'en', 'de', 'fr'].includes(language)) {
      throw new ValidationError('language must be one of: it, en, de, fr');
    }

    // 6. Get sale from DynamoDB
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

    // 7. Check access permissions
    if (!canAccessResource(user, sale.createdBy)) {
      throw new NotFoundError(`Sale ${saleId} not found`);
    }

    // 8. Check if invoice has been generated
    if (!sale.invoiceGenerated) {
      throw new ValidationError('Invoice has not been generated yet. Please generate the invoice first.');
    }

    // 9. Generate pre-signed download URL (valid for 1 hour)
    const downloadUrl = await generateInvoiceDownloadUrl({
      saleId,
      format: format as 'pdf' | 'html' | 'xml',
      language: format === 'xml' ? undefined : language as 'it' | 'en' | 'de' | 'fr',
      expiresIn: 3600, // 1 hour
    });

    // 10. Return download URL
    return successResponse({
      saleId,
      format,
      language: format === 'xml' ? undefined : language,
      downloadUrl,
      expiresIn: 3600,
      invoiceNumber: sale.invoiceNumber,
      message: 'Download URL generated successfully',
    });

  } catch (error) {
    return handleError(error, requestId, path);
  }
}
