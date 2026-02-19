/**
 * Create Producer Handler
 * POST /api/producers
 *
 * Create a new producer
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { getUserContext, requireWritePermission, parseRequestBody } from '../../common/middleware/auth';
import { createdResponse, handleError } from '../../common/utils/response';
import { validateProducerData } from '../../common/utils/validation';
import { putItem, addTimestamps, TableNames } from '../../common/clients/dynamodb';
import { Producer, CreateProducerRequest } from '../../common/types';

/**
 * Create producer handler
 */
export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;
  const path = event.path;

  try {
    // 1. Extract user context
    const user = getUserContext(event);

    // 2. Check permissions (only admin and operator can create producers)
    requireWritePermission(user);

    // 3. Parse and validate request body
    const body = parseRequestBody<CreateProducerRequest>(event);
    validateProducerData(body);

    // 4. Generate unique producer ID
    const producerId = `PRODUCER${Date.now()}`;

    // 5. Create producer object
    const producer: Producer = {
      PK: `PRODUCER#${producerId}`,
      SK: 'METADATA',
      producerId,
      code: body.code,

      // Company information
      companyName: body.companyName,
      vatNumber: body.vatNumber,
      fiscalCode: body.fiscalCode,
      sdi: body.sdi,
      pec: body.pec,
      preferredLanguage: body.preferredLanguage,

      // Address
      subName: body.subName,
      address: body.address,
      poBox: body.poBox,
      city: body.city,
      province: body.province,
      postalCode: body.postalCode,
      country: body.country,

      // Contact information
      mainContact: body.mainContact,
      email: body.email,
      phone: body.phone,
      fax: body.fax,
      website: body.website,
      defaultOperator: body.defaultOperator,

      // Business terms
      revenuePercentage: body.revenuePercentage,
      bankDetails: body.bankDetails,

      // Production information
      qualityAssurance: body.qualityAssurance,
      productionArea: body.productionArea,
      markets: body.markets,
      materials: body.materials,
      products: body.products,
      standardProducts: body.standardProducts,
      diameterRange: body.diameterRange,
      maxLength: body.maxLength,
      quantity: body.quantity,

      // Notes
      notes: body.notes,

      // Status
      status: 'active',

      // Statistics (initialized)
      totalSales: 0,

      ...addTimestamps({}, user.username),
    };

    // 6. Add GSI attributes for querying
    const producerWithGSI = {
      ...producer,
      GSI1PK: `STATUS#${producer.status}`,
      GSI1SK: producer.companyName,
      GSI2PK: `COUNTRY#${producer.country}`,
      GSI2SK: producer.companyName,
    };

    // 7. Save to DynamoDB
    await putItem({
      TableName: TableNames.Producers,
      Item: producerWithGSI,
      ConditionExpression: 'attribute_not_exists(PK)',
    });

    // 8. Return created producer
    return createdResponse(producer);

  } catch (error) {
    return handleError(error, requestId, path);
  }
}
