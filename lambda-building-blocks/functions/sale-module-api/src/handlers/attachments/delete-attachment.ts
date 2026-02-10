/**
 * Delete Attachment Handler
 * DELETE /api/sales/{id}/attachments/{attachmentId}
 *
 * Delete attachment (soft delete in DynamoDB, hard delete in S3)
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { getUserContext, requireWritePermission, getPathParameter, canAccessResource } from '../../common/middleware/auth';
import { successResponse, handleError } from '../../common/utils/response';
import { NotFoundError, ForbiddenError } from '../../common/utils/validation';
import { getItem, softDelete, TableNames } from '../../common/clients/dynamodb';
import { deleteFile, BucketNames } from '../../common/clients/s3';
import { Sale, Attachment } from '../../common/types';

/**
 * Delete attachment handler
 */
export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;
  const path = event.path;

  try {
    // 1. Extract user context
    const user = getUserContext(event);

    // 2. Check permissions
    requireWritePermission(user);

    // 3. Get sale ID and attachment ID from path
    const saleId = getPathParameter(event, 'id');
    const attachmentId = getPathParameter(event, 'attachmentId');

    // 4. Get sale from DynamoDB
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

    // 5. Check access permissions
    if (!canAccessResource(user, sale.createdBy)) {
      throw new ForbiddenError('You do not have permission to delete attachments for this sale');
    }

    // 6. Get attachment from DynamoDB
    const attachment = await getItem<Attachment>({
      TableName: TableNames.Sales,
      Key: {
        PK: `SALE#${saleId}`,
        SK: `ATTACHMENT#${attachmentId}`,
      },
    });

    if (!attachment || attachment.deletedAt) {
      throw new NotFoundError(`Attachment ${attachmentId} not found`);
    }

    // 7. Soft delete attachment in DynamoDB
    await softDelete(
      TableNames.Sales,
      {
        PK: `SALE#${saleId}`,
        SK: `ATTACHMENT#${attachmentId}`,
      },
      user.username
    );

    // 8. Hard delete file from S3
    try {
      await deleteFile({
        bucket: BucketNames.Documents,
        key: attachment.s3Key,
      });
    } catch (error) {
      console.warn(`Failed to delete file from S3: ${attachment.s3Key}`, error);
      // Continue even if S3 deletion fails (file might already be deleted)
    }

    // 9. Return success response
    return successResponse({
      saleId,
      attachmentId,
      message: 'Attachment deleted successfully',
    });

  } catch (error) {
    return handleError(error, requestId, path);
  }
}
