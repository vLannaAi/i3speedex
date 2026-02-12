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
import { queryAllItems, scanAllItems, TableNames } from '../../common/clients/dynamodb';
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
    const { page, pageSize } = validatePaginationParams({
      page: event.queryStringParameters?.page,
      pageSize: event.queryStringParameters?.pageSize,
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

    // 5. Query or scan ALL matching items based on filters
    let allItems: Sale[] = [];

    if (status && !buyerId && !producerId) {
      // Use GSI1 (status index) for efficient querying
      allItems = await queryAllItems<Sale>({
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
        ScanIndexForward: false, // Most recent first
      });
    } else if (buyerId) {
      // Use GSI2 (buyer index)
      allItems = await queryAllItems<Sale>({
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
        ScanIndexForward: false,
      });
    } else if (producerId) {
      // Use GSI3 (producer index)
      allItems = await queryAllItems<Sale>({
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
        ScanIndexForward: false,
      });
    } else {
      // Scan with filters
      const scanned = await scanAllItems<Sale>({
        TableName: TableNames.Sales,
        FilterExpression: filterExpression,
        ExpressionAttributeValues: Object.keys(expressionAttributeValues).length > 0
          ? expressionAttributeValues
          : undefined,
        ExpressionAttributeNames: Object.keys(expressionAttributeNames).length > 0
          ? expressionAttributeNames
          : undefined,
      });

      allItems = scanned.filter((item) => item.SK === 'METADATA');
    }

    // 6. Sort by saleDate descending
    allItems.sort((a, b) => (b.saleDate || '').localeCompare(a.saleDate || ''));

    // 7. Paginate in-memory
    const totalCount = allItems.length;
    const totalPages = Math.ceil(totalCount / pageSize);
    const start = (page - 1) * pageSize;
    const pageItems = allItems.slice(start, start + pageSize);

    // 8. Return paginated response
    return paginatedResponse(pageItems, {
      total: totalCount,
      page,
      pageSize,
      totalPages,
      hasMore: page < totalPages,
    });

  } catch (error) {
    return handleError(error, requestId, path);
  }
}
