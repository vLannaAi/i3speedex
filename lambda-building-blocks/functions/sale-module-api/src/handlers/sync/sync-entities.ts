import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { handler as syncBuyers } from './sync-buyers';
import { handler as syncProducers } from './sync-producers';

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const entity = event.path.split('/').pop();
  if (entity === 'buyers')    return syncBuyers(event);
  if (entity === 'producers') return syncProducers(event);
  return { statusCode: 404, body: JSON.stringify({ message: 'Not Found' }) };
}
