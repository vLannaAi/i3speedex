/**
 * Create Sale Line Handler
 * POST /api/sales/{id}/lines
 *
 * Add a new line to a sale
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { v4 as uuidv4 } from 'uuid';
import { getUserContext, requireWritePermission, getPathParameter, parseRequestBody, canAccessResource } from '../../common/middleware/auth';
import { createdResponse, handleError } from '../../common/utils/response';
import { validateSaleLineData, NotFoundError, ForbiddenError } from '../../common/utils/validation';
import { getItem, putItem, queryItems, updateItem, addTimestamps, updateTimestamp, TableNames } from '../../common/clients/dynamodb';
import { Sale, SaleLine, CreateSaleLineRequest } from '../../common/types';

/**
 * Calculate line amounts
 */
function calculateLineAmounts(data: CreateSaleLineRequest): {
  discountAmount: number;
  netAmount: number;
  taxAmount: number;
  totalAmount: number;
} {
  const discount = data.discount || 0;

  // Calculate discount amount
  const discountAmount = (data.quantity * data.unitPrice * discount) / 100;

  // Calculate net amount (after discount)
  const netAmount = data.quantity * data.unitPrice - discountAmount;

  // Calculate tax amount
  const taxAmount = (netAmount * data.taxRate) / 100;

  // Calculate total amount
  const totalAmount = netAmount + taxAmount;

  return {
    discountAmount: Math.round(discountAmount * 100) / 100,
    netAmount: Math.round(netAmount * 100) / 100,
    taxAmount: Math.round(taxAmount * 100) / 100,
    totalAmount: Math.round(totalAmount * 100) / 100,
  };
}

/**
 * Create sale line handler
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

    // 4. Parse and validate request body
    const body = parseRequestBody<CreateSaleLineRequest>(event);
    validateSaleLineData(body);

    // 5. Get existing sale
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

    // 6. Check access permissions
    if (!canAccessResource(user, sale.createdBy)) {
      throw new ForbiddenError('You do not have permission to modify this sale');
    }

    // 7. Prevent adding lines to invoiced sales
    if (sale.invoiceGenerated && sale.status !== 'draft') {
      throw new ForbiddenError('Cannot add lines to a sale that has been invoiced');
    }

    // 8. Get next line number
    const { items: existingLines } = await queryItems<SaleLine>({
      TableName: TableNames.Sales,
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :skPrefix)',
      ExpressionAttributeValues: {
        ':pk': `SALE#${saleId}`,
        ':skPrefix': 'LINE#',
      },
      FilterExpression: 'attribute_not_exists(deletedAt)',
    });

    const lineNumber = existingLines.length > 0
      ? Math.max(...existingLines.map((l) => l.lineNumber)) + 1
      : 1;

    // 9. Generate line ID
    const lineId = uuidv4();

    // 10. Calculate line amounts
    const amounts = calculateLineAmounts(body);

    // 11. Create sale line object
    const saleLine: SaleLine = {
      PK: `SALE#${saleId}`,
      SK: `LINE#${lineId}`,
      saleId,
      lineId,
      lineNumber,

      productCode: body.productCode,
      productDescription: body.productDescription,

      quantity: body.quantity,
      unitPrice: body.unitPrice,
      discount: body.discount || 0,
      discountAmount: amounts.discountAmount,
      netAmount: amounts.netAmount,

      taxRate: body.taxRate,
      taxAmount: amounts.taxAmount,
      totalAmount: amounts.totalAmount,

      unitOfMeasure: body.unitOfMeasure,
      notes: body.notes,

      ...addTimestamps({}, user.username),
    };

    // 12. Save sale line
    await putItem({
      TableName: TableNames.Sales,
      Item: saleLine,
      ConditionExpression: 'attribute_not_exists(PK)',
    });

    // 13. Calculate new sale totals
    const allLines = [...existingLines, saleLine];
    const newSubtotal = allLines.reduce((sum, line) => sum + line.netAmount, 0);
    const newTaxAmount = allLines.reduce((sum, line) => sum + line.taxAmount, 0);
    const newTotal = allLines.reduce((sum, line) => sum + line.totalAmount, 0);

    // 14. Update sale totals and lines count
    const timestamp = updateTimestamp(user.username);
    await updateItem({
      TableName: TableNames.Sales,
      Key: {
        PK: `SALE#${saleId}`,
        SK: 'METADATA',
      },
      UpdateExpression: 'SET subtotal = :subtotal, taxAmount = :taxAmount, #total = :total, linesCount = :linesCount, updatedAt = :updatedAt, updatedBy = :updatedBy',
      ExpressionAttributeNames: {
        '#total': 'total',
      },
      ExpressionAttributeValues: {
        ':subtotal': Math.round(newSubtotal * 100) / 100,
        ':taxAmount': Math.round(newTaxAmount * 100) / 100,
        ':total': Math.round(newTotal * 100) / 100,
        ':linesCount': allLines.length,
        ':updatedAt': timestamp.updatedAt,
        ':updatedBy': timestamp.updatedBy,
      },
    });

    // 15. Return created line
    return createdResponse(saleLine);

  } catch (error) {
    return handleError(error, requestId, path);
  }
}
