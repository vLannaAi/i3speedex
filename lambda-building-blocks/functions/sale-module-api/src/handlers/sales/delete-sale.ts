/**
 * Delete Sale Handler
 * DELETE /api/sales/{id}
 *
 * Soft delete a sale
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { getUserContext, requireWritePermission, getPathParameter, canAccessResource } from '../../common/middleware/auth';
import { noContentResponse, handleError } from '../../common/utils/response';
import { NotFoundError, ForbiddenError } from '../../common/utils/validation';
import { getItem, softDelete, TableNames } from '../../common/clients/dynamodb';
import { Sale } from '../../common/types';

/**
 * Delete sale handler (soft delete)
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
    const existingSale = await getItem<Sale>({
      TableName: TableNames.Sales,
      Key: {
        PK: `SALE#${saleId}`,
        SK: 'METADATA',
      },
    });

    if (!existingSale || existingSale.deletedAt) {
      throw new NotFoundError(`Sale ${saleId} not found`);
    }

    // 5. Check access permissions
    if (!canAccessResource(user, existingSale.createdBy)) {
      throw new ForbiddenError('You do not have permission to delete this sale');
    }

    // 6. Prevent deleting invoiced sales
    if (existingSale.invoiceGenerated && existingSale.status !== 'draft') {
      throw new ForbiddenError('Cannot delete a sale that has been invoiced');
    }

    // 7. Soft delete the sale
    await softDelete(
      TableNames.Sales,
      {
        PK: `SALE#${saleId}`,
        SK: 'METADATA',
      },
      user.username
    );

    // 8. Return 204 No Content
    return noContentResponse();

  } catch (error) {
    return handleError(error, requestId, path);
  }
}
