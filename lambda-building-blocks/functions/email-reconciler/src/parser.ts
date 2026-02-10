/**
 * RFC 5322 Compliant Email Parser
 * Parses email recipient strings and extracts structured data
 *
 * Enhanced with LLM-optimized preprocessing for Phase 1 extraction pipeline
 */

import { ParsedRecipient, PreprocessedInput } from './types';
import { fullyDecodeMime, cleanDecodedText } from './mime-decoder';

// Common honorific titles (international)
const TITLES = new Set([
  // English
  'mr', 'mr.', 'mrs', 'mrs.', 'ms', 'ms.', 'miss', 'dr', 'dr.', 'prof', 'prof.',
  // German
  'herr', 'frau', 'dr.', 'dipl.-ing.', 'dipl.ing.', 'ing.',
  // Italian
  'sig', 'sig.', 'signor', 'signore', 'sig.ra', 'sigra', 'signora',
  'dott', 'dott.', 'dottore', 'dott.ssa', 'dottoressa',
  'ing', 'ing.', 'ingegnere', 'avv', 'avv.', 'avvocato',
  'rag', 'rag.', 'ragioniere', 'geom', 'geom.', 'geometra',
  'arch', 'arch.', 'architetto',
  // French
  'm', 'm.', 'mme', 'mme.', 'mlle', 'mlle.',
  // Spanish
  'sr', 'sr.', 'sra', 'sra.', 'srta', 'srta.',
]);

// Company indicators
const COMPANY_INDICATORS = [
  // English
  'ltd', 'ltd.', 'limited', 'llc', 'l.l.c.', 'inc', 'inc.', 'incorporated',
  'corp', 'corp.', 'corporation', 'co', 'co.', 'company',
  'plc', 'p.l.c.', 'lp', 'l.p.',
  // German
  'gmbh', 'g.m.b.h.', 'ag', 'a.g.', 'kg', 'k.g.', 'ohg', 'o.h.g.',
  'e.k.', 'ek', 'gbr', 'g.b.r.',
  // Italian
  's.r.l.', 'srl', 's.r.l', 's.p.a.', 'spa', 's.p.a', 's.a.s.', 'sas',
  's.n.c.', 'snc', 's.s.', 'ss',
  // French
  'sarl', 's.a.r.l.', 'sa', 's.a.', 'sas', 's.a.s.', 'sci', 's.c.i.',
  // Dutch
  'b.v.', 'bv', 'n.v.', 'nv',
  // Other
  'pty', 'pty.', 'pvt', 'pvt.',
];

// Service/generic email prefixes
const SERVICE_PREFIXES = new Set([
  'info', 'sales', 'support', 'help', 'contact', 'admin', 'administrator',
  'webmaster', 'postmaster', 'hostmaster', 'abuse', 'noreply', 'no-reply',
  'donotreply', 'do-not-reply', 'mailer-daemon', 'mailerdaemon',
  'newsletter', 'marketing', 'billing', 'accounts', 'finance', 'hr',
  'jobs', 'careers', 'press', 'media', 'legal', 'compliance',
  'security', 'privacy', 'feedback', 'enquiries', 'inquiries',
  'orders', 'shipping', 'returns', 'refunds', 'subscriptions',
  'notifications', 'alerts', 'updates', 'news',
  'office', 'reception', 'general', 'main', 'team', 'hello', 'hi',
  'vendite', 'amministrazione', 'contatti', 'segreteria', 'ufficio',
  'vertrieb', 'verwaltung', 'kontakt', 'zentrale', 'buchhaltung',
  'acquisti', 'commerciale', 'tecnico', 'qualita', 'logistica',
  'export', 'import', 'direzione', 'preventivi', 'ordini',
]);

// Company suffixes to remove from display names (international)
const COMPANY_SUFFIXES = [
  // Italian
  's.r.l.', 'srl', 's.r.l', 's.p.a.', 'spa', 's.p.a', 's.a.s.', 'sas',
  's.n.c.', 'snc', 's.s.', 'ss', 'società', 'azienda',
  // German
  'gmbh', 'g.m.b.h.', 'ag', 'a.g.', 'kg', 'k.g.', 'ohg', 'o.h.g.',
  'e.k.', 'ek', 'gbr', 'g.b.r.', 'ug',
  // English
  'ltd', 'ltd.', 'limited', 'llc', 'l.l.c.', 'inc', 'inc.', 'incorporated',
  'corp', 'corp.', 'corporation', 'co', 'co.', 'company', 'plc', 'p.l.c.',
  'lp', 'l.p.',
  // French
  'sarl', 's.a.r.l.', 'sa', 's.a.', 'sas', 's.a.s.', 'sci', 's.c.i.',
  'eurl', 'e.u.r.l.',
  // Dutch
  'b.v.', 'bv', 'n.v.', 'nv',
  // Other
  'pty', 'pty.', 'pvt', 'pvt.', 'group', 'holding', 'international',
];

/**
 * Parse a raw email recipient string into structured data
 */
export function parseRecipient(input: string): ParsedRecipient {
  // Initialize result
  const result: ParsedRecipient = {
    rawInput: input,
    email: '',
    localPart: '',
    domain: '',
    displayName: null,
    givenName: null,
    surname: null,
    title: null,
    companyName: null,
    isPersonal: true,
    confidence: 0,
  };

  if (!input || typeof input !== 'string') {
    return result;
  }

  // Step 1: Decode MIME encoded text
  let decoded = fullyDecodeMime(input);
  decoded = cleanDecodedText(decoded);

  // Step 2: Sanitize input
  decoded = sanitizeInput(decoded);

  // Step 3: Extract email address and display name
  const { email, displayName } = extractEmailAndDisplayName(decoded);

  if (!email) {
    result.confidence = 0;
    return result;
  }

  // Step 4: Normalize email
  const normalizedEmail = email.toLowerCase().trim();
  const [localPart, domain] = normalizedEmail.split('@');

  result.email = normalizedEmail;
  result.localPart = localPart || '';
  result.domain = domain || '';

  // Step 5: Check if service/generic address
  result.isPersonal = !SERVICE_PREFIXES.has(localPart);

  // Step 6: Process display name
  if (displayName) {
    result.displayName = displayName;

    // Check if display name looks like a company
    const companyName = extractCompanyName(displayName);
    if (companyName) {
      result.companyName = companyName;
      result.isPersonal = false;
    } else {
      // Try to extract person name
      const { title, givenName, surname } = extractPersonName(displayName);
      result.title = title;
      result.givenName = givenName;
      result.surname = surname;
    }
  }

  // Step 7: If no name from display, try local part
  if (!result.givenName && !result.surname && result.isPersonal) {
    const nameFromLocal = extractNameFromLocalPart(localPart);
    if (nameFromLocal) {
      result.givenName = nameFromLocal.givenName;
      result.surname = nameFromLocal.surname;
    }
  }

  // Step 8: Calculate confidence
  result.confidence = calculateConfidence(result);

  return result;
}

/**
 * Sanitize raw input by removing problematic characters
 */
function sanitizeInput(input: string): string {
  return input
    // Remove leading special characters
    .replace(/^[\t\-'*+\s]+/, '')
    // Remove trailing special characters
    .replace(/[\t\-'*+\s]+$/, '')
    // Normalize whitespace
    .replace(/\s+/g, ' ')
    // Remove null characters
    .replace(/\x00/g, '')
    .trim();
}

/**
 * Extract email address and display name from input
 * Handles formats: "Name" <email>, Name <email>, <email>, email
 */
function extractEmailAndDisplayName(input: string): { email: string; displayName: string | null } {
  let email = '';
  let displayName: string | null = null;

  // Pattern 1: "Display Name" <email@domain.com>
  // Pattern 2: Display Name <email@domain.com>
  const angleMatch = input.match(/^(.+?)\s*<([^>]+)>\s*$/);
  if (angleMatch) {
    displayName = angleMatch[1].trim();
    email = angleMatch[2].trim();

    // Remove surrounding quotes from display name
    displayName = displayName.replace(/^["']|["']$/g, '').trim();

    // Handle empty display name
    if (!displayName) {
      displayName = null;
    }
  } else {
    // Pattern 3: <email@domain.com>
    const bracketMatch = input.match(/^<([^>]+)>$/);
    if (bracketMatch) {
      email = bracketMatch[1].trim();
    } else {
      // Pattern 4: email@domain.com (plain email)
      // Check if it looks like an email address
      const emailMatch = input.match(/[\w.+-]+@[\w.-]+\.\w+/);
      if (emailMatch) {
        email = emailMatch[0];

        // If there's text before/after the email, it might be the display name
        const beforeEmail = input.slice(0, input.indexOf(email)).trim();
        const afterEmail = input.slice(input.indexOf(email) + email.length).trim();

        if (beforeEmail && !afterEmail) {
          displayName = beforeEmail.replace(/^["']|["']$/g, '').trim();
        } else if (afterEmail && !beforeEmail) {
          displayName = afterEmail.replace(/^["']|["']$/g, '').trim();
        }
      } else {
        // No valid email found, treat entire input as potential email
        email = input.trim();
      }
    }
  }

  // Validate email format
  if (email && !isValidEmail(email)) {
    // Try to extract email from malformed input
    const extracted = email.match(/[\w.+-]+@[\w.-]+\.\w+/);
    if (extracted) {
      email = extracted[0];
    } else {
      email = '';
    }
  }

  return { email, displayName };
}

/**
 * Basic email validation
 */
function isValidEmail(email: string): boolean {
  // Simplified RFC 5322 compliant regex
  const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
  return emailRegex.test(email);
}

/**
 * Check if display name looks like a company and extract it
 */
function extractCompanyName(displayName: string): string | null {
  const lower = displayName.toLowerCase();

  // Check for company indicators using word boundaries
  // This prevents matching substrings like "rossi" containing "ss"
  for (const indicator of COMPANY_INDICATORS) {
    // Escape regex special characters in indicator
    const escaped = indicator.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    // Match indicator as a complete word or at the end of a word
    const regex = new RegExp(`(?:^|\\s|\\b)${escaped}(?:\\s|$|\\b)`, 'i');
    if (regex.test(lower)) {
      return displayName;
    }
  }

  // Check for all caps (common for company names)
  if (displayName === displayName.toUpperCase() && displayName.length > 3) {
    // But not if it looks like a person name (e.g., "JOHN SMITH")
    const words = displayName.split(/\s+/);
    if (words.length <= 2 && words.every(w => w.length <= 15)) {
      return null; // Likely a person name in caps
    }
    return displayName;
  }

  return null;
}

/**
 * Extract title, given name, and surname from a person name
 */
function extractPersonName(displayName: string): {
  title: string | null;
  givenName: string | null;
  surname: string | null;
} {
  let title: string | null = null;
  let givenName: string | null = null;
  let surname: string | null = null;

  // Remove company suffixes if present after a dash
  let cleanName = displayName.replace(/\s*[-–—]\s*.*$/, '').trim();

  // Handle "Lastname, Firstname" format first (before title extraction)
  const commaIndex = cleanName.indexOf(',');
  if (commaIndex > 0) {
    const parts = cleanName.split(',').map(p => p.trim());
    if (parts.length === 2) {
      // Check if first part has a title
      const surnameWords = parts[0].split(/\s+/);
      if (surnameWords.length > 1) {
        const firstWordLower = surnameWords[0].toLowerCase().replace(/[.,]$/, '');
        if (TITLES.has(firstWordLower)) {
          title = surnameWords[0];
          surname = surnameWords.slice(1).join(' ');
        } else {
          surname = parts[0];
        }
      } else {
        surname = parts[0];
      }

      // Check if second part (given name) has a title
      const givenWords = parts[1].split(/\s+/);
      if (givenWords.length > 0) {
        const givenFirstLower = givenWords[0].toLowerCase().replace(/[.,]$/, '');
        if (TITLES.has(givenFirstLower)) {
          if (!title) title = givenWords[0];
          givenName = givenWords.slice(1).join(' ') || null;
        } else {
          givenName = parts[1];
        }
      }

      // Capitalize properly
      if (givenName) givenName = capitalizeProper(givenName);
      if (surname) surname = capitalizeProper(surname);

      return { title, givenName, surname };
    }
  }

  // Split into words
  const words = cleanName.split(/\s+/).filter(w => w.length > 0);

  if (words.length === 0) {
    return { title, givenName, surname };
  }

  // Check first word(s) for title(s)
  while (words.length > 0) {
    const firstWordLower = words[0].toLowerCase().replace(/[.,]$/, '');
    if (TITLES.has(firstWordLower)) {
      // Append to title (handle "Herr Dr." style)
      title = title ? `${title} ${words[0]}` : words[0];
      words.shift();
    } else {
      break;
    }
  }

  if (words.length === 0) {
    return { title, givenName, surname };
  }

  // Standard "Firstname Lastname" or "Firstname Middle Lastname"
  if (words.length === 1) {
    // Single name - could be either
    givenName = words[0];
  } else if (words.length === 2) {
    givenName = words[0];
    surname = words[1];
  } else {
    // Multiple words - first is given, last is surname, rest are middle
    givenName = words[0];
    surname = words[words.length - 1];
  }

  // Capitalize properly
  if (givenName) givenName = capitalizeProper(givenName);
  if (surname) surname = capitalizeProper(surname);

  return { title, givenName, surname };
}

/**
 * Extract name from email local part (e.g., john.smith -> John Smith)
 */
function extractNameFromLocalPart(localPart: string): { givenName: string | null; surname: string | null } | null {
  // Common patterns:
  // firstname.lastname
  // firstname_lastname
  // f.lastname
  // flastname (harder to detect)

  // Pattern 1: f.lastname (single letter + . + lastname) - check first to avoid matching as firstname.lastname
  const initialMatch = localPart.match(/^([a-zA-Z])[._]([a-zA-Z]{2,})$/);
  if (initialMatch) {
    const [, initial, last] = initialMatch;
    return {
      givenName: initial.toUpperCase() + '.',
      surname: capitalizeProper(last),
    };
  }

  // Pattern 2: firstname.lastname or firstname_lastname (requires 2+ chars for first name)
  const dotMatch = localPart.match(/^([a-zA-Z]{2,})[._]([a-zA-Z]+)$/);
  if (dotMatch) {
    const [, first, last] = dotMatch;
    return {
      givenName: capitalizeProper(first),
      surname: capitalizeProper(last),
    };
  }

  // Pattern 3: firstnamelastname with capital in middle (e.g., johnSmith)
  const camelMatch = localPart.match(/^([a-z]+)([A-Z][a-z]+)$/);
  if (camelMatch) {
    const [, first, last] = camelMatch;
    return {
      givenName: capitalizeProper(first),
      surname: capitalizeProper(last),
    };
  }

  return null;
}

// Lowercase particles that should NOT be capitalized
const NAME_PARTICLES = new Set([
  'van', 'von', 'de', 'del', 'della', 'delle', 'dei', 'degli',
  'di', 'da', 'dal', 'dalla', 'das', 'do', 'dos',
  'la', 'le', 'les', 'el', 'al', 'den', 'der', 'het',
  'ten', 'ter', 'du', 'des', 'e',
]);

// Mac-prefix false positives (should NOT get MacX treatment)
const MAC_EXCEPTIONS = new Set(['mace', 'mack', 'maceo', 'macro']);

/**
 * Capitalize a name properly
 *
 * Handles: basic, all-caps, apostrophes (O'Brien), Mc prefix (McDonald),
 * Mac prefix (MacGregor, 5+ chars), particles (van, di, etc.), initials (M.)
 */
export function capitalizeProper(name: string): string {
  if (!name) return name;

  // Handle multi-word names (e.g., "van der Berg")
  const words = name.split(/\s+/);
  if (words.length > 1) {
    return words
      .map((word, i) => {
        const lower = word.toLowerCase();
        // Particles stay lowercase (unless they are the very last word)
        if (NAME_PARTICLES.has(lower) && i < words.length - 1) {
          return lower;
        }
        return capitalizeSingleName(word);
      })
      .join(' ');
  }

  return capitalizeSingleName(name);
}

/**
 * Capitalize a single name token (no spaces)
 */
function capitalizeSingleName(name: string): string {
  if (!name) return name;

  // Preserve initials like "M." or single-char "M"
  if (/^[A-Za-z]\.$/.test(name) || (name.length === 1 && /^[A-Za-z]$/.test(name))) {
    return name.toUpperCase();
  }

  // Handle hyphenated names: capitalize each part
  if (name.includes('-')) {
    return name.split('-').map(part => capitalizeSingleName(part)).join('-');
  }

  const lower = name.toLowerCase();

  // Handle apostrophe names: O'Brien, D'Angelo
  const apostropheMatch = lower.match(/^([a-z])'([a-z].*)$/);
  if (apostropheMatch) {
    return apostropheMatch[1].toUpperCase() + "'" +
      apostropheMatch[2].charAt(0).toUpperCase() + apostropheMatch[2].slice(1);
  }

  // Handle Mc prefix: McDonald, McCarthy (Mc + 1 more char minimum)
  if (lower.startsWith('mc') && lower.length >= 3) {
    return 'Mc' + lower.charAt(2).toUpperCase() + lower.slice(3);
  }

  // Handle Mac prefix: MacGregor, MacKenzie (Mac + 2 more chars minimum, total 5+)
  // Exclude false positives: mace, mack, maceo, macro
  if (lower.startsWith('mac') && lower.length >= 5 && !MAC_EXCEPTIONS.has(lower)) {
    return 'Mac' + lower.charAt(3).toUpperCase() + lower.slice(4);
  }

  // Default: capitalize first letter, lowercase rest
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

/**
 * Calculate parsing confidence based on extracted data quality
 */
function calculateConfidence(result: ParsedRecipient): number {
  let score = 0;

  // Valid email is the base requirement
  if (result.email && result.domain) {
    score += 0.3;
  } else {
    return 0;
  }

  // Has display name
  if (result.displayName) {
    score += 0.2;
  }

  // Has structured name (given + surname)
  if (result.givenName && result.surname) {
    score += 0.3;
  } else if (result.givenName || result.surname) {
    score += 0.1;
  }

  // Is a personal address (not generic)
  if (result.isPersonal) {
    score += 0.1;
  }

  // Has title (additional structure)
  if (result.title) {
    score += 0.1;
  }

  return Math.min(score, 1);
}

/**
 * Parse multiple recipients (comma or semicolon separated)
 */
export function parseRecipients(input: string): ParsedRecipient[] {
  if (!input) {
    return [];
  }

  // Split by comma or semicolon, but not within angle brackets or quotes
  const recipients: string[] = [];
  let current = '';
  let inBrackets = false;
  let inQuotes = false;
  let quoteChar = '';

  for (const char of input) {
    if ((char === '"' || char === "'") && !inBrackets) {
      if (!inQuotes) {
        inQuotes = true;
        quoteChar = char;
      } else if (char === quoteChar) {
        inQuotes = false;
        quoteChar = '';
      }
      current += char;
    } else if (char === '<' && !inQuotes) {
      inBrackets = true;
      current += char;
    } else if (char === '>' && !inQuotes) {
      inBrackets = false;
      current += char;
    } else if ((char === ',' || char === ';') && !inBrackets && !inQuotes) {
      if (current.trim()) {
        recipients.push(current.trim());
      }
      current = '';
    } else {
      current += char;
    }
  }

  // Don't forget the last one
  if (current.trim()) {
    recipients.push(current.trim());
  }

  return recipients.map(parseRecipient);
}

/**
 * Determine if two parsed recipients likely refer to the same person
 */
export function areSamePerson(a: ParsedRecipient, b: ParsedRecipient): boolean {
  // Same email is definitive
  if (a.email && a.email === b.email) {
    return true;
  }

  // Same domain + same name
  if (a.domain === b.domain) {
    if (a.givenName && a.surname && b.givenName && b.surname) {
      const aName = `${a.givenName} ${a.surname}`.toLowerCase();
      const bName = `${b.givenName} ${b.surname}`.toLowerCase();
      if (aName === bName) {
        return true;
      }
    }
  }

  return false;
}

// ============================================================================
// LLM Preprocessing Functions
// ============================================================================

/**
 * Preprocess a raw email recipient string for LLM extraction
 * Returns clean, structured input optimized for LLM consumption
 */
export function preprocessForLLM(
  input: string,
  domainConvention?: string
): PreprocessedInput {
  const result: PreprocessedInput = {
    rawInput: input,
    cleanedEmail: '',
    cleanedDisplay: null,
    domain: '',
    domainConvention: domainConvention || null,
    localPart: '',
  };

  if (!input || typeof input !== 'string') {
    return result;
  }

  // Step 1: Full MIME decoding
  let decoded = fullyDecodeMime(input);
  decoded = cleanDecodedText(decoded);

  // Step 2: Enhanced sanitization
  decoded = enhancedSanitize(decoded);

  // Step 3: Extract email and display name
  const { email, displayName } = extractEmailAndDisplayName(decoded);

  if (!email) {
    return result;
  }

  // Step 4: Validate and normalize email
  const normalizedEmail = email.toLowerCase().trim();
  const atIndex = normalizedEmail.indexOf('@');
  if (atIndex === -1 || atIndex === 0 || atIndex === normalizedEmail.length - 1) {
    return result;
  }

  const localPart = normalizedEmail.slice(0, atIndex);
  const domain = normalizedEmail.slice(atIndex + 1);

  // Validate domain has at least one dot
  if (!domain.includes('.')) {
    return result;
  }

  result.cleanedEmail = normalizedEmail;
  result.localPart = localPart;
  result.domain = domain;

  // Step 5: Clean display name for LLM
  if (displayName) {
    result.cleanedDisplay = cleanDisplayNameForLLM(displayName);
  }

  return result;
}

/**
 * Enhanced input sanitization for preprocessing
 */
function enhancedSanitize(input: string): string {
  return input
    // Remove control characters
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    // Remove leading garbage characters
    .replace(/^[\t\-'*+\s"'`=:;,./\\|<>[\]{}()#@!$%^&~]+/, '')
    // Remove trailing garbage characters
    .replace(/[\t\-'*+\s"'`=:;,./\\|[\]{}()#@!$%^&~]+$/, '')
    // Normalize whitespace
    .replace(/\s+/g, ' ')
    // Remove MIME encoding artifacts that didn't decode
    .replace(/=\?[^?]*\?[BbQq]\?[^?]*\?=/g, '')
    // Remove orphaned angle brackets
    .replace(/^>+\s*/, '')
    .replace(/\s*<+$/, '')
    .trim();
}

/**
 * Clean display name specifically for LLM consumption
 * Removes company suffixes and normalizes format
 */
function cleanDisplayNameForLLM(displayName: string): string | null {
  let cleaned = displayName.trim();

  if (!cleaned) {
    return null;
  }

  // Remove surrounding quotes
  cleaned = cleaned.replace(/^["']+|["']+$/g, '').trim();

  // Check if it looks like an email address (garbage in display name)
  if (cleaned.includes('@') && /^[^<>]+@[^<>]+\.[^<>]+$/.test(cleaned)) {
    return null; // Display name is actually an email, ignore it
  }

  // Remove company suffixes after dash/hyphen
  cleaned = cleaned.replace(/\s*[-–—]\s+[\w\s.&]+(?:s\.?r\.?l\.?|s\.?p\.?a\.?|gmbh|ltd|llc|inc|corp|ag|spa|srl)\.?\s*$/i, '');

  // Remove standalone company suffixes
  for (const suffix of COMPANY_SUFFIXES) {
    const regex = new RegExp(`\\s*\\b${suffix.replace(/\./g, '\\.?')}\\s*$`, 'i');
    cleaned = cleaned.replace(regex, '');
  }

  // Clean up residual artifacts
  cleaned = cleaned
    .replace(/\s*[-–—]\s*$/, '') // Trailing dashes
    .replace(/\s*[,;:]\s*$/, '') // Trailing punctuation
    .replace(/\s+/g, ' ')
    .trim();

  // Final validation: must have at least 2 characters and no @ symbol
  if (cleaned.length < 2 || cleaned.includes('@')) {
    return null;
  }

  return cleaned || null;
}

/**
 * Check if an email is a service/generic address
 */
export function isServiceAddress(email: string): boolean {
  if (!email) return false;

  const localPart = email.split('@')[0]?.toLowerCase();
  if (!localPart) return false;

  return SERVICE_PREFIXES.has(localPart);
}

/**
 * Extract the likely email convention from a local part
 * Returns hints about how names map to the local part
 */
export function detectLocalPartPattern(localPart: string): {
  pattern: string | null;
  givenHint: string | null;
  surnameHint: string | null;
} {
  const result = {
    pattern: null as string | null,
    givenHint: null as string | null,
    surnameHint: null as string | null,
  };

  if (!localPart || localPart.length < 2) {
    return result;
  }

  // Pattern: firstname.lastname or firstname_lastname
  const dotMatch = localPart.match(/^([a-zA-Z]{2,})[._]([a-zA-Z]{2,})$/);
  if (dotMatch) {
    result.pattern = 'firstname.lastname';
    result.givenHint = capitalizeProper(dotMatch[1]);
    result.surnameHint = capitalizeProper(dotMatch[2]);
    return result;
  }

  // Pattern: f.lastname (initial + last)
  const initialMatch = localPart.match(/^([a-zA-Z])[._]([a-zA-Z]{2,})$/);
  if (initialMatch) {
    result.pattern = 'f.lastname';
    result.givenHint = initialMatch[1].toUpperCase();
    result.surnameHint = capitalizeProper(initialMatch[2]);
    return result;
  }

  // Pattern: lastname.firstname
  const reversedMatch = localPart.match(/^([a-zA-Z]{2,})[._]([a-zA-Z]{2,})$/);
  // This is ambiguous - we'll let the LLM figure it out based on cultural context

  // Pattern: flastname (camelCase)
  const camelMatch = localPart.match(/^([a-z])([A-Z][a-z]+)$/);
  if (camelMatch) {
    result.pattern = 'flastname';
    result.givenHint = camelMatch[1].toUpperCase();
    result.surnameHint = camelMatch[2];
    return result;
  }

  return result;
}

/**
 * Map honorific titles to genre (Mr./Ms.)
 */
export function mapTitleToGenre(title: string | null): 'Mr.' | 'Ms.' | null {
  if (!title) return null;

  const normalized = title.toLowerCase().replace(/[.,]$/g, '');

  // Male titles
  const maleTitles = new Set([
    'mr', 'herr', 'sig', 'signor', 'signore', 'sr', 'm',
    'dott', 'dottore', 'ing', 'ingegnere', 'avv', 'avvocato',
    'rag', 'ragioniere', 'geom', 'geometra', 'arch', 'architetto',
  ]);

  // Female titles
  const femaleTitles = new Set([
    'mrs', 'ms', 'miss', 'frau', 'sig.ra', 'sigra', 'signora',
    'sra', 'srta', 'mme', 'mlle',
    'dott.ssa', 'dottoressa',
  ]);

  if (maleTitles.has(normalized)) {
    return 'Mr.';
  }

  if (femaleTitles.has(normalized)) {
    return 'Ms.';
  }

  return null;
}

/**
 * Batch preprocess multiple inputs for efficient LLM processing
 */
export function batchPreprocessForLLM(
  inputs: string[],
  domainConventions?: Map<string, string>
): PreprocessedInput[] {
  return inputs.map(input => {
    // Quick parse to get domain
    const quickParsed = parseRecipient(input);
    const convention = domainConventions?.get(quickParsed.domain);
    return preprocessForLLM(input, convention);
  });
}
