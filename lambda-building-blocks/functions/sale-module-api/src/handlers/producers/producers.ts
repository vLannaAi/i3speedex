/**
 * Producers Handler — all producer CRUD operations in one consolidated file.
 * GET /api/producers         → listProducers
 * GET /api/producers/{id}    → getProducer
 * POST /api/producers        → createProducer
 * PUT /api/producers/{id}    → updateProducer
 * DELETE /api/producers/{id} → deleteProducer
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import {
  getUserContext,
  requireWritePermission,
  getPathParameter,
  getQueryParameter,
  parseRequestBody,
} from '../../common/middleware/auth';
import {
  successResponse,
  createdResponse,
  noContentResponse,
  handleError,
} from '../../common/utils/response';
import { validateProducerData, validatePaginationParams, ForbiddenError } from '../../common/utils/validation';
import {
  putItem,
  updateItem,
  softDelete,
  queryItems,
  addTimestamps,
  updateTimestamp,
  TableNames,
} from '../../common/clients/dynamodb';
import { scanEntities, getEntityOrThrow, buildUpdateSet } from '../../common/utils/entity-utils';
import { Producer, CreateProducerRequest, UpdateProducerRequest, Sale } from '../../common/types';

const PRODUCER_SIMPLE_FIELDS = [
  'code', 'companyName', 'vatNumber', 'fiscalCode', 'sdi', 'pec', 'preferredLanguage',
  'subName', 'address', 'poBox', 'city', 'province', 'postalCode', 'country',
  'mainContact', 'email', 'phone', 'fax', 'website', 'defaultOperator',
  'revenuePercentage', 'bankDetails', 'qualityAssurance', 'productionArea',
  'markets', 'materials', 'products', 'standardProducts', 'diameterRange',
  'maxLength', 'quantity', 'notes', 'status',
];

// ---- List ----

export async function listProducers(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;
  const path = event.path;
  try {
    getUserContext(event);
    const { page, pageSize } = validatePaginationParams({
      page: event.queryStringParameters?.page,
      pageSize: event.queryStringParameters?.pageSize,
    });
    return await scanEntities<Producer>(
      TableNames.Producers,
      {
        status: getQueryParameter(event, 'status'),
        search: getQueryParameter(event, 'search'),
        country: getQueryParameter(event, 'country'),
      },
      { page, pageSize }
    );
  } catch (error) {
    return handleError(error, requestId, path);
  }
}

// ---- Get ----

export async function getProducer(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;
  const path = event.path;
  try {
    getUserContext(event);
    const producerId = getPathParameter(event, 'id');
    const producer = await getEntityOrThrow<Producer>(
      TableNames.Producers, 'PRODUCER#', producerId, `Producer ${producerId} not found`
    );
    return successResponse(producer);
  } catch (error) {
    return handleError(error, requestId, path);
  }
}

// ---- Create ----

export async function createProducer(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;
  const path = event.path;
  try {
    const user = getUserContext(event);
    requireWritePermission(user);
    const body = parseRequestBody<CreateProducerRequest>(event);
    validateProducerData(body);

    const producerId = `PRODUCER${Date.now()}`;
    const producer: Producer = {
      PK: `PRODUCER#${producerId}`,
      SK: 'METADATA',
      producerId,
      code: body.code,
      companyName: body.companyName,
      vatNumber: body.vatNumber,
      fiscalCode: body.fiscalCode,
      sdi: body.sdi,
      pec: body.pec,
      preferredLanguage: body.preferredLanguage,
      subName: body.subName,
      address: body.address,
      poBox: body.poBox,
      city: body.city,
      province: body.province,
      postalCode: body.postalCode,
      country: body.country,
      mainContact: body.mainContact,
      email: body.email,
      phone: body.phone,
      fax: body.fax,
      website: body.website,
      defaultOperator: body.defaultOperator,
      revenuePercentage: body.revenuePercentage,
      bankDetails: body.bankDetails,
      qualityAssurance: body.qualityAssurance,
      productionArea: body.productionArea,
      markets: body.markets,
      materials: body.materials,
      products: body.products,
      standardProducts: body.standardProducts,
      diameterRange: body.diameterRange,
      maxLength: body.maxLength,
      quantity: body.quantity,
      notes: body.notes,
      status: 'active',
      totalSales: 0,
      ...addTimestamps({}, user.username),
    };

    await putItem({
      TableName: TableNames.Producers,
      Item: {
        ...producer,
        GSI1PK: `STATUS#${producer.status}`,
        GSI1SK: producer.companyName,
        GSI2PK: `COUNTRY#${producer.country}`,
        GSI2SK: producer.companyName,
      },
      ConditionExpression: 'attribute_not_exists(PK)',
    });

    return createdResponse(producer);
  } catch (error) {
    return handleError(error, requestId, path);
  }
}

// ---- Update ----

export async function updateProducer(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;
  const path = event.path;
  try {
    const user = getUserContext(event);
    requireWritePermission(user);
    const producerId = getPathParameter(event, 'id');
    const body = parseRequestBody<UpdateProducerRequest>(event);

    const existingProducer = await getEntityOrThrow<Producer>(
      TableNames.Producers, 'PRODUCER#', producerId, `Producer ${producerId} not found`
    );

    const { updateExpressions, expressionAttributeNames, expressionAttributeValues } =
      buildUpdateSet(body as Record<string, unknown>, PRODUCER_SIMPLE_FIELDS);

    if (updateExpressions.length === 0) return successResponse(existingProducer);

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

    const timestamp = updateTimestamp(user.username);
    updateExpressions.push('updatedAt = :updatedAt', 'updatedBy = :updatedBy');
    expressionAttributeValues[':updatedAt'] = timestamp.updatedAt;
    expressionAttributeValues[':updatedBy'] = timestamp.updatedBy;

    const updatedAttributes = await updateItem({
      TableName: TableNames.Producers,
      Key: { PK: `PRODUCER#${producerId}`, SK: 'METADATA' },
      UpdateExpression: `SET ${updateExpressions.join(', ')}`,
      ExpressionAttributeNames: expressionAttributeNames,
      ExpressionAttributeValues: expressionAttributeValues,
      ReturnValues: 'ALL_NEW',
    });

    return successResponse(updatedAttributes);
  } catch (error) {
    return handleError(error, requestId, path);
  }
}

// ---- Delete ----

export async function deleteProducer(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;
  const path = event.path;
  try {
    const user = getUserContext(event);
    requireWritePermission(user);
    const producerId = getPathParameter(event, 'id');

    await getEntityOrThrow<Producer>(
      TableNames.Producers, 'PRODUCER#', producerId, `Producer ${producerId} not found`
    );

    const { items: associatedSales } = await queryItems<Sale>({
      TableName: TableNames.Sales,
      IndexName: 'GSI3',
      KeyConditionExpression: 'GSI3PK = :gsi3pk',
      ExpressionAttributeValues: { ':gsi3pk': `PRODUCER#${producerId}` },
      FilterExpression: 'attribute_not_exists(deletedAt)',
      Limit: 1,
    });

    if (associatedSales.length > 0) {
      throw new ForbiddenError(
        'Cannot delete producer with associated sales. Please delete or reassign sales first.'
      );
    }

    await softDelete(
      TableNames.Producers,
      { PK: `PRODUCER#${producerId}`, SK: 'METADATA' },
      user.username
    );

    return noContentResponse();
  } catch (error) {
    return handleError(error, requestId, path);
  }
}

// ---- Router (Lambda entry point) ----

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const method = event.httpMethod;
  const id = event.pathParameters?.id;
  if (method === 'GET' && !id) return listProducers(event);
  if (method === 'GET' && id)  return getProducer(event);
  if (method === 'POST')       return createProducer(event);
  if (method === 'PUT')        return updateProducer(event);
  if (method === 'DELETE')     return deleteProducer(event);
  return { statusCode: 405, body: JSON.stringify({ message: 'Method Not Allowed' }) };
}
