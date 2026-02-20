import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { handler as register } from './register-attachment';
import { handler as list } from './list-attachments';
import { handler as remove } from './delete-attachment';

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const method = event.httpMethod;
  const attachmentId = event.pathParameters?.attachmentId;
  if (method === 'POST' && !attachmentId) return register(event);
  if (method === 'GET')                   return list(event);
  if (method === 'DELETE')                return remove(event);
  return { statusCode: 405, body: JSON.stringify({ message: 'Method Not Allowed' }) };
}
