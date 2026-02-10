/**
 * Delete Producer Handler
 * DELETE /api/producers/{id}
 *
 * Soft delete a producer
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { getUserContext, requireWritePermission, getPathParameter } from '../../common/middleware/auth';
import { noContentResponse, handleError } from '../../common/utils/response';
import { NotFoundError, ForbiddenError } from '../../common/utils/validation';
import { getItem, softDelete, queryItems, TableNames } from '../../common/clients/dynamodb';
import { Producer, Sale } from '../../common/types';

/**
 * Delete producer handler (soft delete)
 */
export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;
  const path = event.path;

  try {
    // 1. Extract user context
    const user = getUserContext(event);

    // 2. Check permissions
    requireWritePermission(user);

    // 3. Get producer ID from path
    const producerId = getPathParameter(event, 'id');

    // 4. Get existing producer
    const existingProducer = await getItem<Producer>({
      TableName: TableNames.Producers,
      Key: {
        PK: `PRODUCER#${producerId}`,
        SK: 'METADATA',
      },
    });

    if (!existingProducer || existingProducer.deletedAt) {
      throw new NotFoundError(`Producer ${producerId} not found`);
    }

    // 5. Check if producer has associated sales
    const { items: associatedSales } = await queryItems<Sale>({
      TableName: TableNames.Sales,
      IndexName: 'GSI3-QueryByStatus',
      KeyConditionExpression: 'GSI3PK = :gsi3pk',
      ExpressionAttributeValues: {
        ':gsi3pk': `PRODUCER#${producerId}`,
      },
      FilterExpression: 'attribute_not_exists(deletedAt)',
      Limit: 1,
    });

    // 6. Prevent deleting producer with active sales
    if (associatedSales.length > 0) {
      throw new ForbiddenError(
        'Cannot delete producer with associated sales. Please delete or reassign sales first.'
      );
    }

    // 7. Soft delete the producer
    await softDelete(
      TableNames.Producers,
      {
        PK: `PRODUCER#${producerId}`,
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
