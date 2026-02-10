/**
 * Confirm Sale Handler
 * POST /api/sales/{id}/confirm
 *
 * Confirm a sale (change status from draft to confirmed)
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { getUserContext, requireWritePermission, getPathParameter, canAccessResource } from '../../common/middleware/auth';
import { successResponse, handleError } from '../../common/utils/response';
import { NotFoundError, ForbiddenError, ValidationError } from '../../common/utils/validation';
import { getItem, updateItem, queryItems, updateTimestamp, TableNames } from '../../common/clients/dynamodb';
import { Sale, SaleLine } from '../../common/types';

/**
 * Confirm sale handler
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

    // 4. Get existing sale
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
      throw new ForbiddenError('You do not have permission to confirm this sale');
    }

    // 6. Check if sale is already confirmed
    if (sale.status !== 'draft') {
      throw new ValidationError(`Sale ${saleId} is already ${sale.status}`);
    }

    // 7. Validate sale has at least one line
    if (sale.linesCount === 0) {
      throw new ValidationError('Cannot confirm a sale with no lines');
    }

    // 8. Verify lines exist and are valid
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
      throw new ValidationError('Cannot confirm a sale with no lines');
    }

    // 9. Verify totals match line totals (data integrity check)
    const calculatedSubtotal = lines.reduce((sum, line) => sum + line.netAmount, 0);
    const calculatedTaxAmount = lines.reduce((sum, line) => sum + line.taxAmount, 0);
    const calculatedTotal = lines.reduce((sum, line) => sum + line.totalAmount, 0);

    const subtotalMatch = Math.abs(sale.subtotal - calculatedSubtotal) < 0.01;
    const taxAmountMatch = Math.abs(sale.taxAmount - calculatedTaxAmount) < 0.01;
    const totalMatch = Math.abs(sale.total - calculatedTotal) < 0.01;

    if (!subtotalMatch || !taxAmountMatch || !totalMatch) {
      // Recalculate and update totals before confirming
      const timestamp = updateTimestamp(user.username);
      await updateItem({
        TableName: TableNames.Sales,
        Key: {
          PK: `SALE#${saleId}`,
          SK: 'METADATA',
        },
        UpdateExpression: 'SET subtotal = :subtotal, taxAmount = :taxAmount, #total = :total, updatedAt = :updatedAt, updatedBy = :updatedBy',
        ExpressionAttributeNames: {
          '#total': 'total',
        },
        ExpressionAttributeValues: {
          ':subtotal': Math.round(calculatedSubtotal * 100) / 100,
          ':taxAmount': Math.round(calculatedTaxAmount * 100) / 100,
          ':total': Math.round(calculatedTotal * 100) / 100,
          ':updatedAt': timestamp.updatedAt,
          ':updatedBy': timestamp.updatedBy,
        },
      });
    }

    // 10. Update sale status to confirmed
    const timestamp = updateTimestamp(user.username);
    const updatedAttributes = await updateItem({
      TableName: TableNames.Sales,
      Key: {
        PK: `SALE#${saleId}`,
        SK: 'METADATA',
      },
      UpdateExpression: 'SET #status = :status, GSI1PK = :gsi1pk, updatedAt = :updatedAt, updatedBy = :updatedBy',
      ExpressionAttributeNames: {
        '#status': 'status',
      },
      ExpressionAttributeValues: {
        ':status': 'confirmed',
        ':gsi1pk': 'STATUS#confirmed',
        ':updatedAt': timestamp.updatedAt,
        ':updatedBy': timestamp.updatedBy,
      },
      ReturnValues: 'ALL_NEW',
    });

    // 11. Return updated sale
    return successResponse(updatedAttributes);

  } catch (error) {
    return handleError(error, requestId, path);
  }
}
