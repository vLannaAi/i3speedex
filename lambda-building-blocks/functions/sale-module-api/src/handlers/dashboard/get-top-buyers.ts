/**
 * Get Top Buyers Handler
 * GET /api/dashboard/top-buyers
 *
 * Get top buyers by revenue or number of sales
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { getUserContext, getQueryParameter } from '../../common/middleware/auth';
import { successResponse, handleError } from '../../common/utils/response';
import { ValidationError } from '../../common/utils/validation';
import { scanItems, TableNames } from '../../common/clients/dynamodb';
import { Sale } from '../../common/types';

interface BuyerStats {
  buyerId: string;
  buyerName: string;
  totalSales: number;
  totalRevenue: number;
  averageSaleValue: number;
  lastSaleDate: string;
}

/**
 * Get top buyers handler
 */
export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;
  const path = event.path;

  try {
    // 1. Extract user context
    const user = getUserContext(event);

    // 2. Get query parameters
    const limit = parseInt(getQueryParameter(event, 'limit') || '10', 10);
    const sortBy = getQueryParameter(event, 'sortBy') || 'revenue'; // revenue or sales
    const startDate = getQueryParameter(event, 'startDate');
    const endDate = getQueryParameter(event, 'endDate');

    if (!['revenue', 'sales'].includes(sortBy)) {
      throw new ValidationError('sortBy must be one of: revenue, sales');
    }

    if (limit < 1 || limit > 100) {
      throw new ValidationError('limit must be between 1 and 100');
    }

    // 3. Get all sales
    const { items: allSales } = await scanItems<Sale>({
      TableName: TableNames.Sales,
      FilterExpression: 'SK = :sk AND attribute_not_exists(deletedAt)',
      ExpressionAttributeValues: {
        ':sk': 'METADATA',
      },
    });

    // 4. Filter sales by user access and optional date range
    let filteredSales = allSales.filter((sale) => {
      return user.groups.includes('Admin') || sale.createdBy === user.username;
    });

    // Apply date range filter if provided
    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);

      filteredSales = filteredSales.filter((sale) => {
        const saleDate = new Date(sale.saleDate);
        return saleDate >= start && saleDate <= end;
      });
    }

    // 5. Group sales by buyer
    const buyerStatsMap = new Map<string, BuyerStats>();

    filteredSales.forEach((sale) => {
      const existing = buyerStatsMap.get(sale.buyerId);

      if (existing) {
        existing.totalSales += 1;
        existing.totalRevenue += sale.total || 0;

        // Update last sale date if this sale is more recent
        if (new Date(sale.saleDate) > new Date(existing.lastSaleDate)) {
          existing.lastSaleDate = sale.saleDate;
        }
      } else {
        buyerStatsMap.set(sale.buyerId, {
          buyerId: sale.buyerId,
          buyerName: sale.buyerName,
          totalSales: 1,
          totalRevenue: sale.total || 0,
          averageSaleValue: 0, // Will calculate after
          lastSaleDate: sale.saleDate,
        });
      }
    });

    // 6. Calculate average sale value for each buyer
    const buyerStats = Array.from(buyerStatsMap.values()).map((buyer) => ({
      ...buyer,
      averageSaleValue: buyer.totalSales > 0 ? buyer.totalRevenue / buyer.totalSales : 0,
    }));

    // 7. Sort buyers
    buyerStats.sort((a, b) => {
      if (sortBy === 'revenue') {
        return b.totalRevenue - a.totalRevenue;
      } else {
        return b.totalSales - a.totalSales;
      }
    });

    // 8. Limit results
    const topBuyers = buyerStats.slice(0, limit);

    // 9. Calculate summary statistics
    const totalRevenue = buyerStats.reduce((sum, buyer) => sum + buyer.totalRevenue, 0);
    const topBuyersRevenue = topBuyers.reduce((sum, buyer) => sum + buyer.totalRevenue, 0);
    const revenuePercentage = totalRevenue > 0 ? (topBuyersRevenue / totalRevenue) * 100 : 0;

    // 10. Return results
    return successResponse({
      buyers: topBuyers,
      summary: {
        totalBuyers: buyerStats.length,
        topBuyersCount: topBuyers.length,
        topBuyersRevenue,
        totalRevenue,
        revenuePercentage,
        sortBy,
        startDate,
        endDate,
      },
      message: `Found top ${topBuyers.length} buyer(s) by ${sortBy}`,
    });

  } catch (error) {
    return handleError(error, requestId, path);
  }
}
