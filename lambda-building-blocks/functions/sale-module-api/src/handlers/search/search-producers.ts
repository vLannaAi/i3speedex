/**
 * Search Producers Handler
 * GET /api/search/producers
 *
 * Search producers by keyword (matches company name, VAT number, fiscal code, city, email)
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { getUserContext, getQueryParameter } from '../../common/middleware/auth';
import { successResponse, handleError } from '../../common/utils/response';
import { ValidationError } from '../../common/utils/validation';
import { scanItems, TableNames } from '../../common/clients/dynamodb';
import { Producer } from '../../common/types';

/**
 * Search producers handler
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

    // 4. Scan producers table
    const { items: allProducers, lastEvaluatedKey } = await scanItems<Producer>({
      TableName: TableNames.Producers,
      FilterExpression: 'SK = :sk AND attribute_not_exists(deletedAt)',
      ExpressionAttributeValues: {
        ':sk': 'METADATA',
      },
      Limit: 100,
      ExclusiveStartKey: nextToken ? JSON.parse(Buffer.from(nextToken, 'base64').toString()) : undefined,
    });

    // 5. Filter producers by keyword (case-insensitive)
    const keywordLower = keyword.toLowerCase();
    let filteredProducers = allProducers.filter((producer) => {
      return (
        producer.companyName.toLowerCase().includes(keywordLower) ||
        (producer.vatNumber && producer.vatNumber.toLowerCase().includes(keywordLower)) ||
        (producer.fiscalCode && producer.fiscalCode.toLowerCase().includes(keywordLower)) ||
        producer.city.toLowerCase().includes(keywordLower) ||
        (producer.email && producer.email.toLowerCase().includes(keywordLower)) ||
        (producer.phone && producer.phone.includes(keyword))
      );
    });

    // 6. Sort by company name
    filteredProducers.sort((a, b) => a.companyName.localeCompare(b.companyName));

    // 7. Paginate results
    const paginatedProducers = filteredProducers.slice(0, pageSize);

    // 8. Prepare response
    const hasMore = filteredProducers.length > pageSize || !!lastEvaluatedKey;
    const nextPageToken = hasMore && lastEvaluatedKey
      ? Buffer.from(JSON.stringify(lastEvaluatedKey)).toString('base64')
      : undefined;

    return successResponse({
      producers: paginatedProducers,
      count: paginatedProducers.length,
      totalMatches: filteredProducers.length,
      hasMore,
      nextToken: nextPageToken,
      keyword,
      message: `Found ${filteredProducers.length} producer(s) matching "${keyword}"`,
    });

  } catch (error) {
    return handleError(error, requestId, path);
  }
}
