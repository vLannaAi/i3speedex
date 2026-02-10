/**
 * Split Module
 * Detects cases where multiple distinct persons share the same email/user
 * and proposes splitting them into separate user records
 */

import {
  UserRecord,
  MsgEmailRecord,
  SplitDetectionResult,
  SplitProposal,
} from './types';
import { getAllUsers, getUserById } from './db/queries';
import { query } from './db/connection';
import { createQueueEntry } from './db/queries';
import { logger } from './logger';

// Thresholds for split detection
const THRESHOLDS = {
  minDistinctNames: 2,
  minConfidenceToReport: 0.7,
  minMsgEmailsPerName: 3,
};

/**
 * Detect users that might need splitting
 */
export async function detectSplitCandidates(): Promise<SplitDetectionResult[]> {
  const results: SplitDetectionResult[] = [];

  // Find users with multiple distinct names in their msg_emails
  const candidates = await query<{
    user_ud: number;
    email: string;
    distinct_names: number;
  }>(`
    SELECT
      user_ud,
      address as email,
      COUNT(DISTINCT TRIM(LOWER(user_name))) as distinct_names
    FROM msg_emails
    WHERE user_ud IS NOT NULL
      AND user_name IS NOT NULL
      AND user_name != ''
    GROUP BY user_ud, address
    HAVING distinct_names >= ?
  `, [THRESHOLDS.minDistinctNames]);

  for (const candidate of candidates) {
    const result = await analyzeSplitCandidate(
      candidate.user_ud,
      candidate.email
    );

    if (result && result.confidence >= THRESHOLDS.minConfidenceToReport) {
      results.push(result);
    }
  }

  // Sort by confidence descending
  results.sort((a, b) => b.confidence - a.confidence);

  return results;
}

/**
 * Analyze a specific user for potential split
 */
async function analyzeSplitCandidate(
  userId: number,
  email: string
): Promise<SplitDetectionResult | null> {
  // Get all distinct names used with this user
  const nameData = await query<{
    user_name: string;
    count: number;
    msg_email_ids: string;
  }>(`
    SELECT
      TRIM(user_name) as user_name,
      COUNT(*) as count,
      GROUP_CONCAT(id) as msg_email_ids
    FROM msg_emails
    WHERE user_ud = ?
      AND address = ?
      AND user_name IS NOT NULL
      AND user_name != ''
    GROUP BY TRIM(LOWER(user_name))
    HAVING count >= ?
    ORDER BY count DESC
  `, [userId, email, THRESHOLDS.minMsgEmailsPerName]);

  if (nameData.length < THRESHOLDS.minDistinctNames) {
    return null;
  }

  // Analyze name patterns
  const names = nameData.map(n => n.user_name);
  const normalizedNames = names.map(normalizeName);

  // Check if names are truly distinct (not just variations)
  const distinctGroups = groupSimilarNames(normalizedNames);

  if (distinctGroups.length < THRESHOLDS.minDistinctNames) {
    // Names are variations of the same person
    return null;
  }

  // Calculate confidence based on:
  // - Number of distinct names
  // - Distribution of msg_emails across names
  // - Name dissimilarity

  const totalEmails = nameData.reduce((sum, n) => sum + n.count, 0);
  const distribution = nameData.map(n => n.count / totalEmails);
  const entropy = -distribution.reduce(
    (sum, p) => sum + (p > 0 ? p * Math.log2(p) : 0),
    0
  );
  const maxEntropy = Math.log2(nameData.length);
  const normalizedEntropy = maxEntropy > 0 ? entropy / maxEntropy : 0;

  // Higher entropy = more even distribution = more likely truly distinct people
  const confidence = Math.min(
    0.5 + normalizedEntropy * 0.3 + (distinctGroups.length - 2) * 0.1,
    1.0
  );

  // Collect msg_email IDs for each distinct name
  const msgEmailIds = nameData.flatMap(n =>
    n.msg_email_ids.split(',').map(id => parseInt(id, 10))
  );

  return {
    userId,
    email,
    distinctNames: names,
    msgEmailIds,
    confidence,
    suggestSplit: confidence >= THRESHOLDS.minConfidenceToReport,
  };
}

/**
 * Normalize a name for comparison
 */
function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    // Remove titles
    .replace(/^(mr\.?|mrs\.?|ms\.?|dr\.?|sig\.?|sig\.ra|dott\.?|ing\.?)\s+/i, '')
    // Remove punctuation
    .replace(/[.,\-']/g, ' ')
    // Normalize whitespace
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Group similar names together
 */
function groupSimilarNames(names: string[]): string[][] {
  const groups: string[][] = [];
  const assigned = new Set<number>();

  for (let i = 0; i < names.length; i++) {
    if (assigned.has(i)) continue;

    const group = [names[i]];
    assigned.add(i);

    for (let j = i + 1; j < names.length; j++) {
      if (assigned.has(j)) continue;

      if (areNamesSimilar(names[i], names[j])) {
        group.push(names[j]);
        assigned.add(j);
      }
    }

    groups.push(group);
  }

  return groups;
}

/**
 * Check if two names are similar (same person with variations)
 */
function areNamesSimilar(name1: string, name2: string): boolean {
  // Exact match after normalization
  if (name1 === name2) return true;

  // Split into words
  const words1 = name1.split(' ').filter(w => w.length > 1);
  const words2 = name2.split(' ').filter(w => w.length > 1);

  if (words1.length === 0 || words2.length === 0) return false;

  // Check if first and last names match (in any order)
  const first1 = words1[0];
  const last1 = words1[words1.length - 1];
  const first2 = words2[0];
  const last2 = words2[words2.length - 1];

  // Same first and last name
  if (first1 === first2 && last1 === last2) return true;

  // Swapped order (Lastname Firstname vs Firstname Lastname)
  if (first1 === last2 && last1 === first2) return true;

  // First name matches last name of other (possible reversal)
  if ((first1 === last2 || last1 === first2) && words1.length === 2 && words2.length === 2) {
    return true;
  }

  // Check for initial matching
  if (first1.length === 1 || first2.length === 1) {
    if (first1[0] === first2[0] && last1 === last2) return true;
  }

  return false;
}

/**
 * Create queue entries for split proposals
 */
export async function createSplitProposals(
  results: SplitDetectionResult[]
): Promise<number> {
  let created = 0;

  for (const result of results) {
    if (!result.suggestSplit) continue;

    // Get the source user
    const sourceUser = await getUserById(result.userId);
    if (!sourceUser) continue;

    // For each distinct name (except the primary), create a split proposal
    const primaryName = result.distinctNames[0]; // Most common name
    const otherNames = result.distinctNames.slice(1);

    for (const newName of otherNames) {
      // Find msg_email IDs for this name
      const nameEmails = await query<{ id: number }>(`
        SELECT id
        FROM msg_emails
        WHERE user_ud = ?
          AND TRIM(LOWER(user_name)) = TRIM(LOWER(?))
      `, [result.userId, newName]);

      const msgEmailIds = nameEmails.map(e => e.id);

      if (msgEmailIds.length < THRESHOLDS.minMsgEmailsPerName) {
        continue; // Not enough emails to justify split
      }

      const proposal: SplitProposal = {
        sourceUserId: result.userId,
        newUserName: newName,
        newUserEmail: result.email,
        msgEmailIds,
      };

      await createQueueEntry({
        queueType: 'split',
        msgEmailId: null,
        sourceUserId: result.userId,
        targetUserId: null,
        proposedData: proposal,
        currentData: {
          sourceUser: {
            id: sourceUser.id,
            name: sourceUser.name,
            email: sourceUser.email,
          },
          distinctNames: result.distinctNames,
          primaryName,
        },
        confidence: result.confidence,
        llmReasoning: `Detected ${result.distinctNames.length} distinct names for same email: ${result.distinctNames.join(', ')}`,
        status: 'pending',
        reviewedBy: null,
        reviewedAt: null,
      });

      created++;

      logger.info('Created split proposal', {
        sourceUserId: result.userId,
        newUserName: newName,
        msgEmailCount: msgEmailIds.length,
        confidence: result.confidence,
      });
    }
  }

  return created;
}

/**
 * Analyze a specific user ID for potential split
 */
export async function analyzeUserForSplit(
  userId: number
): Promise<SplitDetectionResult | null> {
  const user = await getUserById(userId);
  if (!user || !user.email) {
    return null;
  }

  return analyzeSplitCandidate(userId, user.email);
}

/**
 * Run full split detection and create proposals
 */
export async function runSplitDetection(): Promise<{
  detected: number;
  proposalsCreated: number;
}> {
  logger.info('Starting split detection');

  const results = await detectSplitCandidates();

  logger.info('Split detection complete', { detected: results.length });

  const proposalsCreated = await createSplitProposals(results);

  return {
    detected: results.length,
    proposalsCreated,
  };
}
