/**
 * List Attachments Handler
 * GET /api/sales/{id}/attachments
 *
 * List all attachments for a sale
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { getUserContext, getPathParameter, canAccessResource } from '../../common/middleware/auth';
import { successResponse, handleError } from '../../common/utils/response';
import { NotFoundError } from '../../common/utils/validation';
import { getItem, queryItems, TableNames } from '../../common/clients/dynamodb';
import { generateDownloadUrl, BucketNames } from '../../common/clients/s3';
import { Sale, Attachment } from '../../common/types';

/**
 * List attachments handler
 */
export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;
  const path = event.path;

  try {
    // 1. Extract user context
    getUserContext(event);

    // 2. Get sale ID from path
    const saleId = getPathParameter(event, 'id');

    // 3. Get sale from DynamoDB
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

    // 4. Check access permissions
    const user = getUserContext(event);
    if (!canAccessResource(user, sale.createdBy)) {
      throw new NotFoundError(`Sale ${saleId} not found`);
    }

    // 5. Get attachments from DynamoDB
    const { items: attachments } = await queryItems<Attachment>({
      TableName: TableNames.Sales,
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :skPrefix)',
      ExpressionAttributeValues: {
        ':pk': `SALE#${saleId}`,
        ':skPrefix': 'ATTACHMENT#',
      },
      FilterExpression: 'attribute_not_exists(deletedAt)',
    });

    // 6. Generate download URLs for each attachment (valid 1 hour)
    const attachmentsWithUrls = await Promise.all(
      attachments.map(async (attachment) => {
        const downloadUrl = await generateDownloadUrl({
          bucket: BucketNames.Documents,
          key: attachment.s3Key,
          expiresIn: 3600, // 1 hour
        });

        return {
          attachmentId: attachment.attachmentId,
          fileName: attachment.fileName,
          fileType: attachment.fileType,
          fileSize: attachment.fileSize,
          description: attachment.description,
          downloadUrl,
          createdAt: attachment.createdAt,
          createdBy: attachment.createdBy,
        };
      })
    );

    // 7. Sort by creation date (newest first)
    attachmentsWithUrls.sort((a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    // 8. Return attachments with download URLs
    return successResponse({
      saleId,
      attachments: attachmentsWithUrls,
      count: attachmentsWithUrls.length,
      message: `Found ${attachmentsWithUrls.length} attachment(s)`,
    });

  } catch (error) {
    return handleError(error, requestId, path);
  }
}
