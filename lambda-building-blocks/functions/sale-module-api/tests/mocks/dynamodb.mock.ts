/**
 * DynamoDB Mock Utilities
 */

export const mockDynamoDBClient = {
  send: jest.fn(),
};

export const mockGetCommand = jest.fn();
export const mockPutCommand = jest.fn();
export const mockUpdateCommand = jest.fn();
export const mockDeleteCommand = jest.fn();
export const mockQueryCommand = jest.fn();
export const mockScanCommand = jest.fn();

export function mockDynamoDBGet(returnValue: any) {
  mockDynamoDBClient.send.mockResolvedValueOnce({
    Item: returnValue,
  });
}

export function mockDynamoDBPut() {
  mockDynamoDBClient.send.mockResolvedValueOnce({});
}

export function mockDynamoDBUpdate(returnValue: any) {
  mockDynamoDBClient.send.mockResolvedValueOnce({
    Attributes: returnValue,
  });
}

export function mockDynamoDBQuery(items: any[], lastEvaluatedKey?: any) {
  mockDynamoDBClient.send.mockResolvedValueOnce({
    Items: items,
    LastEvaluatedKey: lastEvaluatedKey,
  });
}

export function mockDynamoDBScan(items: any[], lastEvaluatedKey?: any) {
  mockDynamoDBClient.send.mockResolvedValueOnce({
    Items: items,
    LastEvaluatedKey: lastEvaluatedKey,
  });
}

export function mockDynamoDBError(errorMessage: string) {
  mockDynamoDBClient.send.mockRejectedValueOnce(new Error(errorMessage));
}

export function resetDynamoDBMocks() {
  mockDynamoDBClient.send.mockReset();
}
