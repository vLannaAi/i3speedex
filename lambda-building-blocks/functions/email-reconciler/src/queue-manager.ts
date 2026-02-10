/**
 * Queue Manager
 * Handles review queue operations and approval workflows
 */

import { PoolConnection } from 'mysql2/promise';
import {
  QueueEntry,
  QueueEntryWithDetails,
  QueueStatus,
  QueueType,
  QueueFilterOptions,
  PaginatedResponse,
  ApprovalRequest,
  ApprovalResult,
  LinkProposal,
  CreateUserProposal,
  MergeProposal,
  SplitProposal,
  ProcessingStats,
} from './types';
import {
  getQueueEntries,
  getQueueEntryById,
  updateQueueStatus,
  getMsgEmailById,
  getUserById,
  applyLinkProposal,
  applyCreateUserProposal,
  applyMergeProposal,
  applySplitProposal,
  getProcessingStats as getStats,
} from './db/queries';
import { withTransaction, query, execute } from './db/connection';
import { logger } from './logger';

/**
 * Get pending queue entries with pagination
 */
export async function getPendingQueue(
  options: QueueFilterOptions = {}
): Promise<PaginatedResponse<QueueEntryWithDetails>> {
  const filterOptions: QueueFilterOptions = {
    ...options,
    status: options.status || ['pending'],
  };

  const entries = await getQueueEntries(filterOptions);
  const entriesWithDetails = await enrichQueueEntries(entries);

  // Get total count
  const totalResult = await query<{ count: number }>(`
    SELECT COUNT(*) as count FROM reconciliation_queue WHERE status = 'pending'
  `);

  const total = totalResult[0]?.count || 0;
  const page = options.page || 1;
  const pageSize = options.pageSize || 50;

  return {
    items: entriesWithDetails,
    total,
    page,
    pageSize,
    hasMore: page * pageSize < total,
  };
}

/**
 * Get queue entry by ID with details
 */
export async function getQueueEntry(id: number): Promise<QueueEntryWithDetails | null> {
  const entry = await getQueueEntryById(id);
  if (!entry) return null;

  const [enriched] = await enrichQueueEntries([entry]);
  return enriched;
}

/**
 * Enrich queue entries with related data
 */
async function enrichQueueEntries(
  entries: QueueEntry[]
): Promise<QueueEntryWithDetails[]> {
  const enriched: QueueEntryWithDetails[] = [];

  for (const entry of entries) {
    const details: QueueEntryWithDetails = { ...entry };

    // Get msg_email input
    if (entry.msgEmailId) {
      const msgEmail = await getMsgEmailById(entry.msgEmailId);
      if (msgEmail) {
        details.msgEmailInput = msgEmail.input || undefined;
      }
    }

    // Get source user name
    if (entry.sourceUserId) {
      const sourceUser = await getUserById(entry.sourceUserId);
      if (sourceUser) {
        details.sourceUserName = sourceUser.name || undefined;
      }
    }

    // Get target user name
    if (entry.targetUserId) {
      const targetUser = await getUserById(entry.targetUserId);
      if (targetUser) {
        details.targetUserName = targetUser.name || undefined;
      }
    }

    enriched.push(details);
  }

  return enriched;
}

/**
 * Approve a queue entry and apply changes
 */
export async function approveEntry(
  request: ApprovalRequest
): Promise<ApprovalResult> {
  const { queueId, reviewerId, modifications } = request;

  // Get the queue entry
  const entry = await getQueueEntryById(queueId);
  if (!entry) {
    return {
      success: false,
      queueId,
      appliedChanges: {},
      error: 'Queue entry not found',
    };
  }

  if (entry.status !== 'pending') {
    return {
      success: false,
      queueId,
      appliedChanges: {},
      error: `Entry is already ${entry.status}`,
    };
  }

  try {
    // Apply modifications to proposed data if provided
    const proposedData = modifications
      ? { ...entry.proposedData, ...modifications }
      : entry.proposedData;

    // Apply changes within a transaction
    const appliedChanges = await withTransaction(async (connection) => {
      const conn = connection as PoolConnection;

      switch (entry.queueType) {
        case 'link':
          await applyLinkProposal(conn, proposedData as LinkProposal);
          return { type: 'link', ...proposedData };

        case 'create_user':
          const newUserId = await applyCreateUserProposal(
            conn,
            proposedData as CreateUserProposal
          );
          return { type: 'create_user', newUserId, ...proposedData };

        case 'merge':
          await applyMergeProposal(conn, proposedData as MergeProposal);
          return { type: 'merge', ...proposedData };

        case 'split':
          const sourceUser = await getUserById(entry.sourceUserId!);
          if (!sourceUser) {
            throw new Error('Source user not found');
          }
          const splitUserId = await applySplitProposal(
            conn,
            proposedData as SplitProposal,
            sourceUser
          );
          return { type: 'split', newUserId: splitUserId, ...proposedData };

        default:
          throw new Error(`Unknown queue type: ${entry.queueType}`);
      }
    });

    // Update queue status
    await updateQueueStatus(queueId, 'applied', reviewerId);

    // Log audit entry
    await logAuditEntry(queueId, 'applied', reviewerId, modifications, appliedChanges);

    logger.info('Queue entry approved and applied', {
      queueId,
      queueType: entry.queueType,
      reviewerId,
    });

    return {
      success: true,
      queueId,
      appliedChanges,
    };
  } catch (error) {
    logger.error('Failed to apply queue entry', {
      queueId,
      error: String(error),
    });

    // Log failed attempt
    await logAuditEntry(queueId, 'approved', reviewerId, modifications, null, String(error));

    return {
      success: false,
      queueId,
      appliedChanges: {},
      error: String(error),
    };
  }
}

/**
 * Reject a queue entry
 */
export async function rejectEntry(
  queueId: number,
  reviewerId: number,
  reason?: string
): Promise<boolean> {
  const entry = await getQueueEntryById(queueId);
  if (!entry) {
    logger.warn('Queue entry not found for rejection', { queueId });
    return false;
  }

  if (entry.status !== 'pending') {
    logger.warn('Cannot reject non-pending entry', { queueId, status: entry.status });
    return false;
  }

  await updateQueueStatus(queueId, 'rejected', reviewerId);
  await logAuditEntry(queueId, 'rejected', reviewerId, { reason });

  logger.info('Queue entry rejected', { queueId, reviewerId, reason });

  return true;
}

/**
 * Bulk approve high-confidence entries
 */
export async function bulkApproveHighConfidence(
  reviewerId: number,
  minConfidence: number = 0.95,
  limit: number = 100
): Promise<{ approved: number; failed: number; errors: string[] }> {
  // Get high-confidence pending entries
  const entries = await getQueueEntries({
    status: ['pending'],
    minConfidence,
    pageSize: limit,
  });

  let approved = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const entry of entries) {
    const result = await approveEntry({
      queueId: entry.id,
      reviewerId,
    });

    if (result.success) {
      approved++;
    } else {
      failed++;
      errors.push(`Entry ${entry.id}: ${result.error}`);
    }
  }

  logger.info('Bulk approval completed', {
    approved,
    failed,
    minConfidence,
    reviewerId,
  });

  return { approved, failed, errors };
}

/**
 * Get queue entries by domain
 */
export async function getQueueByDomain(
  domain: string,
  options: QueueFilterOptions = {}
): Promise<PaginatedResponse<QueueEntryWithDetails>> {
  // This requires a join with msg_emails - use raw query
  const page = options.page || 1;
  const pageSize = options.pageSize || 50;
  const offset = (page - 1) * pageSize;

  const statusFilter = options.status?.length
    ? `AND q.status IN (${options.status.map(() => '?').join(', ')})`
    : '';

  const rows = await query<{
    id: number;
    queue_type: string;
    msg_email_id: number | null;
    source_user_id: number | null;
    target_user_id: number | null;
    proposed_data: string;
    current_data: string;
    confidence: number;
    llm_reasoning: string;
    status: string;
    reviewed_by: number | null;
    reviewed_at: string | null;
    created_at: string;
    msg_email_input: string | null;
  }>(`
    SELECT q.*, me.input as msg_email_input
    FROM reconciliation_queue q
    LEFT JOIN msg_emails me ON q.msg_email_id = me.id
    WHERE me.domain = ?
    ${statusFilter}
    ORDER BY q.confidence DESC, q.created_at ASC
    LIMIT ? OFFSET ?
  `, [
    domain,
    ...(options.status || []),
    pageSize,
    offset,
  ]);

  const entries: QueueEntryWithDetails[] = rows.map(row => ({
    id: row.id,
    queueType: row.queue_type as QueueType,
    msgEmailId: row.msg_email_id,
    sourceUserId: row.source_user_id,
    targetUserId: row.target_user_id,
    proposedData: JSON.parse(row.proposed_data),
    currentData: JSON.parse(row.current_data),
    confidence: row.confidence,
    llmReasoning: row.llm_reasoning,
    status: row.status as QueueStatus,
    reviewedBy: row.reviewed_by,
    reviewedAt: row.reviewed_at ? new Date(row.reviewed_at) : null,
    createdAt: new Date(row.created_at),
    msgEmailInput: row.msg_email_input || undefined,
  }));

  // Get total count
  const countResult = await query<{ count: number }>(`
    SELECT COUNT(*) as count
    FROM reconciliation_queue q
    JOIN msg_emails me ON q.msg_email_id = me.id
    WHERE me.domain = ?
    ${statusFilter}
  `, [domain, ...(options.status || [])]);

  const total = countResult[0]?.count || 0;

  return {
    items: entries,
    total,
    page,
    pageSize,
    hasMore: page * pageSize < total,
  };
}

/**
 * Get processing statistics
 */
export async function getProcessingStats(): Promise<ProcessingStats> {
  return getStats();
}

/**
 * Log an audit entry
 */
async function logAuditEntry(
  queueId: number,
  action: 'approved' | 'rejected' | 'applied' | 'modified',
  actorId: number,
  modifications?: Record<string, unknown> | null,
  applyResult?: Record<string, unknown> | null,
  errorMessage?: string
): Promise<void> {
  try {
    await execute(`
      INSERT INTO reconciliation_audit_log
      (queue_id, action, actor_id, modifications, apply_result, error_message)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [
      queueId,
      action,
      actorId,
      modifications ? JSON.stringify(modifications) : null,
      applyResult ? JSON.stringify(applyResult) : null,
      errorMessage || null,
    ]);
  } catch (error) {
    // Audit logging should not fail the main operation
    logger.warn('Failed to log audit entry', { queueId, action, error: String(error) });
  }
}

/**
 * Get audit log for a queue entry
 */
export async function getAuditLog(
  queueId: number
): Promise<Array<{
  action: string;
  actorId: number | null;
  actionAt: Date;
  modifications: Record<string, unknown> | null;
  applyResult: Record<string, unknown> | null;
  errorMessage: string | null;
}>> {
  const rows = await query<{
    action: string;
    actor_id: number | null;
    action_at: string;
    modifications: string | null;
    apply_result: string | null;
    error_message: string | null;
  }>(`
    SELECT action, actor_id, action_at, modifications, apply_result, error_message
    FROM reconciliation_audit_log
    WHERE queue_id = ?
    ORDER BY action_at ASC
  `, [queueId]);

  return rows.map(row => ({
    action: row.action,
    actorId: row.actor_id,
    actionAt: new Date(row.action_at),
    modifications: row.modifications ? JSON.parse(row.modifications) : null,
    applyResult: row.apply_result ? JSON.parse(row.apply_result) : null,
    errorMessage: row.error_message,
  }));
}

/**
 * Delete rejected entries older than specified days
 */
export async function cleanupRejectedEntries(olderThanDays: number = 30): Promise<number> {
  const result = await execute(`
    DELETE FROM reconciliation_queue
    WHERE status = 'rejected'
      AND reviewed_at < DATE_SUB(NOW(), INTERVAL ? DAY)
  `, [olderThanDays]);

  logger.info('Cleaned up rejected entries', {
    deleted: result.affectedRows,
    olderThanDays,
  });

  return result.affectedRows;
}
