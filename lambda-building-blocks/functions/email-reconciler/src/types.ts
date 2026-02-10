/**
 * TypeScript interfaces for Email Reconciliation Agent
 */

// ============================================================================
// Extraction Status Types
// ============================================================================

/**
 * Status of LLM-based extraction for a msg_email record
 */
export type ExtractionStatus =
  | 'unprocessed'      // Never sent to extraction pipeline
  | 'extracted_high'   // Confidence >= 0.85, all fields populated
  | 'extracted_medium' // Confidence 0.60-0.85, needs review
  | 'extracted_low'    // Confidence < 0.60, flagged for Phase 2
  | 'reviewed'         // Human verified/corrected
  | 'not_applicable';  // Service address (info@, support@)

/**
 * Result of LLM extraction for an email recipient
 */
export interface LLMExtractionResult {
  // Core extracted fields matching msg_emails columns
  name1: string | null;           // Given name + middle names
  name2: string | null;           // Family/surname
  genre: 'Mr.' | 'Ms.' | null;    // Mapped from honorifics
  email: string;                   // Email address (normalized)
  domain: string;                  // Domain extracted from email

  // Classification
  isPersonal: boolean;             // true if person, false if service/company
  confidence: number;              // 0.0-1.0 extraction confidence
  extractionStatus: ExtractionStatus;

  // Initials (computed deterministically, not from LLM)
  name1pre: string | null;          // Initial of name1 (e.g., "M.")
  name2pre: string | null;          // Initial of name2 (e.g., "R.")

  // Functional/role label for non-personal addresses
  name3: string | null;             // Simplified label from local part (e.g., "bounce-detection~")

  // Debug/review info
  reasoning: string;               // LLM explanation of extraction
  chainOfThought?: string;         // Extended reasoning for ambiguous cases
}

/**
 * Preprocessed input ready for LLM extraction
 */
export interface PreprocessedInput {
  rawInput: string;                // Original input string
  cleanedEmail: string;            // Validated and normalized email
  cleanedDisplay: string | null;   // Cleaned display name (or null)
  domain: string;                  // Domain from email
  domainConvention: string | null; // Known pattern if available (e.g., "firstname.lastname")
  localPart: string;               // Local part of email
}

/**
 * Validation result for extracted data
 */
export interface ExtractionValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  sanitizedResult?: LLMExtractionResult;
}

/**
 * Batch extraction request
 */
export interface BatchExtractionRequest {
  inputs: PreprocessedInput[];
  useDomainHints: boolean;
  extendedReasoningThreshold: number; // Trigger chain-of-thought below this confidence
}

/**
 * Batch extraction result
 */
export interface BatchExtractionResult {
  results: LLMExtractionResult[];
  successCount: number;
  errorCount: number;
  errors: Array<{ index: number; error: string }>;
  totalTokensUsed?: number;
}

// ============================================================================
// Parsed Email Data
// ============================================================================

/**
 * Result of parsing a raw email recipient string
 */
export interface ParsedRecipient {
  rawInput: string;
  email: string;              // lowercase, trimmed
  localPart: string;
  domain: string;
  displayName: string | null;
  givenName: string | null;
  surname: string | null;
  title: string | null;       // Mr., Ms., Dr., etc.
  companyName: string | null;
  isPersonal: boolean;        // true if person, false if service/generic address
  confidence: number;         // 0-1 parsing confidence
}

/**
 * LLM-enhanced parsing result
 */
export interface LLMParsedRecipient extends ParsedRecipient {
  llmConfidence: number;
  llmReasoning: string;
}

// ============================================================================
// Domain Intelligence
// ============================================================================

/**
 * Email naming convention pattern for a domain
 */
export type EmailConvention =
  | 'firstname.lastname'    // john.smith@domain.com
  | 'f.lastname'            // j.smith@domain.com
  | 'flastname'             // jsmith@domain.com
  | 'firstname'             // john@domain.com
  | 'lastname.firstname'    // smith.john@domain.com
  | 'unknown';

/**
 * Domain pattern analysis result
 */
export interface DomainPattern {
  domain: string;
  convention: EmailConvention;
  confidence: number;
  sampleSize: number;
  isSharedDomain: boolean;  // gmail.com, outlook.com, etc.
  companyName: string | null;
  buyerId: number | null;
  producerId: number | null;
}

// ============================================================================
// User and Email Records
// ============================================================================

/**
 * User record from the database
 */
export interface UserRecord {
  id: number;
  name: string | null;
  genre: string | null;
  email: string | null;
  email2: string | null;
  address: string | null;
  userCode: string | null;
  buyerId: number | null;
  producerId: number | null;
  domain: string | null;
  domain2: string | null;
}

/**
 * MsgEmail record from the database
 * Matches the actual i2_speedex.msg_emails table schema
 */
export interface MsgEmailRecord {
  id: number;
  input: string | null;              // Raw input string
  userUd: number | null;             // Linked user ID
  email: string | null;              // Normalized email address
  address: string | null;            // Full address (may include display name)
  pos: number | null;                // Position
  textindex: string | null;          // Search index
  userGenre: string | null;          // User genre (Mr./Ms.)
  userName: string | null;           // User name
  userCode: string | null;           // User code
  name: string | null;               // Extracted display name
  local: string | null;              // Local part of email
  notes: string | null;              // Processing notes
  modDate: Date | null;              // Modification date
  buyerId: number | null;
  producerId: number | null;
  // AI extraction fields (prefixed with ai_)
  aiName1: string | null;           // AI extracted given name + middle names
  aiName2: string | null;           // AI extracted family/surname
  aiGenre: 'Mr.' | 'Ms.' | null;    // AI inferred gender
  aiEmail: string | null;           // AI normalized email
  aiConfidence: number | null;      // AI extraction confidence
  aiStatus: ExtractionStatus | null;
  aiNotes: string | null;           // AI reasoning/processing notes
  aiProcessedAt: Date | null;
  aiModel: string | null;
  aiIsPersonal: boolean | null;
  aiDomainConvention: string | null;
  aiName1pre: string | null;         // Initial of ai_name1 (e.g., "M.")
  aiName2pre: string | null;         // Initial of ai_name2 (e.g., "R.")
  aiName3: string | null;            // Functional/role label for non-personal addresses
  aiVersion: number | null;          // Extraction pipeline version
}

// ============================================================================
// Reconciliation Results
// ============================================================================

/**
 * Match factor explaining why a candidate was matched
 */
export type MatchFactor =
  | 'email_exact'           // Exact email match
  | 'email2_exact'          // Match on secondary email
  | 'domain_match'          // Same domain
  | 'name_exact'            // Exact name match
  | 'name_fuzzy'            // Fuzzy name match (Levenshtein)
  | 'local_part_pattern'    // firstname.lastname pattern match
  | 'company_code_match'    // user_code matches
  | 'buyer_producer_match'; // Same buyer/producer

/**
 * Candidate user match with confidence score
 */
export interface MatchCandidate {
  userId: number;
  confidence: number;       // 0-1 combined score
  matchFactors: MatchFactor[];
  userName: string | null;
  userEmail: string | null;
  userEmail2: string | null;
  userCode: string | null;
  buyerId: number | null;
  producerId: number | null;
}

/**
 * Suggested action for a reconciliation result
 */
export type SuggestedAction =
  | 'link_user'             // Link msg_email to existing user
  | 'create_user'           // Create new user from msg_email
  | 'manual_review'         // Needs human review
  | 'duplicate_suspect';    // Possible duplicate user

/**
 * Full reconciliation result for a msg_email record
 */
export interface ReconciliationResult {
  msgEmailId: number;
  parsedData: ParsedRecipient;
  candidates: MatchCandidate[];
  suggestedAction: SuggestedAction;
  suggestedUserId: number | null;
  confidence: number;
  isSharedEmail: boolean;
  llmReasoning: string;
}

// ============================================================================
// Review Queue
// ============================================================================

/**
 * Queue entry type
 */
export type QueueType =
  | 'link'                  // Link msg_email to user
  | 'create_user'           // Create new user
  | 'update_user'           // Update user data
  | 'merge'                 // Merge duplicate users
  | 'split';                // Split user (multiple persons using same email)

/**
 * Queue entry status
 */
export type QueueStatus =
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'applied';

/**
 * Enhanced proposal with extracted fields for msg_emails update
 * Used for both link and create_user actions
 */
export interface EnhancedProposal {
  // Core extracted fields for msg_emails update
  name1: string | null;           // First name (given name)
  name2: string | null;           // Last name (surname)
  genre: 'Mr.' | 'Ms.' | null;    // Mapped from title
  email: string;                   // Email address
  domain: string;                  // Domain

  // Full name for display
  fullName: string | null;
  displayName: string | null;

  // Company info
  companyName: string | null;
  isPersonal: boolean;

  // Link/match info
  user_ud: number | null;         // Matching user ID (for high/medium confidence)
  displayClassification: 'full' | 'partial' | 'unknown';

  // Reference IDs
  msgEmailId: number;
  buyerId: number | null;
  producerId: number | null;
}

/**
 * Proposed changes for a link action (legacy)
 */
export interface LinkProposal {
  msgEmailId: number;
  targetUserId: number;
  proposedUserName: string | null;
  proposedUserGenre: string | null;
  proposedDisplayClassification: 'full' | 'partial';
}

/**
 * Proposed changes for creating a new user (legacy)
 */
export interface CreateUserProposal {
  msgEmailId: number;
  name: string | null;
  genre: string | null;
  email: string;
  domain: string;
  buyerId: number | null;
  producerId: number | null;
}

/**
 * Proposed changes for merging users
 */
export interface MergeProposal {
  sourceUserId: number;
  targetUserId: number;
  sourceUserName: string | null;
  targetUserName: string | null;
  affectedMsgEmailCount: number;
}

/**
 * Proposed changes for splitting a user
 */
export interface SplitProposal {
  sourceUserId: number;
  newUserName: string;
  newUserEmail: string;
  msgEmailIds: number[];
}

/**
 * Review queue entry
 */
export interface QueueEntry {
  id: number;
  queueType: QueueType;
  msgEmailId: number | null;
  sourceUserId: number | null;
  targetUserId: number | null;
  proposedData: EnhancedProposal | LinkProposal | CreateUserProposal | MergeProposal | SplitProposal;
  currentData: Record<string, unknown>;
  confidence: number;
  llmReasoning: string;
  status: QueueStatus;
  reviewedBy: number | null;
  reviewedAt: Date | null;
  createdAt: Date;
}

/**
 * Queue entry for API responses (with additional computed fields)
 */
export interface QueueEntryWithDetails extends QueueEntry {
  msgEmailInput?: string;
  sourceUserName?: string;
  targetUserName?: string;
}

// ============================================================================
// API Request/Response Types
// ============================================================================

/**
 * Paginated list response
 */
export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

/**
 * Queue filter options
 */
export interface QueueFilterOptions {
  status?: QueueStatus[];
  queueType?: QueueType[];
  minConfidence?: number;
  maxConfidence?: number;
  domain?: string;
  page?: number;
  pageSize?: number;
}

/**
 * Processing statistics
 */
export interface ProcessingStats {
  totalMsgEmails: number;
  processedMsgEmails: number;
  pendingQueue: number;
  approvedQueue: number;
  rejectedQueue: number;
  appliedQueue: number;
  byClassification: {
    full: number;
    partial: number;
    unknown: number;
  };
  byConfidenceTier: {
    high: number;     // >= 0.90
    medium: number;   // 0.70 - 0.90
    low: number;      // 0.50 - 0.70
    veryLow: number;  // < 0.50
  };
}

/**
 * Batch processing request
 */
export interface BatchProcessRequest {
  limit?: number;
  domain?: string;
  includeProcessed?: boolean;
}

/**
 * Batch processing result
 */
export interface BatchProcessResult {
  processed: number;
  proposalsCreated: number;
  errors: number;
  errorMessages: string[];
}

/**
 * Approval request
 */
export interface ApprovalRequest {
  queueId: number;
  reviewerId: number;
  modifications?: Partial<LinkProposal | CreateUserProposal | MergeProposal | SplitProposal>;
}

/**
 * Approval result
 */
export interface ApprovalResult {
  success: boolean;
  queueId: number;
  appliedChanges: Record<string, unknown>;
  error?: string;
}

// ============================================================================
// LLM Engine Types
// ============================================================================

/**
 * LLM parsing request
 */
export interface LLMParseRequest {
  input: string;
  domainHints?: DomainPattern;
}

/**
 * LLM matching request
 */
export interface LLMMatchRequest {
  parsed: ParsedRecipient;
  candidates: UserRecord[];
  domainPattern?: DomainPattern;
}

/**
 * LLM matching response
 */
export interface LLMMatchResponse {
  bestMatchId: number | null;
  confidence: number;
  reasoning: string;
  alternativeMatches: Array<{
    userId: number;
    confidence: number;
    reasoning: string;
  }>;
}

/**
 * LLM domain analysis request
 */
export interface LLMDomainAnalysisRequest {
  domain: string;
  users: UserRecord[];
}

// ============================================================================
// Deduplication Types
// ============================================================================

/**
 * Duplicate detection result
 */
export interface DuplicateDetectionResult {
  user1: UserRecord;
  user2: UserRecord;
  similarity: number;
  factors: Array<'same_email' | 'same_name' | 'similar_name' | 'same_domain'>;
  suggestedMerge: 'user1_into_user2' | 'user2_into_user1' | 'needs_review';
}

// ============================================================================
// Split Detection Types
// ============================================================================

/**
 * Split detection result
 */
export interface SplitDetectionResult {
  userId: number;
  email: string;
  distinctNames: string[];
  msgEmailIds: number[];
  confidence: number;
  suggestSplit: boolean;
}

// ============================================================================
// Database Types
// ============================================================================

/**
 * Database configuration
 */
export interface DatabaseConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
  connectionLimit?: number;
}

/**
 * Transaction callback type
 */
export type TransactionCallback<T> = (connection: unknown) => Promise<T>;
