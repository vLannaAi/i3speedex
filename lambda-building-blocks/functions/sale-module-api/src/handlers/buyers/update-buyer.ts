/**
 * Update Buyer Handler
 * PUT /api/buyers/{id}
 *
 * Update an existing buyer
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { getUserContext, requireWritePermission, getPathParameter, parseRequestBody } from '../../common/middleware/auth';
import { successResponse, handleError } from '../../common/utils/response';
import { NotFoundError } from '../../common/utils/validation';
import { getItem, updateItem, updateTimestamp, TableNames } from '../../common/clients/dynamodb';
import { Buyer, UpdateBuyerRequest } from '../../common/types';

/**
 * Update buyer handler
 */
export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;
  const path = event.path;

  try {
    // 1. Extract user context
    const user = getUserContext(event);

    // 2. Check permissions
    requireWritePermission(user);

    // 3. Get buyer ID from path
    const buyerId = getPathParameter(event, 'id');

    // 4. Parse request body
    const body = parseRequestBody<UpdateBuyerRequest>(event);

    // 5. Get existing buyer
    const existingBuyer = await getItem<Buyer>({
      TableName: TableNames.Buyers,
      Key: {
        PK: `BUYER#${buyerId}`,
        SK: 'METADATA',
      },
    });

    if (!existingBuyer || existingBuyer.deletedAt) {
      throw new NotFoundError(`Buyer ${buyerId} not found`);
    }

    // 6. Build update expression
    const updateExpressions: string[] = [];
    const expressionAttributeNames: Record<string, string> = {};
    const expressionAttributeValues: Record<string, any> = {};

    // Update simple fields
    const simpleFields: Array<keyof UpdateBuyerRequest> = [
      'code',
      'companyName',
      'industrialGroup',
      'sector',
      'vatNumber',
      'fiscalCode',
      'vatExempt',
      'currency',
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
      'pec',
      'sdi',
      'defaultPaymentMethod',
      'defaultPaymentTerms',
      'defaultOperator',
      'bankDetails',
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

    // 7. If no updates, return existing buyer
    if (updateExpressions.length === 0) {
      return successResponse(existingBuyer);
    }

    // 8. Update GSI attributes if relevant fields changed
    if (body.status && body.status !== existingBuyer.status) {
      updateExpressions.push('GSI1PK = :gsi1pk');
      expressionAttributeValues[':gsi1pk'] = `STATUS#${body.status}`;
    }

    if (body.companyName && body.companyName !== existingBuyer.companyName) {
      updateExpressions.push('GSI1SK = :gsi1sk', 'GSI2SK = :gsi2sk');
      expressionAttributeValues[':gsi1sk'] = body.companyName;
      expressionAttributeValues[':gsi2sk'] = body.companyName;
    }

    if (body.country && body.country !== existingBuyer.country) {
      updateExpressions.push('GSI2PK = :gsi2pk');
      expressionAttributeValues[':gsi2pk'] = `COUNTRY#${body.country}`;
    }

    // 9. Add timestamp updates
    const timestamp = updateTimestamp(user.username);
    updateExpressions.push('updatedAt = :updatedAt', 'updatedBy = :updatedBy');
    expressionAttributeValues[':updatedAt'] = timestamp.updatedAt;
    expressionAttributeValues[':updatedBy'] = timestamp.updatedBy;

    // 10. Update buyer in DynamoDB
    const updatedAttributes = await updateItem({
      TableName: TableNames.Buyers,
      Key: {
        PK: `BUYER#${buyerId}`,
        SK: 'METADATA',
      },
      UpdateExpression: `SET ${updateExpressions.join(', ')}`,
      ExpressionAttributeNames: expressionAttributeNames,
      ExpressionAttributeValues: expressionAttributeValues,
      ReturnValues: 'ALL_NEW',
    });

    // 11. Return updated buyer
    return successResponse(updatedAttributes);

  } catch (error) {
    return handleError(error, requestId, path);
  }
}
