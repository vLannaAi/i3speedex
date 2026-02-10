/**
 * List Sale Lines Handler
 * GET /api/sales/{id}/lines
 *
 * Get all lines for a sale
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { getUserContext, getPathParameter, canAccessResource } from '../../common/middleware/auth';
import { successResponse, handleError } from '../../common/utils/response';
import { NotFoundError } from '../../common/utils/validation';
import { getItem, queryItems, TableNames } from '../../common/clients/dynamodb';
import { Sale, SaleLine } from '../../common/types';

/**
 * List sale lines handler
 */
export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;
  const path = event.path;

  try {
    // 1. Extract user context
    const user = getUserContext(event);

    // 2. Get sale ID from path
    const saleId = getPathParameter(event, 'id');

    // 3. Verify sale exists and user has access
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

    if (!canAccessResource(user, sale.createdBy)) {
      throw new NotFoundError(`Sale ${saleId} not found`);
    }

    // 4. Query sale lines
    const { items: lines } = await queryItems<SaleLine>({
      TableName: TableNames.Sales,
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :skPrefix)',
      ExpressionAttributeValues: {
        ':pk': `SALE#${saleId}`,
        ':skPrefix': 'LINE#',
      },
      FilterExpression: 'attribute_not_exists(deletedAt)',
    });

    // 5. Sort by line number
    lines.sort((a, b) => a.lineNumber - b.lineNumber);

    // 6. Return lines
    return successResponse(lines);

  } catch (error) {
    return handleError(error, requestId, path);
  }
}
