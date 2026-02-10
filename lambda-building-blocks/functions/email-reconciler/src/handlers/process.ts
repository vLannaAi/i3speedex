/**
 * Processing API Handlers
 * REST endpoints for triggering email reconciliation processing
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { processById, processBatch, reconcileMsgEmail } from '../reconciler';
import { getUnprocessedMsgEmails, getMsgEmailsByDomain, getMsgEmailById } from '../db/queries';
import { preloadTopDomains } from '../domain-analyzer';
import { runDuplicateDetection } from '../dedup';
import { runSplitDetection } from '../split';
import { BatchProcessRequest } from '../types';
import { logger } from '../logger';

/**
 * Helper to create API response
 */
function response(
  statusCode: number,
  body: unknown
): APIGatewayProxyResult {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
    body: JSON.stringify(body),
  };
}

/**
 * GET /process/msg-email/{id}
 * Process a single msg_email record
 */
export async function processSingleEmail(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  try {
    const id = parseInt(event.pathParameters?.id || '', 10);
    const useLLM = event.queryStringParameters?.useLLM !== 'false';

    if (isNaN(id)) {
      return response(400, { error: 'Invalid msg_email ID' });
    }

    const result = await processById(id, useLLM);

    if (!result) {
      return response(404, { error: 'MsgEmail not found' });
    }

    return response(200, {
      msgEmailId: result.msgEmailId,
      parsedData: result.parsedData,
      candidateCount: result.candidates.length,
      suggestedAction: result.suggestedAction,
      suggestedUserId: result.suggestedUserId,
      confidence: result.confidence,
      reasoning: result.llmReasoning,
    });
  } catch (error) {
    logger.error('Failed to process single email', { error: String(error) });
    return response(500, { error: 'Internal server error' });
  }
}

/**
 * POST /process/batch
 * Trigger batch processing
 */
export async function processBatchEmails(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  try {
    const body: BatchProcessRequest = event.body
      ? JSON.parse(event.body)
      : {};

    const limit = body.limit || 100;
    const domain = body.domain;
    const useLLM = true;

    // Preload domain patterns for efficiency
    await preloadTopDomains(20);

    // Get emails to process
    let emails;
    if (domain) {
      emails = await getMsgEmailsByDomain(domain, limit);
    } else {
      emails = await getUnprocessedMsgEmails(limit);
    }

    if (emails.length === 0) {
      return response(200, {
        message: 'No unprocessed emails found',
        processed: 0,
        proposalsCreated: 0,
        errors: 0,
      });
    }

    // Process batch
    const result = await processBatch(emails, useLLM);

    return response(200, {
      message: `Processed ${result.processed} emails`,
      ...result,
    });
  } catch (error) {
    logger.error('Failed to process batch', { error: String(error) });
    return response(500, { error: 'Internal server error' });
  }
}

/**
 * POST /process/duplicates
 * Run duplicate detection
 */
export async function processDetectDuplicates(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  try {
    const body = event.body ? JSON.parse(event.body) : {};
    const useLLM = body.useLLM !== false;

    const result = await runDuplicateDetection(useLLM);

    return response(200, {
      message: `Duplicate detection complete`,
      detected: result.detected,
      proposalsCreated: result.proposalsCreated,
    });
  } catch (error) {
    logger.error('Failed to detect duplicates', { error: String(error) });
    return response(500, { error: 'Internal server error' });
  }
}

/**
 * POST /process/splits
 * Run split detection
 */
export async function processDetectSplits(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  try {
    const result = await runSplitDetection();

    return response(200, {
      message: `Split detection complete`,
      detected: result.detected,
      proposalsCreated: result.proposalsCreated,
    });
  } catch (error) {
    logger.error('Failed to detect splits', { error: String(error) });
    return response(500, { error: 'Internal server error' });
  }
}

/**
 * GET /process/preview/{id}
 * Preview processing for a single msg_email without creating queue entry
 */
export async function previewProcessing(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  try {
    const id = parseInt(event.pathParameters?.id || '', 10);
    const useLLM = event.queryStringParameters?.useLLM !== 'false';

    if (isNaN(id)) {
      return response(400, { error: 'Invalid msg_email ID' });
    }

    const msgEmail = await getMsgEmailById(id);
    if (!msgEmail) {
      return response(404, { error: 'MsgEmail not found' });
    }

    // Process without creating queue entry
    const result = await reconcileMsgEmail(msgEmail, useLLM);

    return response(200, {
      msgEmailId: result.msgEmailId,
      input: msgEmail.input,
      parsedData: result.parsedData,
      candidates: result.candidates.slice(0, 10), // Limit for preview
      suggestedAction: result.suggestedAction,
      suggestedUserId: result.suggestedUserId,
      confidence: result.confidence,
      isSharedEmail: result.isSharedEmail,
      reasoning: result.llmReasoning,
    });
  } catch (error) {
    logger.error('Failed to preview processing', { error: String(error) });
    return response(500, { error: 'Internal server error' });
  }
}

/**
 * POST /process/full
 * Run full processing pipeline (emails + duplicates + splits)
 */
export async function processFullPipeline(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  try {
    const body = event.body ? JSON.parse(event.body) : {};
    const emailLimit = body.emailLimit || 500;
    const useLLM = body.useLLM !== false;

    logger.info('Starting full processing pipeline', { emailLimit, useLLM });

    // Preload domain patterns
    await preloadTopDomains(50);

    // Step 1: Process unprocessed emails
    const emails = await getUnprocessedMsgEmails(emailLimit);
    const emailResult = await processBatch(emails, useLLM);

    // Step 2: Detect duplicates
    const dupResult = await runDuplicateDetection(useLLM);

    // Step 3: Detect splits
    const splitResult = await runSplitDetection();

    const summary = {
      emails: {
        processed: emailResult.processed,
        proposalsCreated: emailResult.proposalsCreated,
        errors: emailResult.errors,
      },
      duplicates: {
        detected: dupResult.detected,
        proposalsCreated: dupResult.proposalsCreated,
      },
      splits: {
        detected: splitResult.detected,
        proposalsCreated: splitResult.proposalsCreated,
      },
      totalProposals:
        emailResult.proposalsCreated +
        dupResult.proposalsCreated +
        splitResult.proposalsCreated,
    };

    logger.info('Full processing pipeline complete', summary);

    return response(200, {
      message: 'Full processing pipeline complete',
      ...summary,
    });
  } catch (error) {
    logger.error('Failed to run full pipeline', { error: String(error) });
    return response(500, { error: 'Internal server error' });
  }
}
