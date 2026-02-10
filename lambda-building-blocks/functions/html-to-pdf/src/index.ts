import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { generatePDF } from './pdf-generator';
import { uploadToS3 } from './s3-uploader';
import { validateInput, PdfGenerationRequest } from './validator';
import { logger } from './logger';

/**
 * AWS Lambda handler for HTML to PDF conversion
 * Supports Lambda Function URLs and API Gateway proxy integration
 */
export const handler = async (
  event: APIGatewayProxyEvent,
  context: Context
): Promise<APIGatewayProxyResult> => {
  const requestId = context.awsRequestId;
  const startTime = Date.now();

  logger.info('PDF generation request received', { requestId });

  try {
    // Parse request body
    const body = typeof event.body === 'string' ? JSON.parse(event.body) : event.body;

    // Validate input
    const validationResult = validateInput(body);
    if (!validationResult.valid) {
      logger.warn('Invalid input', { requestId, errors: validationResult.errors });
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Content-Type',
          'Access-Control-Allow-Methods': 'POST, OPTIONS'
        },
        body: JSON.stringify({
          success: false,
          error: 'Invalid input',
          details: validationResult.errors
        })
      };
    }

    const request = body as PdfGenerationRequest;

    // Generate PDF
    logger.info('Generating PDF', { requestId, format: request.options?.format || 'A4' });
    const pdfBuffer = await generatePDF(request.html, request.options);

    const pdfSize = pdfBuffer.length;
    logger.info('PDF generated successfully', { requestId, size: pdfSize });

    // Prepare response based on output format
    let response: any = {
      success: true,
      size: pdfSize,
      generationTime: (Date.now() - startTime) / 1000
    };

    const outputFormat = request.outputFormat || 'base64';

    switch (outputFormat) {
      case 'base64':
        response.pdfBase64 = pdfBuffer.toString('base64');
        break;

      case 's3':
        if (!process.env.PDF_BUCKET_NAME) {
          throw new Error('S3 bucket not configured');
        }
        const s3Key = `pdfs/${requestId}/${Date.now()}.pdf`;
        const s3Result = await uploadToS3(
          pdfBuffer,
          process.env.PDF_BUCKET_NAME,
          s3Key
        );
        response.s3Url = s3Result.s3Url;
        response.s3Key = s3Key;
        if (process.env.CLOUDFRONT_DOMAIN) {
          response.cdnUrl = `https://${process.env.CLOUDFRONT_DOMAIN}/${s3Key}`;
        }
        break;

      case 'url':
        // Generate presigned URL (requires S3 upload first)
        if (!process.env.PDF_BUCKET_NAME) {
          throw new Error('S3 bucket not configured for URL generation');
        }
        const urlKey = `pdfs/${requestId}/${Date.now()}.pdf`;
        const urlResult = await uploadToS3(
          pdfBuffer,
          process.env.PDF_BUCKET_NAME,
          urlKey,
          true // Generate presigned URL
        );
        response.url = urlResult.presignedUrl;
        response.s3Key = urlKey;
        break;

      default:
        throw new Error(`Unsupported output format: ${outputFormat}`);
    }

    logger.info('PDF request completed', {
      requestId,
      outputFormat,
      duration: response.generationTime
    });

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
      },
      body: JSON.stringify(response)
    };

  } catch (error: any) {
    logger.error('PDF generation failed', {
      requestId,
      error: error.message,
      stack: error.stack
    });

    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        success: false,
        error: 'PDF generation failed',
        message: error.message,
        requestId
      })
    };
  }
};
