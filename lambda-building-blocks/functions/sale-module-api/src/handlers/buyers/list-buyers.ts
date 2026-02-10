/**
 * List Buyers Handler
 * GET /api/buyers
 *
 * List all buyers with pagination and search
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { getUserContext, getQueryParameter } from '../../common/middleware/auth';
import { paginatedResponse, handleError } from '../../common/utils/response';
import { validatePaginationParams } from '../../common/utils/validation';
import { scanItems, decodeNextToken, calculatePagination, TableNames } from '../../common/clients/dynamodb';
import { Buyer } from '../../common/types';

/**
 * List buyers handler
 */
export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;
  const path = event.path;

  try {
    // 1. Extract user context (validates authentication)
    getUserContext(event);

    // 2. Parse pagination parameters
    const { page, pageSize, nextToken } = validatePaginationParams({
      page: event.queryStringParameters?.page,
      pageSize: event.queryStringParameters?.pageSize,
      nextToken: event.queryStringParameters?.nextToken,
    });

    // 3. Parse filter parameters
    const status = getQueryParameter(event, 'status'); // Filter by status (active/inactive)
    const search = getQueryParameter(event, 'search'); // Search by company name
    const country = getQueryParameter(event, 'country'); // Filter by country

    // 4. Build filter expression
    const filters: string[] = ['attribute_not_exists(deletedAt)', 'SK = :sk'];
    const expressionAttributeNames: Record<string, string> = {};
    const expressionAttributeValues: Record<string, any> = {
      ':sk': 'METADATA',
    };

    // Add status filter
    if (status) {
      filters.push('#status = :status');
      expressionAttributeNames['#status'] = 'status';
      expressionAttributeValues[':status'] = status;
    }

    // Add country filter
    if (country) {
      filters.push('country = :country');
      expressionAttributeValues[':country'] = country;
    }

    // Add search filter (case-insensitive search in company name)
    if (search) {
      filters.push('contains(companyName, :search)');
      expressionAttributeValues[':search'] = search;
    }

    const filterExpression = filters.join(' AND ');

    // 5. Scan buyers table
    const { items, lastEvaluatedKey } = await scanItems<Buyer>({
      TableName: TableNames.Buyers,
      FilterExpression: filterExpression,
      ExpressionAttributeNames: Object.keys(expressionAttributeNames).length > 0
        ? expressionAttributeNames
        : undefined,
      ExpressionAttributeValues: expressionAttributeValues,
      Limit: pageSize,
      ExclusiveStartKey: decodeNextToken(nextToken),
    });

    // 6. Sort by company name
    items.sort((a, b) => a.companyName.localeCompare(b.companyName));

    // 7. Calculate total count
    const totalCount = items.length;

    // 8. Calculate pagination info
    const paginatedResult = calculatePagination(
      items,
      totalCount,
      page,
      pageSize,
      lastEvaluatedKey
    );

    // 9. Return paginated response
    return paginatedResponse(
      paginatedResult.items,
      paginatedResult.pagination
    );

  } catch (error) {
    return handleError(error, requestId, path);
  }
}
