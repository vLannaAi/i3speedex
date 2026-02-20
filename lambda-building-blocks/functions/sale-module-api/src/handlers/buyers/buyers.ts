/**
 * Buyers Handler — all buyer CRUD operations in one consolidated file.
 * GET /api/buyers         → listBuyers
 * GET /api/buyers/{id}    → getBuyer
 * POST /api/buyers        → createBuyer
 * PUT /api/buyers/{id}    → updateBuyer
 * DELETE /api/buyers/{id} → deleteBuyer
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
import { validateBuyerData, validatePaginationParams, ForbiddenError } from '../../common/utils/validation';
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
import { Buyer, CreateBuyerRequest, UpdateBuyerRequest, Sale } from '../../common/types';

const BUYER_SIMPLE_FIELDS = [
  'code', 'companyName', 'industrialGroup', 'sector', 'vatNumber', 'fiscalCode',
  'vatExempt', 'currency', 'preferredLanguage', 'subName', 'address', 'poBox',
  'city', 'province', 'postalCode', 'country', 'mainContact', 'email', 'phone',
  'fax', 'website', 'pec', 'sdi', 'defaultPaymentMethod', 'defaultPaymentTerms',
  'defaultOperator', 'bankDetails', 'notes', 'status',
];

// ---- List ----

export async function listBuyers(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;
  const path = event.path;
  try {
    getUserContext(event);
    const { page, pageSize } = validatePaginationParams({
      page: event.queryStringParameters?.page,
      pageSize: event.queryStringParameters?.pageSize,
    });
    return await scanEntities<Buyer>(
      TableNames.Buyers,
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

export async function getBuyer(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;
  const path = event.path;
  try {
    getUserContext(event);
    const buyerId = getPathParameter(event, 'id');
    const buyer = await getEntityOrThrow<Buyer>(
      TableNames.Buyers, 'BUYER#', buyerId, `Buyer ${buyerId} not found`
    );
    return successResponse(buyer);
  } catch (error) {
    return handleError(error, requestId, path);
  }
}

// ---- Create ----

export async function createBuyer(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;
  const path = event.path;
  try {
    const user = getUserContext(event);
    requireWritePermission(user);
    const body = parseRequestBody<CreateBuyerRequest>(event);
    validateBuyerData(body);

    const buyerId = `BUYER${Date.now()}`;
    const buyer: Buyer = {
      PK: `BUYER#${buyerId}`,
      SK: 'METADATA',
      buyerId,
      code: body.code,
      companyName: body.companyName,
      industrialGroup: body.industrialGroup,
      sector: body.sector,
      vatNumber: body.vatNumber,
      fiscalCode: body.fiscalCode,
      vatExempt: body.vatExempt,
      currency: body.currency,
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
      pec: body.pec,
      sdi: body.sdi,
      defaultPaymentMethod: body.defaultPaymentMethod,
      defaultPaymentTerms: body.defaultPaymentTerms,
      defaultOperator: body.defaultOperator,
      bankDetails: body.bankDetails,
      notes: body.notes,
      status: 'active',
      totalSales: 0,
      totalRevenue: 0,
      ...addTimestamps({}, user.username),
    };

    await putItem({
      TableName: TableNames.Buyers,
      Item: {
        ...buyer,
        GSI1PK: `STATUS#${buyer.status}`,
        GSI1SK: buyer.companyName,
        GSI2PK: `COUNTRY#${buyer.country}`,
        GSI2SK: buyer.companyName,
      },
      ConditionExpression: 'attribute_not_exists(PK)',
    });

    return createdResponse(buyer);
  } catch (error) {
    return handleError(error, requestId, path);
  }
}

// ---- Update ----

export async function updateBuyer(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;
  const path = event.path;
  try {
    const user = getUserContext(event);
    requireWritePermission(user);
    const buyerId = getPathParameter(event, 'id');
    const body = parseRequestBody<UpdateBuyerRequest>(event);

    const existingBuyer = await getEntityOrThrow<Buyer>(
      TableNames.Buyers, 'BUYER#', buyerId, `Buyer ${buyerId} not found`
    );

    const { updateExpressions, expressionAttributeNames, expressionAttributeValues } =
      buildUpdateSet(body as Record<string, unknown>, BUYER_SIMPLE_FIELDS);

    if (updateExpressions.length === 0) return successResponse(existingBuyer);

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

    const timestamp = updateTimestamp(user.username);
    updateExpressions.push('updatedAt = :updatedAt', 'updatedBy = :updatedBy');
    expressionAttributeValues[':updatedAt'] = timestamp.updatedAt;
    expressionAttributeValues[':updatedBy'] = timestamp.updatedBy;

    const updatedAttributes = await updateItem({
      TableName: TableNames.Buyers,
      Key: { PK: `BUYER#${buyerId}`, SK: 'METADATA' },
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

export async function deleteBuyer(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;
  const path = event.path;
  try {
    const user = getUserContext(event);
    requireWritePermission(user);
    const buyerId = getPathParameter(event, 'id');

    await getEntityOrThrow<Buyer>(
      TableNames.Buyers, 'BUYER#', buyerId, `Buyer ${buyerId} not found`
    );

    const { items: associatedSales } = await queryItems<Sale>({
      TableName: TableNames.Sales,
      IndexName: 'GSI2',
      KeyConditionExpression: 'GSI2PK = :gsi2pk',
      ExpressionAttributeValues: { ':gsi2pk': `BUYER#${buyerId}` },
      FilterExpression: 'attribute_not_exists(deletedAt)',
      Limit: 1,
    });

    if (associatedSales.length > 0) {
      throw new ForbiddenError(
        'Cannot delete buyer with associated sales. Please delete or reassign sales first.'
      );
    }

    await softDelete(
      TableNames.Buyers,
      { PK: `BUYER#${buyerId}`, SK: 'METADATA' },
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
  if (method === 'GET' && !id) return listBuyers(event);
  if (method === 'GET' && id)  return getBuyer(event);
  if (method === 'POST')       return createBuyer(event);
  if (method === 'PUT')        return updateBuyer(event);
  if (method === 'DELETE')     return deleteBuyer(event);
  return { statusCode: 405, body: JSON.stringify({ message: 'Method Not Allowed' }) };
}
