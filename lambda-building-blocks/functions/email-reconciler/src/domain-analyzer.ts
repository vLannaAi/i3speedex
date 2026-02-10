/**
 * Domain Analyzer Module
 * Learns and caches email conventions for domains
 */

import {
  DomainPattern,
  EmailConvention,
  UserRecord,
} from './types';
import { getUsersByDomain } from './db/queries';
import { query, execute } from './db/connection';
import { llmAnalyzeDomainPattern } from './llm-engine';
import { logger } from './logger';

// In-memory cache for domain patterns
const patternCache: Map<string, DomainPattern> = new Map();

// Known shared/public email domains
const SHARED_DOMAINS = new Set([
  'gmail.com',
  'googlemail.com',
  'outlook.com',
  'hotmail.com',
  'live.com',
  'msn.com',
  'yahoo.com',
  'yahoo.it',
  'yahoo.de',
  'yahoo.fr',
  'yahoo.co.uk',
  'icloud.com',
  'me.com',
  'mac.com',
  'aol.com',
  'libero.it',
  'virgilio.it',
  'alice.it',
  'tin.it',
  'tiscali.it',
  'fastwebnet.it',
  'web.de',
  'gmx.de',
  'gmx.net',
  'gmx.at',
  't-online.de',
  'orange.fr',
  'free.fr',
  'wanadoo.fr',
  'sfr.fr',
  'laposte.net',
  'mail.com',
  'email.com',
  'protonmail.com',
  'proton.me',
  'tutanota.com',
  'zoho.com',
  'yandex.com',
  'yandex.ru',
  'mail.ru',
  'pec.it',
  'legalmail.it',
  'arubapec.it',
  'postecert.it',
]);

/**
 * Check if a domain is a shared/public email provider
 */
export function isSharedDomain(domain: string): boolean {
  return SHARED_DOMAINS.has(domain.toLowerCase());
}

/**
 * Get the email pattern for a domain
 * Uses cache, then database, then LLM analysis
 */
export async function getDomainPattern(domain: string): Promise<DomainPattern> {
  const normalizedDomain = domain.toLowerCase();

  // Check memory cache first
  if (patternCache.has(normalizedDomain)) {
    return patternCache.get(normalizedDomain)!;
  }

  // Check if it's a shared domain
  if (isSharedDomain(normalizedDomain)) {
    const pattern: DomainPattern = {
      domain: normalizedDomain,
      convention: 'unknown',
      confidence: 1.0,
      sampleSize: 0,
      isSharedDomain: true,
      companyName: null,
      buyerId: null,
      producerId: null,
    };
    patternCache.set(normalizedDomain, pattern);
    return pattern;
  }

  // Check database cache
  const dbPattern = await getPatternFromDb(normalizedDomain);
  if (dbPattern) {
    patternCache.set(normalizedDomain, dbPattern);
    return dbPattern;
  }

  // Analyze using LLM
  logger.info('Analyzing domain pattern', { domain: normalizedDomain });
  const pattern = await analyzeDomainPattern(normalizedDomain);

  // Cache in memory and database
  patternCache.set(normalizedDomain, pattern);
  await savePatternToDb(pattern);

  return pattern;
}

/**
 * Get domain pattern from database
 */
async function getPatternFromDb(domain: string): Promise<DomainPattern | null> {
  try {
    const rows = await query<{
      domain: string;
      convention: string;
      confidence: number;
      sample_size: number;
      is_shared_domain: boolean;
      company_name: string | null;
      buyer_id: number | null;
      producer_id: number | null;
    }>(`
      SELECT domain, convention, confidence, sample_size,
             is_shared_domain, company_name, buyer_id, producer_id
      FROM domain_patterns
      WHERE domain = ?
    `, [domain]);

    if (rows.length === 0) {
      return null;
    }

    const row = rows[0];
    return {
      domain: row.domain,
      convention: row.convention as EmailConvention,
      confidence: row.confidence,
      sampleSize: row.sample_size,
      isSharedDomain: row.is_shared_domain,
      companyName: row.company_name,
      buyerId: row.buyer_id,
      producerId: row.producer_id,
    };
  } catch (error) {
    // Table might not exist yet
    logger.warn('Failed to get domain pattern from DB', { domain, error: String(error) });
    return null;
  }
}

/**
 * Save domain pattern to database
 */
async function savePatternToDb(pattern: DomainPattern): Promise<void> {
  try {
    await execute(`
      INSERT INTO domain_patterns
        (domain, convention, confidence, sample_size, is_shared_domain,
         company_name, buyer_id, producer_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        convention = VALUES(convention),
        confidence = VALUES(confidence),
        sample_size = VALUES(sample_size),
        is_shared_domain = VALUES(is_shared_domain),
        company_name = VALUES(company_name),
        buyer_id = VALUES(buyer_id),
        producer_id = VALUES(producer_id),
        analyzed_at = NOW()
    `, [
      pattern.domain,
      pattern.convention,
      pattern.confidence,
      pattern.sampleSize,
      pattern.isSharedDomain,
      pattern.companyName,
      pattern.buyerId,
      pattern.producerId,
    ]);
  } catch (error) {
    // Table might not exist yet
    logger.warn('Failed to save domain pattern to DB', { domain: pattern.domain, error: String(error) });
  }
}

/**
 * Analyze a domain's email pattern using existing users and LLM
 */
async function analyzeDomainPattern(domain: string): Promise<DomainPattern> {
  // Get users for this domain
  const users = await getUsersByDomain(domain);

  if (users.length === 0) {
    return {
      domain,
      convention: 'unknown',
      confidence: 0,
      sampleSize: 0,
      isSharedDomain: false,
      companyName: null,
      buyerId: null,
      producerId: null,
    };
  }

  // Try heuristic analysis first
  const heuristicPattern = analyzePatternHeuristically(domain, users);

  // If heuristic has high confidence, use it
  if (heuristicPattern.confidence >= 0.8) {
    return heuristicPattern;
  }

  // Otherwise, use LLM for deeper analysis
  const llmPattern = await llmAnalyzeDomainPattern(domain, users);

  // Combine heuristic and LLM results
  if (llmPattern.confidence > heuristicPattern.confidence) {
    return llmPattern;
  }

  return heuristicPattern;
}

/**
 * Analyze email pattern using heuristics
 */
function analyzePatternHeuristically(domain: string, users: UserRecord[]): DomainPattern {
  const patterns: Record<EmailConvention, number> = {
    'firstname.lastname': 0,
    'f.lastname': 0,
    'flastname': 0,
    'firstname': 0,
    'lastname.firstname': 0,
    'unknown': 0,
  };

  let buyerId: number | null = null;
  let producerId: number | null = null;
  let companyName: string | null = null;

  for (const user of users) {
    if (!user.email || !user.name) continue;

    const email = user.email.toLowerCase();
    const [localPart] = email.split('@');
    const nameParts = user.name.toLowerCase().split(/\s+/).filter(p => p.length > 0);

    if (nameParts.length < 2) {
      patterns.unknown++;
      continue;
    }

    const firstName = nameParts[0];
    const lastName = nameParts[nameParts.length - 1];
    const firstInitial = firstName[0];

    // Check patterns
    if (localPart === `${firstName}.${lastName}`) {
      patterns['firstname.lastname']++;
    } else if (localPart === `${firstInitial}.${lastName}`) {
      patterns['f.lastname']++;
    } else if (localPart === `${firstName}${lastName}` || localPart === `${firstInitial}${lastName}`) {
      patterns.flastname++;
    } else if (localPart === firstName) {
      patterns.firstname++;
    } else if (localPart === `${lastName}.${firstName}`) {
      patterns['lastname.firstname']++;
    } else {
      patterns.unknown++;
    }

    // Capture buyer/producer info
    if (user.buyerId && !buyerId) buyerId = user.buyerId;
    if (user.producerId && !producerId) producerId = user.producerId;
    if (user.userCode && !companyName) companyName = user.userCode;
  }

  // Find dominant pattern
  const total = Object.values(patterns).reduce((a, b) => a + b, 0);
  let maxPattern: EmailConvention = 'unknown';
  let maxCount = 0;

  for (const [pattern, count] of Object.entries(patterns)) {
    if (count > maxCount) {
      maxCount = count;
      maxPattern = pattern as EmailConvention;
    }
  }

  const confidence = total > 0 ? maxCount / total : 0;

  return {
    domain,
    convention: maxPattern,
    confidence,
    sampleSize: users.length,
    isSharedDomain: false,
    companyName,
    buyerId,
    producerId,
  };
}

/**
 * Refresh domain pattern analysis
 */
export async function refreshDomainPattern(domain: string): Promise<DomainPattern> {
  const normalizedDomain = domain.toLowerCase();

  // Remove from cache
  patternCache.delete(normalizedDomain);

  // Re-analyze
  const pattern = await analyzeDomainPattern(normalizedDomain);

  // Update caches
  patternCache.set(normalizedDomain, pattern);
  await savePatternToDb(pattern);

  return pattern;
}

/**
 * Get all cached domain patterns
 */
export async function getAllDomainPatterns(): Promise<DomainPattern[]> {
  try {
    const rows = await query<{
      domain: string;
      convention: string;
      confidence: number;
      sample_size: number;
      is_shared_domain: boolean;
      company_name: string | null;
      buyer_id: number | null;
      producer_id: number | null;
    }>(`
      SELECT domain, convention, confidence, sample_size,
             is_shared_domain, company_name, buyer_id, producer_id
      FROM domain_patterns
      WHERE is_shared_domain = FALSE
      ORDER BY sample_size DESC, confidence DESC
    `);

    return rows.map(row => ({
      domain: row.domain,
      convention: row.convention as EmailConvention,
      confidence: row.confidence,
      sampleSize: row.sample_size,
      isSharedDomain: row.is_shared_domain,
      companyName: row.company_name,
      buyerId: row.buyer_id,
      producerId: row.producer_id,
    }));
  } catch (error) {
    logger.warn('Failed to get all domain patterns', { error: String(error) });
    return [];
  }
}

/**
 * Clear the in-memory cache
 */
export function clearCache(): void {
  patternCache.clear();
}

/**
 * Preload patterns for high-volume domains
 */
export async function preloadTopDomains(limit: number = 50): Promise<void> {
  try {
    // Get top domains by email count
    const rows = await query<{ domain: string }>(`
      SELECT domain, COUNT(*) as cnt
      FROM msg_emails
      WHERE domain IS NOT NULL AND domain != ''
      GROUP BY domain
      ORDER BY cnt DESC
      LIMIT ?
    `, [limit]);

    logger.info('Preloading domain patterns', { count: rows.length });

    for (const row of rows) {
      await getDomainPattern(row.domain);
    }

    logger.info('Domain pattern preload complete');
  } catch (error) {
    logger.error('Failed to preload domain patterns', { error: String(error) });
  }
}
