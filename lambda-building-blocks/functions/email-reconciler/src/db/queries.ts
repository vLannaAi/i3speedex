/**
 * Database Queries for Email Reconciliation
 */

import { PoolConnection, ResultSetHeader } from 'mysql2/promise';
import { query, execute, transactionQuery, transactionExecute } from './connection';
import {
  UserRecord,
  MsgEmailRecord,
  QueueEntry,
  QueueStatus,
  QueueType,
  QueueFilterOptions,
  ProcessingStats,
  EnhancedProposal,
  LinkProposal,
  CreateUserProposal,
  MergeProposal,
  SplitProposal,
  ExtractionStatus,
  LLMExtractionResult,
} from '../types';
import { logger } from '../logger';
import { AI_EXTRACTION_VERSION } from '../extraction-validator';

// ============================================================================
// User Queries
// ============================================================================

/**
 * Get all users
 */
export async function getAllUsers(): Promise<UserRecord[]> {
  const rows = await query<{
    id: number;
    name: string | null;
    genre: string | null;
    email: string | null;
    email2: string | null;
    address: string | null;
    user_code: string | null;
    buyer_id: number | null;
    producer_id: number | null;
    domain: string | null;
    domain2: string | null;
  }>(`
    SELECT id, name, genre, email, email2, address, user_code,
           buyer_id, producer_id, domain, domain2
    FROM users
    WHERE status != 'deleted' OR status IS NULL
  `);

  return rows.map(mapUserRow);
}

/**
 * Get users by domain
 */
export async function getUsersByDomain(domain: string): Promise<UserRecord[]> {
  const rows = await query<{
    id: number;
    name: string | null;
    genre: string | null;
    email: string | null;
    email2: string | null;
    address: string | null;
    user_code: string | null;
    buyer_id: number | null;
    producer_id: number | null;
    domain: string | null;
    domain2: string | null;
  }>(`
    SELECT id, name, genre, email, email2, address, user_code,
           buyer_id, producer_id, domain, domain2
    FROM users
    WHERE (domain = ? OR domain2 = ?)
      AND (status != 'deleted' OR status IS NULL)
  `, [domain, domain]);

  return rows.map(mapUserRow);
}

/**
 * Get user by ID
 */
export async function getUserById(id: number): Promise<UserRecord | null> {
  const rows = await query<{
    id: number;
    name: string | null;
    genre: string | null;
    email: string | null;
    email2: string | null;
    address: string | null;
    user_code: string | null;
    buyer_id: number | null;
    producer_id: number | null;
    domain: string | null;
    domain2: string | null;
  }>(`
    SELECT id, name, genre, email, email2, address, user_code,
           buyer_id, producer_id, domain, domain2
    FROM users
    WHERE id = ?
  `, [id]);

  return rows.length > 0 ? mapUserRow(rows[0]) : null;
}

/**
 * Get users by email (checks both email and email2)
 */
export async function getUsersByEmail(email: string): Promise<UserRecord[]> {
  const rows = await query<{
    id: number;
    name: string | null;
    genre: string | null;
    email: string | null;
    email2: string | null;
    address: string | null;
    user_code: string | null;
    buyer_id: number | null;
    producer_id: number | null;
    domain: string | null;
    domain2: string | null;
  }>(`
    SELECT id, name, genre, email, email2, address, user_code,
           buyer_id, producer_id, domain, domain2
    FROM users
    WHERE (LOWER(email) = LOWER(?) OR LOWER(email2) = LOWER(?))
      AND (status != 'deleted' OR status IS NULL)
  `, [email, email]);

  return rows.map(mapUserRow);
}

function mapUserRow(row: {
  id: number;
  name: string | null;
  genre: string | null;
  email: string | null;
  email2: string | null;
  address: string | null;
  user_code: string | null;
  buyer_id: number | null;
  producer_id: number | null;
  domain: string | null;
  domain2: string | null;
}): UserRecord {
  return {
    id: row.id,
    name: row.name,
    genre: row.genre,
    email: row.email,
    email2: row.email2,
    address: row.address,
    userCode: row.user_code,
    buyerId: row.buyer_id,
    producerId: row.producer_id,
    domain: row.domain,
    domain2: row.domain2,
  };
}

// ============================================================================
// MsgEmail Queries
// ============================================================================

const MSG_EMAIL_COLUMNS = `
  id, input, user_ud, email, pos, mod_date
`;

/**
 * Get all msg_emails records
 */
export async function getAllMsgEmails(): Promise<MsgEmailRecord[]> {
  const rows = await query<MsgEmailRowBasic>(`
    SELECT ${MSG_EMAIL_COLUMNS}
    FROM msg_emails
  `);

  return rows.map(mapMsgEmailRow);
}

/**
 * Get unprocessed msg_emails (no user_ud)
 */
export async function getUnprocessedMsgEmails(limit?: number): Promise<MsgEmailRecord[]> {
  let sql = `
    SELECT ${MSG_EMAIL_COLUMNS}
    FROM msg_emails
    WHERE user_ud IS NULL
    ORDER BY id
  `;

  if (limit) {
    sql += ` LIMIT ${limit}`;
  }

  const rows = await query<MsgEmailRowBasic>(sql);

  return rows.map(mapMsgEmailRow);
}

/**
 * Get msg_emails by domain (extracted from email field)
 */
export async function getMsgEmailsByDomain(domain: string, limit?: number): Promise<MsgEmailRecord[]> {
  let sql = `
    SELECT ${MSG_EMAIL_COLUMNS}
    FROM msg_emails
    WHERE email LIKE ?
    ORDER BY id
  `;

  if (limit) {
    sql += ` LIMIT ${limit}`;
  }

  const rows = await query<MsgEmailRowBasic>(sql, [`%@${domain}`]);

  return rows.map(mapMsgEmailRow);
}

/**
 * Get msg_email by ID
 */
export async function getMsgEmailById(id: number): Promise<MsgEmailRecord | null> {
  const rows = await query<MsgEmailRowBasic>(`
    SELECT ${MSG_EMAIL_COLUMNS}
    FROM msg_emails
    WHERE id = ?
  `, [id]);

  return rows.length > 0 ? mapMsgEmailRow(rows[0]) : null;
}

// Basic row type for simple queries (without AI fields)
interface MsgEmailRowBasic {
  id: number;
  input: string | null;
  user_ud: number | null;
  email: string | null;
  pos: number | null;
  mod_date: string | null;
}

// Row type matching actual msg_emails table schema with AI fields
interface MsgEmailRowExtended extends MsgEmailRowBasic {
  ai_name1: string | null;
  ai_name2: string | null;
  ai_genre: string | null;
  ai_email: string | null;
  ai_confidence: number | null;
  ai_status: string | null;
  ai_notes: string | null;
  ai_processed_at: string | null;
  ai_model: string | null;
  ai_is_personal: number | null;
  ai_domain_convention: string | null;
  ai_name1pre: string | null;
  ai_name2pre: string | null;
  ai_name3: string | null;
  ai_version: number | null;
}

function mapMsgEmailRow(row: MsgEmailRowBasic): MsgEmailRecord {
  return {
    id: row.id,
    input: row.input,
    userUd: row.user_ud,
    email: row.email,
    address: null,
    pos: row.pos,
    textindex: null,
    userGenre: null,
    userName: null,
    userCode: null,
    name: null,
    local: null,
    notes: null,
    modDate: row.mod_date ? new Date(row.mod_date) : null,
    buyerId: null,
    producerId: null,
    aiName1: null,
    aiName2: null,
    aiGenre: null,
    aiEmail: null,
    aiConfidence: null,
    aiStatus: null,
    aiNotes: null,
    aiProcessedAt: null,
    aiModel: null,
    aiIsPersonal: null,
    aiDomainConvention: null,
    aiName1pre: null,
    aiName2pre: null,
    aiName3: null,
    aiVersion: null,
  };
}

function mapMsgEmailRowExtended(row: MsgEmailRowExtended): MsgEmailRecord {
  return {
    id: row.id,
    input: row.input,
    userUd: row.user_ud,
    email: row.email,
    address: null,
    pos: row.pos,
    textindex: null,
    userGenre: null,
    userName: null,
    userCode: null,
    name: null,
    local: null,
    notes: null,
    modDate: row.mod_date ? new Date(row.mod_date) : null,
    buyerId: null,
    producerId: null,
    aiName1: row.ai_name1,
    aiName2: row.ai_name2,
    aiGenre: row.ai_genre as 'Mr.' | 'Ms.' | null,
    aiEmail: row.ai_email,
    aiConfidence: row.ai_confidence,
    aiStatus: row.ai_status as ExtractionStatus | null,
    aiNotes: row.ai_notes,
    aiProcessedAt: row.ai_processed_at ? new Date(row.ai_processed_at) : null,
    aiModel: row.ai_model,
    aiIsPersonal: row.ai_is_personal === 1 ? true : row.ai_is_personal === 0 ? false : null,
    aiDomainConvention: row.ai_domain_convention,
    aiName1pre: row.ai_name1pre,
    aiName2pre: row.ai_name2pre,
    aiName3: row.ai_name3,
    aiVersion: row.ai_version,
  };
}

// ============================================================================
// Queue Queries
// ============================================================================

/**
 * Create a queue entry with explicit columns
 */
export async function createQueueEntry(entry: Omit<QueueEntry, 'id' | 'createdAt'>): Promise<number> {
  // Extract proposed data fields (cast via unknown for union type compatibility)
  const p = (entry.proposedData as unknown as Record<string, unknown>) || {};
  const c = entry.currentData || {};

  const result = await execute(`
    INSERT INTO reconciliation_queue
    (queue_type, msg_email_id, source_user_id, target_user_id,
     name1, name2, genre, email, domain, full_name, display_name,
     company_name, is_personal, proposed_user_ud, proposed_classification,
     current_address, current_user_name, current_user_genre, current_user_ud, current_classification,
     input, confidence, llm_reasoning, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    entry.queueType,
    entry.msgEmailId ?? null,
    entry.sourceUserId ?? null,
    entry.targetUserId ?? null,
    // Extracted fields
    (p.name1 as string) ?? null,
    (p.name2 as string) ?? null,
    (p.genre as string) ?? null,
    (p.email as string) ?? null,
    (p.domain as string) ?? null,
    (p.fullName as string) ?? null,
    (p.displayName as string) ?? null,
    (p.companyName as string) ?? null,
    p.isPersonal === false ? 0 : 1,
    (p.user_ud as number) ?? null,
    (p.displayClassification as string) ?? null,
    // Current values
    (c.address as string) ?? null,
    (c.userName as string) ?? null,
    (c.userGenre as string) ?? null,
    (c.userUd as number) ?? null,
    (c.displayClassification as string) ?? null,
    // Input for reference
    (c.input as string) ?? null,
    entry.confidence ?? 0,
    entry.llmReasoning ?? '',
    entry.status || 'pending',
  ]);

  return result.insertId;
}

/**
 * Get queue entries with filtering
 */
export async function getQueueEntries(options: QueueFilterOptions): Promise<QueueEntry[]> {
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (options.status && options.status.length > 0) {
    conditions.push(`status IN (${options.status.map(() => '?').join(', ')})`);
    params.push(...options.status);
  }

  if (options.queueType && options.queueType.length > 0) {
    conditions.push(`queue_type IN (${options.queueType.map(() => '?').join(', ')})`);
    params.push(...options.queueType);
  }

  if (options.minConfidence !== undefined) {
    conditions.push('confidence >= ?');
    params.push(options.minConfidence);
  }

  if (options.maxConfidence !== undefined) {
    conditions.push('confidence <= ?');
    params.push(options.maxConfidence);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const page = options.page || 1;
  const pageSize = options.pageSize || 50;
  const offset = (page - 1) * pageSize;

  const sql = `
    SELECT id, queue_type, msg_email_id, source_user_id, target_user_id,
           name1, name2, genre, email, domain, full_name, display_name,
           company_name, is_personal, proposed_user_ud, proposed_classification,
           current_address, current_user_name, current_user_genre, current_user_ud, current_classification,
           input, confidence, llm_reasoning, status,
           reviewed_by, reviewed_at, created_at
    FROM reconciliation_queue
    ${whereClause}
    ORDER BY
      CASE status WHEN 'pending' THEN 0 ELSE 1 END,
      confidence DESC,
      created_at ASC
    LIMIT ? OFFSET ?
  `;

  params.push(pageSize, offset);

  const rows = await query<{
    id: number;
    queue_type: string;
    msg_email_id: number | null;
    source_user_id: number | null;
    target_user_id: number | null;
    name1: string | null;
    name2: string | null;
    genre: string | null;
    email: string | null;
    domain: string | null;
    full_name: string | null;
    display_name: string | null;
    company_name: string | null;
    is_personal: number;
    proposed_user_ud: number | null;
    proposed_classification: string | null;
    current_address: string | null;
    current_user_name: string | null;
    current_user_genre: string | null;
    current_user_ud: number | null;
    current_classification: string | null;
    input: string | null;
    confidence: number;
    llm_reasoning: string;
    status: string;
    reviewed_by: number | null;
    reviewed_at: string | null;
    created_at: string;
  }>(sql, params);

  return rows.map(mapQueueRow);
}

/**
 * Get queue entry by ID
 */
export async function getQueueEntryById(id: number): Promise<QueueEntry | null> {
  const rows = await query<{
    id: number;
    queue_type: string;
    msg_email_id: number | null;
    source_user_id: number | null;
    target_user_id: number | null;
    name1: string | null;
    name2: string | null;
    genre: string | null;
    email: string | null;
    domain: string | null;
    full_name: string | null;
    display_name: string | null;
    company_name: string | null;
    is_personal: number;
    proposed_user_ud: number | null;
    proposed_classification: string | null;
    current_address: string | null;
    current_user_name: string | null;
    current_user_genre: string | null;
    current_user_ud: number | null;
    current_classification: string | null;
    input: string | null;
    confidence: number;
    llm_reasoning: string;
    status: string;
    reviewed_by: number | null;
    reviewed_at: string | null;
    created_at: string;
  }>(`
    SELECT id, queue_type, msg_email_id, source_user_id, target_user_id,
           name1, name2, genre, email, domain, full_name, display_name,
           company_name, is_personal, proposed_user_ud, proposed_classification,
           current_address, current_user_name, current_user_genre, current_user_ud, current_classification,
           input, confidence, llm_reasoning, status,
           reviewed_by, reviewed_at, created_at
    FROM reconciliation_queue
    WHERE id = ?
  `, [id]);

  return rows.length > 0 ? mapQueueRow(rows[0]) : null;
}

/**
 * Update queue entry status
 */
export async function updateQueueStatus(
  id: number,
  status: QueueStatus,
  reviewedBy?: number
): Promise<void> {
  await execute(`
    UPDATE reconciliation_queue
    SET status = ?, reviewed_by = ?, reviewed_at = NOW()
    WHERE id = ?
  `, [status, reviewedBy || null, id]);
}

/**
 * Check if a msg_email already has a pending queue entry
 */
export async function hasPendingQueueEntry(msgEmailId: number): Promise<boolean> {
  const rows = await query<{ count: number }>(`
    SELECT COUNT(*) as count
    FROM reconciliation_queue
    WHERE msg_email_id = ? AND status = 'pending'
  `, [msgEmailId]);

  return rows[0].count > 0;
}

function mapQueueRow(row: {
  id: number;
  queue_type: string;
  msg_email_id: number | null;
  source_user_id: number | null;
  target_user_id: number | null;
  name1: string | null;
  name2: string | null;
  genre: string | null;
  email: string | null;
  domain: string | null;
  full_name: string | null;
  display_name: string | null;
  company_name: string | null;
  is_personal: number;
  proposed_user_ud: number | null;
  proposed_classification: string | null;
  current_address: string | null;
  current_user_name: string | null;
  current_user_genre: string | null;
  current_user_ud: number | null;
  current_classification: string | null;
  input: string | null;
  confidence: number;
  llm_reasoning: string;
  status: string;
  reviewed_by: number | null;
  reviewed_at: string | null;
  created_at: string;
}): QueueEntry {
  // Build proposedData from explicit columns
  const proposedData: EnhancedProposal = {
    name1: row.name1,
    name2: row.name2,
    genre: row.genre as 'Mr.' | 'Ms.' | null,
    email: row.email || '',
    domain: row.domain || '',
    fullName: row.full_name,
    displayName: row.display_name,
    companyName: row.company_name,
    isPersonal: row.is_personal === 1,
    user_ud: row.proposed_user_ud,
    displayClassification: (row.proposed_classification || 'unknown') as 'full' | 'partial' | 'unknown',
    msgEmailId: row.msg_email_id || 0,
    buyerId: null,
    producerId: null,
  };

  // Build currentData from explicit columns
  const currentData: Record<string, unknown> = {
    input: row.input,
    address: row.current_address,
    userName: row.current_user_name,
    userGenre: row.current_user_genre,
    userUd: row.current_user_ud,
    displayClassification: row.current_classification,
  };

  return {
    id: row.id,
    queueType: row.queue_type as QueueType,
    msgEmailId: row.msg_email_id,
    sourceUserId: row.source_user_id,
    targetUserId: row.target_user_id,
    proposedData,
    currentData,
    confidence: row.confidence,
    llmReasoning: row.llm_reasoning,
    status: row.status as QueueStatus,
    reviewedBy: row.reviewed_by,
    reviewedAt: row.reviewed_at ? new Date(row.reviewed_at) : null,
    createdAt: new Date(row.created_at),
  };
}

// ============================================================================
// Apply Changes (Transaction-based)
// ============================================================================

/**
 * Apply a link proposal (update msg_email to link to user)
 */
export async function applyLinkProposal(
  connection: PoolConnection,
  proposal: LinkProposal
): Promise<void> {
  await transactionExecute(connection, `
    UPDATE msg_emails
    SET user_ud = ?,
        user_name = COALESCE(?, user_name),
        user_genre = COALESCE(?, user_genre),
        display_classification = ?
    WHERE id = ?
  `, [
    proposal.targetUserId,
    proposal.proposedUserName,
    proposal.proposedUserGenre,
    proposal.proposedDisplayClassification,
    proposal.msgEmailId,
  ]);

  logger.info('Applied link proposal', {
    msgEmailId: proposal.msgEmailId,
    targetUserId: proposal.targetUserId,
  });
}

/**
 * Apply a create user proposal
 */
export async function applyCreateUserProposal(
  connection: PoolConnection,
  proposal: CreateUserProposal
): Promise<number> {
  // Create the new user
  const result = await transactionExecute(connection, `
    INSERT INTO users (name, genre, email, domain, buyer_id, producer_id)
    VALUES (?, ?, ?, ?, ?, ?)
  `, [
    proposal.name,
    proposal.genre,
    proposal.email,
    proposal.domain,
    proposal.buyerId,
    proposal.producerId,
  ]);

  const newUserId = result.insertId;

  // Update the msg_email to link to new user
  await transactionExecute(connection, `
    UPDATE msg_emails
    SET user_ud = ?,
        display_classification = 'full'
    WHERE id = ?
  `, [newUserId, proposal.msgEmailId]);

  logger.info('Applied create user proposal', {
    msgEmailId: proposal.msgEmailId,
    newUserId,
  });

  return newUserId;
}

/**
 * Apply a merge proposal (merge source user into target)
 */
export async function applyMergeProposal(
  connection: PoolConnection,
  proposal: MergeProposal
): Promise<void> {
  // Update all msg_emails pointing to source to point to target
  await transactionExecute(connection, `
    UPDATE msg_emails
    SET user_ud = ?
    WHERE user_ud = ?
  `, [proposal.targetUserId, proposal.sourceUserId]);

  // Mark source user as deleted
  await transactionExecute(connection, `
    UPDATE users
    SET status = 'deleted'
    WHERE id = ?
  `, [proposal.sourceUserId]);

  logger.info('Applied merge proposal', {
    sourceUserId: proposal.sourceUserId,
    targetUserId: proposal.targetUserId,
    affectedMsgEmailCount: proposal.affectedMsgEmailCount,
  });
}

/**
 * Apply a split proposal (create new user and reassign some msg_emails)
 */
export async function applySplitProposal(
  connection: PoolConnection,
  proposal: SplitProposal,
  sourceUser: UserRecord
): Promise<number> {
  // Create the new user
  const result = await transactionExecute(connection, `
    INSERT INTO users (name, email, domain, buyer_id, producer_id)
    VALUES (?, ?, ?, ?, ?)
  `, [
    proposal.newUserName,
    proposal.newUserEmail,
    sourceUser.domain,
    sourceUser.buyerId,
    sourceUser.producerId,
  ]);

  const newUserId = result.insertId;

  // Update specified msg_emails to point to new user
  if (proposal.msgEmailIds.length > 0) {
    await transactionExecute(connection, `
      UPDATE msg_emails
      SET user_ud = ?
      WHERE id IN (${proposal.msgEmailIds.map(() => '?').join(', ')})
    `, [newUserId, ...proposal.msgEmailIds]);
  }

  logger.info('Applied split proposal', {
    sourceUserId: proposal.sourceUserId,
    newUserId,
    msgEmailCount: proposal.msgEmailIds.length,
  });

  return newUserId;
}

// ============================================================================
// Statistics
// ============================================================================

/**
 * Get processing statistics
 */
export async function getProcessingStats(): Promise<ProcessingStats> {
  // Get classification counts
  const classificationRows = await query<{
    display_classification: string | null;
    count: number;
  }>(`
    SELECT display_classification, COUNT(*) as count
    FROM msg_emails
    GROUP BY display_classification
  `);

  const byClassification = {
    full: 0,
    partial: 0,
    unknown: 0,
  };

  let totalMsgEmails = 0;
  for (const row of classificationRows) {
    totalMsgEmails += row.count;
    if (row.display_classification === 'full') {
      byClassification.full = row.count;
    } else if (row.display_classification === 'partial') {
      byClassification.partial = row.count;
    } else {
      byClassification.unknown += row.count;
    }
  }

  // Get queue status counts
  const queueRows = await query<{
    status: string;
    count: number;
  }>(`
    SELECT status, COUNT(*) as count
    FROM reconciliation_queue
    GROUP BY status
  `);

  let pendingQueue = 0;
  let approvedQueue = 0;
  let rejectedQueue = 0;
  let appliedQueue = 0;

  for (const row of queueRows) {
    switch (row.status) {
      case 'pending':
        pendingQueue = row.count;
        break;
      case 'approved':
        approvedQueue = row.count;
        break;
      case 'rejected':
        rejectedQueue = row.count;
        break;
      case 'applied':
        appliedQueue = row.count;
        break;
    }
  }

  // Get confidence tier counts for pending entries
  const confidenceRows = await query<{
    tier: string;
    count: number;
  }>(`
    SELECT
      CASE
        WHEN confidence >= 0.90 THEN 'high'
        WHEN confidence >= 0.70 THEN 'medium'
        WHEN confidence >= 0.50 THEN 'low'
        ELSE 'veryLow'
      END as tier,
      COUNT(*) as count
    FROM reconciliation_queue
    WHERE status = 'pending'
    GROUP BY tier
  `);

  const byConfidenceTier = {
    high: 0,
    medium: 0,
    low: 0,
    veryLow: 0,
  };

  for (const row of confidenceRows) {
    if (row.tier in byConfidenceTier) {
      byConfidenceTier[row.tier as keyof typeof byConfidenceTier] = row.count;
    }
  }

  return {
    totalMsgEmails,
    processedMsgEmails: byClassification.full + byClassification.partial,
    pendingQueue,
    approvedQueue,
    rejectedQueue,
    appliedQueue,
    byClassification,
    byConfidenceTier,
  };
}

/**
 * Get unique domains with their record counts
 */
export async function getDomainStats(): Promise<Array<{ domain: string; count: number; userCount: number }>> {
  const rows = await query<{
    domain: string;
    email_count: number;
    user_count: number;
  }>(`
    SELECT
      me.domain,
      COUNT(DISTINCT me.id) as email_count,
      COUNT(DISTINCT u.id) as user_count
    FROM msg_emails me
    LEFT JOIN users u ON u.domain = me.domain OR u.domain2 = me.domain
    WHERE me.domain IS NOT NULL AND me.domain != ''
    GROUP BY me.domain
    ORDER BY email_count DESC
    LIMIT 100
  `);

  return rows.map(row => ({
    domain: row.domain,
    count: row.email_count,
    userCount: row.user_count,
  }));
}

// ============================================================================
// AI Extraction Queries (Phase 1)
// ============================================================================

/**
 * Get msg_emails by AI extraction status
 */
export async function getMsgEmailsByAIStatus(
  status: ExtractionStatus | ExtractionStatus[],
  limit?: number
): Promise<MsgEmailRecord[]> {
  const statuses = Array.isArray(status) ? status : [status];
  const placeholders = statuses.map(() => '?').join(', ');

  let sql = `
    SELECT id, input, user_ud, email, pos, mod_date,
           ai_name1, ai_name2, ai_genre, ai_email, ai_confidence,
           ai_status, ai_notes, ai_processed_at, ai_model,
           ai_is_personal, ai_domain_convention,
           ai_name1pre, ai_name2pre, ai_name3, ai_version
    FROM msg_emails
    WHERE ai_status IN (${placeholders})
    ORDER BY id DESC
  `;

  if (limit) {
    sql += ` LIMIT ${limit}`;
  }

  const rows = await query<MsgEmailRowExtended>(sql, statuses);
  return rows.map(mapMsgEmailRowExtended);
}

/**
 * Get unprocessed msg_emails without user_ud (for AI extraction)
 * Orders by id DESC to process most recent records first
 */
export async function getUnprocessedForAI(limit?: number): Promise<MsgEmailRecord[]> {
  let sql = `
    SELECT id, input, user_ud, email, pos, mod_date,
           ai_name1, ai_name2, ai_genre, ai_email, ai_confidence,
           ai_status, ai_notes, ai_processed_at, ai_model,
           ai_is_personal, ai_domain_convention,
           ai_name1pre, ai_name2pre, ai_name3, ai_version
    FROM msg_emails
    WHERE user_ud IS NULL
      AND (ai_status = 'unprocessed' OR ai_status IS NULL)
    ORDER BY id DESC
  `;

  if (limit) {
    sql += ` LIMIT ${limit}`;
  }

  const rows = await query<MsgEmailRowExtended>(sql);
  return rows.map(mapMsgEmailRowExtended);
}

/**
 * Get unprocessed msg_emails for emails matching a domain pattern
 */
export async function getUnprocessedForAIByDomain(
  domain: string,
  limit?: number
): Promise<MsgEmailRecord[]> {
  let sql = `
    SELECT id, input, user_ud, email, pos, mod_date,
           ai_name1, ai_name2, ai_genre, ai_email, ai_confidence,
           ai_status, ai_notes, ai_processed_at, ai_model,
           ai_is_personal, ai_domain_convention,
           ai_name1pre, ai_name2pre, ai_name3, ai_version
    FROM msg_emails
    WHERE email LIKE ?
      AND (ai_status = 'unprocessed' OR ai_status IS NULL)
    ORDER BY id DESC
  `;

  if (limit) {
    sql += ` LIMIT ${limit}`;
  }

  const rows = await query<MsgEmailRowExtended>(sql, [`%@${domain}`]);
  return rows.map(mapMsgEmailRowExtended);
}

/**
 * Look up genre (Mr./Ms.) by given name across existing records.
 * Returns the majority genre only if 2+ records agree on the same value.
 */
export async function getGenreByName1(name1: string): Promise<'Mr.' | 'Ms.' | null> {
  if (!name1) return null;

  const rows = await query<{ ai_genre: string; cnt: number }>(`
    SELECT ai_genre, COUNT(*) as cnt
    FROM msg_emails
    WHERE LOWER(ai_name1) = LOWER(?)
      AND ai_genre IS NOT NULL
    GROUP BY ai_genre
    ORDER BY cnt DESC
    LIMIT 1
  `, [name1]);

  if (rows.length > 0 && rows[0].cnt >= 2) {
    return rows[0].ai_genre as 'Mr.' | 'Ms.';
  }

  return null;
}

/**
 * Save AI extraction result for a single msg_email
 */
export async function saveAIExtractionResult(
  id: number,
  result: LLMExtractionResult,
  model: string = 'claude-sonnet-4-20250514'
): Promise<void> {
  // Genre fallback: if LLM didn't assign genre, look it up from existing records
  let genre = result.genre;
  if (!genre && result.name1) {
    try {
      genre = await getGenreByName1(result.name1);
    } catch {
      // Ignore lookup errors, keep genre as null
    }
  }

  await execute(`
    UPDATE msg_emails
    SET ai_name1 = ?,
        ai_name2 = ?,
        ai_genre = ?,
        ai_email = ?,
        ai_confidence = ?,
        ai_status = ?,
        ai_notes = ?,
        ai_processed_at = NOW(),
        ai_model = ?,
        ai_is_personal = ?,
        ai_domain_convention = ?,
        ai_name1pre = ?,
        ai_name2pre = ?,
        ai_name3 = ?,
        ai_version = ?
    WHERE id = ?
  `, [
    result.name1,
    result.name2,
    genre,
    result.email,
    result.confidence,
    result.extractionStatus,
    result.reasoning + (result.chainOfThought ? '\n\n[Chain of Thought]\n' + result.chainOfThought : ''),
    model,
    result.isPersonal ? 1 : 0,
    null, // domain convention filled separately if known
    result.name1pre,
    result.name2pre,
    result.name3,
    AI_EXTRACTION_VERSION,
    id,
  ]);

  logger.debug('Saved AI extraction result', {
    msgEmailId: id,
    status: result.extractionStatus,
    confidence: result.confidence,
  });
}

/**
 * Batch save AI extraction results
 */
export async function batchSaveAIExtractionResults(
  updates: Array<{ id: number; result: LLMExtractionResult }>,
  model: string = 'claude-sonnet-4-20250514'
): Promise<{ success: number; errors: number }> {
  let success = 0;
  let errors = 0;

  for (const { id, result } of updates) {
    try {
      await saveAIExtractionResult(id, result, model);
      success++;
    } catch (error) {
      logger.error('Failed to save AI extraction result', {
        msgEmailId: id,
        error: String(error),
      });
      errors++;
    }
  }

  return { success, errors };
}

/**
 * Mark msg_email as human reviewed (copies AI data to user fields if approved)
 */
export async function markAsReviewed(
  id: number,
  corrections?: {
    name1?: string | null;
    name2?: string | null;
    genre?: 'Mr.' | 'Ms.' | null;
  }
): Promise<void> {
  const updates: string[] = [
    "ai_status = 'reviewed'",
  ];
  const params: unknown[] = [];

  if (corrections) {
    if (corrections.name1 !== undefined) {
      updates.push('ai_name1 = ?');
      params.push(corrections.name1);
    }
    if (corrections.name2 !== undefined) {
      updates.push('ai_name2 = ?');
      params.push(corrections.name2);
    }
    if (corrections.genre !== undefined) {
      updates.push('ai_genre = ?');
      params.push(corrections.genre);
    }
  }

  params.push(id);

  await execute(`
    UPDATE msg_emails
    SET ${updates.join(', ')}
    WHERE id = ?
  `, params);

  logger.info('Marked msg_email as reviewed', { msgEmailId: id });
}

/**
 * Get AI extraction statistics
 */
export async function getAIExtractionStats(): Promise<{
  total: number;
  byStatus: Record<ExtractionStatus, number>;
  averageConfidence: number;
  needsReview: number;
  unlinkedCount: number;
}> {
  const statusRows = await query<{
    ai_status: string | null;
    count: number;
    avg_confidence: number | null;
  }>(`
    SELECT
      COALESCE(ai_status, 'unprocessed') as ai_status,
      COUNT(*) as count,
      AVG(ai_confidence) as avg_confidence
    FROM msg_emails
    GROUP BY ai_status
  `);

  const byStatus: Record<ExtractionStatus, number> = {
    unprocessed: 0,
    extracted_high: 0,
    extracted_medium: 0,
    extracted_low: 0,
    reviewed: 0,
    not_applicable: 0,
  };

  let total = 0;
  let totalConfidenceSum = 0;
  let totalWithConfidence = 0;

  for (const row of statusRows) {
    const status = (row.ai_status || 'unprocessed') as ExtractionStatus;
    byStatus[status] = row.count;
    total += row.count;

    if (row.avg_confidence !== null && status !== 'unprocessed') {
      totalConfidenceSum += row.avg_confidence * row.count;
      totalWithConfidence += row.count;
    }
  }

  // Count records without user_ud
  const unlinkedRows = await query<{ count: number }>(`
    SELECT COUNT(*) as count FROM msg_emails WHERE user_ud IS NULL
  `);

  const needsReview = byStatus.extracted_medium + byStatus.extracted_low;
  const averageConfidence = totalWithConfidence > 0
    ? totalConfidenceSum / totalWithConfidence
    : 0;

  return {
    total,
    byStatus,
    averageConfidence,
    needsReview,
    unlinkedCount: unlinkedRows[0]?.count || 0,
  };
}

/**
 * Get domains with low AI extraction quality (for targeted improvement)
 */
export async function getProblematicDomains(minRecords = 5): Promise<Array<{
  domain: string;
  totalCount: number;
  lowConfidenceCount: number;
  avgConfidence: number;
}>> {
  const rows = await query<{
    domain: string;
    total_count: number;
    low_confidence_count: number;
    avg_confidence: number | null;
  }>(`
    SELECT
      domain,
      COUNT(*) as total_count,
      SUM(CASE WHEN ai_status IN ('extracted_low', 'extracted_medium') THEN 1 ELSE 0 END) as low_confidence_count,
      AVG(ai_confidence) as avg_confidence
    FROM msg_emails
    WHERE domain IS NOT NULL
      AND domain != ''
      AND ai_status IS NOT NULL
      AND ai_status != 'unprocessed'
    GROUP BY domain
    HAVING total_count >= ?
    ORDER BY low_confidence_count DESC, avg_confidence ASC
    LIMIT 50
  `, [minRecords]);

  return rows.map(row => ({
    domain: row.domain,
    totalCount: row.total_count,
    lowConfidenceCount: row.low_confidence_count,
    avgConfidence: row.avg_confidence || 0,
  }));
}
