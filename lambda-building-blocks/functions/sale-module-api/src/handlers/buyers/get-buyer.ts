/**
 * Get Buyer Handler
 * GET /api/buyers/{id}
 *
 * Get buyer details by ID
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { getUserContext, getPathParameter } from '../../common/middleware/auth';
import { successResponse, handleError } from '../../common/utils/response';
import { NotFoundError } from '../../common/utils/validation';
import { getItem, TableNames } from '../../common/clients/dynamodb';
import { Buyer } from '../../common/types';

/**
 * Get buyer handler
 */
export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;
  const path = event.path;

  try {
    // 1. Extract user context (validates authentication)
    getUserContext(event);

    // 2. Get buyer ID from path
    const buyerId = getPathParameter(event, 'id');

    // 3. Get buyer from DynamoDB
    const buyer = await getItem<Buyer>({
      TableName: TableNames.Buyers,
      Key: {
        PK: `BUYER#${buyerId}`,
        SK: 'METADATA',
      },
    });

    // 4. Check if buyer exists
    if (!buyer) {
      throw new NotFoundError(`Buyer ${buyerId} not found`);
    }

    // 5. Check if buyer is soft deleted
    if (buyer.deletedAt) {
      throw new NotFoundError(`Buyer ${buyerId} not found`);
    }

    // 6. Return buyer
    return successResponse(buyer);

  } catch (error) {
    return handleError(error, requestId, path);
  }
}
