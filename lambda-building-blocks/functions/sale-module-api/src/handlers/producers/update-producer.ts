/**
 * Update Producer Handler
 * PUT /api/producers/{id}
 *
 * Update an existing producer
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { getUserContext, requireWritePermission, getPathParameter, parseRequestBody } from '../../common/middleware/auth';
import { successResponse, handleError } from '../../common/utils/response';
import { NotFoundError } from '../../common/utils/validation';
import { getItem, updateItem, updateTimestamp, TableNames } from '../../common/clients/dynamodb';
import { Producer, UpdateProducerRequest } from '../../common/types';

/**
 * Update producer handler
 */
export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;
  const path = event.path;

  try {
    // 1. Extract user context
    const user = getUserContext(event);

    // 2. Check permissions
    requireWritePermission(user);

    // 3. Get producer ID from path
    const producerId = getPathParameter(event, 'id');

    // 4. Parse request body
    const body = parseRequestBody<UpdateProducerRequest>(event);

    // 5. Get existing producer
    const existingProducer = await getItem<Producer>({
      TableName: TableNames.Producers,
      Key: {
        PK: `PRODUCER#${producerId}`,
        SK: 'METADATA',
      },
    });

    if (!existingProducer || existingProducer.deletedAt) {
      throw new NotFoundError(`Producer ${producerId} not found`);
    }

    // 6. Build update expression
    const updateExpressions: string[] = [];
    const expressionAttributeNames: Record<string, string> = {};
    const expressionAttributeValues: Record<string, any> = {};

    // Update simple fields
    const simpleFields: Array<keyof UpdateProducerRequest> = [
      'code',
      'companyName',
      'vatNumber',
      'fiscalCode',
      'sdi',
      'pec',
      'preferredLanguage',
      'subName',
      'address',
      'poBox',
      'city',
      'province',
      'postalCode',
      'country',
      'mainContact',
      'email',
      'phone',
      'fax',
      'website',
      'defaultOperator',
      'revenuePercentage',
      'bankDetails',
      'qualityAssurance',
      'productionArea',
      'markets',
      'materials',
      'products',
      'standardProducts',
      'diameterRange',
      'maxLength',
      'quantity',
      'notes',
      'status',
    ];

    for (const field of simpleFields) {
      if (body[field] !== undefined) {
        updateExpressions.push(`#${field} = :${field}`);
        expressionAttributeNames[`#${field}`] = field;
        expressionAttributeValues[`:${field}`] = body[field];
      }
    }

    // 7. If no updates, return existing producer
    if (updateExpressions.length === 0) {
      return successResponse(existingProducer);
    }

    // 8. Update GSI attributes if relevant fields changed
    if (body.status && body.status !== existingProducer.status) {
      updateExpressions.push('GSI1PK = :gsi1pk');
      expressionAttributeValues[':gsi1pk'] = `STATUS#${body.status}`;
    }

    if (body.companyName && body.companyName !== existingProducer.companyName) {
      updateExpressions.push('GSI1SK = :gsi1sk', 'GSI2SK = :gsi2sk');
      expressionAttributeValues[':gsi1sk'] = body.companyName;
      expressionAttributeValues[':gsi2sk'] = body.companyName;
    }

    if (body.country && body.country !== existingProducer.country) {
      updateExpressions.push('GSI2PK = :gsi2pk');
      expressionAttributeValues[':gsi2pk'] = `COUNTRY#${body.country}`;
    }

    // 9. Add timestamp updates
    const timestamp = updateTimestamp(user.username);
    updateExpressions.push('updatedAt = :updatedAt', 'updatedBy = :updatedBy');
    expressionAttributeValues[':updatedAt'] = timestamp.updatedAt;
    expressionAttributeValues[':updatedBy'] = timestamp.updatedBy;

    // 10. Update producer in DynamoDB
    const updatedAttributes = await updateItem({
      TableName: TableNames.Producers,
      Key: {
        PK: `PRODUCER#${producerId}`,
        SK: 'METADATA',
      },
      UpdateExpression: `SET ${updateExpressions.join(', ')}`,
      ExpressionAttributeNames: expressionAttributeNames,
      ExpressionAttributeValues: expressionAttributeValues,
      ReturnValues: 'ALL_NEW',
    });

    // 11. Return updated producer
    return successResponse(updatedAttributes);

  } catch (error) {
    return handleError(error, requestId, path);
  }
}
