/**
 * DynamoDB Client for i2speedex Sale Module
 * Provides reusable methods for DynamoDB operations
 */

import {
  DynamoDBClient,
  DynamoDBClientConfig,
} from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  UpdateCommand,
  DeleteCommand,
  QueryCommand,
  ScanCommand,
  BatchGetCommand,
  TransactWriteCommand,
  GetCommandInput,
  PutCommandInput,
  UpdateCommandInput,
  DeleteCommandInput,
  QueryCommandInput,
  ScanCommandInput,
} from '@aws-sdk/lib-dynamodb';

// Environment variables
const REGION = process.env.AWS_REGION || 'eu-west-1';
const SALES_TABLE = process.env.SALES_TABLE_NAME || '';
const SALE_LINES_TABLE = process.env.SALE_LINES_TABLE_NAME || '';
const BUYERS_TABLE = process.env.BUYERS_TABLE_NAME || '';
const PRODUCERS_TABLE = process.env.PRODUCERS_TABLE_NAME || '';
const USERS_TABLE = process.env.USERS_TABLE_NAME || '';

// Create DynamoDB client
const config: DynamoDBClientConfig = {
  region: REGION,
};

const client = new DynamoDBClient(config);

// Create Document client with marshalling/unmarshalling
export const dynamoDb = DynamoDBDocumentClient.from(client, {
  marshallOptions: {
    removeUndefinedValues: true,
    convertClassInstanceToMap: true,
  },
  unmarshallOptions: {
    wrapNumbers: false,
  },
});

// ========================================
// Table Names
// ========================================

export const TableNames = {
  Sales: SALES_TABLE,
  SaleLines: SALE_LINES_TABLE,
  Buyers: BUYERS_TABLE,
  Producers: PRODUCERS_TABLE,
  Users: USERS_TABLE,
};

// ========================================
// Helper Functions
// ========================================

/**
 * Get a single item from DynamoDB
 */
export async function getItem<T>(params: GetCommandInput): Promise<T | null> {
  const command = new GetCommand(params);
  const result = await dynamoDb.send(command);
  return (result.Item as T) || null;
}

/**
 * Put an item into DynamoDB
 */
export async function putItem(params: PutCommandInput): Promise<void> {
  const command = new PutCommand(params);
  await dynamoDb.send(command);
}

/**
 * Update an item in DynamoDB
 */
export async function updateItem(params: UpdateCommandInput): Promise<any> {
  const command = new UpdateCommand(params);
  const result = await dynamoDb.send(command);
  return result.Attributes;
}

/**
 * Delete an item from DynamoDB
 */
export async function deleteItem(params: DeleteCommandInput): Promise<void> {
  const command = new DeleteCommand(params);
  await dynamoDb.send(command);
}

/**
 * Query items from DynamoDB
 */
export async function queryItems<T>(params: QueryCommandInput): Promise<{
  items: T[];
  lastEvaluatedKey?: Record<string, any>;
  count: number;
}> {
  const command = new QueryCommand(params);
  const result = await dynamoDb.send(command);

  return {
    items: (result.Items as T[]) || [],
    lastEvaluatedKey: result.LastEvaluatedKey,
    count: result.Count || 0,
  };
}

/**
 * Scan items from DynamoDB (use sparingly)
 */
export async function scanItems<T>(params: ScanCommandInput): Promise<{
  items: T[];
  lastEvaluatedKey?: Record<string, any>;
  count: number;
}> {
  const command = new ScanCommand(params);
  const result = await dynamoDb.send(command);

  return {
    items: (result.Items as T[]) || [],
    lastEvaluatedKey: result.LastEvaluatedKey,
    count: result.Count || 0,
  };
}

/**
 * Scan ALL matching items from DynamoDB, paginating through results automatically.
 * Use for list endpoints that need accurate total counts.
 */
export async function scanAllItems<T>(params: Omit<ScanCommandInput, 'Limit' | 'ExclusiveStartKey'>): Promise<T[]> {
  const allItems: T[] = [];
  let lastKey: Record<string, any> | undefined;

  do {
    const command = new ScanCommand({
      ...params,
      ExclusiveStartKey: lastKey,
    });
    const result = await dynamoDb.send(command);
    allItems.push(...((result.Items as T[]) || []));
    lastKey = result.LastEvaluatedKey;
  } while (lastKey);

  return allItems;
}

/**
 * Query ALL matching items from DynamoDB, paginating through results automatically.
 * Use for list endpoints that need accurate total counts.
 */
export async function queryAllItems<T>(params: Omit<QueryCommandInput, 'Limit' | 'ExclusiveStartKey'>): Promise<T[]> {
  const allItems: T[] = [];
  let lastKey: Record<string, any> | undefined;

  do {
    const command = new QueryCommand({
      ...params,
      ExclusiveStartKey: lastKey,
    });
    const result = await dynamoDb.send(command);
    allItems.push(...((result.Items as T[]) || []));
    lastKey = result.LastEvaluatedKey;
  } while (lastKey);

  return allItems;
}

/**
 * Batch get items from DynamoDB
 */
export async function batchGetItems<T>(
  tableName: string,
  keys: Record<string, any>[]
): Promise<T[]> {
  const command = new BatchGetCommand({
    RequestItems: {
      [tableName]: {
        Keys: keys,
      },
    },
  });

  const result = await dynamoDb.send(command);
  return (result.Responses?.[tableName] as T[]) || [];
}

/**
 * Transactional write (atomic operations)
 */
export async function transactWrite(items: any[]): Promise<void> {
  const command = new TransactWriteCommand({
    TransactItems: items,
  });

  await dynamoDb.send(command);
}

// ========================================
// Pagination Helper
// ========================================

export interface PaginationParams {
  page?: number;
  pageSize?: number;
  nextToken?: string;
}

export interface PaginatedResult<T> {
  items: T[];
  pagination: {
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
    hasMore: boolean;
    nextToken?: string;
  };
}

/**
 * Helper to calculate pagination
 */
export function calculatePagination<T>(
  items: T[],
  totalCount: number,
  page: number,
  pageSize: number,
  lastEvaluatedKey?: Record<string, any>
): PaginatedResult<T> {
  const totalPages = Math.ceil(totalCount / pageSize);
  const hasMore = !!lastEvaluatedKey || page < totalPages;

  return {
    items,
    pagination: {
      total: totalCount,
      page,
      pageSize,
      totalPages,
      hasMore,
      nextToken: lastEvaluatedKey
        ? Buffer.from(JSON.stringify(lastEvaluatedKey)).toString('base64')
        : undefined,
    },
  };
}

/**
 * Decode nextToken for pagination
 */
export function decodeNextToken(nextToken?: string): Record<string, any> | undefined {
  if (!nextToken) return undefined;

  try {
    const decoded = Buffer.from(nextToken, 'base64').toString('utf-8');
    return JSON.parse(decoded);
  } catch (error) {
    console.error('Failed to decode nextToken:', error);
    return undefined;
  }
}

// ========================================
// Timestamp Helpers
// ========================================

/**
 * Get current ISO timestamp
 */
export function getCurrentTimestamp(): string {
  return new Date().toISOString();
}

/**
 * Add timestamp fields to an item
 */
export function addTimestamps<T extends Record<string, any>>(
  item: T,
  username: string
): T & { createdAt: string; updatedAt: string; createdBy: string; updatedBy: string } {
  const now = getCurrentTimestamp();

  return {
    ...item,
    createdAt: now,
    updatedAt: now,
    createdBy: username,
    updatedBy: username,
  };
}

/**
 * Update timestamp fields
 */
export function updateTimestamp(username: string): {
  updatedAt: string;
  updatedBy: string;
} {
  return {
    updatedAt: getCurrentTimestamp(),
    updatedBy: username,
  };
}

// ========================================
// Soft Delete Helper
// ========================================

/**
 * Soft delete an item (set deletedAt timestamp)
 */
export async function softDelete(
  tableName: string,
  key: Record<string, any>,
  username: string
): Promise<void> {
  await updateItem({
    TableName: tableName,
    Key: key,
    UpdateExpression: 'SET deletedAt = :deletedAt, updatedAt = :updatedAt, updatedBy = :updatedBy',
    ExpressionAttributeValues: {
      ':deletedAt': getCurrentTimestamp(),
      ':updatedAt': getCurrentTimestamp(),
      ':updatedBy': username,
    },
  });
}

// ========================================
// Conditional Expression Builder
// ========================================

export class ConditionBuilder {
  private conditions: string[] = [];
  private attributeNames: Record<string, string> = {};
  private attributeValues: Record<string, any> = {};

  equals(key: string, value: any): this {
    const placeholder = `:${key}`;
    this.conditions.push(`${key} = ${placeholder}`);
    this.attributeValues[placeholder] = value;
    return this;
  }

  notEquals(key: string, value: any): this {
    const placeholder = `:${key}`;
    this.conditions.push(`${key} <> ${placeholder}`);
    this.attributeValues[placeholder] = value;
    return this;
  }

  greaterThan(key: string, value: any): this {
    const placeholder = `:${key}`;
    this.conditions.push(`${key} > ${placeholder}`);
    this.attributeValues[placeholder] = value;
    return this;
  }

  lessThan(key: string, value: any): this {
    const placeholder = `:${key}`;
    this.conditions.push(`${key} < ${placeholder}`);
    this.attributeValues[placeholder] = value;
    return this;
  }

  between(key: string, start: any, end: any): this {
    const placeholderStart = `:${key}Start`;
    const placeholderEnd = `:${key}End`;
    this.conditions.push(`${key} BETWEEN ${placeholderStart} AND ${placeholderEnd}`);
    this.attributeValues[placeholderStart] = start;
    this.attributeValues[placeholderEnd] = end;
    return this;
  }

  contains(key: string, value: string): this {
    const placeholder = `:${key}`;
    this.conditions.push(`contains(${key}, ${placeholder})`);
    this.attributeValues[placeholder] = value;
    return this;
  }

  exists(key: string): this {
    this.conditions.push(`attribute_exists(${key})`);
    return this;
  }

  notExists(key: string): this {
    this.conditions.push(`attribute_not_exists(${key})`);
    return this;
  }

  build(): {
    condition: string;
    attributeNames: Record<string, string>;
    attributeValues: Record<string, any>;
  } {
    return {
      condition: this.conditions.join(' AND '),
      attributeNames: this.attributeNames,
      attributeValues: this.attributeValues,
    };
  }
}
