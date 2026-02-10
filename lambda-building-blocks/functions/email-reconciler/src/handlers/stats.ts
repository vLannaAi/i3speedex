/**
 * Statistics API Handlers
 * REST endpoints for viewing processing statistics and domain data
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { getProcessingStats } from '../queue-manager';
import { getDomainStats } from '../db/queries';
import { getAllDomainPatterns, getDomainPattern } from '../domain-analyzer';
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
 * GET /stats
 * Get overall processing statistics
 */
export async function getStats(
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
 * GET /stats/domains
 * Get domain statistics (record counts, user counts)
 */
export async function getDomainStatistics(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  try {
    const stats = await getDomainStats();
    return response(200, { domains: stats });
  } catch (error) {
    logger.error('Failed to get domain stats', { error: String(error) });
    return response(500, { error: 'Internal server error' });
  }
}

/**
 * GET /domains
 * Get all learned domain patterns
 */
export async function getDomains(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  try {
    const patterns = await getAllDomainPatterns();
    return response(200, { patterns });
  } catch (error) {
    logger.error('Failed to get domain patterns', { error: String(error) });
    return response(500, { error: 'Internal server error' });
  }
}

/**
 * GET /domains/{domain}
 * Get or analyze pattern for a specific domain
 */
export async function getDomainDetails(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  try {
    const domain = event.pathParameters?.domain;

    if (!domain) {
      return response(400, { error: 'Domain is required' });
    }

    const pattern = await getDomainPattern(domain);

    return response(200, pattern);
  } catch (error) {
    logger.error('Failed to get domain details', { error: String(error) });
    return response(500, { error: 'Internal server error' });
  }
}

/**
 * GET /stats/summary
 * Get a high-level summary suitable for dashboard
 */
export async function getDashboardSummary(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  try {
    const stats = await getProcessingStats();
    const domainStats = await getDomainStats();

    const summary = {
      // Overall progress
      progress: {
        total: stats.totalMsgEmails,
        processed: stats.processedMsgEmails,
        remaining: stats.totalMsgEmails - stats.processedMsgEmails,
        percentComplete: stats.totalMsgEmails > 0
          ? Math.round((stats.processedMsgEmails / stats.totalMsgEmails) * 100)
          : 0,
      },

      // Queue status
      queue: {
        pending: stats.pendingQueue,
        approved: stats.approvedQueue,
        rejected: stats.rejectedQueue,
        applied: stats.appliedQueue,
        total: stats.pendingQueue + stats.approvedQueue + stats.rejectedQueue + stats.appliedQueue,
      },

      // Confidence distribution of pending items
      pendingByConfidence: stats.byConfidenceTier,

      // Classification distribution
      classification: stats.byClassification,

      // Top domains (by email count)
      topDomains: domainStats.slice(0, 10),

      // Action needed
      actionNeeded: {
        highConfidence: stats.byConfidenceTier.high,
        needsReview: stats.byConfidenceTier.medium + stats.byConfidenceTier.low,
        lowConfidence: stats.byConfidenceTier.veryLow,
      },
    };

    return response(200, summary);
  } catch (error) {
    logger.error('Failed to get dashboard summary', { error: String(error) });
    return response(500, { error: 'Internal server error' });
  }
}
