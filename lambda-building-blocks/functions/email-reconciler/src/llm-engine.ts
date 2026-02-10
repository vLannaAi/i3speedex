/**
 * LLM Engine - Claude API Integration
 * Core AI functionality for parsing, matching, and domain analysis
 *
 * Phase 1: LLM-First Extraction Pipeline
 * - Optimized few-shot prompting with cultural examples
 * - Chain-of-thought reasoning for ambiguous cases
 * - Batch processing support
 */

import Anthropic from '@anthropic-ai/sdk';
import {
  ParsedRecipient,
  LLMParsedRecipient,
  UserRecord,
  DomainPattern,
  LLMMatchResponse,
  EmailConvention,
  PreprocessedInput,
  LLMExtractionResult,
  BatchExtractionResult,
} from './types';
import { logger } from './logger';
import { validateExtractionResult, classifyExtractionStatus } from './extraction-validator';

// Initialize Anthropic client
let anthropic: Anthropic | null = null;

function getClient(): Anthropic {
  if (!anthropic) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY environment variable is not set');
    }
    anthropic = new Anthropic({ apiKey });
  }
  return anthropic;
}

// Model configuration
const MODEL = 'claude-sonnet-4-20250514';
const MAX_TOKENS = 1024;

// Type definitions for LLM responses
interface LLMParseResponse {
  email?: string;
  given_name?: string;
  surname?: string;
  title?: string;
  company_name?: string;
  is_personal?: boolean;
  confidence?: number;
  reasoning?: string;
}

// LLM extraction response (Phase 1 optimized)
interface LLMExtractionResponse {
  name1?: string | null;       // Given name + middle names
  name2?: string | null;       // Family/surname
  genre?: 'Mr.' | 'Ms.' | null;
  email?: string;
  is_personal?: boolean;
  confidence?: number;
  reasoning?: string;
  chain_of_thought?: string;   // Extended reasoning for ambiguous cases
}

interface LLMMatchResponseData {
  best_match_id?: number | null;
  confidence?: number;
  reasoning?: string;
  alternative_matches?: Array<{
    user_id: number;
    confidence: number;
    reasoning: string;
  }>;
}

interface LLMDomainPatternResponse {
  convention?: string;
  confidence?: number;
  reasoning?: string;
}

interface LLMDuplicateResponse {
  is_duplicate?: boolean;
  confidence?: number;
  reasoning?: string;
}

/**
 * Extract JSON from LLM response text
 * Handles cases where the response includes markdown code blocks
 */
function extractJson<T = Record<string, unknown>>(text: string): T {
  // Try to find JSON in markdown code blocks
  const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlockMatch) {
    return JSON.parse(codeBlockMatch[1].trim()) as T;
  }

  // Try to find JSON object directly
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    return JSON.parse(jsonMatch[0]) as T;
  }

  throw new Error('No JSON found in response');
}

// ============================================================================
// Prompts
// ============================================================================

const PARSE_PROMPT = `You are an email recipient parser. Given a raw email recipient string, extract structured information.

Consider:
- RFC 5322 format: "Display Name" <email@domain.com>
- MIME encoded headers: =?UTF-8?Q?...?= or =?UTF-8?B?...?=
- Cultural name variations (Asian: surname first, Western: given first)
- Company indicators: S.R.L., GmbH, Ltd, SpA, Inc, AG, S.p.A., S.a.s.
- Service addresses: info@, sales@, support@, noreply@
- Italian honorifics: Sig., Sig.ra, Dott., Dott.ssa, Ing.
- German honorifics: Herr, Frau, Dr.

Input: {input}

{domainHint}

Return ONLY a JSON object with these fields:
{
  "email": "normalized email address (lowercase)",
  "given_name": "first name or null",
  "surname": "family/last name or null",
  "title": "honorific (Mr., Ms., Dr., Sig., etc.) or null",
  "company_name": "company name if present, null otherwise",
  "is_personal": true/false (true if person, false if generic/company address),
  "confidence": 0.0-1.0 (how confident you are),
  "reasoning": "brief explanation of your parsing decisions"
}`;

const MATCH_PROMPT = `You are an email matching expert. Given a parsed email recipient and a list of candidate users, determine the best match.

Consider:
- Email exact match (highest priority)
- Secondary email (email2) match
- Domain + name similarity
- Known domain email conventions (firstname.lastname, f.lastname, etc.)
- Company code matching
- Multiple people may share similar names at the same company

Parsed recipient:
{parsed}

Candidate users:
{candidates}

{domainPattern}

Return ONLY a JSON object:
{
  "best_match_id": user_id or null if no good match,
  "confidence": 0.0-1.0,
  "reasoning": "explanation of your decision",
  "alternative_matches": [
    { "user_id": id, "confidence": 0.0-1.0, "reasoning": "why this could also match" }
  ]
}`;

const DOMAIN_PATTERN_PROMPT = `You are an email pattern analyst. Analyze the email addresses from this domain to determine the naming convention used.

Domain: {domain}
Sample emails from users at this domain:
{emails}

Common patterns:
- firstname.lastname (e.g., john.smith@example.com)
- f.lastname (e.g., j.smith@example.com)
- flastname (e.g., jsmith@example.com)
- firstname (e.g., john@example.com)
- lastname.firstname (e.g., smith.john@example.com)

Return ONLY a JSON object:
{
  "convention": "one of: firstname.lastname, f.lastname, flastname, firstname, lastname.firstname, unknown",
  "confidence": 0.0-1.0,
  "reasoning": "explanation of the pattern you detected",
  "example_breakdown": "show how 2-3 emails match the pattern"
}`;

// ============================================================================
// Phase 1: LLM-First Extraction Prompts
// ============================================================================

const EXTRACTION_PROMPT = `You are an expert at parsing email recipient strings to extract person information.

TASK: Extract structured name data from the provided email recipient.

OUTPUT FORMAT (JSON only):
{
  "name1": "given name + middle names (or null)",
  "name2": "family/surname (or null)",
  "genre": "Mr." | "Ms." | null,
  "is_personal": true | false,
  "confidence": 0.0-1.0,
  "reasoning": "brief explanation"
}

RULES:
1. name1 = given/first name(s), name2 = family/last name
2. For Asian names (Chinese, Korean, Japanese, Vietnamese): surname often comes FIRST
   - "Wang Li" → name1: "Li", name2: "Wang"
   - "Kim Minji" → name1: "Minji", name2: "Kim"
3. Titles map to genre:
   - Mr/Herr/Sig/Signor/Sr/M → "Mr."
   - Mrs/Ms/Miss/Frau/Sig.ra/Signora/Sra/Mme/Mlle → "Ms."
   - Dr/Dott/Dott.ssa/Prof/Ing → keep as-is but infer gender if possible
3b. When NO explicit title is present, infer genre from culturally gendered first names:
    - Clearly male (Marco, Hans, Giovanni, Alessandro, Klaus, Pierre) → "Mr."
    - Clearly female (Maria, Sarah, Giulia, Anna, Claudia, Marie) → "Ms."
    - Ambiguous or unfamiliar → null (do NOT guess)
4. Service addresses (info@, sales@, support@, noreply@, admin@, etc.): is_personal = false
5. If email only (no display name): extract from local part if follows firstname.lastname pattern
6. NEVER put email addresses in name1 or name2 fields
7. If you cannot confidently extract names, return null for name1/name2

EXAMPLES:

Example 1 - Italian formal:
Input: "Sig. Marco Rossi" <m.rossi@company.it>
Output: {"name1": "Marco", "name2": "Rossi", "genre": "Mr.", "is_personal": true, "confidence": 0.95, "reasoning": "Italian honorific Sig. indicates male, clear first/last name structure"}

Example 2 - German formal:
Input: "Herr Hans Müller" <h.mueller@firma.de>
Output: {"name1": "Hans", "name2": "Müller", "genre": "Mr.", "is_personal": true, "confidence": 0.95, "reasoning": "German Herr = Mr., firstname lastname order"}

Example 3 - English with hyphenated surname:
Input: "Dr. Sarah O'Brien-Smith" <sarah.obriensmith@corp.com>
Output: {"name1": "Sarah", "name2": "O'Brien-Smith", "genre": "Ms.", "is_personal": true, "confidence": 0.90, "reasoning": "Dr. with Sarah suggests female, hyphenated surname preserved"}

Example 4 - Asian name (Chinese):
Input: "Wang Li" <wang.li@company.cn>
Output: {"name1": "Li", "name2": "Wang", "genre": null, "is_personal": true, "confidence": 0.85, "reasoning": "Chinese name order: surname Wang first, given name Li second"}

Example 5 - No display name:
Input: <firstname.lastname@domain.com>
Output: {"name1": "Firstname", "name2": "Lastname", "genre": null, "is_personal": true, "confidence": 0.75, "reasoning": "Extracted from email local part pattern firstname.lastname"}

Example 6 - Company mixed in display:
Input: "Mario Bianchi - Acme S.R.L." <m.bianchi@acme.it>
Output: {"name1": "Mario", "name2": "Bianchi", "genre": null, "is_personal": true, "confidence": 0.90, "reasoning": "Company suffix S.R.L. after dash ignored, extracted person name"}

Example 7 - Malformed with garbage:
Input: john@old.com <john.new@domain.com>
Output: {"name1": "John", "name2": "New", "genre": null, "is_personal": true, "confidence": 0.70, "reasoning": "Ignored malformed display part (email), extracted from actual email local part"}

Example 8 - Genre inferred from first name (no title):
Input: "Marco Rossi" <m.rossi@company.it>
Output: {"name1": "Marco", "name2": "Rossi", "genre": "Mr.", "is_personal": true, "confidence": 0.90, "reasoning": "No title present; Marco is a clearly male Italian name, genre inferred"}

Example 9 - Ambiguous name, no genre guess:
Input: "Andrea Bianchi" <a.bianchi@company.it>
Output: {"name1": "Andrea", "name2": "Bianchi", "genre": null, "is_personal": true, "confidence": 0.85, "reasoning": "Andrea is gender-ambiguous in Italian, no genre assigned"}

INPUT:
Email: {email}
Display Name: {display}
Domain: {domain}
{domain_hint}`;

const EXTRACTION_COT_PROMPT = `You are an expert at parsing email recipient strings. This case requires careful analysis.

For ambiguous cases, follow this chain-of-thought process:

Step 1: What language/culture does this name likely originate from?
- Consider the domain TLD (.it, .de, .cn, .jp, .kr, etc.)
- Consider the name patterns and characters

Step 2: In that culture, what is the typical name order?
- Western (most European, American): Given name first, surname last
- East Asian (Chinese, Korean, Japanese, Vietnamese): Surname first, given name last
- Some Asian names in Western contexts may be reversed

Step 3: Are there honorifics or titles? What gender do they indicate?
- Mr/Herr/Sig/Signor/Sr/M → Male
- Mrs/Ms/Miss/Frau/Sig.ra/Signora/Sra/Mme/Mlle → Female
- Dr/Dott/Prof/Ing → Check name for gender cues
- If NO title is present, infer genre from culturally gendered first names:
  - Clearly male (Marco, Hans, Giovanni, Alessandro, Klaus, Pierre) → "Mr."
  - Clearly female (Maria, Sarah, Giulia, Anna, Claudia, Marie) → "Ms."
  - Ambiguous or unfamiliar → null (do NOT guess)

Step 4: Is this a person or a service/company address?
- info@, sales@, support@, admin@ → Service address
- Company names in display → May still have person's name

Step 5: Extract with cultural context applied.

INPUT:
Email: {email}
Display Name: {display}
Domain: {domain}
{domain_hint}

Think through this step by step, then provide your answer as JSON:
{
  "chain_of_thought": "your step-by-step analysis",
  "name1": "given name(s) or null",
  "name2": "surname or null",
  "genre": "Mr." | "Ms." | null,
  "is_personal": true | false,
  "confidence": 0.0-1.0,
  "reasoning": "brief summary"
}`;

// ============================================================================
// LLM Functions
// ============================================================================

/**
 * Parse a raw email input using LLM
 */
export async function llmParseRecipient(
  input: string,
  domainPattern?: DomainPattern
): Promise<LLMParsedRecipient> {
  const client = getClient();

  let domainHint = '';
  if (domainPattern && !domainPattern.isSharedDomain) {
    domainHint = `Domain convention hint: ${domainPattern.domain} typically uses ${domainPattern.convention} format (confidence: ${domainPattern.confidence})`;
  }

  const prompt = PARSE_PROMPT
    .replace('{input}', input)
    .replace('{domainHint}', domainHint);

  try {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    });

    const content = response.content[0];
    if (content.type !== 'text') {
      throw new Error('Unexpected response type');
    }

    const parsed = extractJson<LLMParseResponse>(content.text);
    const email = parsed.email?.toLowerCase() || '';
    const [localPart = '', domain = ''] = email.split('@');

    return {
      rawInput: input,
      email,
      localPart,
      domain,
      displayName: null, // Not directly extracted by LLM
      givenName: parsed.given_name || null,
      surname: parsed.surname || null,
      title: parsed.title || null,
      companyName: parsed.company_name || null,
      isPersonal: parsed.is_personal !== false,
      confidence: parsed.confidence || 0.5,
      llmConfidence: parsed.confidence || 0.5,
      llmReasoning: parsed.reasoning || '',
    };
  } catch (error) {
    logger.error('LLM parsing failed', {
      input,
      error: String(error),
    });

    // Return a minimal result on error
    return {
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
      llmConfidence: 0,
      llmReasoning: `LLM parsing failed: ${error}`,
    };
  }
}

/**
 * Find the best matching user using LLM
 */
export async function llmMatchUser(
  parsed: ParsedRecipient,
  candidates: UserRecord[],
  domainPattern?: DomainPattern
): Promise<LLMMatchResponse> {
  // If no candidates, return no match
  if (candidates.length === 0) {
    return {
      bestMatchId: null,
      confidence: 0,
      reasoning: 'No candidate users provided',
      alternativeMatches: [],
    };
  }

  const client = getClient();

  // Format parsed recipient for prompt
  const parsedStr = JSON.stringify({
    email: parsed.email,
    given_name: parsed.givenName,
    surname: parsed.surname,
    title: parsed.title,
    company_name: parsed.companyName,
    is_personal: parsed.isPersonal,
  }, null, 2);

  // Format candidates (limit to top 20 to avoid token limits)
  const topCandidates = candidates.slice(0, 20);
  const candidatesStr = JSON.stringify(
    topCandidates.map(c => ({
      id: c.id,
      name: c.name,
      email: c.email,
      email2: c.email2,
      user_code: c.userCode,
      buyer_id: c.buyerId,
      producer_id: c.producerId,
    })),
    null,
    2
  );

  let domainPatternStr = '';
  if (domainPattern && !domainPattern.isSharedDomain) {
    domainPatternStr = `Domain pattern: ${domainPattern.convention} (confidence: ${domainPattern.confidence})`;
  }

  const prompt = MATCH_PROMPT
    .replace('{parsed}', parsedStr)
    .replace('{candidates}', candidatesStr)
    .replace('{domainPattern}', domainPatternStr);

  try {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    });

    const content = response.content[0];
    if (content.type !== 'text') {
      throw new Error('Unexpected response type');
    }

    const result = extractJson<LLMMatchResponseData>(content.text);

    return {
      bestMatchId: result.best_match_id ?? null,
      confidence: result.confidence || 0,
      reasoning: result.reasoning || '',
      alternativeMatches: (result.alternative_matches || []).map((m) => ({
        userId: m.user_id,
        confidence: m.confidence || 0,
        reasoning: m.reasoning || '',
      })),
    };
  } catch (error) {
    logger.error('LLM matching failed', {
      email: parsed.email,
      candidateCount: candidates.length,
      error: String(error),
    });

    return {
      bestMatchId: null,
      confidence: 0,
      reasoning: `LLM matching failed: ${error}`,
      alternativeMatches: [],
    };
  }
}

/**
 * Analyze domain email patterns using LLM
 */
export async function llmAnalyzeDomainPattern(
  domain: string,
  users: UserRecord[]
): Promise<DomainPattern> {
  // Collect unique emails for this domain
  const emails = users
    .filter(u => u.email)
    .map(u => ({
      email: u.email!,
      name: u.name,
    }))
    .slice(0, 30); // Limit samples

  if (emails.length < 3) {
    // Not enough data to analyze
    return {
      domain,
      convention: 'unknown',
      confidence: 0,
      sampleSize: emails.length,
      isSharedDomain: false,
      companyName: null,
      buyerId: users[0]?.buyerId || null,
      producerId: users[0]?.producerId || null,
    };
  }

  const client = getClient();

  const emailsStr = emails
    .map(e => `${e.email} (${e.name || 'name unknown'})`)
    .join('\n');

  const prompt = DOMAIN_PATTERN_PROMPT
    .replace('{domain}', domain)
    .replace('{emails}', emailsStr);

  try {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    });

    const content = response.content[0];
    if (content.type !== 'text') {
      throw new Error('Unexpected response type');
    }

    const result = extractJson<LLMDomainPatternResponse>(content.text);

    const validConventions: EmailConvention[] = [
      'firstname.lastname',
      'f.lastname',
      'flastname',
      'firstname',
      'lastname.firstname',
      'unknown',
    ];

    const conventionStr = result.convention || 'unknown';
    const convention = validConventions.includes(conventionStr as EmailConvention)
      ? conventionStr as EmailConvention
      : 'unknown';

    // Try to extract company name from user records
    const companyName = users.find(u => u.userCode)?.userCode || null;

    return {
      domain,
      convention,
      confidence: result.confidence || 0.5,
      sampleSize: emails.length,
      isSharedDomain: false,
      companyName,
      buyerId: users[0]?.buyerId || null,
      producerId: users[0]?.producerId || null,
    };
  } catch (error) {
    logger.error('LLM domain analysis failed', {
      domain,
      userCount: users.length,
      error: String(error),
    });

    return {
      domain,
      convention: 'unknown',
      confidence: 0,
      sampleSize: users.length,
      isSharedDomain: false,
      companyName: null,
      buyerId: users[0]?.buyerId || null,
      producerId: users[0]?.producerId || null,
    };
  }
}

/**
 * Check if two users might be duplicates using LLM
 */
export async function llmCheckDuplicates(
  user1: UserRecord,
  user2: UserRecord
): Promise<{ isDuplicate: boolean; confidence: number; reasoning: string }> {
  const client = getClient();

  const prompt = `Are these two user records likely the same person? Consider name variations, email patterns, and company associations.

User 1:
- ID: ${user1.id}
- Name: ${user1.name}
- Email: ${user1.email}
- Email 2: ${user1.email2}
- Code: ${user1.userCode}
- Domain: ${user1.domain}

User 2:
- ID: ${user2.id}
- Name: ${user2.name}
- Email: ${user2.email}
- Email 2: ${user2.email2}
- Code: ${user2.userCode}
- Domain: ${user2.domain}

Return ONLY a JSON object:
{
  "is_duplicate": true/false,
  "confidence": 0.0-1.0,
  "reasoning": "explanation"
}`;

  try {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    });

    const content = response.content[0];
    if (content.type !== 'text') {
      throw new Error('Unexpected response type');
    }

    const result = extractJson<LLMDuplicateResponse>(content.text);

    return {
      isDuplicate: result.is_duplicate === true,
      confidence: result.confidence || 0,
      reasoning: result.reasoning || '',
    };
  } catch (error) {
    logger.error('LLM duplicate check failed', {
      user1Id: user1.id,
      user2Id: user2.id,
      error: String(error),
    });

    return {
      isDuplicate: false,
      confidence: 0,
      reasoning: `LLM check failed: ${error}`,
    };
  }
}

/**
 * Calculate token estimate for a string
 * Rough estimate: ~4 characters per token
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Check if we're approaching rate limits
 */
export function shouldThrottle(): boolean {
  // This is a placeholder - in production, you'd track actual API usage
  // and implement proper rate limiting
  return false;
}

// ============================================================================
// Phase 1: LLM-First Extraction Functions
// ============================================================================

/**
 * Extract recipient data using LLM (Phase 1 optimized)
 * Uses few-shot prompting with cultural examples
 *
 * @param input - Preprocessed input ready for LLM
 * @param useExtendedReasoning - Force chain-of-thought reasoning
 */
export async function llmExtractRecipient(
  input: PreprocessedInput,
  useExtendedReasoning = false
): Promise<LLMExtractionResult> {
  const client = getClient();

  // Build domain hint
  let domainHint = '';
  if (input.domainConvention) {
    domainHint = `Domain Convention: ${input.domainConvention}`;
  }

  // Choose prompt based on whether we need extended reasoning
  const prompt = useExtendedReasoning
    ? EXTRACTION_COT_PROMPT
    : EXTRACTION_PROMPT;

  const filledPrompt = prompt
    .replace('{email}', input.cleanedEmail || '(none)')
    .replace('{display}', input.cleanedDisplay || '(none)')
    .replace('{domain}', input.domain || '(unknown)')
    .replace('{domain_hint}', domainHint);

  try {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      messages: [
        {
          role: 'user',
          content: filledPrompt,
        },
      ],
    });

    const content = response.content[0];
    if (content.type !== 'text') {
      throw new Error('Unexpected response type');
    }

    const parsed = extractJson<LLMExtractionResponse>(content.text);

    // Build result
    const result: LLMExtractionResult = {
      name1: parsed.name1 || null,
      name2: parsed.name2 || null,
      name1pre: null, // Computed by validator
      name2pre: null, // Computed by validator
      name3: null,    // Computed by validator
      genre: parsed.genre || null,
      email: input.cleanedEmail,
      domain: input.domain,
      isPersonal: parsed.is_personal !== false,
      confidence: parsed.confidence || 0.5,
      extractionStatus: 'extracted_medium', // Will be classified properly
      reasoning: parsed.reasoning || '',
      chainOfThought: parsed.chain_of_thought,
    };

    // Validate and classify
    const validation = validateExtractionResult(result);

    if (validation.isValid && validation.sanitizedResult) {
      return validation.sanitizedResult;
    }

    // If validation failed, return with low confidence
    logger.warn('Extraction validation failed', {
      email: input.cleanedEmail,
      errors: validation.errors,
    });

    result.confidence = Math.min(result.confidence, 0.4);
    result.extractionStatus = 'extracted_low';
    result.reasoning += ` [Validation issues: ${validation.errors.join(', ')}]`;

    return result;
  } catch (error) {
    logger.error('LLM extraction failed', {
      email: input.cleanedEmail,
      error: String(error),
    });

    // Return minimal result on error
    return {
      name1: null,
      name2: null,
      name1pre: null,
      name2pre: null,
      name3: null,
      genre: null,
      email: input.cleanedEmail,
      domain: input.domain,
      isPersonal: true,
      confidence: 0,
      extractionStatus: 'extracted_low',
      reasoning: `LLM extraction failed: ${error}`,
    };
  }
}

/**
 * Extract recipient data with automatic chain-of-thought for low confidence
 * First attempts standard extraction, then uses extended reasoning if confidence is low
 *
 * @param input - Preprocessed input ready for LLM
 * @param confidenceThreshold - Threshold below which to use extended reasoning (default 0.70)
 */
export async function llmExtractRecipientWithFallback(
  input: PreprocessedInput,
  confidenceThreshold = 0.70
): Promise<LLMExtractionResult> {
  // First attempt: standard extraction
  const initialResult = await llmExtractRecipient(input, false);

  // If confidence is high enough, return immediately
  if (initialResult.confidence >= confidenceThreshold) {
    return initialResult;
  }

  // Low confidence: try extended reasoning
  logger.info('Using extended reasoning for low-confidence extraction', {
    email: input.cleanedEmail,
    initialConfidence: initialResult.confidence,
  });

  const extendedResult = await llmExtractRecipient(input, true);

  // Return the better result
  if (extendedResult.confidence > initialResult.confidence) {
    return extendedResult;
  }

  return initialResult;
}

/**
 * Batch extract recipients using LLM
 * Processes multiple inputs efficiently
 *
 * @param inputs - Array of preprocessed inputs
 * @param options - Batch processing options
 */
export async function llmBatchExtract(
  inputs: PreprocessedInput[],
  options: {
    extendedReasoningThreshold?: number;
    maxConcurrent?: number;
    onProgress?: (completed: number, total: number) => void;
  } = {}
): Promise<BatchExtractionResult> {
  const {
    extendedReasoningThreshold = 0.70,
    maxConcurrent = 5,
    onProgress,
  } = options;

  const results: LLMExtractionResult[] = [];
  const errors: Array<{ index: number; error: string }> = [];
  let successCount = 0;
  let errorCount = 0;

  // Process in batches to respect rate limits
  for (let i = 0; i < inputs.length; i += maxConcurrent) {
    const batch = inputs.slice(i, i + maxConcurrent);

    const batchPromises = batch.map(async (input, batchIndex) => {
      const globalIndex = i + batchIndex;

      try {
        const result = await llmExtractRecipientWithFallback(
          input,
          extendedReasoningThreshold
        );
        return { index: globalIndex, result, error: null };
      } catch (error) {
        return { index: globalIndex, result: null, error: String(error) };
      }
    });

    const batchResults = await Promise.all(batchPromises);

    for (const { index, result, error } of batchResults) {
      if (result) {
        results[index] = result;
        successCount++;
      } else {
        // Create error placeholder result
        results[index] = {
          name1: null,
          name2: null,
          name1pre: null,
          name2pre: null,
          name3: null,
          genre: null,
          email: inputs[index].cleanedEmail,
          domain: inputs[index].domain,
          isPersonal: true,
          confidence: 0,
          extractionStatus: 'extracted_low',
          reasoning: `Extraction error: ${error}`,
        };
        errors.push({ index, error: error || 'Unknown error' });
        errorCount++;
      }
    }

    // Report progress
    if (onProgress) {
      onProgress(Math.min(i + maxConcurrent, inputs.length), inputs.length);
    }

    // Small delay between batches to avoid rate limiting
    if (i + maxConcurrent < inputs.length) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  return {
    results,
    successCount,
    errorCount,
    errors,
  };
}

/**
 * Extract with domain pattern learning
 * Analyzes existing users from the same domain to improve accuracy
 *
 * @param input - Preprocessed input
 * @param existingUsers - Known users from the same domain (for pattern inference)
 */
export async function llmExtractWithDomainContext(
  input: PreprocessedInput,
  existingUsers: UserRecord[]
): Promise<LLMExtractionResult> {
  // If we have users from this domain, try to learn the pattern
  if (existingUsers.length >= 3 && !input.domainConvention) {
    try {
      const pattern = await llmAnalyzeDomainPattern(input.domain, existingUsers);
      if (pattern.confidence > 0.6) {
        input = { ...input, domainConvention: pattern.convention };
      }
    } catch (error) {
      logger.warn('Failed to analyze domain pattern', {
        domain: input.domain,
        error: String(error),
      });
    }
  }

  return llmExtractRecipientWithFallback(input);
}
