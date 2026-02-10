import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { logger } from './logger';

const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'eu-west-1'
});

export interface S3UploadResult {
  s3Url: string;
  presignedUrl?: string;
}

/**
 * Upload PDF buffer to S3
 * @param buffer - PDF file buffer
 * @param bucket - S3 bucket name
 * @param key - S3 object key
 * @param generatePresignedUrl - Whether to generate a presigned URL for download
 * @returns S3 URL and optional presigned URL
 */
export async function uploadToS3(
  buffer: Buffer,
  bucket: string,
  key: string,
  generatePresignedUrl: boolean = false
): Promise<S3UploadResult> {
  try {
    logger.info('Uploading to S3', { bucket, key, size: buffer.length });

    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: buffer,
      ContentType: 'application/pdf',
      ContentDisposition: 'inline',
      CacheControl: 'public, max-age=31536000', // 1 year cache
      Metadata: {
        generatedAt: new Date().toISOString(),
        generator: 'html-to-pdf-lambda'
      }
    });

    await s3Client.send(command);

    const s3Url = `s3://${bucket}/${key}`;
    logger.info('Upload successful', { s3Url });

    const result: S3UploadResult = { s3Url };

    // Generate presigned URL if requested
    if (generatePresignedUrl) {
      const getCommand = new GetObjectCommand({
        Bucket: bucket,
        Key: key
      });

      const presignedUrl = await getSignedUrl(s3Client, getCommand, {
        expiresIn: 3600 // 1 hour
      });

      result.presignedUrl = presignedUrl;
      logger.info('Presigned URL generated', { expiresIn: 3600 });
    }

    return result;

  } catch (error: any) {
    logger.error('S3 upload failed', {
      error: error.message,
      bucket,
      key
    });
    throw new Error(`Failed to upload to S3: ${error.message}`);
  }
}
