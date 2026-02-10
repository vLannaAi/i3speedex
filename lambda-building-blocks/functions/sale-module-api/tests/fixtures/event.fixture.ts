/**
 * Test fixtures for API Gateway events
 */

import { APIGatewayProxyEvent } from 'aws-lambda';

export function createMockEvent(overrides: Partial<APIGatewayProxyEvent> = {}): APIGatewayProxyEvent {
  return {
    body: null,
    headers: {},
    multiValueHeaders: {},
    httpMethod: 'GET',
    isBase64Encoded: false,
    path: '/api/test',
    pathParameters: null,
    queryStringParameters: null,
    multiValueQueryStringParameters: null,
    stageVariables: null,
    requestContext: {
      accountId: '123456789012',
      apiId: 'test-api',
      authorizer: {
        jwt: {
          claims: {
            'cognito:username': 'admin@i2speedex.com',
            'cognito:groups': ['Admin'],
            email: 'admin@i2speedex.com',
            sub: 'test-user-id',
          },
          scopes: [],
        },
      },
      domainName: 'test.execute-api.eu-west-1.amazonaws.com',
      domainPrefix: 'test',
      extendedRequestId: 'test-extended-id',
      httpMethod: 'GET',
      identity: {
        accessKey: null,
        accountId: null,
        caller: null,
        cognitoAuthenticationProvider: null,
        cognitoAuthenticationType: null,
        cognitoIdentityId: null,
        cognitoIdentityPoolId: null,
        principalOrgId: null,
        sourceIp: '127.0.0.1',
        user: null,
        userAgent: 'test-agent',
        userArn: null,
        clientCert: null,
      },
      path: '/api/test',
      protocol: 'HTTP/1.1',
      requestId: 'test-request-id',
      requestTime: '01/Jan/2026:00:00:00 +0000',
      requestTimeEpoch: 1704067200000,
      resourceId: 'test-resource',
      resourcePath: '/api/test',
      stage: 'test',
    },
    resource: '/api/test',
    ...overrides,
  } as APIGatewayProxyEvent;
}

export function createAuthenticatedEvent(
  username: string,
  groups: string[] = ['admin'],
  overrides: Partial<APIGatewayProxyEvent> = {}
): APIGatewayProxyEvent {
  return createMockEvent({
    ...overrides,
    requestContext: {
      ...(overrides.requestContext || createMockEvent().requestContext),
      authorizer: {
        jwt: {
          claims: {
            'cognito:username': username,
            'cognito:groups': groups,
            email: username,
            sub: 'test-user-id',
          },
          scopes: [],
        },
      },
    },
  });
}

export function createEventWithBody(body: any, overrides: Partial<APIGatewayProxyEvent> = {}): APIGatewayProxyEvent {
  return createMockEvent({
    ...overrides,
    body: JSON.stringify(body),
    httpMethod: 'POST',
  });
}

export function createEventWithPathParams(
  pathParameters: Record<string, string>,
  overrides: Partial<APIGatewayProxyEvent> = {}
): APIGatewayProxyEvent {
  return createMockEvent({
    ...overrides,
    pathParameters,
  });
}

export function createEventWithQueryParams(
  queryStringParameters: Record<string, string>,
  overrides: Partial<APIGatewayProxyEvent> = {}
): APIGatewayProxyEvent {
  return createMockEvent({
    ...overrides,
    queryStringParameters,
  });
}
