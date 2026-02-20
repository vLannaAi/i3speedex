/**
 * Search Sales Handler
 * GET /api/search/sales
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { getUserContext, getQueryParameter } from '../../common/middleware/auth';
import { successResponse, handleError } from '../../common/utils/response';
import { ValidationError } from '../../common/utils/validation';
import { TableNames } from '../../common/clients/dynamodb';
import { searchEntities } from '../../common/utils/entity-utils';
import { Sale } from '../../common/types';

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;
  const path = event.path;
  try {
    const user = getUserContext(event);
    const keyword = getQueryParameter(event, 'q') || '';
    if (!keyword || keyword.length < 2) {
      throw new ValidationError('Search keyword must be at least 2 characters');
    }
    const pageSize = parseInt(getQueryParameter(event, 'pageSize') || '20', 10);
    const nextToken = getQueryParameter(event, 'nextToken') || undefined;

    const result = await searchEntities<Sale>(
      TableNames.Sales,
      keyword,
      pageSize,
      nextToken,
      (sale, kw) => {
        const hasAccess = user.groups.includes('Admin') || sale.createdBy === user.username;
        if (!hasAccess) return false;
        return (
          sale.saleId.toLowerCase().includes(kw) ||
          (sale.invoiceNumber != null && sale.invoiceNumber.toLowerCase().includes(kw)) ||
          sale.buyerName.toLowerCase().includes(kw) ||
          sale.producerName.toLowerCase().includes(kw) ||
          (sale.referenceNumber != null && sale.referenceNumber.toLowerCase().includes(kw)) ||
          (sale.notes != null && sale.notes.toLowerCase().includes(kw))
        );
      },
      (a, b) => new Date(b.saleDate).getTime() - new Date(a.saleDate).getTime()
    );

    return successResponse({
      sales: result.items,
      count: result.items.length,
      totalMatches: result.totalMatches,
      hasMore: result.hasMore,
      nextToken: result.nextToken,
      keyword,
      message: `Found ${result.totalMatches} sale(s) matching "${keyword}"`,
    });
  } catch (error) {
    return handleError(error, requestId, path);
  }
}
