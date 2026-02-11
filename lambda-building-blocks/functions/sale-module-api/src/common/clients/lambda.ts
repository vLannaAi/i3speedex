/**
 * Lambda Client for i2speedex Sale Module
 * Provides methods to invoke building block Lambda functions
 */

import {
  LambdaClient,
  InvokeCommand,
  InvokeCommandInput,
} from '@aws-sdk/client-lambda';

// Environment variables
const REGION = process.env.AWS_REGION || 'eu-west-1';
const TEMPLATE_RENDERER_FUNCTION = process.env.TEMPLATE_RENDERER_FUNCTION_NAME || '';
const HTML_TO_PDF_FUNCTION = process.env.HTML_TO_PDF_FUNCTION_NAME || '';
const SDI_GENERATOR_FUNCTION = process.env.SDI_GENERATOR_FUNCTION_NAME || '';

// Create Lambda client
export const lambdaClient = new LambdaClient({ region: REGION });

// ========================================
// Function Names
// ========================================

export const FunctionNames = {
  TemplateRenderer: TEMPLATE_RENDERER_FUNCTION,
  HtmlToPdf: HTML_TO_PDF_FUNCTION,
  SdiGenerator: SDI_GENERATOR_FUNCTION,
};

// ========================================
// Helper Functions
// ========================================

/**
 * Invoke a Lambda function that expects an API Gateway proxy event.
 * Wraps the payload in an APIGatewayProxyEvent-like structure so the
 * target Lambda can read it from event.body.
 */
async function invokeFunction<TRequest, TResponse>(
  functionName: string,
  payload: TRequest
): Promise<TResponse> {
  const event = {
    httpMethod: 'POST',
    path: '/',
    body: JSON.stringify(payload),
    headers: { 'Content-Type': 'application/json' },
    pathParameters: null,
    queryStringParameters: null,
    requestContext: { requestId: `invoke-${Date.now()}` },
    isBase64Encoded: false,
  };

  const params: InvokeCommandInput = {
    FunctionName: functionName,
    InvocationType: 'RequestResponse',
    Payload: Buffer.from(JSON.stringify(event)),
  };

  const command = new InvokeCommand(params);
  const response = await lambdaClient.send(command);

  if (response.FunctionError) {
    const errorPayload = response.Payload
      ? JSON.parse(Buffer.from(response.Payload).toString())
      : { error: 'Unknown error' };

    throw new Error(
      `Lambda function error: ${response.FunctionError} - ${JSON.stringify(errorPayload)}`
    );
  }

  if (!response.Payload) {
    throw new Error('Lambda function returned no payload');
  }

  const result = JSON.parse(Buffer.from(response.Payload).toString());

  // Check for HTTP error responses (statusCode >= 400)
  if (result.statusCode && result.statusCode >= 400) {
    const body = typeof result.body === 'string' ? JSON.parse(result.body) : result.body;
    throw new Error(`Lambda function returned error: ${body.error || body.message || 'Unknown error'}`);
  }

  return result;
}

// ========================================
// Template Renderer
// ========================================

export interface TemplateRendererRequest {
  template: string; // Template name (e.g., 'invoice')
  language: 'it' | 'en' | 'de' | 'fr';
  data: Record<string, any>; // Template data
}

export interface TemplateRendererResponse {
  statusCode: number;
  body: string; // JSON string containing { html: string }
  headers: Record<string, string>;
}

/**
 * Render a template using Template Renderer Lambda
 */
export async function renderTemplate(params: {
  template: string;
  language: 'it' | 'en' | 'de' | 'fr';
  data: Record<string, any>;
}): Promise<string> {
  const payload: TemplateRendererRequest = {
    template: params.template,
    language: params.language,
    data: params.data,
  };

  const response = await invokeFunction<TemplateRendererRequest, TemplateRendererResponse>(
    TEMPLATE_RENDERER_FUNCTION,
    payload
  );

  // Parse response body
  const body = typeof response.body === 'string' ? JSON.parse(response.body) : response.body;

  if (!body.html) {
    throw new Error('Template renderer did not return HTML');
  }

  return body.html;
}

// ========================================
// HTML to PDF Converter
// ========================================

export interface HtmlToPdfRequest {
  html: string; // HTML content to convert
  options?: {
    format?: 'A4' | 'Letter';
    margin?: {
      top?: string;
      right?: string;
      bottom?: string;
      left?: string;
    };
    displayHeaderFooter?: boolean;
    headerTemplate?: string;
    footerTemplate?: string;
    printBackground?: boolean;
  };
}

export interface HtmlToPdfResponse {
  statusCode: number;
  body: string; // Base64-encoded PDF or JSON string
  headers: Record<string, string>;
  isBase64Encoded?: boolean;
}

/**
 * Convert HTML to PDF using HTML-to-PDF Lambda
 */
export async function convertHtmlToPdf(params: {
  html: string;
  options?: HtmlToPdfRequest['options'];
}): Promise<Buffer> {
  const payload: HtmlToPdfRequest = {
    html: params.html,
    options: params.options || {
      format: 'A4',
      printBackground: true,
      margin: {
        top: '20mm',
        right: '15mm',
        bottom: '20mm',
        left: '15mm',
      },
    },
  };

  const response = await invokeFunction<HtmlToPdfRequest, HtmlToPdfResponse>(
    HTML_TO_PDF_FUNCTION,
    payload
  );

  // Parse the response body from the API Gateway-style response
  const body = typeof response.body === 'string' ? JSON.parse(response.body) : response.body;

  // Check for pdfBase64 field (default output format from html-to-pdf Lambda)
  if (body.pdfBase64) {
    return Buffer.from(body.pdfBase64, 'base64');
  }

  // Fallback: check if response itself is base64 encoded
  if (response.isBase64Encoded && typeof response.body === 'string') {
    return Buffer.from(response.body, 'base64');
  }

  // Fallback: check for pdf field
  if (body.pdf) {
    return Buffer.from(body.pdf, 'base64');
  }

  throw new Error('HTML-to-PDF did not return valid PDF data');
}

// ========================================
// SDI Invoice Generator
// ========================================

export interface SdiGeneratorRequest {
  sale: {
    saleId: string;
    saleNumber: number;
    saleDate: string;
    currency: string;
    paymentMethod?: string;
    paymentTerms?: string;
  };
  buyer: {
    companyName: string;
    vatNumber?: string;
    fiscalCode?: string;
    address: string;
    city: string;
    province?: string;
    postalCode: string;
    country: string;
    pec?: string;
    sdi?: string;
  };
  producer: {
    companyName: string;
    vatNumber?: string;
    fiscalCode?: string;
    address: string;
    city: string;
    province?: string;
    postalCode: string;
    country: string;
  };
  lines: Array<{
    lineNumber: number;
    productDescription: string;
    quantity: number;
    unitPrice: number;
    taxRate: number;
    totalAmount: number;
  }>;
  totals: {
    subtotal: number;
    taxAmount: number;
    total: number;
  };
}

export interface SdiGeneratorResponse {
  statusCode: number;
  body: string; // JSON string containing { xml: string }
  headers: Record<string, string>;
}

/**
 * Generate Italian SDI XML using SDI Generator Lambda
 */
export async function generateSdiXml(params: SdiGeneratorRequest): Promise<string> {
  const response = await invokeFunction<SdiGeneratorRequest, SdiGeneratorResponse>(
    SDI_GENERATOR_FUNCTION,
    params
  );

  // Parse response body
  const body = typeof response.body === 'string' ? JSON.parse(response.body) : response.body;

  if (!body.xml) {
    throw new Error('SDI generator did not return XML');
  }

  return body.xml;
}

// ========================================
// Complete Invoice Generation Workflow
// ========================================

/**
 * Generate complete invoice (HTML + PDF)
 */
export async function generateInvoice(params: {
  template: string;
  language: 'it' | 'en' | 'de' | 'fr';
  data: Record<string, any>;
}): Promise<{
  html: string;
  pdf: Buffer;
}> {
  // Step 1: Render HTML template
  const html = await renderTemplate({
    template: params.template,
    language: params.language,
    data: params.data,
  });

  // Step 2: Convert HTML to PDF
  const pdf = await convertHtmlToPdf({ html });

  return {
    html,
    pdf,
  };
}

/**
 * Generate complete invoice set (HTML + PDF + SDI XML for IT invoices)
 */
export async function generateCompleteInvoice(params: {
  template: string;
  language: 'it' | 'en' | 'de' | 'fr';
  data: Record<string, any>;
  sdiData?: SdiGeneratorRequest;
}): Promise<{
  html: string;
  pdf: Buffer;
  xml?: string;
}> {
  // Generate HTML and PDF
  const { html, pdf } = await generateInvoice({
    template: params.template,
    language: params.language,
    data: params.data,
  });

  // Generate SDI XML only for Italian invoices
  let xml: string | undefined;
  if (params.language === 'it' && params.sdiData) {
    xml = await generateSdiXml(params.sdiData);
  }

  return {
    html,
    pdf,
    xml,
  };
}
