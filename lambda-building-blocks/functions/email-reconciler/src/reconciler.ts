/**
 * Reconciliation Engine
 * Orchestrates matching between msg_emails and users
 */

import levenshtein from 'fast-levenshtein';
import {
  ParsedRecipient,
  UserRecord,
  MsgEmailRecord,
  MatchCandidate,
  MatchFactor,
  ReconciliationResult,
  SuggestedAction,
  QueueEntry,
  EnhancedProposal,
} from './types';
import { parseRecipient } from './parser';
import { getDomainPattern, isSharedDomain } from './domain-analyzer';
import { llmMatchUser, llmParseRecipient } from './llm-engine';
import {
  getUsersByDomain,
  getUsersByEmail,
  getMsgEmailById,
  createQueueEntry,
  hasPendingQueueEntry,
} from './db/queries';
import { logger } from './logger';

// Matching weight configuration
const WEIGHTS = {
  emailExact: 1.0,
  email2Exact: 0.95,
  domainMatch: 0.3,
  nameExact: 0.4,
  nameFuzzy: 0.25,
  localPartPattern: 0.35,
  companyCodeMatch: 0.2,
  buyerProducerMatch: 0.15,
};

// Threshold configuration
const THRESHOLDS = {
  highConfidence: 0.90,
  mediumConfidence: 0.70,
  lowConfidence: 0.50,
  nameSimilarity: 0.8, // Levenshtein similarity threshold
};

/**
 * Map honorific titles to genre (Mr./Ms./null)
 * Returns null for role/function addresses or unknown titles
 */
function mapTitleToGenre(title: string | null): 'Mr.' | 'Ms.' | null {
  if (!title) return null;

  const normalized = title.toLowerCase().replace(/[.,]/g, '').trim();

  // Male titles
  const maleTitles = ['mr', 'herr', 'sig', 'signor', 'signore', 'sr', 'm', 'dr', 'dott', 'dottore', 'ing', 'ingegnere', 'prof'];
  if (maleTitles.includes(normalized)) {
    return 'Mr.';
  }

  // Female titles
  const femaleTitles = ['mrs', 'ms', 'miss', 'frau', 'sig.ra', 'sigra', 'signora', 'sra', 'srta', 'mme', 'mlle', 'dott.ssa', 'dottoressa'];
  if (femaleTitles.includes(normalized)) {
    return 'Ms.';
  }

  // Unknown or role titles - return null
  return null;
}

/**
 * Process a single msg_email record and generate reconciliation result
 */
export async function reconcileMsgEmail(
  msgEmail: MsgEmailRecord,
  useLLM: boolean = true
): Promise<ReconciliationResult> {
  // Parse the input (use empty string if null)
  const inputStr = msgEmail.input || msgEmail.address || msgEmail.email || '';
  let parsed = parseRecipient(inputStr);

  // If basic parsing didn't extract enough info, use LLM
  if (useLLM && parsed.confidence < 0.6) {
    const domainPattern = parsed.domain
      ? await getDomainPattern(parsed.domain)
      : undefined;

    const llmParsed = await llmParseRecipient(inputStr, domainPattern);
    if (llmParsed.llmConfidence > parsed.confidence) {
      parsed = llmParsed;
    }
  }

  // If no valid email extracted, return no-match result
  if (!parsed.email) {
    return {
      msgEmailId: msgEmail.id,
      parsedData: parsed,
      candidates: [],
      suggestedAction: 'manual_review',
      suggestedUserId: null,
      confidence: 0,
      isSharedEmail: false,
      llmReasoning: 'Could not extract valid email address from input',
    };
  }

  // Get domain pattern for matching context
  const domainPattern = await getDomainPattern(parsed.domain);
  const sharedEmail = domainPattern.isSharedDomain;

  // Find candidate users
  const candidates = await findCandidateUsers(parsed, msgEmail);

  // Score candidates
  const scoredCandidates = scoreCandidates(parsed, candidates, domainPattern);

  // Use LLM for final matching decision if confidence is ambiguous
  let llmReasoning = '';
  let suggestedUserId: number | null = null;
  let confidence = 0;

  if (scoredCandidates.length > 0) {
    const topCandidate = scoredCandidates[0];

    if (useLLM && topCandidate.confidence < THRESHOLDS.highConfidence) {
      // Use LLM to validate/improve matching
      const llmResult = await llmMatchUser(parsed, candidates, domainPattern);
      llmReasoning = llmResult.reasoning;

      if (llmResult.bestMatchId && llmResult.confidence > topCandidate.confidence) {
        suggestedUserId = llmResult.bestMatchId;
        confidence = llmResult.confidence;
      } else {
        suggestedUserId = topCandidate.userId;
        confidence = topCandidate.confidence;
      }
    } else {
      suggestedUserId = topCandidate.userId;
      confidence = topCandidate.confidence;
      llmReasoning = `Top match by score: ${topCandidate.matchFactors.join(', ')}`;
    }
  }

  // Determine suggested action
  const suggestedAction = determineSuggestedAction(
    confidence,
    scoredCandidates,
    sharedEmail
  );

  return {
    msgEmailId: msgEmail.id,
    parsedData: parsed,
    candidates: scoredCandidates,
    suggestedAction,
    suggestedUserId,
    confidence,
    isSharedEmail: sharedEmail,
    llmReasoning,
  };
}

/**
 * Find candidate users for matching
 */
async function findCandidateUsers(
  parsed: ParsedRecipient,
  msgEmail: MsgEmailRecord
): Promise<UserRecord[]> {
  const candidates: Map<number, UserRecord> = new Map();

  // 1. Exact email match
  const emailMatches = await getUsersByEmail(parsed.email);
  for (const user of emailMatches) {
    candidates.set(user.id, user);
  }

  // 2. Same domain users
  if (parsed.domain && !isSharedDomain(parsed.domain)) {
    const domainUsers = await getUsersByDomain(parsed.domain);
    for (const user of domainUsers) {
      if (!candidates.has(user.id)) {
        candidates.set(user.id, user);
      }
    }
  }

  // 3. If msg_email has buyer/producer, get users with same association
  if (msgEmail.buyerId || msgEmail.producerId) {
    // This would require additional queries - for now, rely on domain matching
  }

  return Array.from(candidates.values());
}

/**
 * Score candidate users based on multiple matching factors
 */
function scoreCandidates(
  parsed: ParsedRecipient,
  candidates: UserRecord[],
  domainPattern: { convention: string; isSharedDomain: boolean }
): MatchCandidate[] {
  const scored: MatchCandidate[] = [];

  for (const candidate of candidates) {
    const factors: MatchFactor[] = [];
    let score = 0;

    // Email exact match
    if (candidate.email?.toLowerCase() === parsed.email) {
      factors.push('email_exact');
      score += WEIGHTS.emailExact;
    }

    // Email2 match
    if (candidate.email2?.toLowerCase() === parsed.email) {
      factors.push('email2_exact');
      score += WEIGHTS.email2Exact;
    }

    // Domain match
    if (candidate.domain === parsed.domain || candidate.domain2 === parsed.domain) {
      factors.push('domain_match');
      score += WEIGHTS.domainMatch;
    }

    // Name matching
    if (parsed.givenName && parsed.surname && candidate.name) {
      const parsedFullName = `${parsed.givenName} ${parsed.surname}`.toLowerCase();
      const candidateName = candidate.name.toLowerCase();

      // Exact name match
      if (candidateName === parsedFullName) {
        factors.push('name_exact');
        score += WEIGHTS.nameExact;
      } else {
        // Fuzzy name match
        const similarity = calculateNameSimilarity(parsedFullName, candidateName);
        if (similarity >= THRESHOLDS.nameSimilarity) {
          factors.push('name_fuzzy');
          score += WEIGHTS.nameFuzzy * similarity;
        }
      }
    }

    // Local part pattern matching (based on domain convention)
    if (!domainPattern.isSharedDomain && candidate.name) {
      const patternMatch = checkLocalPartPattern(
        parsed.localPart,
        candidate.name,
        domainPattern.convention
      );
      if (patternMatch) {
        factors.push('local_part_pattern');
        score += WEIGHTS.localPartPattern;
      }
    }

    // Buyer/Producer match
    if (
      (parsed.companyName && candidate.buyerId) ||
      (parsed.companyName && candidate.producerId)
    ) {
      factors.push('buyer_producer_match');
      score += WEIGHTS.buyerProducerMatch;
    }

    // Only include candidates with at least one matching factor
    if (factors.length > 0) {
      scored.push({
        userId: candidate.id,
        confidence: Math.min(score, 1.0),
        matchFactors: factors,
        userName: candidate.name,
        userEmail: candidate.email,
        userEmail2: candidate.email2,
        userCode: candidate.userCode,
        buyerId: candidate.buyerId,
        producerId: candidate.producerId,
      });
    }
  }

  // Sort by confidence descending
  scored.sort((a, b) => b.confidence - a.confidence);

  return scored;
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
 * Check if local part matches user name based on domain convention
 */
function checkLocalPartPattern(
  localPart: string,
  userName: string,
  convention: string
): boolean {
  const nameParts = userName.toLowerCase().split(/\s+/).filter(p => p.length > 0);

  if (nameParts.length < 2) return false;

  const firstName = nameParts[0];
  const lastName = nameParts[nameParts.length - 1];
  const firstInitial = firstName[0];
  const local = localPart.toLowerCase();

  switch (convention) {
    case 'firstname.lastname':
      return local === `${firstName}.${lastName}`;
    case 'f.lastname':
      return local === `${firstInitial}.${lastName}`;
    case 'flastname':
      return local === `${firstName}${lastName}` || local === `${firstInitial}${lastName}`;
    case 'firstname':
      return local === firstName;
    case 'lastname.firstname':
      return local === `${lastName}.${firstName}`;
    default:
      // Try common patterns
      return (
        local === `${firstName}.${lastName}` ||
        local === `${firstInitial}.${lastName}` ||
        local === `${firstName}${lastName}`
      );
  }
}

/**
 * Determine the suggested action based on matching results
 */
function determineSuggestedAction(
  confidence: number,
  candidates: MatchCandidate[],
  isSharedEmail: boolean
): SuggestedAction {
  // No candidates found
  if (candidates.length === 0) {
    return 'create_user';
  }

  // High confidence match
  if (confidence >= THRESHOLDS.highConfidence) {
    return 'link_user';
  }

  // Medium confidence - needs review but likely a match
  if (confidence >= THRESHOLDS.mediumConfidence) {
    return 'manual_review';
  }

  // Multiple candidates with similar scores - potential duplicate
  if (
    candidates.length >= 2 &&
    candidates[0].confidence - candidates[1].confidence < 0.1
  ) {
    return 'duplicate_suspect';
  }

  // Low confidence
  if (confidence >= THRESHOLDS.lowConfidence) {
    return 'manual_review';
  }

  // Very low or no confidence
  return 'create_user';
}

/**
 * Create a queue entry for a reconciliation result
 */
export async function createQueueEntryForResult(
  result: ReconciliationResult,
  msgEmail: MsgEmailRecord
): Promise<number | null> {
  // Check if already has a pending entry
  if (await hasPendingQueueEntry(result.msgEmailId)) {
    logger.info('Skipping queue entry - already pending', {
      msgEmailId: result.msgEmailId,
    });
    return null;
  }

  // Determine queue type based on action
  const queueType: 'link' | 'create_user' =
    (result.suggestedAction === 'link_user' || result.suggestedAction === 'manual_review' || result.suggestedAction === 'duplicate_suspect')
    && result.suggestedUserId
      ? 'link'
      : 'create_user';

  // Convert title to genre (Mr./Ms./null)
  const extractedGenre = mapTitleToGenre(result.parsedData.title);

  // Build comprehensive proposed data with all extracted fields
  const proposedData: EnhancedProposal = {
    // Core extracted fields for msg_emails update
    name1: result.parsedData.givenName || null,      // First name
    name2: result.parsedData.surname || null,        // Last name
    genre: extractedGenre,                           // Mr./Ms./null
    email: result.parsedData.email,                  // Email address
    domain: result.parsedData.domain,                // Domain

    // Full name for display
    fullName: result.parsedData.givenName && result.parsedData.surname
      ? `${result.parsedData.givenName} ${result.parsedData.surname}`
      : result.parsedData.displayName || null,

    // Original display name from input
    displayName: result.parsedData.displayName,

    // Company info if detected
    companyName: result.parsedData.companyName || null,
    isPersonal: result.parsedData.isPersonal,

    // Link/match info
    user_ud: result.suggestedUserId || null,         // Matching user ID
    displayClassification: (result.suggestedUserId ? 'full' : (result.parsedData.email ? 'partial' : 'unknown')) as 'full' | 'partial' | 'unknown',

    // Reference IDs
    msgEmailId: result.msgEmailId,
    buyerId: msgEmail.buyerId,
    producerId: msgEmail.producerId,
  };

  // Current data from msg_email for comparison
  const currentData = {
    input: msgEmail.input,
    address: msgEmail.address,
    userName: msgEmail.userName,
    userGenre: msgEmail.userGenre,
    userUd: msgEmail.userUd,
  };

  // Create queue entry
  const entryId = await createQueueEntry({
    queueType,
    msgEmailId: result.msgEmailId,
    sourceUserId: null,
    targetUserId: result.suggestedUserId,
    proposedData,
    currentData,
    confidence: result.confidence,
    llmReasoning: result.llmReasoning,
    status: 'pending',
    reviewedBy: null,
    reviewedAt: null,
  });

  logger.info('Created queue entry', {
    entryId,
    queueType,
    msgEmailId: result.msgEmailId,
    confidence: result.confidence,
  });

  return entryId;
}

/**
 * Process a msg_email by ID
 */
export async function processById(
  msgEmailId: number,
  useLLM: boolean = true
): Promise<ReconciliationResult | null> {
  const msgEmail = await getMsgEmailById(msgEmailId);

  if (!msgEmail) {
    logger.warn('MsgEmail not found', { msgEmailId });
    return null;
  }

  const result = await reconcileMsgEmail(msgEmail, useLLM);
  await createQueueEntryForResult(result, msgEmail);

  return result;
}

/**
 * Batch process multiple msg_emails
 */
export async function processBatch(
  msgEmails: MsgEmailRecord[],
  useLLM: boolean = true,
  onProgress?: (processed: number, total: number) => void
): Promise<{
  processed: number;
  proposalsCreated: number;
  errors: number;
  errorMessages: string[];
}> {
  let processed = 0;
  let proposalsCreated = 0;
  let errors = 0;
  const errorMessages: string[] = [];

  for (const msgEmail of msgEmails) {
    try {
      const result = await reconcileMsgEmail(msgEmail, useLLM);
      const entryId = await createQueueEntryForResult(result, msgEmail);

      processed++;
      if (entryId) {
        proposalsCreated++;
      }

      if (onProgress) {
        onProgress(processed, msgEmails.length);
      }
    } catch (error) {
      errors++;
      const message = `Failed to process msgEmail ${msgEmail.id}: ${error}`;
      errorMessages.push(message);
      logger.error(message, { msgEmailId: msgEmail.id, error: String(error) });
    }
  }

  return {
    processed,
    proposalsCreated,
    errors,
    errorMessages,
  };
}
