import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { handler as searchSales } from './search-sales';
import { handler as searchBuyers } from './search-buyers';
import { handler as searchProducers } from './search-producers';

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const entity = event.path.split('/').pop();
  if (entity === 'sales')     return searchSales(event);
  if (entity === 'buyers')    return searchBuyers(event);
  if (entity === 'producers') return searchProducers(event);
  return { statusCode: 404, body: JSON.stringify({ message: 'Not Found' }) };
}
