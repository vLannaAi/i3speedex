/**
 * Search Buyers Handler
 * GET /api/search/buyers
 *
 * Search buyers by keyword (matches company name, VAT number, fiscal code, city, email)
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { getUserContext, getQueryParameter } from '../../common/middleware/auth';
import { successResponse, handleError } from '../../common/utils/response';
import { ValidationError } from '../../common/utils/validation';
import { scanItems, TableNames } from '../../common/clients/dynamodb';
import { Buyer } from '../../common/types';

/**
 * Search buyers handler
 */
export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;
  const path = event.path;

  try {
    // 1. Extract user context
    getUserContext(event);

    // 2. Get search keyword from query parameters
    const keyword = getQueryParameter(event, 'q') || '';

    if (!keyword || keyword.length < 2) {
      throw new ValidationError('Search keyword must be at least 2 characters');
    }

    // 3. Get pagination parameters
    const pageSize = parseInt(getQueryParameter(event, 'pageSize') || '20', 10);
    const nextToken = getQueryParameter(event, 'nextToken');

    // 4. Scan buyers table
    const { items: allBuyers, lastEvaluatedKey } = await scanItems<Buyer>({
      TableName: TableNames.Buyers,
      FilterExpression: 'SK = :sk AND attribute_not_exists(deletedAt)',
      ExpressionAttributeValues: {
        ':sk': 'METADATA',
      },
      Limit: 100,
      ExclusiveStartKey: nextToken ? JSON.parse(Buffer.from(nextToken, 'base64').toString()) : undefined,
    });

    // 5. Filter buyers by keyword (case-insensitive)
    const keywordLower = keyword.toLowerCase();
    let filteredBuyers = allBuyers.filter((buyer) => {
      return (
        buyer.companyName.toLowerCase().includes(keywordLower) ||
        (buyer.vatNumber && buyer.vatNumber.toLowerCase().includes(keywordLower)) ||
        (buyer.fiscalCode && buyer.fiscalCode.toLowerCase().includes(keywordLower)) ||
        buyer.city.toLowerCase().includes(keywordLower) ||
        (buyer.email && buyer.email.toLowerCase().includes(keywordLower)) ||
        (buyer.phone && buyer.phone.includes(keyword))
      );
    });

    // 6. Sort by company name
    filteredBuyers.sort((a, b) => a.companyName.localeCompare(b.companyName));

    // 7. Paginate results
    const paginatedBuyers = filteredBuyers.slice(0, pageSize);

    // 8. Prepare response
    const hasMore = filteredBuyers.length > pageSize || !!lastEvaluatedKey;
    const nextPageToken = hasMore && lastEvaluatedKey
      ? Buffer.from(JSON.stringify(lastEvaluatedKey)).toString('base64')
      : undefined;

    return successResponse({
      buyers: paginatedBuyers,
      count: paginatedBuyers.length,
      totalMatches: filteredBuyers.length,
      hasMore,
      nextToken: nextPageToken,
      keyword,
      message: `Found ${filteredBuyers.length} buyer(s) matching "${keyword}"`,
    });

  } catch (error) {
    return handleError(error, requestId, path);
  }
}
