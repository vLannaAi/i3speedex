/**
 * Get Recent Activity Handler
 * GET /api/dashboard/recent-activity
 *
 * Get recent activity feed (sales, buyers, producers created/updated)
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { getUserContext, getQueryParameter } from '../../common/middleware/auth';
import { successResponse, handleError } from '../../common/utils/response';
import { scanItems, TableNames } from '../../common/clients/dynamodb';
import { Sale, Buyer, Producer } from '../../common/types';

interface ActivityItem {
  id: string;
  type: 'sale' | 'buyer' | 'producer';
  action: 'created' | 'updated' | 'confirmed' | 'invoiced';
  title: string;
  description: string;
  timestamp: string;
  user: string;
}

/**
 * Get recent activity handler
 */
export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;
  const path = event.path;

  try {
    // 1. Extract user context
    const user = getUserContext(event);

    // 2. Get query parameters
    const limit = parseInt(getQueryParameter(event, 'limit') || '20', 10);
    const type = getQueryParameter(event, 'type'); // Optional: sale, buyer, producer

    if (limit < 1 || limit > 100) {
      throw new Error('limit must be between 1 and 100');
    }

    if (type && !['sale', 'buyer', 'producer'].includes(type)) {
      throw new Error('type must be one of: sale, buyer, producer');
    }

    // 3. Fetch recent sales
    let activities: ActivityItem[] = [];

    if (!type || type === 'sale') {
      const { items: sales } = await scanItems<Sale>({
        TableName: TableNames.Sales,
        FilterExpression: 'SK = :sk AND attribute_not_exists(deletedAt)',
        ExpressionAttributeValues: {
          ':sk': 'METADATA',
        },
      });

      // Filter by user access
      const accessibleSales = sales.filter((sale) => {
        return user.groups.includes('Admin') || sale.createdBy === user.username;
      });

      // Add sale activities
      accessibleSales.forEach((sale) => {
        // Created activity
        activities.push({
          id: sale.saleId,
          type: 'sale',
          action: 'created',
          title: `Sale ${sale.saleId} created`,
          description: `Sale for ${sale.buyerName} - ${sale.total.toFixed(2)} ${sale.currency}`,
          timestamp: sale.createdAt,
          user: sale.createdBy,
        });

        // Confirmed activity (if different from created)
        if (sale.status === 'confirmed' && sale.updatedAt !== sale.createdAt) {
          activities.push({
            id: sale.saleId,
            type: 'sale',
            action: 'confirmed',
            title: `Sale ${sale.saleId} confirmed`,
            description: `Sale for ${sale.buyerName} confirmed`,
            timestamp: sale.updatedAt,
            user: sale.updatedBy,
          });
        }

        // Invoiced activity
        if (sale.invoiceGenerated && sale.invoiceGeneratedAt) {
          activities.push({
            id: sale.saleId,
            type: 'sale',
            action: 'invoiced',
            title: `Invoice ${sale.invoiceNumber} generated`,
            description: `Invoice generated for sale ${sale.saleId}`,
            timestamp: sale.invoiceGeneratedAt,
            user: sale.updatedBy,
          });
        }
      });
    }

    // 4. Fetch recent buyers
    if (!type || type === 'buyer') {
      const { items: buyers } = await scanItems<Buyer>({
        TableName: TableNames.Buyers,
        FilterExpression: 'SK = :sk AND attribute_not_exists(deletedAt)',
        ExpressionAttributeValues: {
          ':sk': 'METADATA',
        },
      });

      buyers.forEach((buyer) => {
        activities.push({
          id: buyer.buyerId,
          type: 'buyer',
          action: 'created',
          title: `Buyer ${buyer.companyName} created`,
          description: `New buyer from ${buyer.city}, ${buyer.country}`,
          timestamp: buyer.createdAt,
          user: buyer.createdBy,
        });

        // Updated activity (if different from created)
        if (buyer.updatedAt !== buyer.createdAt) {
          activities.push({
            id: buyer.buyerId,
            type: 'buyer',
            action: 'updated',
            title: `Buyer ${buyer.companyName} updated`,
            description: `Buyer information updated`,
            timestamp: buyer.updatedAt,
            user: buyer.updatedBy,
          });
        }
      });
    }

    // 5. Fetch recent producers
    if (!type || type === 'producer') {
      const { items: producers } = await scanItems<Producer>({
        TableName: TableNames.Producers,
        FilterExpression: 'SK = :sk AND attribute_not_exists(deletedAt)',
        ExpressionAttributeValues: {
          ':sk': 'METADATA',
        },
      });

      producers.forEach((producer) => {
        activities.push({
          id: producer.producerId,
          type: 'producer',
          action: 'created',
          title: `Producer ${producer.companyName} created`,
          description: `New producer from ${producer.city}, ${producer.country}`,
          timestamp: producer.createdAt,
          user: producer.createdBy,
        });

        // Updated activity (if different from created)
        if (producer.updatedAt !== producer.createdAt) {
          activities.push({
            id: producer.producerId,
            type: 'producer',
            action: 'updated',
            title: `Producer ${producer.companyName} updated`,
            description: `Producer information updated`,
            timestamp: producer.updatedAt,
            user: producer.updatedBy,
          });
        }
      });
    }

    // 6. Sort activities by timestamp (newest first)
    activities.sort((a, b) =>
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );

    // 7. Limit results
    const recentActivities = activities.slice(0, limit);

    // 8. Return results
    return successResponse({
      activities: recentActivities,
      count: recentActivities.length,
      totalActivities: activities.length,
      message: `Found ${recentActivities.length} recent activit${recentActivities.length === 1 ? 'y' : 'ies'}`,
    });

  } catch (error) {
    return handleError(error, requestId, path);
  }
}
