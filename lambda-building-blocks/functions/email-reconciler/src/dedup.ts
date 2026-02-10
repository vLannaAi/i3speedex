/**
 * Deduplication Module
 * Detects and proposes merges for duplicate users
 */

import levenshtein from 'fast-levenshtein';
import {
  UserRecord,
  DuplicateDetectionResult,
  MergeProposal,
  QueueEntry,
} from './types';
import { getAllUsers, getUsersByDomain, createQueueEntry } from './db/queries';
import { query } from './db/connection';
import { llmCheckDuplicates } from './llm-engine';
import { logger } from './logger';

// Thresholds for duplicate detection
const THRESHOLDS = {
  nameSimilarity: 0.85,
  minConfidenceToReport: 0.7,
};

/**
 * Detect duplicate users within the entire database
 */
export async function detectAllDuplicates(): Promise<DuplicateDetectionResult[]> {
  const users = await getAllUsers();
  const duplicates: DuplicateDetectionResult[] = [];

  // Group users by domain for more efficient comparison
  const byDomain = new Map<string, UserRecord[]>();

  for (const user of users) {
    if (user.domain) {
      const list = byDomain.get(user.domain) || [];
      list.push(user);
      byDomain.set(user.domain, list);
    }
    if (user.domain2 && user.domain2 !== user.domain) {
      const list = byDomain.get(user.domain2) || [];
      list.push(user);
      byDomain.set(user.domain2, list);
    }
  }

  // Check for duplicates within each domain
  for (const [domain, domainUsers] of byDomain) {
    const domainDuplicates = await detectDuplicatesInGroup(domainUsers);
    duplicates.push(...domainDuplicates);
  }

  // Also check for exact email matches across all users
  const emailDuplicates = await detectEmailDuplicates(users);
  duplicates.push(...emailDuplicates);

  // Deduplicate results (same pair might be detected multiple ways)
  return deduplicateResults(duplicates);
}

/**
 * Detect duplicates within a specific domain
 */
export async function detectDuplicatesByDomain(
  domain: string
): Promise<DuplicateDetectionResult[]> {
  const users = await getUsersByDomain(domain);
  return detectDuplicatesInGroup(users);
}

/**
 * Detect duplicates within a group of users
 */
async function detectDuplicatesInGroup(
  users: UserRecord[]
): Promise<DuplicateDetectionResult[]> {
  const duplicates: DuplicateDetectionResult[] = [];

  for (let i = 0; i < users.length; i++) {
    for (let j = i + 1; j < users.length; j++) {
      const user1 = users[i];
      const user2 = users[j];

      const result = checkDuplicatePair(user1, user2);
      if (result.similarity >= THRESHOLDS.minConfidenceToReport) {
        duplicates.push(result);
      }
    }
  }

  return duplicates;
}

/**
 * Check if two users are potential duplicates
 */
function checkDuplicatePair(
  user1: UserRecord,
  user2: UserRecord
): DuplicateDetectionResult {
  const factors: Array<'same_email' | 'same_name' | 'similar_name' | 'same_domain'> = [];
  let similarity = 0;

  // Check email match
  if (user1.email && user2.email) {
    if (user1.email.toLowerCase() === user2.email.toLowerCase()) {
      factors.push('same_email');
      similarity += 0.5;
    }
  }

  // Check email2 matches
  if (user1.email && user2.email2) {
    if (user1.email.toLowerCase() === user2.email2.toLowerCase()) {
      factors.push('same_email');
      similarity += 0.4;
    }
  }
  if (user1.email2 && user2.email) {
    if (user1.email2.toLowerCase() === user2.email.toLowerCase()) {
      factors.push('same_email');
      similarity += 0.4;
    }
  }

  // Check name match
  if (user1.name && user2.name) {
    const name1 = user1.name.toLowerCase().trim();
    const name2 = user2.name.toLowerCase().trim();

    if (name1 === name2) {
      factors.push('same_name');
      similarity += 0.4;
    } else {
      const nameSimilarity = calculateNameSimilarity(name1, name2);
      if (nameSimilarity >= THRESHOLDS.nameSimilarity) {
        factors.push('similar_name');
        similarity += 0.3 * nameSimilarity;
      }
    }
  }

  // Check domain match
  if (user1.domain === user2.domain && user1.domain) {
    factors.push('same_domain');
    similarity += 0.1;
  }

  // Determine merge direction
  let suggestedMerge: 'user1_into_user2' | 'user2_into_user1' | 'needs_review';

  if (similarity >= 0.9) {
    // High confidence - merge into user with more data
    const user1Score = scoreUserCompleteness(user1);
    const user2Score = scoreUserCompleteness(user2);
    suggestedMerge = user1Score > user2Score ? 'user2_into_user1' : 'user1_into_user2';
  } else {
    suggestedMerge = 'needs_review';
  }

  return {
    user1,
    user2,
    similarity: Math.min(similarity, 1.0),
    factors,
    suggestedMerge,
  };
}

/**
 * Calculate name similarity using Levenshtein distance
 */
function calculateNameSimilarity(name1: string, name2: string): number {
  const distance = levenshtein.get(name1, name2);
  const maxLength = Math.max(name1.length, name2.length);

  if (maxLength === 0) return 1;

  return 1 - distance / maxLength;
}

/**
 * Score user completeness (more data = higher score)
 */
function scoreUserCompleteness(user: UserRecord): number {
  let score = 0;

  if (user.name) score += 1;
  if (user.email) score += 1;
  if (user.email2) score += 0.5;
  if (user.genre) score += 0.5;
  if (user.userCode) score += 0.5;
  if (user.address) score += 0.5;
  if (user.buyerId) score += 0.5;
  if (user.producerId) score += 0.5;

  return score;
}

/**
 * Detect duplicates by exact email match
 */
async function detectEmailDuplicates(
  users: UserRecord[]
): Promise<DuplicateDetectionResult[]> {
  const emailMap = new Map<string, UserRecord[]>();

  for (const user of users) {
    if (user.email) {
      const email = user.email.toLowerCase();
      const list = emailMap.get(email) || [];
      list.push(user);
      emailMap.set(email, list);
    }
    if (user.email2) {
      const email = user.email2.toLowerCase();
      const list = emailMap.get(email) || [];
      list.push(user);
      emailMap.set(email, list);
    }
  }

  const duplicates: DuplicateDetectionResult[] = [];

  for (const [email, usersWithEmail] of emailMap) {
    if (usersWithEmail.length > 1) {
      // All users sharing this email are potential duplicates
      for (let i = 0; i < usersWithEmail.length; i++) {
        for (let j = i + 1; j < usersWithEmail.length; j++) {
          duplicates.push(checkDuplicatePair(usersWithEmail[i], usersWithEmail[j]));
        }
      }
    }
  }

  return duplicates;
}

/**
 * Deduplicate results (remove same pair detected multiple ways)
 */
function deduplicateResults(
  results: DuplicateDetectionResult[]
): DuplicateDetectionResult[] {
  const seen = new Set<string>();
  const unique: DuplicateDetectionResult[] = [];

  for (const result of results) {
    const key = [result.user1.id, result.user2.id].sort().join('-');
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(result);
    }
  }

  // Sort by similarity descending
  unique.sort((a, b) => b.similarity - a.similarity);

  return unique;
}

/**
 * Validate duplicate detection with LLM
 */
export async function validateWithLLM(
  result: DuplicateDetectionResult
): Promise<DuplicateDetectionResult> {
  const llmResult = await llmCheckDuplicates(result.user1, result.user2);

  // Update similarity based on LLM opinion
  if (llmResult.isDuplicate) {
    result.similarity = Math.max(result.similarity, llmResult.confidence);
  } else {
    result.similarity = Math.min(result.similarity, 1 - llmResult.confidence);
  }

  return result;
}

/**
 * Create queue entries for detected duplicates
 */
export async function createMergeProposals(
  duplicates: DuplicateDetectionResult[]
): Promise<number> {
  let created = 0;

  for (const dup of duplicates) {
    if (dup.similarity < THRESHOLDS.minConfidenceToReport) {
      continue;
    }

    // Determine merge direction
    let sourceUser: UserRecord;
    let targetUser: UserRecord;

    if (dup.suggestedMerge === 'user1_into_user2') {
      sourceUser = dup.user1;
      targetUser = dup.user2;
    } else if (dup.suggestedMerge === 'user2_into_user1') {
      sourceUser = dup.user2;
      targetUser = dup.user1;
    } else {
      // needs_review - use lower ID as target (arbitrary but consistent)
      if (dup.user1.id < dup.user2.id) {
        sourceUser = dup.user2;
        targetUser = dup.user1;
      } else {
        sourceUser = dup.user1;
        targetUser = dup.user2;
      }
    }

    // Get affected msg_email count
    const countResult = await query<{ count: number }>(`
      SELECT COUNT(*) as count FROM msg_emails WHERE user_ud = ?
    `, [sourceUser.id]);
    const affectedCount = countResult[0]?.count || 0;

    const proposal: MergeProposal = {
      sourceUserId: sourceUser.id,
      targetUserId: targetUser.id,
      sourceUserName: sourceUser.name,
      targetUserName: targetUser.name,
      affectedMsgEmailCount: affectedCount,
    };

    await createQueueEntry({
      queueType: 'merge',
      msgEmailId: null,
      sourceUserId: sourceUser.id,
      targetUserId: targetUser.id,
      proposedData: proposal,
      currentData: {
        sourceUser: {
          id: sourceUser.id,
          name: sourceUser.name,
          email: sourceUser.email,
          email2: sourceUser.email2,
        },
        targetUser: {
          id: targetUser.id,
          name: targetUser.name,
          email: targetUser.email,
          email2: targetUser.email2,
        },
      },
      confidence: dup.similarity,
      llmReasoning: `Duplicate detected by: ${dup.factors.join(', ')}`,
      status: 'pending',
      reviewedBy: null,
      reviewedAt: null,
    });

    created++;

    logger.info('Created merge proposal', {
      sourceUserId: sourceUser.id,
      targetUserId: targetUser.id,
      similarity: dup.similarity,
      factors: dup.factors,
    });
  }

  return created;
}

/**
 * Run full duplicate detection and create proposals
 */
export async function runDuplicateDetection(
  useLLM: boolean = false
): Promise<{
  detected: number;
  proposalsCreated: number;
}> {
  logger.info('Starting duplicate detection');

  const duplicates = await detectAllDuplicates();

  logger.info('Duplicate detection complete', { detected: duplicates.length });

  // Optionally validate with LLM
  if (useLLM) {
    for (let i = 0; i < duplicates.length; i++) {
      duplicates[i] = await validateWithLLM(duplicates[i]);
    }
  }

  // Create proposals
  const proposalsCreated = await createMergeProposals(duplicates);

  return {
    detected: duplicates.length,
    proposalsCreated,
  };
}
