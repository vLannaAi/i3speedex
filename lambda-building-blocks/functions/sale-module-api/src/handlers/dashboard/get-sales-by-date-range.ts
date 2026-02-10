/**
 * Get Sales by Date Range Handler
 * GET /api/dashboard/sales-by-date
 *
 * Get sales grouped by date for charts (daily, weekly, monthly aggregation)
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { getUserContext, getQueryParameter } from '../../common/middleware/auth';
import { successResponse, handleError } from '../../common/utils/response';
import { ValidationError } from '../../common/utils/validation';
import { scanItems, TableNames } from '../../common/clients/dynamodb';
import { Sale } from '../../common/types';

interface SalesByDate {
  date: string;
  count: number;
  revenue: number;
}

/**
 * Get sales by date range handler
 */
export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;
  const path = event.path;

  try {
    // 1. Extract user context
    const user = getUserContext(event);

    // 2. Get date range from query parameters
    const startDate = getQueryParameter(event, 'startDate');
    const endDate = getQueryParameter(event, 'endDate');
    const groupBy = getQueryParameter(event, 'groupBy') || 'day'; // day, week, month

    if (!startDate || !endDate) {
      throw new ValidationError('startDate and endDate are required');
    }

    if (!['day', 'week', 'month'].includes(groupBy)) {
      throw new ValidationError('groupBy must be one of: day, week, month');
    }

    // 3. Parse dates
    const start = new Date(startDate);
    const end = new Date(endDate);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      throw new ValidationError('Invalid date format. Use ISO 8601 format (YYYY-MM-DD)');
    }

    if (start > end) {
      throw new ValidationError('startDate must be before endDate');
    }

    // 4. Get all sales
    const { items: allSales } = await scanItems<Sale>({
      TableName: TableNames.Sales,
      FilterExpression: 'SK = :sk AND attribute_not_exists(deletedAt)',
      ExpressionAttributeValues: {
        ':sk': 'METADATA',
      },
    });

    // 5. Filter sales by user access and date range
    const filteredSales = allSales.filter((sale) => {
      const hasAccess = user.groups.includes('Admin') || sale.createdBy === user.username;
      if (!hasAccess) return false;

      const saleDate = new Date(sale.saleDate);
      return saleDate >= start && saleDate <= end;
    });

    // 6. Group sales by date
    const salesByDate = new Map<string, SalesByDate>();

    filteredSales.forEach((sale) => {
      const saleDate = new Date(sale.saleDate);
      let groupKey: string;

      switch (groupBy) {
        case 'day':
          groupKey = saleDate.toISOString().split('T')[0]; // YYYY-MM-DD
          break;
        case 'week':
          // Get Monday of the week
          const monday = new Date(saleDate);
          monday.setDate(saleDate.getDate() - saleDate.getDay() + 1);
          groupKey = monday.toISOString().split('T')[0];
          break;
        case 'month':
          groupKey = `${saleDate.getFullYear()}-${String(saleDate.getMonth() + 1).padStart(2, '0')}`; // YYYY-MM
          break;
        default:
          groupKey = saleDate.toISOString().split('T')[0];
      }

      const existing = salesByDate.get(groupKey) || { date: groupKey, count: 0, revenue: 0 };
      existing.count += 1;
      existing.revenue += sale.total || 0;
      salesByDate.set(groupKey, existing);
    });

    // 7. Convert to array and sort by date
    const results = Array.from(salesByDate.values()).sort((a, b) =>
      a.date.localeCompare(b.date)
    );

    // 8. Calculate totals
    const totalSales = results.reduce((sum, item) => sum + item.count, 0);
    const totalRevenue = results.reduce((sum, item) => sum + item.revenue, 0);

    // 9. Return results
    return successResponse({
      data: results,
      summary: {
        startDate,
        endDate,
        groupBy,
        totalSales,
        totalRevenue,
        averageRevenue: totalSales > 0 ? totalRevenue / totalSales : 0,
        periods: results.length,
      },
      message: `Found ${totalSales} sale(s) in ${results.length} ${groupBy}(s)`,
    });

  } catch (error) {
    return handleError(error, requestId, path);
  }
}
