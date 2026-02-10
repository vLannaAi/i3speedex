/**
 * Email Reconciler Lambda Entry Point
 * Routes API Gateway events to appropriate handlers
 */

// Load environment variables from .env file (for local development)
import * as dotenv from 'dotenv';
import * as path from 'path';

// Try .env.local first, then fall back to .env
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config(); // This won't override existing values

import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { logger } from './logger';
import { testConnection, closePool } from './db/connection';

// Queue handlers
import {
  listPendingQueue,
  getQueueEntryHandler,
  listQueueByDomain,
  getAuditLogHandler,
} from './handlers/queue';

// Process handlers
import {
  processSingleEmail,
  processBatchEmails,
  processDetectDuplicates,
  processDetectSplits,
  previewProcessing,
  processFullPipeline,
} from './handlers/process';

// Approval handlers
import {
  approveQueueEntry,
  rejectQueueEntry,
  modifyAndApprove,
  bulkApprove,
  cleanupQueue,
} from './handlers/approve';

// Stats handlers
import {
  getStats,
  getDomainStatistics,
  getDomains,
  getDomainDetails,
  getDashboardSummary,
} from './handlers/stats';

/**
 * Route configuration
 * Maps HTTP method + path pattern to handler function
 */
interface Route {
  method: string;
  pattern: RegExp;
  handler: (event: APIGatewayProxyEvent) => Promise<APIGatewayProxyResult>;
}

const routes: Route[] = [
  // Queue endpoints
  { method: 'GET', pattern: /^\/queue\/pending$/, handler: listPendingQueue },
  { method: 'GET', pattern: /^\/queue\/(\d+)\/audit$/, handler: getAuditLogHandler },
  { method: 'GET', pattern: /^\/queue\/domain\/([^/]+)$/, handler: listQueueByDomain },
  { method: 'GET', pattern: /^\/queue\/(\d+)$/, handler: getQueueEntryHandler },

  // Approval endpoints
  { method: 'POST', pattern: /^\/queue\/bulk-approve$/, handler: bulkApprove },
  { method: 'POST', pattern: /^\/queue\/cleanup$/, handler: cleanupQueue },
  { method: 'POST', pattern: /^\/queue\/(\d+)\/approve$/, handler: approveQueueEntry },
  { method: 'POST', pattern: /^\/queue\/(\d+)\/reject$/, handler: rejectQueueEntry },
  { method: 'POST', pattern: /^\/queue\/(\d+)\/modify$/, handler: modifyAndApprove },

  // Process endpoints
  { method: 'GET', pattern: /^\/process\/preview\/(\d+)$/, handler: previewProcessing },
  { method: 'GET', pattern: /^\/process\/msg-email\/(\d+)$/, handler: processSingleEmail },
  { method: 'POST', pattern: /^\/process\/batch$/, handler: processBatchEmails },
  { method: 'POST', pattern: /^\/process\/duplicates$/, handler: processDetectDuplicates },
  { method: 'POST', pattern: /^\/process\/splits$/, handler: processDetectSplits },
  { method: 'POST', pattern: /^\/process\/full$/, handler: processFullPipeline },

  // Stats endpoints
  { method: 'GET', pattern: /^\/stats\/domains$/, handler: getDomainStatistics },
  { method: 'GET', pattern: /^\/stats\/summary$/, handler: getDashboardSummary },
  { method: 'GET', pattern: /^\/stats$/, handler: getStats },
  { method: 'GET', pattern: /^\/domains\/([^/]+)$/, handler: getDomainDetails },
  { method: 'GET', pattern: /^\/domains$/, handler: getDomains },
];

/**
 * CORS preflight response
 */
function corsResponse(): APIGatewayProxyResult {
  return {
    statusCode: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Reviewer-Id',
      'Access-Control-Max-Age': '86400',
    },
    body: '',
  };
}

/**
 * Error response helper
 */
function errorResponse(
  statusCode: number,
  message: string
): APIGatewayProxyResult {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
    body: JSON.stringify({ error: message }),
  };
}

/**
 * Health check response
 */
async function healthCheck(): Promise<APIGatewayProxyResult> {
  const dbConnected = await testConnection();

  return {
    statusCode: dbConnected ? 200 : 503,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
    body: JSON.stringify({
      status: dbConnected ? 'healthy' : 'unhealthy',
      database: dbConnected ? 'connected' : 'disconnected',
      timestamp: new Date().toISOString(),
    }),
  };
}

/**
 * Main Lambda handler
 */
export async function handler(
  event: APIGatewayProxyEvent,
  context: Context
): Promise<APIGatewayProxyResult> {
  // Don't wait for event loop to empty
  context.callbackWaitsForEmptyEventLoop = false;

  const startTime = Date.now();
  const requestId = context.awsRequestId;

  logger.info('Request received', {
    requestId,
    method: event.httpMethod,
    path: event.path,
  });

  try {
    // Handle CORS preflight
    if (event.httpMethod === 'OPTIONS') {
      return corsResponse();
    }

    // Health check endpoint
    if (event.path === '/health' && event.httpMethod === 'GET') {
      return healthCheck();
    }

    // Find matching route
    const method = event.httpMethod;
    const path = event.path;

    for (const route of routes) {
      if (route.method !== method) continue;

      const match = path.match(route.pattern);
      if (match) {
        // Extract path parameters from regex groups
        if (match.length > 1) {
          event.pathParameters = event.pathParameters || {};

          // Determine parameter name based on pattern
          if (route.pattern.source.includes('domain')) {
            event.pathParameters.domain = match[1];
          } else {
            event.pathParameters.id = match[1];
          }
        }

        const result = await route.handler(event);

        const duration = Date.now() - startTime;
        logger.info('Request completed', {
          requestId,
          statusCode: result.statusCode,
          duration,
        });

        return result;
      }
    }

    // No route matched
    logger.warn('Route not found', { method, path });
    return errorResponse(404, `Route not found: ${method} ${path}`);

  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error('Request failed', {
      requestId,
      error: String(error),
      duration,
    });

    return errorResponse(500, 'Internal server error');
  }
}

/**
 * Graceful shutdown handler
 */
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, closing connections');
  await closePool();
});
