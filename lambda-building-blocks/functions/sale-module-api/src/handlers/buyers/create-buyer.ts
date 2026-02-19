/**
 * Create Buyer Handler
 * POST /api/buyers
 *
 * Create a new buyer
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { getUserContext, requireWritePermission, parseRequestBody } from '../../common/middleware/auth';
import { createdResponse, handleError } from '../../common/utils/response';
import { validateBuyerData } from '../../common/utils/validation';
import { putItem, addTimestamps, TableNames } from '../../common/clients/dynamodb';
import { Buyer, CreateBuyerRequest } from '../../common/types';

/**
 * Create buyer handler
 */
export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;
  const path = event.path;

  try {
    // 1. Extract user context
    const user = getUserContext(event);

    // 2. Check permissions (only admin and operator can create buyers)
    requireWritePermission(user);

    // 3. Parse and validate request body
    const body = parseRequestBody<CreateBuyerRequest>(event);
    validateBuyerData(body);

    // 4. Generate unique buyer ID
    const buyerId = `BUYER${Date.now()}`;

    // 5. Create buyer object
    const buyer: Buyer = {
      PK: `BUYER#${buyerId}`,
      SK: 'METADATA',
      buyerId,
      code: body.code,

      // Company information
      companyName: body.companyName,
      industrialGroup: body.industrialGroup,
      sector: body.sector,
      vatNumber: body.vatNumber,
      fiscalCode: body.fiscalCode,
      vatExempt: body.vatExempt,
      currency: body.currency,
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
      pec: body.pec,
      sdi: body.sdi,

      // Payment preferences
      defaultPaymentMethod: body.defaultPaymentMethod,
      defaultPaymentTerms: body.defaultPaymentTerms,
      defaultOperator: body.defaultOperator,
      bankDetails: body.bankDetails,

      // Notes
      notes: body.notes,

      // Status
      status: 'active',

      // Statistics (initialized)
      totalSales: 0,
      totalRevenue: 0,

      ...addTimestamps({}, user.username),
    };

    // 6. Add GSI attributes for querying
    const buyerWithGSI = {
      ...buyer,
      GSI1PK: `STATUS#${buyer.status}`,
      GSI1SK: buyer.companyName,
      GSI2PK: `COUNTRY#${buyer.country}`,
      GSI2SK: buyer.companyName,
    };

    // 7. Save to DynamoDB
    await putItem({
      TableName: TableNames.Buyers,
      Item: buyerWithGSI,
      ConditionExpression: 'attribute_not_exists(PK)',
    });

    // 8. Return created buyer
    return createdResponse(buyer);

  } catch (error) {
    return handleError(error, requestId, path);
  }
}
