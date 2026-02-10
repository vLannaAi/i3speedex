/**
 * Get Producer Handler
 * GET /api/producers/{id}
 *
 * Get producer details by ID
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { getUserContext, getPathParameter } from '../../common/middleware/auth';
import { successResponse, handleError } from '../../common/utils/response';
import { NotFoundError } from '../../common/utils/validation';
import { getItem, TableNames } from '../../common/clients/dynamodb';
import { Producer } from '../../common/types';

/**
 * Get producer handler
 */
export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;
  const path = event.path;

  try {
    // 1. Extract user context (validates authentication)
    getUserContext(event);

    // 2. Get producer ID from path
    const producerId = getPathParameter(event, 'id');

    // 3. Get producer from DynamoDB
    const producer = await getItem<Producer>({
      TableName: TableNames.Producers,
      Key: {
        PK: `PRODUCER#${producerId}`,
        SK: 'METADATA',
      },
    });

    // 4. Check if producer exists
    if (!producer) {
      throw new NotFoundError(`Producer ${producerId} not found`);
    }

    // 5. Check if producer is soft deleted
    if (producer.deletedAt) {
      throw new NotFoundError(`Producer ${producerId} not found`);
    }

    // 6. Return producer
    return successResponse(producer);

  } catch (error) {
    return handleError(error, requestId, path);
  }
}
