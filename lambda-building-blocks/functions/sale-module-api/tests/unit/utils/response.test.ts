/**
 * Unit tests for response utilities
 */

import {
  successResponse,
  createdResponse,
  paginatedResponse,
  errorResponse,
  handleError,
} from '../../../src/common/utils/response';
import {
  ValidationError,
  NotFoundError,
  UnauthorizedError,
  ForbiddenError,
  ConflictError,
} from '../../../src/common/utils/validation';

describe('Response Utilities', () => {
  describe('successResponse', () => {
    it('should return 200 OK with data', () => {
      const data = { id: '123', name: 'Test' };
      const response = successResponse(data);

      expect(response.statusCode).toBe(200);
      expect(response.headers!['Content-Type']).toBe('application/json');
      expect(response.headers!['Access-Control-Allow-Origin']).toBe('*');

      const body = JSON.parse(response.body!);
      expect(body.success).toBe(true);
      expect(body.data).toEqual(data);
    });

    it('should handle null data', () => {
      const response = successResponse(null);
      const body = JSON.parse(response.body!);

      expect(body.success).toBe(true);
      expect(body.data).toBeNull();
    });
  });

  describe('createdResponse', () => {
    it('should return 201 Created with data', () => {
      const data = { id: '123', name: 'New Resource' };
      const response = createdResponse(data);

      expect(response.statusCode).toBe(201);

      const body = JSON.parse(response.body!);
      expect(body.success).toBe(true);
      expect(body.data).toEqual(data);
    });
  });

  describe('paginatedResponse', () => {
    it('should return paginated data with metadata', () => {
      const items = [{ id: '1' }, { id: '2' }];
      const response = paginatedResponse(items, {
        total: 2,
        page: 1,
        pageSize: 20,
        totalPages: 1,
        hasMore: false,
      });

      expect(response.statusCode).toBe(200);

      const body = JSON.parse(response.body!);
      expect(body.success).toBe(true);
      expect(body.data).toEqual(items);
      expect(body.pagination).toEqual({
        total: 2,
        page: 1,
        pageSize: 20,
        totalPages: 1,
        hasMore: false,
      });
    });

    it('should include nextToken when hasMore is true', () => {
      const items = [{ id: '1' }];
      const nextToken = 'token123';
      const response = paginatedResponse(items, {
        total: 1,
        page: 1,
        pageSize: 20,
        totalPages: 1,
        hasMore: true,
        nextToken,
      });

      const body = JSON.parse(response.body!);
      expect(body.pagination.hasMore).toBe(true);
      expect(body.pagination.nextToken).toBe(nextToken);
    });
  });

  describe('errorResponse', () => {
    it('should return error response with correct format', () => {
      const response = errorResponse(
        'Invalid input',
        'Validation failed',
        400,
        'req-123',
        '/api/test'
      );

      expect(response.statusCode).toBe(400);

      const body = JSON.parse(response.body!);
      expect(body.success).toBe(false);
      expect(body.error).toBe('Invalid input');
      expect(body.message).toBe('Validation failed');
      expect(body.statusCode).toBe(400);
      expect(body.path).toBe('/api/test');
      expect(body.requestId).toBe('req-123');
      expect(body.timestamp).toBeDefined();
    });
  });

  describe('handleError', () => {
    it('should handle ValidationError (422)', () => {
      const error = new ValidationError('Invalid data');
      const response = handleError(error, 'req-123', '/api/test');

      expect(response.statusCode).toBe(422);

      const body = JSON.parse(response.body!);
      expect(body.success).toBe(false);
      expect(body.error).toBe('Validation Error');
      expect(body.message).toBe('Invalid data');
    });

    it('should handle NotFoundError (404)', () => {
      const error = new NotFoundError('Resource not found');
      const response = handleError(error, 'req-123', '/api/test');

      expect(response.statusCode).toBe(404);

      const body = JSON.parse(response.body!);
      expect(body.error).toBe('Not Found');
      expect(body.message).toBe('Resource not found');
    });

    it('should handle UnauthorizedError (401)', () => {
      const error = new UnauthorizedError('Invalid token');
      const response = handleError(error, 'req-123', '/api/test');

      expect(response.statusCode).toBe(401);

      const body = JSON.parse(response.body!);
      expect(body.error).toBe('Unauthorized');
    });

    it('should handle ForbiddenError (403)', () => {
      const error = new ForbiddenError('Access denied');
      const response = handleError(error, 'req-123', '/api/test');

      expect(response.statusCode).toBe(403);

      const body = JSON.parse(response.body!);
      expect(body.error).toBe('Forbidden');
    });

    it('should handle ConflictError (409)', () => {
      const error = new ConflictError('Resource already exists');
      const response = handleError(error, 'req-123', '/api/test');

      expect(response.statusCode).toBe(409);

      const body = JSON.parse(response.body!);
      expect(body.error).toBe('Conflict');
    });

    it('should handle generic Error (500)', () => {
      const error = new Error('Unexpected error');
      const response = handleError(error, 'req-123', '/api/test');

      expect(response.statusCode).toBe(500);

      const body = JSON.parse(response.body!);
      expect(body.error).toBe('Internal Server Error');
      expect(body.message).toBe('Unexpected error');
    });

    it('should handle unknown error type (500)', () => {
      const error = 'string error';
      const response = handleError(error, 'req-123', '/api/test');

      expect(response.statusCode).toBe(500);

      const body = JSON.parse(response.body!);
      expect(body.error).toBe('Internal Server Error');
    });
  });
});
