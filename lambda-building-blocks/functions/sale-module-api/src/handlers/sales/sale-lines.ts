import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { handler as listLines } from './list-sale-lines';
import { handler as createLine } from './create-sale-line';
import { handler as updateLine } from './update-sale-line';
import { handler as deleteLine } from './delete-sale-line';

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const method = event.httpMethod;
  if (method === 'GET')    return listLines(event);
  if (method === 'POST')   return createLine(event);
  if (method === 'PUT')    return updateLine(event);
  if (method === 'DELETE') return deleteLine(event);
  return { statusCode: 405, body: JSON.stringify({ message: 'Method Not Allowed' }) };
}
