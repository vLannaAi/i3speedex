import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { handler as list } from './list-sales';
import { handler as get } from './get-sale';
import { handler as create } from './create-sale';
import { handler as update } from './update-sale';
import { handler as remove } from './delete-sale';

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const method = event.httpMethod;
  const id = event.pathParameters?.id;
  if (method === 'GET' && !id) return list(event);
  if (method === 'GET' && id)  return get(event);
  if (method === 'POST')       return create(event);
  if (method === 'PUT')        return update(event);
  if (method === 'DELETE')     return remove(event);
  return { statusCode: 405, body: JSON.stringify({ message: 'Method Not Allowed' }) };
}
