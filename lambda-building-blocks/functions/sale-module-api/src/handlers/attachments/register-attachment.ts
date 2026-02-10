/**
 * Register Attachment Handler
 * POST /api/sales/{id}/attachments
 *
 * Register uploaded file as attachment in DynamoDB
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { getUserContext, requireWritePermission, getPathParameter, parseRequestBody, canAccessResource } from '../../common/middleware/auth';
import { createdResponse, handleError } from '../../common/utils/response';
import { NotFoundError, ForbiddenError, ValidationError } from '../../common/utils/validation';
import { getItem, putItem, updateTimestamp, TableNames } from '../../common/clients/dynamodb';
import { Sale, Attachment } from '../../common/types';

interface RegisterAttachmentRequest {
  attachmentId: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  s3Key: string;
  description?: string;
}

/**
 * Register attachment handler
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
    const body = parseRequestBody<RegisterAttachmentRequest>(event);

    // 5. Validate request
    if (!body.attachmentId || !body.fileName || !body.fileType || !body.fileSize || !body.s3Key) {
      throw new ValidationError('attachmentId, fileName, fileType, fileSize, and s3Key are required');
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
      throw new ForbiddenError('You do not have permission to register attachments for this sale');
    }

    // 8. Create attachment record
    const timestamp = updateTimestamp(user.username);

    const attachment: Attachment = {
      PK: `SALE#${saleId}`,
      SK: `ATTACHMENT#${body.attachmentId}`,
      attachmentId: body.attachmentId,
      saleId,
      fileName: body.fileName,
      fileType: body.fileType,
      fileSize: body.fileSize,
      s3Key: body.s3Key,
      description: body.description,
      createdAt: timestamp.updatedAt,
      createdBy: user.username,
      updatedAt: timestamp.updatedAt,
      updatedBy: user.username,
    };

    // 9. Save attachment to DynamoDB
    await putItem({
      TableName: TableNames.Sales,
      Item: attachment,
    });

    // 10. Return created attachment
    return createdResponse(attachment);

  } catch (error) {
    return handleError(error, requestId, path);
  }
}
