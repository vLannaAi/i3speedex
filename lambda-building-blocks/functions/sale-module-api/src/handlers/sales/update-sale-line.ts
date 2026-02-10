/**
 * Update Sale Line Handler
 * PUT /api/sales/{id}/lines/{lineId}
 *
 * Update an existing sale line
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { getUserContext, requireWritePermission, getPathParameter, parseRequestBody, canAccessResource } from '../../common/middleware/auth';
import { successResponse, handleError } from '../../common/utils/response';
import { NotFoundError, ForbiddenError } from '../../common/utils/validation';
import { getItem, updateItem, queryItems, updateTimestamp, TableNames } from '../../common/clients/dynamodb';
import { Sale, SaleLine, UpdateSaleLineRequest } from '../../common/types';

/**
 * Calculate line amounts
 */
function calculateLineAmounts(line: SaleLine): {
  discountAmount: number;
  netAmount: number;
  taxAmount: number;
  totalAmount: number;
} {
  const discountAmount = (line.quantity * line.unitPrice * line.discount) / 100;
  const netAmount = line.quantity * line.unitPrice - discountAmount;
  const taxAmount = (netAmount * line.taxRate) / 100;
  const totalAmount = netAmount + taxAmount;

  return {
    discountAmount: Math.round(discountAmount * 100) / 100,
    netAmount: Math.round(netAmount * 100) / 100,
    taxAmount: Math.round(taxAmount * 100) / 100,
    totalAmount: Math.round(totalAmount * 100) / 100,
  };
}

/**
 * Update sale line handler
 */
export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;
  const path = event.path;

  try {
    // 1. Extract user context
    const user = getUserContext(event);

    // 2. Check permissions
    requireWritePermission(user);

    // 3. Get sale ID and line ID from path
    const saleId = getPathParameter(event, 'id');
    const lineId = getPathParameter(event, 'lineId');

    // 4. Parse request body
    const body = parseRequestBody<UpdateSaleLineRequest>(event);

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

    // 7. Prevent updating lines in invoiced sales
    if (sale.invoiceGenerated && sale.status !== 'draft') {
      throw new ForbiddenError('Cannot update lines in a sale that has been invoiced');
    }

    // 8. Get existing line
    const existingLine = await getItem<SaleLine>({
      TableName: TableNames.Sales,
      Key: {
        PK: `SALE#${saleId}`,
        SK: `LINE#${lineId}`,
      },
    });

    if (!existingLine || existingLine.deletedAt) {
      throw new NotFoundError(`Line ${lineId} not found`);
    }

    // 9. Build update expression
    const updateExpressions: string[] = [];
    const expressionAttributeValues: Record<string, any> = {};

    // Update simple fields
    if (body.productCode !== undefined) {
      updateExpressions.push('productCode = :productCode');
      expressionAttributeValues[':productCode'] = body.productCode;
    }

    if (body.productDescription !== undefined) {
      updateExpressions.push('productDescription = :productDescription');
      expressionAttributeValues[':productDescription'] = body.productDescription;
    }

    if (body.unitOfMeasure !== undefined) {
      updateExpressions.push('unitOfMeasure = :unitOfMeasure');
      expressionAttributeValues[':unitOfMeasure'] = body.unitOfMeasure;
    }

    if (body.notes !== undefined) {
      updateExpressions.push('notes = :notes');
      expressionAttributeValues[':notes'] = body.notes;
    }

    // Check if amounts need recalculation
    const needsRecalculation =
      body.quantity !== undefined ||
      body.unitPrice !== undefined ||
      body.discount !== undefined ||
      body.taxRate !== undefined;

    // If no updates, return existing line
    if (updateExpressions.length === 0 && !needsRecalculation) {
      return successResponse(existingLine);
    }

    // 10. Create updated line for calculation
    const updatedLine: SaleLine = {
      ...existingLine,
      quantity: body.quantity !== undefined ? body.quantity : existingLine.quantity,
      unitPrice: body.unitPrice !== undefined ? body.unitPrice : existingLine.unitPrice,
      discount: body.discount !== undefined ? body.discount : existingLine.discount,
      taxRate: body.taxRate !== undefined ? body.taxRate : existingLine.taxRate,
    };

    // 11. Recalculate amounts if needed
    if (needsRecalculation) {
      const amounts = calculateLineAmounts(updatedLine);

      if (body.quantity !== undefined) {
        updateExpressions.push('quantity = :quantity');
        expressionAttributeValues[':quantity'] = body.quantity;
      }

      if (body.unitPrice !== undefined) {
        updateExpressions.push('unitPrice = :unitPrice');
        expressionAttributeValues[':unitPrice'] = body.unitPrice;
      }

      if (body.discount !== undefined) {
        updateExpressions.push('discount = :discount');
        expressionAttributeValues[':discount'] = body.discount;
      }

      if (body.taxRate !== undefined) {
        updateExpressions.push('taxRate = :taxRate');
        expressionAttributeValues[':taxRate'] = body.taxRate;
      }

      updateExpressions.push(
        'discountAmount = :discountAmount',
        'netAmount = :netAmount',
        'taxAmount = :taxAmount',
        'totalAmount = :totalAmount'
      );

      expressionAttributeValues[':discountAmount'] = amounts.discountAmount;
      expressionAttributeValues[':netAmount'] = amounts.netAmount;
      expressionAttributeValues[':taxAmount'] = amounts.taxAmount;
      expressionAttributeValues[':totalAmount'] = amounts.totalAmount;
    }

    // 12. Add timestamp updates
    const timestamp = updateTimestamp(user.username);
    updateExpressions.push('updatedAt = :updatedAt', 'updatedBy = :updatedBy');
    expressionAttributeValues[':updatedAt'] = timestamp.updatedAt;
    expressionAttributeValues[':updatedBy'] = timestamp.updatedBy;

    // 13. Update sale line
    const updatedAttributes = await updateItem({
      TableName: TableNames.Sales,
      Key: {
        PK: `SALE#${saleId}`,
        SK: `LINE#${lineId}`,
      },
      UpdateExpression: `SET ${updateExpressions.join(', ')}`,
      ExpressionAttributeValues: expressionAttributeValues,
      ReturnValues: 'ALL_NEW',
    });

    // 14. If amounts changed, recalculate sale totals
    if (needsRecalculation) {
      const { items: allLines } = await queryItems<SaleLine>({
        TableName: TableNames.Sales,
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :skPrefix)',
        ExpressionAttributeValues: {
          ':pk': `SALE#${saleId}`,
          ':skPrefix': 'LINE#',
        },
        FilterExpression: 'attribute_not_exists(deletedAt)',
      });

      const newSubtotal = allLines.reduce((sum, line) => sum + line.netAmount, 0);
      const newTaxAmount = allLines.reduce((sum, line) => sum + line.taxAmount, 0);
      const newTotal = allLines.reduce((sum, line) => sum + line.totalAmount, 0);

      await updateItem({
        TableName: TableNames.Sales,
        Key: {
          PK: `SALE#${saleId}`,
          SK: 'METADATA',
        },
        UpdateExpression: 'SET subtotal = :subtotal, taxAmount = :taxAmount, #total = :total, updatedAt = :updatedAt, updatedBy = :updatedBy',
        ExpressionAttributeNames: {
          '#total': 'total',
        },
        ExpressionAttributeValues: {
          ':subtotal': Math.round(newSubtotal * 100) / 100,
          ':taxAmount': Math.round(newTaxAmount * 100) / 100,
          ':total': Math.round(newTotal * 100) / 100,
          ':updatedAt': timestamp.updatedAt,
          ':updatedBy': timestamp.updatedBy,
        },
      });
    }

    // 15. Return updated line
    return successResponse(updatedAttributes);

  } catch (error) {
    return handleError(error, requestId, path);
  }
}
