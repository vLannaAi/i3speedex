/**
 * Sync Sales Handler
 * GET /api/sync/sales?since={ISO8601}
 *
 * Returns all sales for initial sync, or only changed sales for delta sync.
 * Delta sync includes soft-deleted records so the client can evict them.
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { getUserContext, isAdmin, getQueryParameter } from '../../common/middleware/auth';
import { successResponse, handleError } from '../../common/utils/response';
import { scanAllItems, TableNames, getCurrentTimestamp } from '../../common/clients/dynamodb';
import { Sale } from '../../common/types';

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;
  const path = event.path;

  try {
    // 1. Extract user context
    const user = getUserContext(event);

    // 2. Parse since parameter
    const since = getQueryParameter(event, 'since');

    // 3. Capture server timestamp BEFORE scan to avoid race conditions
    const serverTimestamp = getCurrentTimestamp();

    // 4. Build filter expression
    const filters: string[] = ['SK = :sk'];
    const expressionAttributeValues: Record<string, any> = {
      ':sk': 'METADATA',
    };

    if (since) {
      // Delta sync: return records updated after `since`, INCLUDING soft-deleted
      filters.push('updatedAt > :since');
      expressionAttributeValues[':since'] = since;
    } else {
      // Initial sync: exclude soft-deleted records
      filters.push('attribute_not_exists(deletedAt)');
    }

    // Non-admin users can only see their own sales
    if (!isAdmin(user)) {
      filters.push('createdBy = :createdBy');
      expressionAttributeValues[':createdBy'] = user.username;
    }

    const filterExpression = filters.join(' AND ');

    // 5. Scan all matching items
    const items = await scanAllItems<Sale>({
      TableName: TableNames.Sales,
      FilterExpression: filterExpression,
      ExpressionAttributeValues: expressionAttributeValues,
    });

    // 6. Return response
    return successResponse({ items, serverTimestamp });

  } catch (error) {
    return handleError(error, requestId, path);
  }
}
