/**
 * Search Producers Handler
 * GET /api/search/producers
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { getUserContext, getQueryParameter } from '../../common/middleware/auth';
import { successResponse, handleError } from '../../common/utils/response';
import { ValidationError } from '../../common/utils/validation';
import { TableNames } from '../../common/clients/dynamodb';
import { searchEntities } from '../../common/utils/entity-utils';
import { Producer } from '../../common/types';

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

    const result = await searchEntities<Producer>(
      TableNames.Producers,
      keyword,
      pageSize,
      nextToken,
      (producer, kw) => (
        producer.companyName.toLowerCase().includes(kw) ||
        (producer.vatNumber != null && producer.vatNumber.toLowerCase().includes(kw)) ||
        (producer.fiscalCode != null && producer.fiscalCode.toLowerCase().includes(kw)) ||
        producer.city.toLowerCase().includes(kw) ||
        (producer.email != null && producer.email.toLowerCase().includes(kw)) ||
        (producer.phone != null && producer.phone.includes(keyword))
      ),
      (a, b) => a.companyName.localeCompare(b.companyName)
    );

    return successResponse({
      producers: result.items,
      count: result.items.length,
      totalMatches: result.totalMatches,
      hasMore: result.hasMore,
      nextToken: result.nextToken,
      keyword,
      message: `Found ${result.totalMatches} producer(s) matching "${keyword}"`,
    });
  } catch (error) {
    return handleError(error, requestId, path);
  }
}
