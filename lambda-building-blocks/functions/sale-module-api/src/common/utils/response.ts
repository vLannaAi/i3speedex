/**
 * HTTP Response Utilities
 * Standard response formatters for API Gateway
 */

import { APIGatewayProxyResult } from 'aws-lambda';
import { ApiResponse, ErrorResponse, PaginatedResponse } from '../types';

// ========================================
// CORS Headers
// ========================================

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': process.env.CORS_ORIGIN || '*',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-Amz-Date,X-Api-Key,X-Amz-Security-Token',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
  'Access-Control-Allow-Credentials': 'true',
  'Content-Type': 'application/json',
};

// ========================================
// Success Responses
// ========================================

/**
 * Create a success response
 */
export function successResponse<T>(
  data: T,
  statusCode: number = 200
): APIGatewayProxyResult {
  const response: ApiResponse<T> = {
    success: true,
    data,
  };

  return {
    statusCode,
    headers: CORS_HEADERS,
    body: JSON.stringify(response),
  };
}

/**
 * Create a paginated success response
 */
export function paginatedResponse<T>(
  data: T[],
  pagination: {
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
    hasMore: boolean;
    nextToken?: string;
  },
  statusCode: number = 200
): APIGatewayProxyResult {
  const response: PaginatedResponse<T> = {
    success: true,
    data,
    pagination,
  };

  return {
    statusCode,
    headers: CORS_HEADERS,
    body: JSON.stringify(response),
  };
}

/**
 * Create a 201 Created response
 */
export function createdResponse<T>(data: T): APIGatewayProxyResult {
  return successResponse(data, 201);
}

/**
 * Create a 204 No Content response
 */
export function noContentResponse(): APIGatewayProxyResult {
  return {
    statusCode: 204,
    headers: CORS_HEADERS,
    body: '',
  };
}

// ========================================
// Error Responses
// ========================================

/**
 * Create an error response
 */
export function errorResponse(
  error: string,
  message: string,
  statusCode: number = 500,
  requestId?: string,
  path?: string
): APIGatewayProxyResult {
  const response: ErrorResponse = {
    success: false,
    error,
    message,
    statusCode,
    timestamp: new Date().toISOString(),
    path: path || '',
    requestId: requestId || 'unknown',
  };

  return {
    statusCode,
    headers: CORS_HEADERS,
    body: JSON.stringify(response),
  };
}

/**
 * Create a 400 Bad Request response
 */
export function badRequestResponse(
  message: string,
  requestId?: string,
  path?: string
): APIGatewayProxyResult {
  return errorResponse('Bad Request', message, 400, requestId, path);
}

/**
 * Create a 401 Unauthorized response
 */
export function unauthorizedResponse(
  message: string = 'Unauthorized',
  requestId?: string,
  path?: string
): APIGatewayProxyResult {
  return errorResponse('Unauthorized', message, 401, requestId, path);
}

/**
 * Create a 403 Forbidden response
 */
export function forbiddenResponse(
  message: string = 'Forbidden',
  requestId?: string,
  path?: string
): APIGatewayProxyResult {
  return errorResponse('Forbidden', message, 403, requestId, path);
}

/**
 * Create a 404 Not Found response
 */
export function notFoundResponse(
  message: string = 'Not Found',
  requestId?: string,
  path?: string
): APIGatewayProxyResult {
  return errorResponse('Not Found', message, 404, requestId, path);
}

/**
 * Create a 409 Conflict response
 */
export function conflictResponse(
  message: string,
  requestId?: string,
  path?: string
): APIGatewayProxyResult {
  return errorResponse('Conflict', message, 409, requestId, path);
}

/**
 * Create a 422 Unprocessable Entity response (validation error)
 */
export function validationErrorResponse(
  message: string,
  requestId?: string,
  path?: string
): APIGatewayProxyResult {
  return errorResponse('Validation Error', message, 422, requestId, path);
}

/**
 * Create a 500 Internal Server Error response
 */
export function internalServerErrorResponse(
  message: string = 'Internal Server Error',
  requestId?: string,
  path?: string
): APIGatewayProxyResult {
  return errorResponse('Internal Server Error', message, 500, requestId, path);
}

// ========================================
// Error Handler Utility
// ========================================

/**
 * Handle errors and return appropriate response
 */
export function handleError(
  error: any,
  requestId?: string,
  path?: string
): APIGatewayProxyResult {
  console.error('Error:', error);

  // Handle known error types
  if (error.name === 'ValidationError') {
    return validationErrorResponse(error.message, requestId, path);
  }

  if (error.name === 'NotFoundError') {
    return notFoundResponse(error.message, requestId, path);
  }

  if (error.name === 'UnauthorizedError') {
    return unauthorizedResponse(error.message, requestId, path);
  }

  if (error.name === 'ForbiddenError') {
    return forbiddenResponse(error.message, requestId, path);
  }

  if (error.name === 'ConflictError') {
    return conflictResponse(error.message, requestId, path);
  }

  // Handle DynamoDB errors
  if (error.name === 'ConditionalCheckFailedException') {
    return conflictResponse('Resource already exists or condition not met', requestId, path);
  }

  if (error.name === 'ResourceNotFoundException') {
    return notFoundResponse('Resource not found', requestId, path);
  }

  // Handle S3 errors
  if (error.name === 'NoSuchKey') {
    return notFoundResponse('File not found', requestId, path);
  }

  // Default to 500 Internal Server Error
  const message = error.message || 'An unexpected error occurred';
  return internalServerErrorResponse(message, requestId, path);
}
