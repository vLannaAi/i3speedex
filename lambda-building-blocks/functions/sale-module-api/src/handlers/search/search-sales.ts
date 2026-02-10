/**
 * Search Sales Handler
 * GET /api/search/sales
 *
 * Search sales by keyword (matches saleId, invoiceNumber, buyer name, producer name, reference number)
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { getUserContext, getQueryParameter } from '../../common/middleware/auth';
import { successResponse, handleError } from '../../common/utils/response';
import { ValidationError } from '../../common/utils/validation';
import { scanItems, TableNames } from '../../common/clients/dynamodb';
import { Sale } from '../../common/types';

/**
 * Search sales handler
 */
export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;
  const path = event.path;

  try {
    // 1. Extract user context
    const user = getUserContext(event);

    // 2. Get search keyword from query parameters
    const keyword = getQueryParameter(event, 'q') || '';

    if (!keyword || keyword.length < 2) {
      throw new ValidationError('Search keyword must be at least 2 characters');
    }

    // 3. Get pagination parameters
    const pageSize = parseInt(getQueryParameter(event, 'pageSize') || '20', 10);
    const nextToken = getQueryParameter(event, 'nextToken');

    // 4. Scan sales table (filter in application due to DynamoDB limitations)
    const { items: allSales, lastEvaluatedKey } = await scanItems<Sale>({
      TableName: TableNames.Sales,
      FilterExpression: 'SK = :sk AND attribute_not_exists(deletedAt)',
      ExpressionAttributeValues: {
        ':sk': 'METADATA',
      },
      Limit: 100, // Get more items to filter
      ExclusiveStartKey: nextToken ? JSON.parse(Buffer.from(nextToken, 'base64').toString()) : undefined,
    });

    // 5. Filter sales by keyword (case-insensitive)
    const keywordLower = keyword.toLowerCase();
    let filteredSales = allSales.filter((sale) => {
      // Check if user has access to this sale
      const hasAccess = user.groups.includes('Admin') || sale.createdBy === user.username;
      if (!hasAccess) return false;

      // Search in multiple fields
      return (
        sale.saleId.toLowerCase().includes(keywordLower) ||
        (sale.invoiceNumber && sale.invoiceNumber.toLowerCase().includes(keywordLower)) ||
        sale.buyerName.toLowerCase().includes(keywordLower) ||
        sale.producerName.toLowerCase().includes(keywordLower) ||
        (sale.referenceNumber && sale.referenceNumber.toLowerCase().includes(keywordLower)) ||
        (sale.notes && sale.notes.toLowerCase().includes(keywordLower))
      );
    });

    // 6. Sort by sale date (newest first)
    filteredSales.sort((a, b) =>
      new Date(b.saleDate).getTime() - new Date(a.saleDate).getTime()
    );

    // 7. Paginate results
    const paginatedSales = filteredSales.slice(0, pageSize);

    // 8. Prepare response
    const hasMore = filteredSales.length > pageSize || !!lastEvaluatedKey;
    const nextPageToken = hasMore && lastEvaluatedKey
      ? Buffer.from(JSON.stringify(lastEvaluatedKey)).toString('base64')
      : undefined;

    return successResponse({
      sales: paginatedSales,
      count: paginatedSales.length,
      totalMatches: filteredSales.length,
      hasMore,
      nextToken: nextPageToken,
      keyword,
      message: `Found ${filteredSales.length} sale(s) matching "${keyword}"`,
    });

  } catch (error) {
    return handleError(error, requestId, path);
  }
}
