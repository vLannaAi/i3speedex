/**
 * Update Sale Handler
 * PUT /api/sales/{id}
 *
 * Update an existing sale
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { getUserContext, requireWritePermission, getPathParameter, parseRequestBody, canAccessResource } from '../../common/middleware/auth';
import { successResponse, handleError } from '../../common/utils/response';
import { NotFoundError, ForbiddenError } from '../../common/utils/validation';
import { getItem, updateItem, updateTimestamp, TableNames } from '../../common/clients/dynamodb';
import { Sale, Buyer, Producer, UpdateSaleRequest } from '../../common/types';

/**
 * Update sale handler
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
    const body = parseRequestBody<UpdateSaleRequest>(event);

    // 5. Get existing sale
    const existingSale = await getItem<Sale>({
      TableName: TableNames.Sales,
      Key: {
        PK: `SALE#${saleId}`,
        SK: 'METADATA',
      },
    });

    if (!existingSale || existingSale.deletedAt) {
      throw new NotFoundError(`Sale ${saleId} not found`);
    }

    // 6. Check access permissions
    if (!canAccessResource(user, existingSale.createdBy)) {
      throw new ForbiddenError('You do not have permission to update this sale');
    }

    // 7. Prevent updating invoiced sales
    if (existingSale.invoiceGenerated && existingSale.status !== 'draft') {
      throw new ForbiddenError('Cannot update a sale that has been invoiced');
    }

    // 8. Build update expression
    const updateExpressions: string[] = [];
    const expressionAttributeNames: Record<string, string> = {};
    const expressionAttributeValues: Record<string, any> = {};

    // Update simple fields
    const simpleFields: Array<keyof UpdateSaleRequest> = [
      'saleDate',
      'paymentMethod',
      'paymentTerms',
      'deliveryMethod',
      'deliveryDate',
      'notes',
      'internalNotes',
      'referenceNumber',
      'status',
    ];

    for (const field of simpleFields) {
      if (body[field] !== undefined) {
        updateExpressions.push(`#${field} = :${field}`);
        expressionAttributeNames[`#${field}`] = field;
        expressionAttributeValues[`:${field}`] = body[field];
      }
    }

    // Update buyer if changed
    if (body.buyerId && body.buyerId !== existingSale.buyerId) {
      const buyer = await getItem<Buyer>({
        TableName: TableNames.Buyers,
        Key: {
          PK: `BUYER#${body.buyerId}`,
          SK: 'METADATA',
        },
      });

      if (!buyer || buyer.deletedAt) {
        throw new NotFoundError(`Buyer ${body.buyerId} not found`);
      }

      // Update buyer fields
      updateExpressions.push(
        'buyerId = :buyerId',
        'buyerName = :buyerName',
        'buyerVatNumber = :buyerVatNumber',
        'buyerFiscalCode = :buyerFiscalCode',
        'buyerAddress = :buyerAddress',
        'buyerCity = :buyerCity',
        'buyerProvince = :buyerProvince',
        'buyerPostalCode = :buyerPostalCode',
        'buyerCountry = :buyerCountry',
        'GSI2PK = :gsi2pk'
      );

      expressionAttributeValues[':buyerId'] = body.buyerId;
      expressionAttributeValues[':buyerName'] = buyer.companyName;
      expressionAttributeValues[':buyerVatNumber'] = buyer.vatNumber;
      expressionAttributeValues[':buyerFiscalCode'] = buyer.fiscalCode;
      expressionAttributeValues[':buyerAddress'] = buyer.address;
      expressionAttributeValues[':buyerCity'] = buyer.city;
      expressionAttributeValues[':buyerProvince'] = buyer.province;
      expressionAttributeValues[':buyerPostalCode'] = buyer.postalCode;
      expressionAttributeValues[':buyerCountry'] = buyer.country;
      expressionAttributeValues[':gsi2pk'] = `BUYER#${body.buyerId}`;
    }

    // Update producer if changed
    if (body.producerId && body.producerId !== existingSale.producerId) {
      const producer = await getItem<Producer>({
        TableName: TableNames.Producers,
        Key: {
          PK: `PRODUCER#${body.producerId}`,
          SK: 'METADATA',
        },
      });

      if (!producer || producer.deletedAt) {
        throw new NotFoundError(`Producer ${body.producerId} not found`);
      }

      // Update producer fields
      updateExpressions.push(
        'producerId = :producerId',
        'producerName = :producerName',
        'producerVatNumber = :producerVatNumber',
        'producerFiscalCode = :producerFiscalCode',
        'producerAddress = :producerAddress',
        'producerCity = :producerCity',
        'producerProvince = :producerProvince',
        'producerPostalCode = :producerPostalCode',
        'producerCountry = :producerCountry',
        'GSI3PK = :gsi3pk'
      );

      expressionAttributeValues[':producerId'] = body.producerId;
      expressionAttributeValues[':producerName'] = producer.companyName;
      expressionAttributeValues[':producerVatNumber'] = producer.vatNumber;
      expressionAttributeValues[':producerFiscalCode'] = producer.fiscalCode;
      expressionAttributeValues[':producerAddress'] = producer.address;
      expressionAttributeValues[':producerCity'] = producer.city;
      expressionAttributeValues[':producerProvince'] = producer.province;
      expressionAttributeValues[':producerPostalCode'] = producer.postalCode;
      expressionAttributeValues[':producerCountry'] = producer.country;
      expressionAttributeValues[':gsi3pk'] = `PRODUCER#${body.producerId}`;
    }

    // Update status GSI if changed
    if (body.status && body.status !== existingSale.status) {
      updateExpressions.push('GSI1PK = :gsi1pk');
      expressionAttributeValues[':gsi1pk'] = `STATUS#${body.status}`;
    }

    // Update date GSIs if changed
    if (body.saleDate && body.saleDate !== existingSale.saleDate) {
      updateExpressions.push(
        'GSI1SK = :gsi1sk',
        'GSI2SK = :gsi2sk',
        'GSI3SK = :gsi3sk',
        'GSI4SK = :gsi4sk'
      );
      expressionAttributeValues[':gsi1sk'] = body.saleDate;
      expressionAttributeValues[':gsi2sk'] = body.saleDate;
      expressionAttributeValues[':gsi3sk'] = body.saleDate;
      expressionAttributeValues[':gsi4sk'] = body.saleDate;
    }

    // 9. If no updates, return existing sale
    if (updateExpressions.length === 0) {
      return successResponse(existingSale);
    }

    // 10. Add timestamp updates
    const timestamp = updateTimestamp(user.username);
    updateExpressions.push('updatedAt = :updatedAt', 'updatedBy = :updatedBy');
    expressionAttributeValues[':updatedAt'] = timestamp.updatedAt;
    expressionAttributeValues[':updatedBy'] = timestamp.updatedBy;

    // 11. Update sale in DynamoDB
    const updatedAttributes = await updateItem({
      TableName: TableNames.Sales,
      Key: {
        PK: `SALE#${saleId}`,
        SK: 'METADATA',
      },
      UpdateExpression: `SET ${updateExpressions.join(', ')}`,
      ExpressionAttributeNames: Object.keys(expressionAttributeNames).length > 0
        ? expressionAttributeNames
        : undefined,
      ExpressionAttributeValues: expressionAttributeValues,
      ReturnValues: 'ALL_NEW',
    });

    // 12. Return updated sale
    return successResponse(updatedAttributes);

  } catch (error) {
    return handleError(error, requestId, path);
  }
}
