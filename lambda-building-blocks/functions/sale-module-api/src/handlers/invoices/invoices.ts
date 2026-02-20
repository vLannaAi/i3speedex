import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { handler as generateHtml } from './generate-html-invoice';
import { handler as generatePdf } from './generate-pdf-invoice';
import { handler as generateSdi } from './generate-sdi-invoice';
import { handler as downloadUrl } from './get-invoice-download-url';

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const format = event.path.split('/').pop();
  const method = event.httpMethod;
  if (format === 'html'     && method === 'POST') return generateHtml(event);
  if (format === 'pdf'      && method === 'POST') return generatePdf(event);
  if (format === 'sdi'      && method === 'POST') return generateSdi(event);
  if (format === 'download' && method === 'GET')  return downloadUrl(event);
  return { statusCode: 405, body: JSON.stringify({ message: 'Method Not Allowed' }) };
}
