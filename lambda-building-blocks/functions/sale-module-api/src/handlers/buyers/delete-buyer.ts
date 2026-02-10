/**
 * Delete Buyer Handler
 * DELETE /api/buyers/{id}
 *
 * Soft delete a buyer
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { getUserContext, requireWritePermission, getPathParameter } from '../../common/middleware/auth';
import { noContentResponse, handleError } from '../../common/utils/response';
import { NotFoundError, ForbiddenError } from '../../common/utils/validation';
import { getItem, softDelete, queryItems, TableNames } from '../../common/clients/dynamodb';
import { Buyer, Sale } from '../../common/types';

/**
 * Delete buyer handler (soft delete)
 */
export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;
  const path = event.path;

  try {
    // 1. Extract user context
    const user = getUserContext(event);

    // 2. Check permissions
    requireWritePermission(user);

    // 3. Get buyer ID from path
    const buyerId = getPathParameter(event, 'id');

    // 4. Get existing buyer
    const existingBuyer = await getItem<Buyer>({
      TableName: TableNames.Buyers,
      Key: {
        PK: `BUYER#${buyerId}`,
        SK: 'METADATA',
      },
    });

    if (!existingBuyer || existingBuyer.deletedAt) {
      throw new NotFoundError(`Buyer ${buyerId} not found`);
    }

    // 5. Check if buyer has associated sales
    const { items: associatedSales } = await queryItems<Sale>({
      TableName: TableNames.Sales,
      IndexName: 'GSI2',
      KeyConditionExpression: 'GSI2PK = :gsi2pk',
      ExpressionAttributeValues: {
        ':gsi2pk': `BUYER#${buyerId}`,
      },
      FilterExpression: 'attribute_not_exists(deletedAt)',
      Limit: 1,
    });

    // 6. Prevent deleting buyer with active sales
    if (associatedSales.length > 0) {
      throw new ForbiddenError(
        'Cannot delete buyer with associated sales. Please delete or reassign sales first.'
      );
    }

    // 7. Soft delete the buyer
    await softDelete(
      TableNames.Buyers,
      {
        PK: `BUYER#${buyerId}`,
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
