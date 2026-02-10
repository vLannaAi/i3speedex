/**
 * Extraction Validator
 * Validates and sanitizes LLM extraction results before storage
 *
 * Ensures:
 * - No garbage data (emails in name fields)
 * - Reasonable field lengths
 * - Proper confidence classification
 * - Service address detection
 */

import {
  LLMExtractionResult,
  ExtractionValidationResult,
  ExtractionStatus,
} from './types';
import { capitalizeProper } from './parser';

/**
 * Extraction pipeline version.
 * Bump this when changing prompt text, capitalization rules, genre inference,
 * initial computation, or any other logic that affects extraction output.
 * Records processed with older versions can be selectively re-processed.
 *
 * Changelog:
 *   1 - Initial extraction pipeline (Phase 1)
 *   2 - Extraction status columns, domain convention
 *   3 - capitalizeProper rewrite, genre inference from names,
 *       name initials (ai_name1pre/ai_name2pre), genre fallback from DB
 *   4 - ai_name3: functional/role label for non-personal addresses
 */
export const AI_EXTRACTION_VERSION = 4;

// Maximum allowed lengths
const MAX_NAME_LENGTH = 50;
const MAX_REASONING_LENGTH = 1000;

// Common email prefixes that should not appear in name fields
const INVALID_NAME_PATTERNS = new Set([
  'info', 'sales', 'support', 'help', 'contact', 'admin', 'administrator',
  'webmaster', 'postmaster', 'hostmaster', 'abuse', 'noreply', 'no-reply',
  'newsletter', 'marketing', 'billing', 'accounts', 'finance', 'hr',
  'jobs', 'careers', 'press', 'media', 'legal', 'compliance',
  'security', 'privacy', 'feedback', 'enquiries', 'inquiries',
  'office', 'reception', 'general', 'main', 'team', 'hello',
  'vendite', 'amministrazione', 'contatti', 'segreteria', 'ufficio',
  'vertrieb', 'verwaltung', 'kontakt', 'zentrale', 'buchhaltung',
]);

// Confidence thresholds
const HIGH_CONFIDENCE_THRESHOLD = 0.85;
const MEDIUM_CONFIDENCE_THRESHOLD = 0.60;

/**
 * Validate an LLM extraction result before storing
 */
export function validateExtractionResult(
  result: Partial<LLMExtractionResult>
): ExtractionValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Validate email (required)
  if (!result.email) {
    errors.push('Email is required');
  } else if (!isValidEmailFormat(result.email)) {
    errors.push(`Invalid email format: ${result.email}`);
  }

  // Validate name1 (given name)
  if (result.name1) {
    const name1Validation = validateNameField(result.name1, 'name1');
    errors.push(...name1Validation.errors);
    warnings.push(...name1Validation.warnings);
  }

  // Validate name2 (surname)
  if (result.name2) {
    const name2Validation = validateNameField(result.name2, 'name2');
    errors.push(...name2Validation.errors);
    warnings.push(...name2Validation.warnings);
  }

  // Validate genre
  if (result.genre && !['Mr.', 'Ms.'].includes(result.genre)) {
    errors.push(`Invalid genre value: ${result.genre}`);
  }

  // Validate confidence
  if (typeof result.confidence !== 'number' || result.confidence < 0 || result.confidence > 1) {
    warnings.push('Invalid confidence value, defaulting to 0.5');
  }

  // Check for service address
  if (result.email && isServiceEmail(result.email) && result.isPersonal === true) {
    warnings.push('Email appears to be a service address but marked as personal');
  }

  // Build sanitized result if valid
  let sanitizedResult: LLMExtractionResult | undefined;

  if (errors.length === 0) {
    sanitizedResult = sanitizeExtractionResult(result);
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    sanitizedResult,
  };
}

/**
 * Validate a name field
 */
function validateNameField(
  name: string,
  fieldName: string
): { errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check for @ symbol (email in name field)
  if (name.includes('@')) {
    errors.push(`${fieldName} contains @ symbol (email address in name field)`);
  }

  // Check length
  if (name.length > MAX_NAME_LENGTH) {
    errors.push(`${fieldName} exceeds maximum length of ${MAX_NAME_LENGTH}`);
  }

  // Check for common email prefixes
  const lowered = name.toLowerCase().trim();
  if (INVALID_NAME_PATTERNS.has(lowered)) {
    errors.push(`${fieldName} is a common email prefix, not a valid name: ${name}`);
  }

  // Check for suspicious patterns
  if (/^\d+$/.test(name)) {
    errors.push(`${fieldName} is entirely numeric: ${name}`);
  }

  // Check for URL patterns
  if (/^https?:\/\//i.test(name) || /\.(com|net|org|io|it|de|fr)$/i.test(name)) {
    errors.push(`${fieldName} appears to be a URL or domain: ${name}`);
  }

  // Warnings for suspicious but potentially valid content
  if (name.length < 2) {
    warnings.push(`${fieldName} is very short: ${name}`);
  }

  if (/\d/.test(name)) {
    warnings.push(`${fieldName} contains numbers: ${name}`);
  }

  return { errors, warnings };
}

/**
 * Validate email format
 */
function isValidEmailFormat(email: string): boolean {
  // Must have exactly one @ with text before and after
  const parts = email.split('@');
  if (parts.length !== 2) return false;

  const [localPart, domain] = parts;

  // Local part validation
  if (!localPart || localPart.length === 0) return false;

  // Domain validation
  if (!domain || domain.length === 0) return false;
  if (!domain.includes('.')) return false;

  // Basic format check
  const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
  return emailRegex.test(email);
}

/**
 * Check if email is a service/generic address
 */
function isServiceEmail(email: string): boolean {
  const localPart = email.split('@')[0]?.toLowerCase();
  if (!localPart) return false;

  return INVALID_NAME_PATTERNS.has(localPart);
}

/**
 * Compute a simplified functional/role label from the email local part.
 * Returns null for personal addresses.
 *
 * A trailing `~` indicates the label was simplified from a noisier original.
 *
 * Simplification order (first matching pattern wins):
 *  1. UUID after separator:    [+\-.]<8-4-4-4-12 hex>
 *  2. Long hex after separator: [+\-.]<16+ hex chars>
 *  3. Numeric suffix:          [+\-._]<3+ digits>
 *  4. Date-like suffix:        [+\-._]2024, [+\-._]2024-q3, [+\-._]q3
 *  5. Short numeric suffix:    [+\-._]<2+ digits>
 *
 * After stripping, if remainder < 2 chars, keep original unchanged (no ~).
 */
export function computeName3(localPart: string, isPersonal: boolean): string | null {
  if (isPersonal) return null;

  const lp = localPart.toLowerCase();
  if (!lp || lp.length === 0) return null;

  // Try simplification patterns in priority order
  const patterns: RegExp[] = [
    // 1. UUID after separator: 8-4-4-4-12 hex
    /[+\-.]([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/,
    // 2. Long hex after separator: 16+ hex chars
    /[+\-.]([0-9a-f]{16,})$/,
    // 3. Numeric suffix: 3+ digits
    /[+\-._](\d{3,})$/,
    // 4. Date-like suffix: year, year-quarter, quarter alone
    /[+\-._]((?:20\d{2})(?:[+\-._]q\d)?)$/,
    /[+\-._](q\d)$/,
    // 5. Short numeric suffix: 2+ digits
    /[+\-._](\d{2,})$/,
  ];

  for (const pattern of patterns) {
    const match = lp.match(pattern);
    if (match) {
      // Strip the matched suffix (including the separator)
      const separatorIndex = lp.lastIndexOf(match[0].charAt(0) === '+' || match[0].charAt(0) === '-' || match[0].charAt(0) === '.' || match[0].charAt(0) === '_'
        ? match[0].charAt(0)
        : match[0].charAt(0));
      // Find where this match starts in the string
      const matchStart = match.index!;
      const remainder = lp.slice(0, matchStart);

      if (remainder.length < 2) {
        // Remainder too short, keep original unchanged (no ~)
        return lp;
      }
      return remainder + '~';
    }
  }

  // No simplification needed, return lowercased local part
  return lp;
}

/**
 * Sanitize and normalize extraction result
 */
function sanitizeExtractionResult(
  result: Partial<LLMExtractionResult>
): LLMExtractionResult {
  const email = result.email!.toLowerCase().trim();
  const domain = email.split('@')[1] || '';

  // Determine confidence and status
  const confidence = normalizeConfidence(result.confidence);
  const isServiceAddress = isServiceEmail(email);

  let extractionStatus: ExtractionStatus;
  if (isServiceAddress) {
    extractionStatus = 'not_applicable';
  } else if (confidence >= HIGH_CONFIDENCE_THRESHOLD) {
    extractionStatus = 'extracted_high';
  } else if (confidence >= MEDIUM_CONFIDENCE_THRESHOLD) {
    extractionStatus = 'extracted_medium';
  } else {
    extractionStatus = 'extracted_low';
  }

  const name1 = sanitizeName(result.name1);
  const name2 = sanitizeName(result.name2);

  // Compute initials from names, falling back to email local part
  const localPart = email.split('@')[0] || '';
  const localSegments = parseLocalPartSegments(email);
  const name1pre = computeInitial(name1, localSegments.first);
  const name2pre = computeInitial(name2, localSegments.second);

  // Compute functional/role label for non-personal addresses
  const isPersonal = !isServiceAddress && result.isPersonal !== false;
  const name3 = computeName3(localPart, isPersonal);

  return {
    name1,
    name2,
    name1pre,
    name2pre,
    name3,
    genre: result.genre || null,
    email,
    domain,
    isPersonal,
    confidence,
    extractionStatus,
    reasoning: truncateString(result.reasoning || '', MAX_REASONING_LENGTH),
    chainOfThought: result.chainOfThought
      ? truncateString(result.chainOfThought, MAX_REASONING_LENGTH * 2)
      : undefined,
  };
}

/**
 * Sanitize a name field
 */
function sanitizeName(name: string | null | undefined): string | null {
  if (!name) return null;

  let cleaned = name
    .trim()
    // Remove surrounding quotes
    .replace(/^["']+|["']+$/g, '')
    // Normalize whitespace
    .replace(/\s+/g, ' ')
    // Remove leading/trailing punctuation
    .replace(/^[.,;:\-!?]+|[.,;:\-!?]+$/g, '')
    .trim();

  // Check if valid after cleaning
  if (!cleaned || cleaned.length < 2) {
    return null;
  }

  // Check for invalid patterns
  if (cleaned.includes('@') || INVALID_NAME_PATTERNS.has(cleaned.toLowerCase())) {
    return null;
  }

  // Apply proper capitalization
  cleaned = capitalizeProper(cleaned);

  return cleaned;
}

/**
 * Compute an initial from a name or email local part
 *
 * - If name exists → first letter + "." (e.g., "Marco" → "M.")
 * - If name is already an initial ("M." or "M") → normalize to "X."
 * - If name is null, derive from email local part segment
 */
export function computeInitial(
  name: string | null,
  emailSegment?: string | null
): string | null {
  if (name) {
    // Already an initial like "M." or single letter "M"
    if (/^[A-Za-z]\.$/.test(name) || (name.length === 1 && /^[A-Za-z]$/.test(name))) {
      return name.charAt(0).toUpperCase() + '.';
    }
    // Normal name: take first letter
    const firstLetter = name.charAt(0);
    if (/[A-Za-z]/.test(firstLetter)) {
      return firstLetter.toUpperCase() + '.';
    }
    return null;
  }

  // Derive from email segment if name is null
  if (emailSegment) {
    const firstLetter = emailSegment.charAt(0);
    if (/[A-Za-z]/.test(firstLetter)) {
      return firstLetter.toUpperCase() + '.';
    }
  }

  return null;
}

/**
 * Parse email local part into segments for initial derivation
 * e.g., "m.rossi" → ["m", "rossi"], "marco.rossi" → ["marco", "rossi"]
 */
function parseLocalPartSegments(email: string): { first: string | null; second: string | null } {
  const localPart = email.split('@')[0] || '';
  // Split on common separators: dot, underscore, hyphen
  const parts = localPart.split(/[._-]/).filter(p => p.length > 0);
  return {
    first: parts[0] || null,
    second: parts[1] || null,
  };
}

/**
 * Normalize confidence to valid range
 */
function normalizeConfidence(confidence: number | undefined | null): number {
  if (typeof confidence !== 'number' || isNaN(confidence)) {
    return 0.5;
  }
  return Math.max(0, Math.min(1, confidence));
}

/**
 * Truncate a string to maximum length
 */
function truncateString(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength - 3) + '...';
}

/**
 * Classify extraction status based on confidence and completeness
 */
export function classifyExtractionStatus(
  result: LLMExtractionResult
): ExtractionStatus {
  // Service addresses get special status
  if (!result.isPersonal) {
    return 'not_applicable';
  }

  // Check confidence thresholds
  if (result.confidence >= HIGH_CONFIDENCE_THRESHOLD) {
    // High confidence also requires both names
    if (result.name1 && result.name2) {
      return 'extracted_high';
    }
    // Downgrade if names are missing
    return 'extracted_medium';
  }

  if (result.confidence >= MEDIUM_CONFIDENCE_THRESHOLD) {
    return 'extracted_medium';
  }

  return 'extracted_low';
}

/**
 * Batch validate multiple extraction results
 */
export function batchValidateResults(
  results: Partial<LLMExtractionResult>[]
): ExtractionValidationResult[] {
  return results.map(validateExtractionResult);
}

/**
 * Get extraction quality metrics for a batch
 */
export function getExtractionMetrics(
  results: LLMExtractionResult[]
): {
  total: number;
  highConfidence: number;
  mediumConfidence: number;
  lowConfidence: number;
  notApplicable: number;
  averageConfidence: number;
  withBothNames: number;
  withGenre: number;
} {
  const metrics = {
    total: results.length,
    highConfidence: 0,
    mediumConfidence: 0,
    lowConfidence: 0,
    notApplicable: 0,
    averageConfidence: 0,
    withBothNames: 0,
    withGenre: 0,
  };

  if (results.length === 0) return metrics;

  let totalConfidence = 0;

  for (const result of results) {
    totalConfidence += result.confidence;

    switch (result.extractionStatus) {
      case 'extracted_high':
        metrics.highConfidence++;
        break;
      case 'extracted_medium':
        metrics.mediumConfidence++;
        break;
      case 'extracted_low':
        metrics.lowConfidence++;
        break;
      case 'not_applicable':
        metrics.notApplicable++;
        break;
    }

    if (result.name1 && result.name2) {
      metrics.withBothNames++;
    }

    if (result.genre) {
      metrics.withGenre++;
    }
  }

  metrics.averageConfidence = totalConfidence / results.length;

  return metrics;
}
