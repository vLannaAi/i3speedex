/**
 * Authentication Middleware
 * Extract and validate user context from Cognito JWT tokens
 */

import { APIGatewayProxyEvent } from 'aws-lambda';
import { UserContext } from '../types';
import { UnauthorizedError, ForbiddenError } from '../utils/validation';

// ========================================
// User Context Extraction
// ========================================

/**
 * Extract user context from API Gateway event
 * API Gateway JWT authorizer injects claims into requestContext.authorizer.jwt.claims
 */
export function getUserContext(event: APIGatewayProxyEvent): UserContext {
  // Check if authorizer context exists
  const authorizer = event.requestContext.authorizer;

  if (!authorizer) {
    throw new UnauthorizedError('No authorization context found');
  }

  // API Gateway HTTP API with JWT authorizer structure
  const claims = (authorizer as any).jwt?.claims || (authorizer as any).claims;

  if (!claims) {
    throw new UnauthorizedError('No JWT claims found');
  }

  // Extract user information from claims
  const username = claims['cognito:username'] || claims.username || claims.sub;
  const email = claims.email;
  const rawGroups = claims['cognito:groups'] || [];

  // HTTP API v2 JWT authorizer may pass groups as a stringified JSON array
  // e.g. "[admin]" or "[admin, operator]" instead of ["admin"]
  let groups: string[];
  if (Array.isArray(rawGroups)) {
    groups = rawGroups;
  } else if (typeof rawGroups === 'string') {
    const trimmed = rawGroups.trim();
    if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
      groups = trimmed.slice(1, -1).split(',').map((s: string) => s.trim()).filter(Boolean);
    } else {
      groups = [trimmed];
    }
  } else {
    groups = [];
  }

  // Extract custom attributes
  const operatorId = claims['custom:operatorId'];
  const role = claims['custom:role'];

  if (!username) {
    throw new UnauthorizedError('Username not found in JWT claims');
  }

  return {
    username,
    email,
    groups,
    operatorId,
    role,
  };
}

// ========================================
// Authorization Helpers
// ========================================

/**
 * Check if user has a specific role
 */
export function hasRole(user: UserContext, role: string): boolean {
  return user.groups.includes(role);
}

/**
 * Check if user has any of the specified roles
 */
export function hasAnyRole(user: UserContext, roles: string[]): boolean {
  return roles.some((role) => user.groups.includes(role));
}

/**
 * Check if user has all of the specified roles
 */
export function hasAllRoles(user: UserContext, roles: string[]): boolean {
  return roles.every((role) => user.groups.includes(role));
}

/**
 * Require user to have a specific role
 */
export function requireRole(user: UserContext, role: string): void {
  if (!hasRole(user, role)) {
    throw new ForbiddenError(`User does not have required role: ${role}`);
  }
}

/**
 * Require user to have any of the specified roles
 */
export function requireAnyRole(user: UserContext, roles: string[]): void {
  if (!hasAnyRole(user, roles)) {
    throw new ForbiddenError(`User does not have any of the required roles: ${roles.join(', ')}`);
  }
}

/**
 * Require user to have all of the specified roles
 */
export function requireAllRoles(user: UserContext, roles: string[]): void {
  if (!hasAllRoles(user, roles)) {
    throw new ForbiddenError(`User does not have all required roles: ${roles.join(', ')}`);
  }
}

/**
 * Check if user is admin
 */
export function isAdmin(user: UserContext): boolean {
  return hasRole(user, 'admin');
}

/**
 * Check if user is operator
 */
export function isOperator(user: UserContext): boolean {
  return hasRole(user, 'operator');
}

/**
 * Check if user is viewer
 */
export function isViewer(user: UserContext): boolean {
  return hasRole(user, 'viewer');
}

/**
 * Require user to be admin
 */
export function requireAdmin(user: UserContext): void {
  requireRole(user, 'admin');
}

/**
 * Require user to be admin or operator
 */
export function requireAdminOrOperator(user: UserContext): void {
  requireAnyRole(user, ['admin', 'operator']);
}

/**
 * Check if user can create/edit resources
 */
export function canWrite(user: UserContext): boolean {
  return hasAnyRole(user, ['admin', 'operator']);
}

/**
 * Check if user can only read resources
 */
export function isReadOnly(user: UserContext): boolean {
  return hasRole(user, 'viewer') && !canWrite(user);
}

/**
 * Require user to have write permission
 */
export function requireWritePermission(user: UserContext): void {
  if (!canWrite(user)) {
    throw new ForbiddenError('User does not have write permission');
  }
}

// ========================================
// Resource Ownership Checks
// ========================================

/**
 * Check if user owns or can access a resource
 * Admins can access all resources, others only their own
 */
export function canAccessResource(user: UserContext, resourceCreatedBy: string): boolean {
  // Admins can access everything
  if (isAdmin(user)) {
    return true;
  }

  // Users can access resources they created
  return user.username === resourceCreatedBy;
}

/**
 * Require user to have access to a resource
 */
export function requireResourceAccess(user: UserContext, resourceCreatedBy: string): void {
  if (!canAccessResource(user, resourceCreatedBy)) {
    throw new ForbiddenError('User does not have access to this resource');
  }
}

// ========================================
// Helper to extract path parameters
// ========================================

/**
 * Extract path parameter from event
 */
export function getPathParameter(event: APIGatewayProxyEvent, paramName: string): string {
  const value = event.pathParameters?.[paramName];

  if (!value) {
    throw new Error(`Missing path parameter: ${paramName}`);
  }

  return value;
}

/**
 * Extract query parameter from event
 */
export function getQueryParameter(
  event: APIGatewayProxyEvent,
  paramName: string,
  defaultValue?: string
): string | undefined {
  return event.queryStringParameters?.[paramName] || defaultValue;
}

/**
 * Parse request body
 */
export function parseRequestBody<T>(event: APIGatewayProxyEvent): T {
  if (!event.body) {
    throw new Error('Request body is missing');
  }

  try {
    return JSON.parse(event.body) as T;
  } catch (error) {
    throw new Error('Invalid JSON in request body');
  }
}
