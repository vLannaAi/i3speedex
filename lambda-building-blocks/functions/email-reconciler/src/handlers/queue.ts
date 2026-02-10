/**
 * Queue API Handlers
 * REST endpoints for managing the review queue
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import {
  getPendingQueue,
  getQueueEntry,
  getQueueByDomain,
  getProcessingStats,
  getAuditLog,
} from '../queue-manager';
import { QueueFilterOptions, QueueStatus, QueueType } from '../types';
import { logger } from '../logger';

/**
 * Helper to create API response
 */
function response(
  statusCode: number,
  body: unknown
): APIGatewayProxyResult {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
    body: JSON.stringify(body),
  };
}

/**
 * Parse filter options from query string
 */
function parseFilterOptions(params: Record<string, string | undefined>): QueueFilterOptions {
  const options: QueueFilterOptions = {};

  if (params.status) {
    options.status = params.status.split(',') as QueueStatus[];
  }

  if (params.queueType) {
    options.queueType = params.queueType.split(',') as QueueType[];
  }

  if (params.minConfidence) {
    options.minConfidence = parseFloat(params.minConfidence);
  }

  if (params.maxConfidence) {
    options.maxConfidence = parseFloat(params.maxConfidence);
  }

  if (params.page) {
    options.page = parseInt(params.page, 10);
  }

  if (params.pageSize) {
    options.pageSize = Math.min(parseInt(params.pageSize, 10), 100);
  }

  return options;
}

/**
 * GET /queue/pending
 * List pending queue entries with filtering
 */
export async function listPendingQueue(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  try {
    const params = event.queryStringParameters || {};
    const options = parseFilterOptions(params);

    const result = await getPendingQueue(options);

    return response(200, result);
  } catch (error) {
    logger.error('Failed to list pending queue', { error: String(error) });
    return response(500, { error: 'Internal server error' });
  }
}

/**
 * GET /queue/{id}
 * Get a specific queue entry
 */
export async function getQueueEntryHandler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  try {
    const id = parseInt(event.pathParameters?.id || '', 10);

    if (isNaN(id)) {
      return response(400, { error: 'Invalid queue ID' });
    }

    const entry = await getQueueEntry(id);

    if (!entry) {
      return response(404, { error: 'Queue entry not found' });
    }

    return response(200, entry);
  } catch (error) {
    logger.error('Failed to get queue entry', { error: String(error) });
    return response(500, { error: 'Internal server error' });
  }
}

/**
 * GET /queue/domain/{domain}
 * List queue entries for a specific domain
 */
export async function listQueueByDomain(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  try {
    const domain = event.pathParameters?.domain;

    if (!domain) {
      return response(400, { error: 'Domain is required' });
    }

    const params = event.queryStringParameters || {};
    const options = parseFilterOptions(params);

    const result = await getQueueByDomain(domain, options);

    return response(200, result);
  } catch (error) {
    logger.error('Failed to list queue by domain', { error: String(error) });
    return response(500, { error: 'Internal server error' });
  }
}

/**
 * GET /stats
 * Get processing statistics
 */
export async function getStatsHandler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  try {
    const stats = await getProcessingStats();
    return response(200, stats);
  } catch (error) {
    logger.error('Failed to get stats', { error: String(error) });
    return response(500, { error: 'Internal server error' });
  }
}

/**
 * GET /queue/{id}/audit
 * Get audit log for a queue entry
 */
export async function getAuditLogHandler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  try {
    const id = parseInt(event.pathParameters?.id || '', 10);

    if (isNaN(id)) {
      return response(400, { error: 'Invalid queue ID' });
    }

    const log = await getAuditLog(id);

    return response(200, { queueId: id, auditLog: log });
  } catch (error) {
    logger.error('Failed to get audit log', { error: String(error) });
    return response(500, { error: 'Internal server error' });
  }
}
