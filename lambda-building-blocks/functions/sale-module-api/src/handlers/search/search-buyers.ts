/**
 * Search Buyers Handler
 * GET /api/search/buyers
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { getUserContext, getQueryParameter } from '../../common/middleware/auth';
import { successResponse, handleError } from '../../common/utils/response';
import { ValidationError } from '../../common/utils/validation';
import { TableNames } from '../../common/clients/dynamodb';
import { searchEntities } from '../../common/utils/entity-utils';
import { Buyer } from '../../common/types';

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;
  const path = event.path;
  try {
    getUserContext(event);
    const keyword = getQueryParameter(event, 'q') || '';
    if (!keyword || keyword.length < 2) {
      throw new ValidationError('Search keyword must be at least 2 characters');
    }
    const pageSize = parseInt(getQueryParameter(event, 'pageSize') || '20', 10);
    const nextToken = getQueryParameter(event, 'nextToken') || undefined;

    const result = await searchEntities<Buyer>(
      TableNames.Buyers,
      keyword,
      pageSize,
      nextToken,
      (buyer, kw) => (
        buyer.companyName.toLowerCase().includes(kw) ||
        (buyer.vatNumber != null && buyer.vatNumber.toLowerCase().includes(kw)) ||
        (buyer.fiscalCode != null && buyer.fiscalCode.toLowerCase().includes(kw)) ||
        buyer.city.toLowerCase().includes(kw) ||
        (buyer.email != null && buyer.email.toLowerCase().includes(kw)) ||
        (buyer.phone != null && buyer.phone.includes(keyword))
      ),
      (a, b) => a.companyName.localeCompare(b.companyName)
    );

    return successResponse({
      buyers: result.items,
      count: result.items.length,
      totalMatches: result.totalMatches,
      hasMore: result.hasMore,
      nextToken: result.nextToken,
      keyword,
      message: `Found ${result.totalMatches} buyer(s) matching "${keyword}"`,
    });
  } catch (error) {
    return handleError(error, requestId, path);
  }
}
