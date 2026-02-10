/**
 * Get Dashboard Statistics Handler
 * GET /api/dashboard/stats
 *
 * Get key statistics for dashboard (total sales, revenue, buyers, producers)
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { getUserContext, getQueryParameter } from '../../common/middleware/auth';
import { successResponse, handleError } from '../../common/utils/response';
import { scanItems, TableNames } from '../../common/clients/dynamodb';
import { Sale, Buyer, Producer } from '../../common/types';

interface DashboardStats {
  // Sales statistics
  totalSales: number;
  confirmedSales: number;
  draftSales: number;
  invoicedSales: number;
  totalRevenue: number;

  // Buyer/Producer statistics
  totalBuyers: number;
  activeBuyers: number;
  totalProducers: number;
  activeProducers: number;

  // Period comparison (current month vs previous month)
  currentMonth: {
    sales: number;
    revenue: number;
  };
  previousMonth: {
    sales: number;
    revenue: number;
  };

  // Growth percentages
  salesGrowth: number;
  revenueGrowth: number;
}

/**
 * Get dashboard statistics handler
 */
export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;
  const path = event.path;

  try {
    // 1. Extract user context
    const user = getUserContext(event);

    // 2. Get optional date range from query parameters
    const year = getQueryParameter(event, 'year');
    const month = getQueryParameter(event, 'month');

    // 3. Get all sales
    const { items: allSales } = await scanItems<Sale>({
      TableName: TableNames.Sales,
      FilterExpression: 'SK = :sk AND attribute_not_exists(deletedAt)',
      ExpressionAttributeValues: {
        ':sk': 'METADATA',
      },
    });

    // 4. Filter sales by user access
    const accessibleSales = allSales.filter((sale) => {
      return user.groups.includes('Admin') || sale.createdBy === user.username;
    });

    // 5. Calculate current and previous month dates
    const now = new Date();
    const currentYear = year ? parseInt(year, 10) : now.getFullYear();
    const currentMonth = month ? parseInt(month, 10) : now.getMonth() + 1;

    const currentMonthStart = new Date(currentYear, currentMonth - 1, 1);
    const currentMonthEnd = new Date(currentYear, currentMonth, 0);

    const previousMonthStart = new Date(currentYear, currentMonth - 2, 1);
    const previousMonthEnd = new Date(currentYear, currentMonth - 1, 0);

    // 6. Calculate sales statistics
    const stats: DashboardStats = {
      totalSales: accessibleSales.length,
      confirmedSales: accessibleSales.filter(s => s.status === 'confirmed').length,
      draftSales: accessibleSales.filter(s => s.status === 'draft').length,
      invoicedSales: accessibleSales.filter(s => s.invoiceGenerated).length,
      totalRevenue: accessibleSales.reduce((sum, sale) => sum + (sale.total || 0), 0),

      totalBuyers: 0,
      activeBuyers: 0,
      totalProducers: 0,
      activeProducers: 0,

      currentMonth: {
        sales: 0,
        revenue: 0,
      },
      previousMonth: {
        sales: 0,
        revenue: 0,
      },

      salesGrowth: 0,
      revenueGrowth: 0,
    };

    // 7. Calculate current month statistics
    const currentMonthSales = accessibleSales.filter((sale) => {
      const saleDate = new Date(sale.saleDate);
      return saleDate >= currentMonthStart && saleDate <= currentMonthEnd;
    });

    stats.currentMonth.sales = currentMonthSales.length;
    stats.currentMonth.revenue = currentMonthSales.reduce((sum, sale) => sum + (sale.total || 0), 0);

    // 8. Calculate previous month statistics
    const previousMonthSales = accessibleSales.filter((sale) => {
      const saleDate = new Date(sale.saleDate);
      return saleDate >= previousMonthStart && saleDate <= previousMonthEnd;
    });

    stats.previousMonth.sales = previousMonthSales.length;
    stats.previousMonth.revenue = previousMonthSales.reduce((sum, sale) => sum + (sale.total || 0), 0);

    // 9. Calculate growth percentages
    if (stats.previousMonth.sales > 0) {
      stats.salesGrowth = ((stats.currentMonth.sales - stats.previousMonth.sales) / stats.previousMonth.sales) * 100;
    }

    if (stats.previousMonth.revenue > 0) {
      stats.revenueGrowth = ((stats.currentMonth.revenue - stats.previousMonth.revenue) / stats.previousMonth.revenue) * 100;
    }

    // 10. Get buyers statistics
    const { items: allBuyers } = await scanItems<Buyer>({
      TableName: TableNames.Buyers,
      FilterExpression: 'SK = :sk AND attribute_not_exists(deletedAt)',
      ExpressionAttributeValues: {
        ':sk': 'METADATA',
      },
    });

    stats.totalBuyers = allBuyers.length;
    stats.activeBuyers = allBuyers.filter(b => b.status === 'active').length;

    // 11. Get producers statistics
    const { items: allProducers } = await scanItems<Producer>({
      TableName: TableNames.Producers,
      FilterExpression: 'SK = :sk AND attribute_not_exists(deletedAt)',
      ExpressionAttributeValues: {
        ':sk': 'METADATA',
      },
    });

    stats.totalProducers = allProducers.length;
    stats.activeProducers = allProducers.filter(p => p.status === 'active').length;

    // 12. Return statistics
    return successResponse({
      stats,
      period: {
        year: currentYear,
        month: currentMonth,
      },
      message: 'Dashboard statistics retrieved successfully',
    });

  } catch (error) {
    return handleError(error, requestId, path);
  }
}
