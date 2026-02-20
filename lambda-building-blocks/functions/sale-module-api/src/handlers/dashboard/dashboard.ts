import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { handler as getStats } from './get-dashboard-stats';
import { handler as getSalesByDate } from './get-sales-by-date-range';
import { handler as getTopBuyers } from './get-top-buyers';
import { handler as getRecentActivity } from './get-recent-activity';

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const segment = event.path.split('/').pop();
  if (segment === 'stats')           return getStats(event);
  if (segment === 'sales-by-date')   return getSalesByDate(event);
  if (segment === 'top-buyers')      return getTopBuyers(event);
  if (segment === 'recent-activity') return getRecentActivity(event);
  return { statusCode: 404, body: JSON.stringify({ message: 'Not Found' }) };
}
