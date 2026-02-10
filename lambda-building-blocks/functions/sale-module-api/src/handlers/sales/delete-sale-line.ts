/**
 * Delete Sale Line Handler
 * DELETE /api/sales/{id}/lines/{lineId}
 *
 * Soft delete a sale line
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { getUserContext, requireWritePermission, getPathParameter, canAccessResource } from '../../common/middleware/auth';
import { noContentResponse, handleError } from '../../common/utils/response';
import { NotFoundError, ForbiddenError } from '../../common/utils/validation';
import { getItem, softDelete, queryItems, updateItem, updateTimestamp, TableNames } from '../../common/clients/dynamodb';
import { Sale, SaleLine } from '../../common/types';

/**
 * Delete sale line handler (soft delete)
 */
export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;
  const path = event.path;

  try {
    // 1. Extract user context
    const user = getUserContext(event);

    // 2. Check permissions
    requireWritePermission(user);

    // 3. Get sale ID and line ID from path
    const saleId = getPathParameter(event, 'id');
    const lineId = getPathParameter(event, 'lineId');

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
      throw new ForbiddenError('You do not have permission to modify this sale');
    }

    // 6. Prevent deleting lines from invoiced sales
    if (sale.invoiceGenerated && sale.status !== 'draft') {
      throw new ForbiddenError('Cannot delete lines from a sale that has been invoiced');
    }

    // 7. Get existing line
    const existingLine = await getItem<SaleLine>({
      TableName: TableNames.Sales,
      Key: {
        PK: `SALE#${saleId}`,
        SK: `LINE#${lineId}`,
      },
    });

    if (!existingLine || existingLine.deletedAt) {
      throw new NotFoundError(`Line ${lineId} not found`);
    }

    // 8. Soft delete the line
    await softDelete(
      TableNames.Sales,
      {
        PK: `SALE#${saleId}`,
        SK: `LINE#${lineId}`,
      },
      user.username
    );

    // 9. Get remaining lines
    const { items: remainingLines } = await queryItems<SaleLine>({
      TableName: TableNames.Sales,
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :skPrefix)',
      ExpressionAttributeValues: {
        ':pk': `SALE#${saleId}`,
        ':skPrefix': 'LINE#',
      },
      FilterExpression: 'attribute_not_exists(deletedAt)',
    });

    // 10. Recalculate sale totals
    const newSubtotal = remainingLines.reduce((sum, line) => sum + line.netAmount, 0);
    const newTaxAmount = remainingLines.reduce((sum, line) => sum + line.taxAmount, 0);
    const newTotal = remainingLines.reduce((sum, line) => sum + line.totalAmount, 0);

    // 11. Update sale totals and lines count
    const timestamp = updateTimestamp(user.username);
    await updateItem({
      TableName: TableNames.Sales,
      Key: {
        PK: `SALE#${saleId}`,
        SK: 'METADATA',
      },
      UpdateExpression: 'SET subtotal = :subtotal, taxAmount = :taxAmount, #total = :total, linesCount = :linesCount, updatedAt = :updatedAt, updatedBy = :updatedBy',
      ExpressionAttributeNames: {
        '#total': 'total',
      },
      ExpressionAttributeValues: {
        ':subtotal': Math.round(newSubtotal * 100) / 100,
        ':taxAmount': Math.round(newTaxAmount * 100) / 100,
        ':total': Math.round(newTotal * 100) / 100,
        ':linesCount': remainingLines.length,
        ':updatedAt': timestamp.updatedAt,
        ':updatedBy': timestamp.updatedBy,
      },
    });

    // 12. Return 204 No Content
    return noContentResponse();

  } catch (error) {
    return handleError(error, requestId, path);
  }
}
