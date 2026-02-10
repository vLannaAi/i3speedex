/**
 * Get Sale Handler
 * GET /api/sales/{id}
 *
 * Get sale details by ID
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { getUserContext, getPathParameter, canAccessResource } from '../../common/middleware/auth';
import { successResponse, handleError } from '../../common/utils/response';
import { NotFoundError } from '../../common/utils/validation';
import { getItem, TableNames } from '../../common/clients/dynamodb';
import { Sale } from '../../common/types';

/**
 * Get sale handler
 */
export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;
  const path = event.path;

  try {
    // 1. Extract user context
    const user = getUserContext(event);

    // 2. Get sale ID from path
    const saleId = getPathParameter(event, 'id');

    // 3. Get sale from DynamoDB
    const sale = await getItem<Sale>({
      TableName: TableNames.Sales,
      Key: {
        PK: `SALE#${saleId}`,
        SK: 'METADATA',
      },
    });

    // 4. Check if sale exists
    if (!sale) {
      throw new NotFoundError(`Sale ${saleId} not found`);
    }

    // 5. Check if sale is soft deleted
    if (sale.deletedAt) {
      throw new NotFoundError(`Sale ${saleId} not found`);
    }

    // 6. Check access permissions (non-admins can only see their own sales)
    if (!canAccessResource(user, sale.createdBy)) {
      throw new NotFoundError(`Sale ${saleId} not found`);
    }

    // 7. Return sale
    return successResponse(sale);

  } catch (error) {
    return handleError(error, requestId, path);
  }
}
