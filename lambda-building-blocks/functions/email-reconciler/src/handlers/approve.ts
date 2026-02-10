/**
 * Approval API Handlers
 * REST endpoints for approving/rejecting queue entries
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import {
  approveEntry,
  rejectEntry,
  bulkApproveHighConfidence,
  cleanupRejectedEntries,
} from '../queue-manager';
import { ApprovalRequest } from '../types';
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
 * Extract reviewer ID from request
 * In production, this would come from JWT/auth context
 */
function getReviewerId(event: APIGatewayProxyEvent): number {
  // Try to get from header
  const header = event.headers['X-Reviewer-Id'] || event.headers['x-reviewer-id'];
  if (header) {
    return parseInt(header, 10);
  }

  // Try to get from body
  const body = event.body ? JSON.parse(event.body) : {};
  if (body.reviewerId) {
    return parseInt(body.reviewerId, 10);
  }

  // Default to system user
  return 0;
}

/**
 * POST /queue/{id}/approve
 * Approve a queue entry and apply changes
 */
export async function approveQueueEntry(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  try {
    const queueId = parseInt(event.pathParameters?.id || '', 10);

    if (isNaN(queueId)) {
      return response(400, { error: 'Invalid queue ID' });
    }

    const reviewerId = getReviewerId(event);
    const body = event.body ? JSON.parse(event.body) : {};

    const request: ApprovalRequest = {
      queueId,
      reviewerId,
      modifications: body.modifications,
    };

    const result = await approveEntry(request);

    if (result.success) {
      return response(200, {
        message: 'Queue entry approved and applied',
        queueId: result.queueId,
        appliedChanges: result.appliedChanges,
      });
    } else {
      return response(400, {
        error: result.error,
        queueId: result.queueId,
      });
    }
  } catch (error) {
    logger.error('Failed to approve queue entry', { error: String(error) });
    return response(500, { error: 'Internal server error' });
  }
}

/**
 * POST /queue/{id}/reject
 * Reject a queue entry
 */
export async function rejectQueueEntry(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  try {
    const queueId = parseInt(event.pathParameters?.id || '', 10);

    if (isNaN(queueId)) {
      return response(400, { error: 'Invalid queue ID' });
    }

    const reviewerId = getReviewerId(event);
    const body = event.body ? JSON.parse(event.body) : {};
    const reason = body.reason;

    const success = await rejectEntry(queueId, reviewerId, reason);

    if (success) {
      return response(200, {
        message: 'Queue entry rejected',
        queueId,
      });
    } else {
      return response(400, {
        error: 'Failed to reject entry (may not exist or already processed)',
        queueId,
      });
    }
  } catch (error) {
    logger.error('Failed to reject queue entry', { error: String(error) });
    return response(500, { error: 'Internal server error' });
  }
}

/**
 * POST /queue/{id}/modify
 * Modify and approve a queue entry
 */
export async function modifyAndApprove(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  try {
    const queueId = parseInt(event.pathParameters?.id || '', 10);

    if (isNaN(queueId)) {
      return response(400, { error: 'Invalid queue ID' });
    }

    const reviewerId = getReviewerId(event);
    const body = event.body ? JSON.parse(event.body) : {};

    if (!body.modifications || Object.keys(body.modifications).length === 0) {
      return response(400, { error: 'Modifications are required' });
    }

    const request: ApprovalRequest = {
      queueId,
      reviewerId,
      modifications: body.modifications,
    };

    const result = await approveEntry(request);

    if (result.success) {
      return response(200, {
        message: 'Queue entry modified and approved',
        queueId: result.queueId,
        appliedChanges: result.appliedChanges,
      });
    } else {
      return response(400, {
        error: result.error,
        queueId: result.queueId,
      });
    }
  } catch (error) {
    logger.error('Failed to modify and approve', { error: String(error) });
    return response(500, { error: 'Internal server error' });
  }
}

/**
 * POST /queue/bulk-approve
 * Bulk approve high-confidence entries
 */
export async function bulkApprove(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  try {
    const reviewerId = getReviewerId(event);
    const body = event.body ? JSON.parse(event.body) : {};
    const minConfidence = body.minConfidence || 0.95;
    const limit = body.limit || 100;

    const result = await bulkApproveHighConfidence(
      reviewerId,
      minConfidence,
      limit
    );

    return response(200, {
      message: `Bulk approval complete`,
      approved: result.approved,
      failed: result.failed,
      errors: result.errors.slice(0, 10), // Limit error messages
    });
  } catch (error) {
    logger.error('Failed to bulk approve', { error: String(error) });
    return response(500, { error: 'Internal server error' });
  }
}

/**
 * POST /queue/cleanup
 * Clean up old rejected entries
 */
export async function cleanupQueue(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  try {
    const body = event.body ? JSON.parse(event.body) : {};
    const olderThanDays = body.olderThanDays || 30;

    const deleted = await cleanupRejectedEntries(olderThanDays);

    return response(200, {
      message: `Cleanup complete`,
      deleted,
      olderThanDays,
    });
  } catch (error) {
    logger.error('Failed to cleanup queue', { error: String(error) });
    return response(500, { error: 'Internal server error' });
  }
}
