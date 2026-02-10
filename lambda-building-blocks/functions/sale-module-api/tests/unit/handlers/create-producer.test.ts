/**
 * Unit tests for create-producer handler
 */

import { handler } from '../../../src/handlers/producers/create-producer';
import { createAuthenticatedEvent, createEventWithBody } from '../../fixtures/event.fixture';
import * as dynamodb from '../../../src/common/clients/dynamodb';

// Mock DynamoDB client - partial mock to preserve utility functions
jest.mock('../../../src/common/clients/dynamodb', () => ({
  ...jest.requireActual('../../../src/common/clients/dynamodb'),
  putItem: jest.fn(),
}));

describe('Create Producer Handler', () => {
  const mockPutItem = dynamodb.putItem as jest.MockedFunction<typeof dynamodb.putItem>;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should create producer successfully', async () => {
    // Arrange
    mockPutItem.mockResolvedValueOnce(undefined);

    const requestBody = {
      companyName: 'Test Factory',
      address: '123 Factory Rd',
      city: 'Factory City',
      postalCode: '54321',
      country: 'IT',
    };

    const event = createEventWithBody(
      requestBody,
      createAuthenticatedEvent('admin@i2speedex.com')
    );

    // Act
    const response = await handler(event);

    // Assert
    expect(response.statusCode).toBe(201);

    const body = JSON.parse(response.body!);
    expect(body.success).toBe(true);
    expect(body.data).toMatchObject({
      companyName: 'Test Factory',
      address: '123 Factory Rd',
      city: 'Factory City',
      postalCode: '54321',
      country: 'IT',
      status: 'active',
    });

    // Verify producer was saved
    expect(mockPutItem).toHaveBeenCalled();
  });

  it('should return 422 when required fields are missing', async () => {
    // Arrange
    const requestBody = {
      companyName: 'Test Factory',
      // Missing required fields: address, city, postalCode, country
    };

    const event = createEventWithBody(
      requestBody,
      createAuthenticatedEvent('admin@i2speedex.com')
    );

    // Act
    const response = await handler(event);

    // Assert
    expect(response.statusCode).toBe(422);

    const body = JSON.parse(response.body!);
    expect(body.error).toBe('Validation Error');
  });

  it('should return 403 when user lacks write permission', async () => {
    // Arrange
    const requestBody = {
      companyName: 'Test Factory',
      address: '123 Factory Rd',
      city: 'Factory City',
      postalCode: '54321',
      country: 'IT',
    };

    const event = createEventWithBody(
      requestBody,
      createAuthenticatedEvent('viewer@i2speedex.com', ['viewer'])
    );

    // Act
    const response = await handler(event);

    // Assert
    expect(response.statusCode).toBe(403);

    const body = JSON.parse(response.body!);
    expect(body.error).toBe('Forbidden');
  });

  it('should handle DynamoDB error', async () => {
    // Arrange
    mockPutItem.mockRejectedValueOnce(new Error('DynamoDB error'));

    const requestBody = {
      companyName: 'Test Factory',
      address: '123 Factory Rd',
      city: 'Factory City',
      postalCode: '54321',
      country: 'IT',
    };

    const event = createEventWithBody(
      requestBody,
      createAuthenticatedEvent('admin@i2speedex.com')
    );

    // Act
    const response = await handler(event);

    // Assert
    expect(response.statusCode).toBe(500);

    const body = JSON.parse(response.body!);
    expect(body.success).toBe(false);
    expect(body.error).toBe('Internal Server Error');
  });
});
