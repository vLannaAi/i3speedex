/**
 * List Sales Handler
 * GET /api/sales
 *
 * List all sales with pagination, filtering, and sorting
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { getUserContext, isAdmin, getQueryParameter } from '../../common/middleware/auth';
import { paginatedResponse, handleError } from '../../common/utils/response';
import { validatePaginationParams } from '../../common/utils/validation';
import { queryItems, scanItems, decodeNextToken, calculatePagination, TableNames } from '../../common/clients/dynamodb';
import { Sale } from '../../common/types';

/**
 * List sales handler
 */
export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;
  const path = event.path;

  try {
    // 1. Extract user context
    const user = getUserContext(event);

    // 2. Parse pagination parameters
    const { page, pageSize, nextToken } = validatePaginationParams({
      page: event.queryStringParameters?.page,
      pageSize: event.queryStringParameters?.pageSize,
      nextToken: event.queryStringParameters?.nextToken,
    });

    // 3. Parse filter parameters
    const status = getQueryParameter(event, 'status'); // Filter by status
    const buyerId = getQueryParameter(event, 'buyerId'); // Filter by buyer
    const producerId = getQueryParameter(event, 'producerId'); // Filter by producer
    const dateFrom = getQueryParameter(event, 'dateFrom'); // Filter by date range (start)
    const dateTo = getQueryParameter(event, 'dateTo'); // Filter by date range (end)
    const createdBy = getQueryParameter(event, 'createdBy'); // Filter by creator

    // 4. Build query parameters
    let filterExpression: string | undefined;
    const expressionAttributeNames: Record<string, string> = {};
    const expressionAttributeValues: Record<string, any> = {};

    // Filter by soft delete (exclude deleted items)
    const filters: string[] = ['attribute_not_exists(deletedAt)'];

    // Add status filter
    if (status) {
      filters.push('#status = :status');
      expressionAttributeNames['#status'] = 'status';
      expressionAttributeValues[':status'] = status;
    }

    // Add buyer filter
    if (buyerId) {
      filters.push('buyerId = :buyerId');
      expressionAttributeValues[':buyerId'] = buyerId;
    }

    // Add producer filter
    if (producerId) {
      filters.push('producerId = :producerId');
      expressionAttributeValues[':producerId'] = producerId;
    }

    // Add date range filter
    if (dateFrom) {
      filters.push('saleDate >= :dateFrom');
      expressionAttributeValues[':dateFrom'] = dateFrom;
    }

    if (dateTo) {
      filters.push('saleDate <= :dateTo');
      expressionAttributeValues[':dateTo'] = dateTo;
    }

    // Add creator filter (non-admins can only see their own sales)
    if (!isAdmin(user)) {
      filters.push('createdBy = :createdBy');
      expressionAttributeValues[':createdBy'] = user.username;
    } else if (createdBy) {
      // Admin can filter by specific creator
      filters.push('createdBy = :createdBy');
      expressionAttributeValues[':createdBy'] = createdBy;
    }

    if (filters.length > 0) {
      filterExpression = filters.join(' AND ');
    }

    // 5. Query or scan based on filters
    // We'll use the GSI1 (by status and date) if filtering by status, otherwise scan
    let items: Sale[] = [];
    let lastEvaluatedKey: Record<string, any> | undefined;

    if (status && !buyerId && !producerId) {
      // Use GSI1 (status index) for efficient querying
      const result = await queryItems<Sale>({
        TableName: TableNames.Sales,
        IndexName: 'GSI1-QueryByBuyer',
        KeyConditionExpression: 'GSI1PK = :gsi1pk',
        ExpressionAttributeValues: {
          ':gsi1pk': `STATUS#${status}`,
          ...expressionAttributeValues,
        },
        FilterExpression: filterExpression,
        ExpressionAttributeNames: Object.keys(expressionAttributeNames).length > 0
          ? expressionAttributeNames
          : undefined,
        Limit: pageSize,
        ExclusiveStartKey: decodeNextToken(nextToken),
        ScanIndexForward: false, // Most recent first
      });

      items = result.items;
      lastEvaluatedKey = result.lastEvaluatedKey;
    } else if (buyerId) {
      // Use GSI2 (buyer index)
      const result = await queryItems<Sale>({
        TableName: TableNames.Sales,
        IndexName: 'GSI2-QueryByProducer',
        KeyConditionExpression: 'GSI2PK = :gsi2pk',
        ExpressionAttributeValues: {
          ':gsi2pk': `BUYER#${buyerId}`,
          ...expressionAttributeValues,
        },
        FilterExpression: filterExpression,
        ExpressionAttributeNames: Object.keys(expressionAttributeNames).length > 0
          ? expressionAttributeNames
          : undefined,
        Limit: pageSize,
        ExclusiveStartKey: decodeNextToken(nextToken),
        ScanIndexForward: false,
      });

      items = result.items;
      lastEvaluatedKey = result.lastEvaluatedKey;
    } else if (producerId) {
      // Use GSI3 (producer index)
      const result = await queryItems<Sale>({
        TableName: TableNames.Sales,
        IndexName: 'GSI3-QueryByStatus',
        KeyConditionExpression: 'GSI3PK = :gsi3pk',
        ExpressionAttributeValues: {
          ':gsi3pk': `PRODUCER#${producerId}`,
          ...expressionAttributeValues,
        },
        FilterExpression: filterExpression,
        ExpressionAttributeNames: Object.keys(expressionAttributeNames).length > 0
          ? expressionAttributeNames
          : undefined,
        Limit: pageSize,
        ExclusiveStartKey: decodeNextToken(nextToken),
        ScanIndexForward: false,
      });

      items = result.items;
      lastEvaluatedKey = result.lastEvaluatedKey;
    } else {
      // Scan with filters (less efficient, but necessary for complex filters)
      const result = await scanItems<Sale>({
        TableName: TableNames.Sales,
        FilterExpression: filterExpression,
        ExpressionAttributeValues: Object.keys(expressionAttributeValues).length > 0
          ? expressionAttributeValues
          : undefined,
        ExpressionAttributeNames: Object.keys(expressionAttributeNames).length > 0
          ? expressionAttributeNames
          : undefined,
        Limit: pageSize,
        ExclusiveStartKey: decodeNextToken(nextToken),
      });

      items = result.items.filter((item) => item.SK === 'METADATA');
      lastEvaluatedKey = result.lastEvaluatedKey;
    }

    // 6. Calculate total count (for pagination)
    // Note: For production, consider caching this or using DynamoDB Streams to maintain a counter
    const totalCount = items.length; // Simplified for now

    // 7. Calculate pagination info
    const paginatedResult = calculatePagination(
      items,
      totalCount,
      page,
      pageSize,
      lastEvaluatedKey
    );

    // 8. Return paginated response
    return paginatedResponse(
      paginatedResult.items,
      paginatedResult.pagination
    );

  } catch (error) {
    return handleError(error, requestId, path);
  }
}
