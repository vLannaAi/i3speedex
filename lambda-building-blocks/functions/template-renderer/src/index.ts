/**
 * AWS Lambda handler for Template Renderer
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import {
  TemplateRendererRequest,
  TemplateRendererResponse,
  Language,
} from './types';
import { validateRequest, sanitizeRequest } from './validator';
import { templateEngine } from './template-engine';
import { i18nService } from './i18n';
import { logger } from './logger';

// Initialize services on cold start
let initialized = false;

async function initialize(): Promise<void> {
  if (initialized) {
    return;
  }

  try {
    logger.info('Initializing Lambda function...');

    // Initialize i18n
    await i18nService.init();

    // Initialize template engine
    await templateEngine.init();

    initialized = true;
    logger.info('Lambda function initialized successfully');
  } catch (error) {
    logger.error('Failed to initialize Lambda function', error);
    throw error;
  }
}

/**
 * Lambda handler
 */
export async function handler(
  event: APIGatewayProxyEvent,
  context: Context
): Promise<APIGatewayProxyResult> {
  const startTime = Date.now();

  // Set request ID for logging
  logger.setRequestId(context.awsRequestId);

  logger.info('Request received', {
    method: event.httpMethod,
    path: event.path,
    requestId: context.awsRequestId,
  });

  try {
    // Initialize on cold start
    await initialize();

    // Parse request body
    let request: TemplateRendererRequest;
    try {
      request = JSON.parse(event.body || '{}');
    } catch (error) {
      return createErrorResponse(400, 'Invalid JSON in request body');
    }

    // Validate request
    const validation = validateRequest(request);
    if (!validation.valid) {
      logger.warn('Request validation failed', {
        errors: validation.errors,
      });

      return createErrorResponse(400, 'Validation failed', {
        errors: validation.errors,
      });
    }

    // Sanitize request
    const sanitized = sanitizeRequest(request);

    // Determine language
    const language: Language = sanitized.language || sanitized.data.buyer.lang;

    logger.info('Rendering template', {
      template: sanitized.template,
      language,
      saleId: sanitized.data.sale.id,
      buyerId: sanitized.data.buyer.id,
      lineCount: sanitized.data.sale_lines.length,
    });

    // Render template
    const result = await templateEngine.render({
      template: sanitized.template,
      language,
      data: sanitized.data,
    });

    const totalTime = Date.now() - startTime;

    logger.info('Template rendered successfully', {
      renderTime: result.renderTime,
      totalTime,
      htmlLength: result.html.length,
    });

    // Create response
    const response: TemplateRendererResponse = {
      success: true,
      html: result.html,
      language,
      generationTime: totalTime,
    };

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
      body: JSON.stringify(response),
    };
  } catch (error: any) {
    logger.error('Error processing request', error);

    return createErrorResponse(
      500,
      'Internal server error',
      {
        message: error.message,
      }
    );
  }
}

/**
 * Create error response
 */
function createErrorResponse(
  statusCode: number,
  message: string,
  details?: any
): APIGatewayProxyResult {
  const response: TemplateRendererResponse = {
    success: false,
    error: message,
    language: 'it',
    generationTime: 0,
    ...(details && { details: JSON.stringify(details) }),
  };

  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
    body: JSON.stringify(response),
  };
}

/**
 * Handle OPTIONS for CORS
 */
export async function optionsHandler(): Promise<APIGatewayProxyResult> {
  return {
    statusCode: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
    body: '',
  };
}
