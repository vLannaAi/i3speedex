/**
 * Create Sale Handler
 * POST /api/sales
 *
 * Create a new sale
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { getUserContext, requireWritePermission, parseRequestBody } from '../../common/middleware/auth';
import { createdResponse, handleError } from '../../common/utils/response';
import { validateSaleData, NotFoundError } from '../../common/utils/validation';
import { getItem, putItem, queryItems, addTimestamps, TableNames } from '../../common/clients/dynamodb';
import { Sale, Buyer, Producer, CreateSaleRequest } from '../../common/types';

/**
 * Create sale handler
 */
export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;
  const path = event.path;

  try {
    // 1. Extract user context
    const user = getUserContext(event);

    // 2. Check permissions (only admin and operator can create sales)
    requireWritePermission(user);

    // 3. Parse and validate request body
    const body = parseRequestBody<CreateSaleRequest>(event);
    validateSaleData(body);

    // 4. Generate unique sale ID
    const saleId = `SALE${Date.now()}`;

    // 5. Get next sale number
    // Query the GSI4 (by date) to get the latest sale number
    const currentYear = new Date().getFullYear();
    const yearStart = `${currentYear}-01-01`;
    const yearEnd = `${currentYear}-12-31`;

    const { items: recentSales } = await queryItems<Sale>({
      TableName: TableNames.Sales,
      IndexName: 'GSI4-QueryByDate',
      KeyConditionExpression: 'GSI4PK = :gsi4pk AND GSI4SK BETWEEN :start AND :end',
      ExpressionAttributeValues: {
        ':gsi4pk': 'SALE',
        ':start': yearStart,
        ':end': yearEnd,
      },
      ScanIndexForward: false, // Most recent first
      Limit: 1,
    });

    const saleNumber = recentSales.length > 0 ? recentSales[0].saleNumber + 1 : 1;

    // 6. Fetch buyer details
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

    // 7. Fetch producer details
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

    // 8. Create sale object
    const sale: Sale = {
      PK: `SALE#${saleId}`,
      SK: 'METADATA',
      saleId,
      saleNumber,
      saleDate: body.saleDate,

      // Buyer information (denormalized for performance)
      buyerId: body.buyerId,
      buyerName: buyer.companyName,
      buyerVatNumber: buyer.vatNumber,
      buyerFiscalCode: buyer.fiscalCode,
      buyerAddress: buyer.address,
      buyerCity: buyer.city,
      buyerProvince: buyer.province,
      buyerPostalCode: buyer.postalCode,
      buyerCountry: buyer.country,

      // Producer information (denormalized for performance)
      producerId: body.producerId,
      producerName: producer.companyName,
      producerVatNumber: producer.vatNumber,
      producerFiscalCode: producer.fiscalCode,
      producerAddress: producer.address,
      producerCity: producer.city,
      producerProvince: producer.province,
      producerPostalCode: producer.postalCode,
      producerCountry: producer.country,

      // Totals (will be calculated when lines are added)
      subtotal: 0,
      taxAmount: 0,
      total: 0,

      // Payment and delivery
      paymentMethod: body.paymentMethod || buyer.defaultPaymentMethod,
      paymentTerms: body.paymentTerms || buyer.defaultPaymentTerms,
      deliveryMethod: body.deliveryMethod,
      deliveryDate: body.deliveryDate,

      // Notes
      notes: body.notes,
      internalNotes: body.internalNotes,
      referenceNumber: body.referenceNumber,

      // Status
      status: 'draft',

      // Invoice
      invoiceGenerated: false,

      // Metadata
      linesCount: 0,
      currency: body.currency || 'EUR',

      ...addTimestamps({}, user.username),
    };

    // 9. Add GSI attributes for querying
    const saleWithGSI = {
      ...sale,
      GSI1PK: `STATUS#${sale.status}`,
      GSI1SK: sale.saleDate,
      GSI2PK: `BUYER#${sale.buyerId}`,
      GSI2SK: sale.saleDate,
      GSI3PK: `PRODUCER#${sale.producerId}`,
      GSI3SK: sale.saleDate,
      GSI4PK: 'SALE',
      GSI4SK: sale.saleDate,
    };

    // 10. Save to DynamoDB
    await putItem({
      TableName: TableNames.Sales,
      Item: saleWithGSI,
      ConditionExpression: 'attribute_not_exists(PK)',
    });

    // 11. Return created sale
    return createdResponse(sale);

  } catch (error) {
    return handleError(error, requestId, path);
  }
}
