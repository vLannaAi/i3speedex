/**
 * SDI Invoice Generator Lambda Function
 * Generates Italian FatturaPA (SDI) XML invoices
 */

import { Context, APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { buildFatturaXML } from './xml-builder';
import { generateFatturaFilename, validateXML } from './validators';
import { SDIInvoiceRequest, SDIInvoiceResponse } from './types';

const s3Client = new S3Client({ region: process.env.AWS_REGION || 'eu-west-1' });
const S3_BUCKET = process.env.S3_BUCKET || '';

/**
 * Lambda handler for SDI invoice generation
 */
export async function handler(
  event: APIGatewayProxyEvent,
  context: Context
): Promise<APIGatewayProxyResult> {
  const startTime = Date.now();
  const requestId = context.awsRequestId;

  console.log(JSON.stringify({
    timestamp: new Date().toISOString(),
    level: 'INFO',
    message: 'SDI invoice generation request received',
    requestId
  }));

  try {
    // Parse request body
    if (!event.body) {
      return createErrorResponse(400, 'Request body is required', requestId);
    }

    const request: SDIInvoiceRequest = JSON.parse(event.body);

    // Validate required fields
    if (!request.invoice) {
      return createErrorResponse(400, 'Invoice data is required', requestId);
    }

    // Set defaults
    const outputFormat = request.outputFormat || 'xml';
    const shouldValidate = request.validate === true; // Default to false (XSD validation requires native module)

    // Generate XML
    const xml = buildFatturaXML(request.invoice);
    const xmlSize = Buffer.byteLength(xml, 'utf8');

    // Validate XML if requested
    let validationErrors: string[] = [];
    if (shouldValidate) {
      const validationResult = validateXML(xml);
      if (!validationResult.valid) {
        validationErrors = validationResult.errors;
        console.warn(JSON.stringify({
          timestamp: new Date().toISOString(),
          level: 'WARN',
          message: 'XML validation errors detected',
          requestId,
          errors: validationErrors
        }));

        // Return validation errors
        return {
          statusCode: 400,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type'
          },
          body: JSON.stringify({
            success: false,
            error: 'XML validation failed',
            validationErrors,
            requestId
          })
        };
      }
    }

    // Generate filename if not provided
    const filename = request.filename || generateFatturaFilename(
      request.invoice.fatturaElettronicaHeader.cedentePrestatore.datiAnagrafici.idFiscaleIVA?.idCodice || '00000000000',
      request.invoice.fatturaElettronicaHeader.datiTrasmissione.progressivoInvio
    );

    const generationTime = Date.now() - startTime;

    // Handle output format
    if (outputFormat === 'xml') {
      // Return XML directly
      const response: SDIInvoiceResponse = {
        success: true,
        xml,
        filename,
        size: xmlSize,
        generationTime
      };

      console.log(JSON.stringify({
        timestamp: new Date().toISOString(),
        level: 'INFO',
        message: 'SDI invoice generated successfully',
        requestId,
        filename,
        size: xmlSize,
        duration: generationTime
      }));

      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type'
        },
        body: JSON.stringify(response)
      };
    }

    // Upload to S3
    const s3Key = `invoices/${requestId}/${filename}`;
    await s3Client.send(new PutObjectCommand({
      Bucket: S3_BUCKET,
      Key: s3Key,
      Body: xml,
      ContentType: 'application/xml',
      Metadata: {
        'request-id': requestId,
        'generation-time': String(generationTime)
      }
    }));

    const s3Url = `s3://${S3_BUCKET}/${s3Key}`;

    if (outputFormat === 's3') {
      // Return S3 URL
      const response: SDIInvoiceResponse = {
        success: true,
        s3Url,
        s3Key,
        filename,
        size: xmlSize,
        generationTime
      };

      console.log(JSON.stringify({
        timestamp: new Date().toISOString(),
        level: 'INFO',
        message: 'SDI invoice uploaded to S3',
        requestId,
        s3Key,
        size: xmlSize,
        duration: generationTime
      }));

      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type'
        },
        body: JSON.stringify(response)
      };
    }

    // Generate presigned URL (outputFormat === 'url')
    const presignedUrl = await getSignedUrl(
      s3Client,
      new PutObjectCommand({
        Bucket: S3_BUCKET,
        Key: s3Key
      }),
      { expiresIn: 3600 } // 1 hour
    );

    const response: SDIInvoiceResponse = {
      success: true,
      presignedUrl,
      s3Key,
      filename,
      size: xmlSize,
      generationTime
    };

    console.log(JSON.stringify({
      timestamp: new Date().toISOString(),
      level: 'INFO',
      message: 'SDI invoice uploaded to S3 with presigned URL',
      requestId,
      s3Key,
      size: xmlSize,
      duration: generationTime
    }));

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
      },
      body: JSON.stringify(response)
    };

  } catch (error: any) {
    console.error(JSON.stringify({
      timestamp: new Date().toISOString(),
      level: 'ERROR',
      message: 'SDI invoice generation failed',
      requestId,
      error: error.message,
      stack: error.stack
    }));

    return createErrorResponse(
      500,
      `Invoice generation failed: ${error.message}`,
      requestId
    );
  }
}

/**
 * Create error response
 */
function createErrorResponse(
  statusCode: number,
  message: string,
  requestId: string
): APIGatewayProxyResult {
  const response: SDIInvoiceResponse = {
    success: false,
    error: statusCode === 400 ? 'Invalid request' : 'Invoice generation failed',
    message,
    requestId,
    filename: '',
    size: 0,
    generationTime: 0
  };

  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    },
    body: JSON.stringify(response)
  };
}
