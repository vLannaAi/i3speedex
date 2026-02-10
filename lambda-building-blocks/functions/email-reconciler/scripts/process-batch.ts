/**
 * Batch Processing Script for AI Email Extraction
 *
 * Processes unlinked msg_emails (user_ud = null) using the LLM extraction pipeline.
 * Orders by id DESC to process most recent records first.
 *
 * Usage:
 *   npx ts-node scripts/process-batch.ts [limit]
 *
 * Examples:
 *   npx ts-node scripts/process-batch.ts        # Process 1000 records (default)
 *   npx ts-node scripts/process-batch.ts 100    # Process 100 records
 *   npx ts-node scripts/process-batch.ts 5000   # Process 5000 records
 *
 * Environment variables required:
 *   ANTHROPIC_API_KEY - Claude API key
 *   DB_HOST, DB_USER, DB_PASSWORD, DB_NAME - Database connection
 *   (or DB_URL for connection string)
 */

import * as dotenv from 'dotenv';
dotenv.config();

import { getUnprocessedForAI, saveAIExtractionResult, getAIExtractionStats } from '../src/db/queries';
import { closePool } from '../src/db/connection';
import { preprocessForLLM } from '../src/parser';
import { llmExtractRecipientWithFallback } from '../src/llm-engine';
import { MsgEmailRecord, LLMExtractionResult } from '../src/types';

// Configuration
const DEFAULT_LIMIT = 1000;
const BATCH_SIZE = 10;  // Process in small batches to manage rate limits
const DELAY_BETWEEN_BATCHES_MS = 500;  // Delay between batches
const PROGRESS_INTERVAL = 50;  // Log progress every N records

// Parse command line arguments
const limit = parseInt(process.argv[2] || String(DEFAULT_LIMIT), 10);

interface ProcessingStats {
  total: number;
  processed: number;
  highConfidence: number;
  mediumConfidence: number;
  lowConfidence: number;
  notApplicable: number;
  errors: number;
  startTime: Date;
}

function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  } else {
    return `${seconds}s`;
  }
}

function printProgress(stats: ProcessingStats): void {
  const elapsed = Date.now() - stats.startTime.getTime();
  const rate = stats.processed / (elapsed / 1000);
  const remaining = stats.total - stats.processed;
  const eta = remaining / rate;

  console.log(`
Progress: ${stats.processed}/${stats.total} (${((stats.processed / stats.total) * 100).toFixed(1)}%)
  High confidence:   ${stats.highConfidence}
  Medium confidence: ${stats.mediumConfidence}
  Low confidence:    ${stats.lowConfidence}
  Not applicable:    ${stats.notApplicable}
  Errors:            ${stats.errors}
  Rate:              ${rate.toFixed(2)} records/sec
  Elapsed:           ${formatDuration(elapsed)}
  ETA:               ${formatDuration(eta * 1000)}
`);
}

function extractDomain(email: string | null): string {
  if (!email) return '';
  const atIndex = email.indexOf('@');
  return atIndex > 0 ? email.slice(atIndex + 1) : '';
}

async function processRecord(
  record: MsgEmailRecord,
  stats: ProcessingStats
): Promise<void> {
  try {
    // Use input field, falling back to address or email
    const inputStr = record.input || record.address || record.email || '';

    // Preprocess the input
    const preprocessed = preprocessForLLM(inputStr);

    // Extract domain from email field
    const domain = extractDomain(record.email);

    if (!preprocessed.cleanedEmail && !record.email) {
      // Invalid email, mark as low confidence
      const result: LLMExtractionResult = {
        name1: null,
        name2: null,
        name1pre: null,
        name2pre: null,
        name3: null,
        genre: null,
        email: record.email || '',
        domain: domain,
        isPersonal: true,
        confidence: 0,
        extractionStatus: 'extracted_low',
        reasoning: 'Could not extract valid email from input',
      };

      await saveAIExtractionResult(record.id, result);
      stats.lowConfidence++;
      stats.processed++;
      return;
    }

    // Use preprocessed email or fall back to record's email
    if (!preprocessed.cleanedEmail && record.email) {
      preprocessed.cleanedEmail = record.email;
      preprocessed.domain = domain;
      preprocessed.localPart = record.local || record.email.split('@')[0] || '';
    }

    // Use existing name field as display name hint if available
    if (!preprocessed.cleanedDisplay && record.name) {
      preprocessed.cleanedDisplay = record.name;
    }

    // Run LLM extraction with fallback to chain-of-thought for low confidence
    const result = await llmExtractRecipientWithFallback(preprocessed, 0.70);

    // Save the result
    await saveAIExtractionResult(record.id, result);

    // Update stats
    switch (result.extractionStatus) {
      case 'extracted_high':
        stats.highConfidence++;
        break;
      case 'extracted_medium':
        stats.mediumConfidence++;
        break;
      case 'extracted_low':
        stats.lowConfidence++;
        break;
      case 'not_applicable':
        stats.notApplicable++;
        break;
    }

    stats.processed++;

  } catch (error) {
    console.error(`Error processing record ${record.id}:`, error);

    const domain = extractDomain(record.email);

    // Save error state
    try {
      const errorResult: LLMExtractionResult = {
        name1: null,
        name2: null,
        name1pre: null,
        name2pre: null,
        name3: null,
        genre: null,
        email: record.email || '',
        domain: domain,
        isPersonal: true,
        confidence: 0,
        extractionStatus: 'extracted_low',
        reasoning: `Processing error: ${error}`,
      };
      await saveAIExtractionResult(record.id, errorResult);
    } catch {
      // Ignore save errors
    }

    stats.errors++;
    stats.processed++;
  }
}

async function processBatch(
  records: MsgEmailRecord[],
  stats: ProcessingStats
): Promise<void> {
  // Process records sequentially within each batch to avoid rate limits
  for (const record of records) {
    await processRecord(record, stats);

    // Log progress at intervals
    if (stats.processed % PROGRESS_INTERVAL === 0) {
      printProgress(stats);
    }
  }
}

async function main(): Promise<void> {
  console.log(`
========================================
AI Email Extraction - Batch Processing
========================================
Limit: ${limit} records
Processing records where user_ud IS NULL
Ordered by id DESC (most recent first)
========================================
`);

  // Check for required environment variables
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('Error: ANTHROPIC_API_KEY environment variable is required');
    process.exit(1);
  }

  if (!process.env.DB_HOST && !process.env.DB_URL) {
    console.error('Error: Database connection environment variables are required');
    console.error('Set either DB_URL or (DB_HOST, DB_USER, DB_PASSWORD, DB_NAME)');
    process.exit(1);
  }

  try {
    // Get initial stats
    console.log('Fetching current extraction stats...');
    const initialStats = await getAIExtractionStats();
    console.log(`
Current database state:
  Total records:     ${initialStats.total}
  Unlinked (no user_ud): ${initialStats.unlinkedCount}
  Already processed: ${initialStats.total - initialStats.byStatus.unprocessed}
  Unprocessed:       ${initialStats.byStatus.unprocessed}
`);

    // Fetch records to process
    console.log(`Fetching up to ${limit} unprocessed records...`);
    const records = await getUnprocessedForAI(limit);

    if (records.length === 0) {
      console.log('No unprocessed records found. All done!');
      await closePool();
      return;
    }

    console.log(`Found ${records.length} records to process.\n`);

    // Initialize stats
    const stats: ProcessingStats = {
      total: records.length,
      processed: 0,
      highConfidence: 0,
      mediumConfidence: 0,
      lowConfidence: 0,
      notApplicable: 0,
      errors: 0,
      startTime: new Date(),
    };

    // Process in batches
    for (let i = 0; i < records.length; i += BATCH_SIZE) {
      const batch = records.slice(i, i + BATCH_SIZE);
      await processBatch(batch, stats);

      // Delay between batches to avoid rate limits
      if (i + BATCH_SIZE < records.length) {
        await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_BATCHES_MS));
      }
    }

    // Final stats
    const elapsed = Date.now() - stats.startTime.getTime();
    console.log(`
========================================
Processing Complete!
========================================
Total processed:   ${stats.processed}
High confidence:   ${stats.highConfidence} (${((stats.highConfidence / stats.processed) * 100).toFixed(1)}%)
Medium confidence: ${stats.mediumConfidence} (${((stats.mediumConfidence / stats.processed) * 100).toFixed(1)}%)
Low confidence:    ${stats.lowConfidence} (${((stats.lowConfidence / stats.processed) * 100).toFixed(1)}%)
Not applicable:    ${stats.notApplicable} (${((stats.notApplicable / stats.processed) * 100).toFixed(1)}%)
Errors:            ${stats.errors}
Duration:          ${formatDuration(elapsed)}
Rate:              ${(stats.processed / (elapsed / 1000)).toFixed(2)} records/sec
========================================
`);

    // Get final stats from database
    const finalStats = await getAIExtractionStats();
    console.log(`
Updated database state:
  Total records:     ${finalStats.total}
  High confidence:   ${finalStats.byStatus.extracted_high}
  Medium confidence: ${finalStats.byStatus.extracted_medium}
  Low confidence:    ${finalStats.byStatus.extracted_low}
  Not applicable:    ${finalStats.byStatus.not_applicable}
  Needs review:      ${finalStats.needsReview}
  Average confidence: ${(finalStats.averageConfidence * 100).toFixed(1)}%
`);

  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  } finally {
    await closePool();
  }
}

// Run the script
main().catch(error => {
  console.error('Unhandled error:', error);
  process.exit(1);
});
