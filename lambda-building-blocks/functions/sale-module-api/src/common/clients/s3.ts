/**
 * S3 Client for i2speedex Sale Module
 * Provides reusable methods for S3 operations
 */

import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

// Environment variables
const REGION = process.env.AWS_REGION || 'eu-west-1';
const DOCUMENTS_BUCKET = process.env.DOCUMENTS_BUCKET_NAME || '';
const ATTACHMENTS_BUCKET = process.env.ATTACHMENTS_BUCKET_NAME || '';

// Create S3 client
export const s3Client = new S3Client({ region: REGION });

// ========================================
// Bucket Names
// ========================================

export const BucketNames = {
  Documents: DOCUMENTS_BUCKET,
  Attachments: ATTACHMENTS_BUCKET,
};

// ========================================
// Upload Functions
// ========================================

/**
 * Upload a file to S3
 */
export async function uploadFile(params: {
  bucket: string;
  key: string;
  body: Buffer | string;
  contentType?: string;
  metadata?: Record<string, string>;
}): Promise<void> {
  const command = new PutObjectCommand({
    Bucket: params.bucket,
    Key: params.key,
    Body: params.body,
    ContentType: params.contentType,
    ServerSideEncryption: 'AES256',
    Metadata: params.metadata,
  });

  await s3Client.send(command);
}

/**
 * Upload PDF invoice to documents bucket
 */
export async function uploadInvoicePDF(params: {
  saleId: string;
  pdfBuffer: Buffer;
  language?: string;
}): Promise<string> {
  const year = new Date().getFullYear();
  const language = params.language || 'it';
  const key = `pdfs/${year}/${params.saleId}/invoice-${params.saleId}-${language}.pdf`;

  await uploadFile({
    bucket: DOCUMENTS_BUCKET,
    key,
    body: params.pdfBuffer,
    contentType: 'application/pdf',
    metadata: {
      saleId: params.saleId,
      language,
      generatedAt: new Date().toISOString(),
    },
  });

  return key;
}

/**
 * Upload HTML invoice to documents bucket
 */
export async function uploadInvoiceHTML(params: {
  saleId: string;
  htmlContent: string;
  language?: string;
}): Promise<string> {
  const year = new Date().getFullYear();
  const language = params.language || 'it';
  const key = `html/${year}/${params.saleId}/invoice-${params.saleId}-${language}.html`;

  await uploadFile({
    bucket: DOCUMENTS_BUCKET,
    key,
    body: params.htmlContent,
    contentType: 'text/html',
    metadata: {
      saleId: params.saleId,
      language,
      generatedAt: new Date().toISOString(),
    },
  });

  return key;
}

/**
 * Upload SDI XML invoice to documents bucket
 */
export async function uploadInvoiceXML(params: {
  saleId: string;
  xmlContent: string;
}): Promise<string> {
  const year = new Date().getFullYear();
  const key = `xml/${year}/${params.saleId}/invoice-${params.saleId}.xml`;

  await uploadFile({
    bucket: DOCUMENTS_BUCKET,
    key,
    body: params.xmlContent,
    contentType: 'application/xml',
    metadata: {
      saleId: params.saleId,
      generatedAt: new Date().toISOString(),
    },
  });

  return key;
}

// ========================================
// Download Functions
// ========================================

/**
 * Get a file from S3
 */
export async function getFile(params: {
  bucket: string;
  key: string;
}): Promise<Buffer> {
  const command = new GetObjectCommand({
    Bucket: params.bucket,
    Key: params.key,
  });

  const response = await s3Client.send(command);

  if (!response.Body) {
    throw new Error('File not found or empty');
  }

  // Convert stream to buffer
  const chunks: Uint8Array[] = [];
  for await (const chunk of response.Body as any) {
    chunks.push(chunk);
  }

  return Buffer.concat(chunks);
}

/**
 * Check if a file exists in S3
 */
export async function fileExists(params: {
  bucket: string;
  key: string;
}): Promise<boolean> {
  try {
    const command = new HeadObjectCommand({
      Bucket: params.bucket,
      Key: params.key,
    });

    await s3Client.send(command);
    return true;
  } catch (error: any) {
    if (error.name === 'NotFound' || error.$metadata?.httpStatusCode === 404) {
      return false;
    }
    throw error;
  }
}

/**
 * Get file metadata
 */
export async function getFileMetadata(params: {
  bucket: string;
  key: string;
}): Promise<{
  size: number;
  contentType?: string;
  lastModified?: Date;
  metadata?: Record<string, string>;
}> {
  const command = new HeadObjectCommand({
    Bucket: params.bucket,
    Key: params.key,
  });

  const response = await s3Client.send(command);

  return {
    size: response.ContentLength || 0,
    contentType: response.ContentType,
    lastModified: response.LastModified,
    metadata: response.Metadata,
  };
}

// ========================================
// Delete Functions
// ========================================

/**
 * Delete a file from S3
 */
export async function deleteFile(params: {
  bucket: string;
  key: string;
}): Promise<void> {
  const command = new DeleteObjectCommand({
    Bucket: params.bucket,
    Key: params.key,
  });

  await s3Client.send(command);
}

/**
 * Delete all files for a sale (PDFs, HTML, XML)
 */
export async function deleteSaleDocuments(saleId: string): Promise<void> {
  const year = new Date().getFullYear();

  // List all files for this sale
  const prefixes = [
    `pdfs/${year}/${saleId}/`,
    `html/${year}/${saleId}/`,
    `xml/${year}/${saleId}/`,
  ];

  for (const prefix of prefixes) {
    const listCommand = new ListObjectsV2Command({
      Bucket: DOCUMENTS_BUCKET,
      Prefix: prefix,
    });

    const listResponse = await s3Client.send(listCommand);

    if (listResponse.Contents && listResponse.Contents.length > 0) {
      for (const object of listResponse.Contents) {
        if (object.Key) {
          await deleteFile({
            bucket: DOCUMENTS_BUCKET,
            key: object.Key,
          });
        }
      }
    }
  }
}

// ========================================
// Pre-signed URL Functions
// ========================================

/**
 * Generate pre-signed upload URL
 */
export async function generateUploadUrl(params: {
  bucket: string;
  key: string;
  contentType?: string;
  expiresIn?: number; // seconds
  metadata?: Record<string, string>;
}): Promise<string> {
  const command = new PutObjectCommand({
    Bucket: params.bucket,
    Key: params.key,
    ContentType: params.contentType,
    ServerSideEncryption: 'AES256',
    Metadata: params.metadata,
  });

  const url = await getSignedUrl(s3Client, command, {
    expiresIn: params.expiresIn || 900, // Default 15 minutes
  });

  return url;
}

/**
 * Generate pre-signed download URL
 */
export async function generateDownloadUrl(params: {
  bucket: string;
  key: string;
  expiresIn?: number; // seconds
  filename?: string; // Force download with specific filename
}): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: params.bucket,
    Key: params.key,
    ResponseContentDisposition: params.filename
      ? `attachment; filename="${params.filename}"`
      : undefined,
  });

  const url = await getSignedUrl(s3Client, command, {
    expiresIn: params.expiresIn || 3600, // Default 1 hour
  });

  return url;
}

/**
 * Generate download URL for invoice
 */
export async function generateInvoiceDownloadUrl(params: {
  saleId: string;
  format: 'pdf' | 'html' | 'xml';
  language?: string;
  expiresIn?: number;
}): Promise<string> {
  const year = new Date().getFullYear();
  const language = params.language || 'it';

  let key: string;
  let filename: string;

  switch (params.format) {
    case 'pdf':
      key = `pdfs/${year}/${params.saleId}/invoice-${params.saleId}-${language}.pdf`;
      filename = `invoice-${params.saleId}.pdf`;
      break;
    case 'html':
      key = `html/${year}/${params.saleId}/invoice-${params.saleId}-${language}.html`;
      filename = `invoice-${params.saleId}.html`;
      break;
    case 'xml':
      key = `xml/${year}/${params.saleId}/invoice-${params.saleId}.xml`;
      filename = `invoice-${params.saleId}.xml`;
      break;
  }

  // Check if file exists
  const exists = await fileExists({
    bucket: DOCUMENTS_BUCKET,
    key,
  });

  if (!exists) {
    throw new Error(`Invoice ${params.format.toUpperCase()} not found for sale ${params.saleId}`);
  }

  return generateDownloadUrl({
    bucket: DOCUMENTS_BUCKET,
    key,
    filename,
    expiresIn: params.expiresIn,
  });
}

/**
 * Generate upload URL for attachment
 */
export async function generateAttachmentUploadUrl(params: {
  entityType: 'sale' | 'buyer';
  entityId: string;
  filename: string;
  contentType?: string;
  expiresIn?: number;
}): Promise<{ uploadUrl: string; key: string }> {
  const key = `${params.entityType}s/${params.entityId}/${params.filename}`;

  const uploadUrl = await generateUploadUrl({
    bucket: ATTACHMENTS_BUCKET,
    key,
    contentType: params.contentType,
    expiresIn: params.expiresIn,
    metadata: {
      entityType: params.entityType,
      entityId: params.entityId,
    },
  });

  return {
    uploadUrl,
    key,
  };
}

// ========================================
// List Functions
// ========================================

/**
 * List files in a bucket with a prefix
 */
export async function listFiles(params: {
  bucket: string;
  prefix: string;
  maxKeys?: number;
}): Promise<Array<{ key: string; size: number; lastModified: Date }>> {
  const command = new ListObjectsV2Command({
    Bucket: params.bucket,
    Prefix: params.prefix,
    MaxKeys: params.maxKeys,
  });

  const response = await s3Client.send(command);

  return (response.Contents || []).map((item) => ({
    key: item.Key || '',
    size: item.Size || 0,
    lastModified: item.LastModified || new Date(),
  }));
}

/**
 * List all invoices for a sale
 */
export async function listSaleInvoices(saleId: string): Promise<{
  pdfs: string[];
  html: string[];
  xml: string[];
}> {
  const year = new Date().getFullYear();

  const [pdfs, html, xml] = await Promise.all([
    listFiles({
      bucket: DOCUMENTS_BUCKET,
      prefix: `pdfs/${year}/${saleId}/`,
    }),
    listFiles({
      bucket: DOCUMENTS_BUCKET,
      prefix: `html/${year}/${saleId}/`,
    }),
    listFiles({
      bucket: DOCUMENTS_BUCKET,
      prefix: `xml/${year}/${saleId}/`,
    }),
  ]);

  return {
    pdfs: pdfs.map((f) => f.key),
    html: html.map((f) => f.key),
    xml: xml.map((f) => f.key),
  };
}
