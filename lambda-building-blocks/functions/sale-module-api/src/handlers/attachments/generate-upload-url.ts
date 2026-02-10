/**
 * Generate Upload URL Handler
 * POST /api/sales/{id}/upload-url
 *
 * Generate pre-signed S3 URL for direct file upload
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { getUserContext, requireWritePermission, getPathParameter, parseRequestBody, canAccessResource } from '../../common/middleware/auth';
import { successResponse, handleError } from '../../common/utils/response';
import { NotFoundError, ForbiddenError, ValidationError } from '../../common/utils/validation';
import { getItem, TableNames } from '../../common/clients/dynamodb';
import { generateUploadUrl, BucketNames } from '../../common/clients/s3';
import { Sale } from '../../common/types';
import { v4 as uuidv4 } from 'uuid';

interface UploadUrlRequest {
  fileName: string;
  fileType: string;
  fileSize: number;
}

/**
 * Generate pre-signed upload URL handler
 */
export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;
  const path = event.path;

  try {
    // 1. Extract user context
    const user = getUserContext(event);

    // 2. Check permissions
    requireWritePermission(user);

    // 3. Get sale ID from path
    const saleId = getPathParameter(event, 'id');

    // 4. Parse request body
    const body = parseRequestBody<UploadUrlRequest>(event);

    // 5. Validate request
    if (!body.fileName || !body.fileType || !body.fileSize) {
      throw new ValidationError('fileName, fileType, and fileSize are required');
    }

    // Validate file size (max 10MB)
    if (body.fileSize > 10 * 1024 * 1024) {
      throw new ValidationError('File size exceeds maximum limit of 10MB');
    }

    // Validate file type (allow common document types)
    const allowedTypes = [
      'application/pdf',
      'image/jpeg',
      'image/jpg',
      'image/png',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/plain',
      'text/csv',
    ];

    if (!allowedTypes.includes(body.fileType)) {
      throw new ValidationError('File type not allowed. Allowed types: PDF, JPEG, PNG, DOC, DOCX, XLS, XLSX, TXT, CSV');
    }

    // 6. Get sale from DynamoDB
    const sale = await getItem<Sale>({
      TableName: TableNames.Sales,
      Key: {
        PK: `SALE#${saleId}`,
        SK: 'METADATA',
      },
    });

    if (!sale || sale.deletedAt) {
      throw new NotFoundError(`Sale ${saleId} not found`);
    }

    // 7. Check access permissions
    if (!canAccessResource(user, sale.createdBy)) {
      throw new ForbiddenError('You do not have permission to upload files for this sale');
    }

    // 8. Generate attachment ID and S3 key
    const attachmentId = uuidv4();
    const year = new Date().getFullYear();
    const fileExtension = body.fileName.split('.').pop();
    const s3Key = `attachments/${year}/${saleId}/${attachmentId}.${fileExtension}`;

    // 9. Generate pre-signed upload URL (valid for 15 minutes)
    const uploadUrl = await generateUploadUrl({
      bucket: BucketNames.Documents,
      key: s3Key,
      contentType: body.fileType,
      expiresIn: 900, // 15 minutes
    });

    // 10. Return upload URL and metadata
    return successResponse({
      attachmentId,
      uploadUrl,
      s3Key,
      expiresIn: 900,
      message: 'Upload URL generated successfully. Upload your file to this URL, then register the attachment.',
    });

  } catch (error) {
    return handleError(error, requestId, path);
  }
}
