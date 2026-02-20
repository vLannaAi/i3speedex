/**
 * Shared Entity Utilities
 * Reusable helpers for common DynamoDB patterns across buyers and producers.
 */

import { APIGatewayProxyResult } from 'aws-lambda';
import { ScanCommandInput } from '@aws-sdk/lib-dynamodb';
import { scanAllItems, scanItems, getItem } from '../clients/dynamodb';
import { paginatedResponse } from './response';
import { NotFoundError } from './validation';

/**
 * Scan all entities with optional status/country/search filters, sort by companyName,
 * and return a paginated API response. Used by list handlers (buyers, producers).
 */
export async function scanEntities<T extends { companyName: string }>(
  tableName: string,
  filters: { status?: string | null; search?: string | null; country?: string | null },
  pagination: { page: number; pageSize: number }
): Promise<APIGatewayProxyResult> {
  const filterParts: string[] = ['attribute_not_exists(deletedAt)', 'SK = :sk'];
  const expressionAttributeNames: Record<string, string> = {};
  const expressionAttributeValues: Record<string, unknown> = { ':sk': 'METADATA' };

  if (filters.status) {
    filterParts.push('#status = :status');
    expressionAttributeNames['#status'] = 'status';
    expressionAttributeValues[':status'] = filters.status;
  }
  if (filters.country) {
    filterParts.push('country = :country');
    expressionAttributeValues[':country'] = filters.country;
  }
  if (filters.search) {
    filterParts.push('contains(companyName, :search)');
    expressionAttributeValues[':search'] = filters.search;
  }

  const params: Omit<ScanCommandInput, 'Limit' | 'ExclusiveStartKey'> = {
    TableName: tableName,
    FilterExpression: filterParts.join(' AND '),
    ExpressionAttributeValues: expressionAttributeValues,
  };
  if (Object.keys(expressionAttributeNames).length > 0) {
    params.ExpressionAttributeNames = expressionAttributeNames;
  }

  const allItems = await scanAllItems<T>(params);
  allItems.sort((a, b) => a.companyName.localeCompare(b.companyName));

  const { page, pageSize } = pagination;
  const totalCount = allItems.length;
  const totalPages = Math.ceil(totalCount / pageSize);
  const start = (page - 1) * pageSize;

  return paginatedResponse(allItems.slice(start, start + pageSize), {
    total: totalCount,
    page,
    pageSize,
    totalPages,
    hasMore: page < totalPages,
  });
}

/**
 * Fetch a single entity by (pkPrefix + id), throwing NotFoundError if missing or soft-deleted.
 * Used by get, update, and delete handlers.
 */
export async function getEntityOrThrow<T extends { deletedAt?: string }>(
  tableName: string,
  pkPrefix: string,
  id: string,
  notFoundMessage: string
): Promise<T> {
  const item = await getItem<T>({
    TableName: tableName,
    Key: { PK: `${pkPrefix}${id}`, SK: 'METADATA' },
  });
  if (!item || item.deletedAt) throw new NotFoundError(notFoundMessage);
  return item;
}

/**
 * Build a DynamoDB SET expression from a body object and a list of allowed fields.
 * Each present field becomes `#field = :field` to avoid reserved-word conflicts.
 */
export function buildUpdateSet(
  body: Record<string, unknown>,
  fields: string[]
): {
  updateExpressions: string[];
  expressionAttributeNames: Record<string, string>;
  expressionAttributeValues: Record<string, unknown>;
} {
  const updateExpressions: string[] = [];
  const expressionAttributeNames: Record<string, string> = {};
  const expressionAttributeValues: Record<string, unknown> = {};

  for (const field of fields) {
    if (body[field] !== undefined) {
      updateExpressions.push(`#${field} = :${field}`);
      expressionAttributeNames[`#${field}`] = field;
      expressionAttributeValues[`:${field}`] = body[field];
    }
  }

  return { updateExpressions, expressionAttributeNames, expressionAttributeValues };
}

/**
 * Scan a single page of entities with keyword filtering applied in-memory,
 * returning items + pagination metadata. Used by search handlers.
 */
export async function searchEntities<T>(
  tableName: string,
  keyword: string,
  pageSize: number,
  nextToken: string | undefined,
  filterFn: (item: T, keywordLower: string) => boolean,
  sortFn: (a: T, b: T) => number
): Promise<{
  items: T[];
  totalMatches: number;
  hasMore: boolean;
  nextToken: string | undefined;
}> {
  const { items: allItems, lastEvaluatedKey } = await scanItems<T>({
    TableName: tableName,
    FilterExpression: 'SK = :sk AND attribute_not_exists(deletedAt)',
    ExpressionAttributeValues: { ':sk': 'METADATA' },
    Limit: 100,
    ExclusiveStartKey: nextToken
      ? JSON.parse(Buffer.from(nextToken, 'base64').toString())
      : undefined,
  });

  const keywordLower = keyword.toLowerCase();
  const filteredItems = allItems.filter(item => filterFn(item, keywordLower));
  filteredItems.sort(sortFn);

  const paginatedItems = filteredItems.slice(0, pageSize);
  const hasMore = filteredItems.length > pageSize || !!lastEvaluatedKey;
  const nextPageToken =
    hasMore && lastEvaluatedKey
      ? Buffer.from(JSON.stringify(lastEvaluatedKey)).toString('base64')
      : undefined;

  return {
    items: paginatedItems,
    totalMatches: filteredItems.length,
    hasMore,
    nextToken: nextPageToken,
  };
}
