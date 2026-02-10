# Search and Dashboard Implementation

## Task #18: Search and Dashboard Lambda Functions

**Date**: January 29, 2026
**Status**: ✅ Complete
**Handlers Implemented**: 7

---

## Overview

Implemented comprehensive search and dashboard analytics functionality for the Sale Module:
- **Search Handlers**: Full-text search across sales, buyers, and producers
- **Dashboard Handlers**: Key statistics, time-series analysis, top buyers, and activity feed
- **Performance**: Client-side filtering for flexibility (DynamoDB scan limitations)
- **Access Control**: Role-based filtering (operators see only own sales)

---

## Search Handlers

### 1. Search Sales
**File**: `src/handlers/search/search-sales.ts`
**Route**: `GET /api/search/sales?q={keyword}`
**Description**: Search sales by keyword across multiple fields

**Features**:
- Search in: saleId, invoiceNumber, buyer name, producer name, reference number, notes
- Case-insensitive matching
- Access control (operators see only own sales)
- Pagination support
- Sorted by sale date (newest first)

**Query Parameters**:
```
q          - Search keyword (required, min 2 characters)
pageSize   - Results per page (default: 20)
nextToken  - Pagination token
```

**Response**:
```json
{
  "success": true,
  "data": {
    "sales": [
      {
        "saleId": "SALE001",
        "saleNumber": 1,
        "saleDate": "2026-01-29",
        "buyerName": "Acme Corp",
        "producerName": "Factory Inc",
        "total": 1220.00,
        "status": "confirmed",
        "invoiceNumber": "INV-1-2026"
      }
    ],
    "count": 1,
    "totalMatches": 1,
    "hasMore": false,
    "keyword": "acme",
    "message": "Found 1 sale(s) matching \"acme\""
  }
}
```

**Search Fields**:
- ✅ Sale ID (exact or partial match)
- ✅ Invoice number
- ✅ Buyer company name
- ✅ Producer company name
- ✅ Reference number
- ✅ Notes

**Example Searches**:
```bash
# Search by buyer name
GET /api/search/sales?q=acme

# Search by invoice number
GET /api/search/sales?q=INV-1-2026

# Search by reference number
GET /api/search/sales?q=PO12345
```

---

### 2. Search Buyers
**File**: `src/handlers/search/search-buyers.ts`
**Route**: `GET /api/search/buyers?q={keyword}`
**Description**: Search buyers by keyword across multiple fields

**Features**:
- Search in: company name, VAT number, fiscal code, city, email, phone
- Case-insensitive matching
- No access control (all authenticated users can search buyers)
- Pagination support
- Sorted alphabetically by company name

**Query Parameters**:
```
q          - Search keyword (required, min 2 characters)
pageSize   - Results per page (default: 20)
nextToken  - Pagination token
```

**Response**:
```json
{
  "success": true,
  "data": {
    "buyers": [
      {
        "buyerId": "BUYER001",
        "companyName": "Acme Corp",
        "vatNumber": "IT12345678901",
        "city": "Milan",
        "country": "IT",
        "email": "info@acme.com",
        "status": "active"
      }
    ],
    "count": 1,
    "totalMatches": 1,
    "hasMore": false,
    "keyword": "acme",
    "message": "Found 1 buyer(s) matching \"acme\""
  }
}
```

**Search Fields**:
- ✅ Company name
- ✅ VAT number
- ✅ Fiscal code
- ✅ City
- ✅ Email
- ✅ Phone number

---

### 3. Search Producers
**File**: `src/handlers/search/search-producers.ts`
**Route**: `GET /api/search/producers?q={keyword}`
**Description**: Search producers by keyword across multiple fields

**Features**:
- Search in: company name, VAT number, fiscal code, city, email, phone
- Case-insensitive matching
- No access control (all authenticated users can search producers)
- Pagination support
- Sorted alphabetically by company name

**Query Parameters**:
```
q          - Search keyword (required, min 2 characters)
pageSize   - Results per page (default: 20)
nextToken  - Pagination token
```

**Response**:
```json
{
  "success": true,
  "data": {
    "producers": [
      {
        "producerId": "PROD001",
        "companyName": "Factory Inc",
        "vatNumber": "IT98765432109",
        "city": "Rome",
        "country": "IT",
        "email": "sales@factory.com",
        "status": "active"
      }
    ],
    "count": 1,
    "totalMatches": 1,
    "hasMore": false,
    "keyword": "factory",
    "message": "Found 1 producer(s) matching \"factory\""
  }
}
```

**Search Fields**:
- ✅ Company name
- ✅ VAT number
- ✅ Fiscal code
- ✅ City
- ✅ Email
- ✅ Phone number

---

## Dashboard Handlers

### 4. Get Dashboard Statistics
**File**: `src/handlers/dashboard/get-dashboard-stats.ts`
**Route**: `GET /api/dashboard/stats`
**Description**: Get comprehensive dashboard statistics and KPIs

**Features**:
- Overall statistics (total sales, revenue, buyers, producers)
- Current month vs previous month comparison
- Growth percentages
- Status breakdown (draft, confirmed, invoiced)
- Optional year/month filtering

**Query Parameters**:
```
year   - Optional year filter (default: current year)
month  - Optional month filter (default: current month)
```

**Response**:
```json
{
  "success": true,
  "data": {
    "stats": {
      "totalSales": 42,
      "confirmedSales": 38,
      "draftSales": 4,
      "invoicedSales": 35,
      "totalRevenue": 51240.50,
      "totalBuyers": 15,
      "activeBuyers": 14,
      "totalProducers": 8,
      "activeProducers": 7,
      "currentMonth": {
        "sales": 12,
        "revenue": 14650.00
      },
      "previousMonth": {
        "sales": 10,
        "revenue": 12200.00
      },
      "salesGrowth": 20.0,
      "revenueGrowth": 20.08
    },
    "period": {
      "year": 2026,
      "month": 1
    },
    "message": "Dashboard statistics retrieved successfully"
  }
}
```

**KPIs Provided**:
- **Sales Metrics**: Total, confirmed, draft, invoiced counts
- **Revenue Metrics**: Total revenue across all sales
- **Entity Counts**: Buyers (total/active), producers (total/active)
- **Monthly Comparison**: Current vs previous month (sales & revenue)
- **Growth Indicators**: Percentage growth month-over-month

**Use Cases**:
- Dashboard overview cards
- Monthly performance tracking
- Growth trend analysis
- Inventory of active entities

---

### 5. Get Sales by Date Range
**File**: `src/handlers/dashboard/get-sales-by-date-range.ts`
**Route**: `GET /api/dashboard/sales-by-date`
**Description**: Get sales data grouped by date for charts and time-series analysis

**Features**:
- Flexible date range filtering
- Multiple aggregation levels (day, week, month)
- Count and revenue per period
- Access control (operators see only own sales)
- Summary statistics

**Query Parameters**:
```
startDate  - Start date (required, ISO 8601 format: YYYY-MM-DD)
endDate    - End date (required, ISO 8601 format: YYYY-MM-DD)
groupBy    - Aggregation level: day, week, month (default: day)
```

**Response**:
```json
{
  "success": true,
  "data": {
    "data": [
      {
        "date": "2026-01-01",
        "count": 3,
        "revenue": 3660.00
      },
      {
        "date": "2026-01-02",
        "count": 5,
        "revenue": 6100.00
      },
      {
        "date": "2026-01-03",
        "count": 2,
        "revenue": 2440.00
      }
    ],
    "summary": {
      "startDate": "2026-01-01",
      "endDate": "2026-01-31",
      "groupBy": "day",
      "totalSales": 10,
      "totalRevenue": 12200.00,
      "averageRevenue": 1220.00,
      "periods": 3
    },
    "message": "Found 10 sale(s) in 3 day(s)"
  }
}
```

**Aggregation Levels**:
- **Day**: One data point per day (YYYY-MM-DD)
- **Week**: One data point per week (Monday as start)
- **Month**: One data point per month (YYYY-MM)

**Use Cases**:
- Line charts (revenue over time)
- Bar charts (sales per day/week/month)
- Trend analysis
- Seasonal pattern detection

**Example Requests**:
```bash
# Daily sales for January 2026
GET /api/dashboard/sales-by-date?startDate=2026-01-01&endDate=2026-01-31&groupBy=day

# Weekly sales for Q1 2026
GET /api/dashboard/sales-by-date?startDate=2026-01-01&endDate=2026-03-31&groupBy=week

# Monthly sales for 2026
GET /api/dashboard/sales-by-date?startDate=2026-01-01&endDate=2026-12-31&groupBy=month
```

---

### 6. Get Top Buyers
**File**: `src/handlers/dashboard/get-top-buyers.ts`
**Route**: `GET /api/dashboard/top-buyers`
**Description**: Get top buyers ranked by revenue or number of sales

**Features**:
- Sort by revenue or sales count
- Optional date range filtering
- Buyer statistics (total sales, revenue, average sale value)
- Last sale date tracking
- Summary with percentage of total revenue

**Query Parameters**:
```
limit      - Number of top buyers to return (default: 10, max: 100)
sortBy     - Sort criterion: revenue or sales (default: revenue)
startDate  - Optional start date filter (ISO 8601)
endDate    - Optional end date filter (ISO 8601)
```

**Response**:
```json
{
  "success": true,
  "data": {
    "buyers": [
      {
        "buyerId": "BUYER001",
        "buyerName": "Acme Corp",
        "totalSales": 15,
        "totalRevenue": 18300.00,
        "averageSaleValue": 1220.00,
        "lastSaleDate": "2026-01-28"
      },
      {
        "buyerId": "BUYER002",
        "buyerName": "Global Trade Ltd",
        "totalSales": 12,
        "totalRevenue": 14640.00,
        "averageSaleValue": 1220.00,
        "lastSaleDate": "2026-01-27"
      }
    ],
    "summary": {
      "totalBuyers": 15,
      "topBuyersCount": 2,
      "topBuyersRevenue": 32940.00,
      "totalRevenue": 51240.50,
      "revenuePercentage": 64.29,
      "sortBy": "revenue",
      "startDate": null,
      "endDate": null
    },
    "message": "Found top 2 buyer(s) by revenue"
  }
}
```

**Buyer Metrics**:
- **Total Sales**: Number of sales for this buyer
- **Total Revenue**: Sum of all sale totals
- **Average Sale Value**: Revenue / Sales count
- **Last Sale Date**: Most recent sale date

**Use Cases**:
- Identify most valuable customers
- Customer relationship prioritization
- Revenue concentration analysis
- Sales performance tracking

**Example Requests**:
```bash
# Top 10 buyers by revenue (all time)
GET /api/dashboard/top-buyers?sortBy=revenue&limit=10

# Top 5 buyers by number of sales
GET /api/dashboard/top-buyers?sortBy=sales&limit=5

# Top buyers in January 2026
GET /api/dashboard/top-buyers?startDate=2026-01-01&endDate=2026-01-31
```

---

### 7. Get Recent Activity
**File**: `src/handlers/dashboard/get-recent-activity.ts`
**Route**: `GET /api/dashboard/recent-activity`
**Description**: Get chronological activity feed of recent actions

**Features**:
- Multiple activity types: sales, buyers, producers
- Multiple actions: created, updated, confirmed, invoiced
- Chronological ordering (newest first)
- User attribution
- Optional type filtering

**Query Parameters**:
```
limit  - Number of activities to return (default: 20, max: 100)
type   - Optional filter: sale, buyer, producer
```

**Response**:
```json
{
  "success": true,
  "data": {
    "activities": [
      {
        "id": "SALE042",
        "type": "sale",
        "action": "invoiced",
        "title": "Invoice INV-42-2026 generated",
        "description": "Invoice generated for sale SALE042",
        "timestamp": "2026-01-29T14:30:00.000Z",
        "user": "admin@i2speedex.com"
      },
      {
        "id": "SALE042",
        "type": "sale",
        "action": "confirmed",
        "title": "Sale SALE042 confirmed",
        "description": "Sale for Acme Corp confirmed",
        "timestamp": "2026-01-29T14:00:00.000Z",
        "user": "operator@i2speedex.com"
      },
      {
        "id": "BUYER015",
        "type": "buyer",
        "action": "created",
        "title": "Buyer New Customer Ltd created",
        "description": "New buyer from London, GB",
        "timestamp": "2026-01-29T13:00:00.000Z",
        "user": "admin@i2speedex.com"
      }
    ],
    "count": 3,
    "totalActivities": 127,
    "message": "Found 3 recent activities"
  }
}
```

**Activity Types and Actions**:
- **Sales**:
  - `created`: Sale created
  - `confirmed`: Sale status changed to confirmed
  - `invoiced`: Invoice generated for sale
- **Buyers**:
  - `created`: Buyer created
  - `updated`: Buyer information updated
- **Producers**:
  - `created`: Producer created
  - `updated`: Producer information updated

**Use Cases**:
- Activity feed widget
- Audit trail
- Recent changes tracking
- Team activity monitoring

**Example Requests**:
```bash
# Last 20 activities (all types)
GET /api/dashboard/recent-activity?limit=20

# Last 10 sale activities only
GET /api/dashboard/recent-activity?type=sale&limit=10

# Last 5 buyer activities
GET /api/dashboard/recent-activity?type=buyer&limit=5
```

---

## Performance Considerations

### DynamoDB Scan Operations
All search and dashboard handlers use DynamoDB scan operations due to:
- **Full-text search** not natively supported by DynamoDB
- **Flexible filtering** across multiple attributes
- **Complex aggregations** and calculations

**Optimizations**:
- Limit scan results (configurable)
- Client-side filtering after scan
- Pagination support with ExclusiveStartKey
- Results cached at application layer (future enhancement)

**Alternative Approaches** (future):
- Amazon OpenSearch for full-text search
- DynamoDB Streams → Lambda → OpenSearch pipeline
- Redis caching for dashboard statistics
- Pre-computed aggregates in separate DynamoDB table

### Access Control Filtering
- Admin users: See all data
- Operator users: See only own sales (filtered after scan)
- Buyer/Producer searches: No access control (all users see all)

---

## Validation Rules

### Search Handlers
- ✅ Keyword must be at least 2 characters
- ✅ PageSize must be between 1 and 100
- ✅ User must be authenticated

### Dashboard Statistics
- ✅ Year/month must be valid if provided
- ✅ User must be authenticated

### Sales by Date Range
- ✅ startDate and endDate are required
- ✅ Dates must be valid ISO 8601 format
- ✅ startDate must be before endDate
- ✅ groupBy must be: day, week, or month

### Top Buyers
- ✅ Limit must be between 1 and 100
- ✅ sortBy must be: revenue or sales
- ✅ Date range must be valid if provided

### Recent Activity
- ✅ Limit must be between 1 and 100
- ✅ Type must be: sale, buyer, or producer (if provided)

---

## Error Responses

### 400 Bad Request
- Keyword too short (< 2 characters)
- Invalid date format
- Invalid groupBy parameter
- Invalid sortBy parameter
- Invalid type parameter

### 401 Unauthorized
- Missing or invalid authentication token

### 422 Validation Error
- startDate after endDate
- Invalid date range

### 500 Internal Server Error
- DynamoDB scan failed
- Unexpected error during processing

---

## Permissions Matrix

| Operation | Admin | Operator | Viewer |
|-----------|-------|----------|--------|
| Search Sales | ✅ All | ✅ Own | ✅ Own |
| Search Buyers | ✅ | ✅ | ✅ |
| Search Producers | ✅ | ✅ | ✅ |
| Dashboard Stats | ✅ All | ✅ Own | ✅ Own |
| Sales by Date | ✅ All | ✅ Own | ✅ Own |
| Top Buyers | ✅ All | ✅ Own | ✅ Own |
| Recent Activity | ✅ All | ✅ Own | ✅ Own |

---

## Testing

### Search Sales
```bash
curl -X GET \
  "https://r10lp4qqkg.execute-api.eu-west-1.amazonaws.com/api/search/sales?q=acme&pageSize=10" \
  -H "Authorization: Bearer $TOKEN"
```

### Search Buyers
```bash
curl -X GET \
  "https://r10lp4qqkg.execute-api.eu-west-1.amazonaws.com/api/search/buyers?q=milan" \
  -H "Authorization: Bearer $TOKEN"
```

### Search Producers
```bash
curl -X GET \
  "https://r10lp4qqkg.execute-api.eu-west-1.amazonaws.com/api/search/producers?q=factory" \
  -H "Authorization: Bearer $TOKEN"
```

### Dashboard Statistics
```bash
curl -X GET \
  "https://r10lp4qqkg.execute-api.eu-west-1.amazonaws.com/api/dashboard/stats" \
  -H "Authorization: Bearer $TOKEN"
```

### Sales by Date Range
```bash
curl -X GET \
  "https://r10lp4qqkg.execute-api.eu-west-1.amazonaws.com/api/dashboard/sales-by-date?startDate=2026-01-01&endDate=2026-01-31&groupBy=day" \
  -H "Authorization: Bearer $TOKEN"
```

### Top Buyers
```bash
curl -X GET \
  "https://r10lp4qqkg.execute-api.eu-west-1.amazonaws.com/api/dashboard/top-buyers?limit=10&sortBy=revenue" \
  -H "Authorization: Bearer $TOKEN"
```

### Recent Activity
```bash
curl -X GET \
  "https://r10lp4qqkg.execute-api.eu-west-1.amazonaws.com/api/dashboard/recent-activity?limit=20" \
  -H "Authorization: Bearer $TOKEN"
```

---

## Frontend Integration Examples

### Search with Auto-complete
```javascript
// Debounced search for buyer autocomplete
import { debounce } from 'lodash';

const searchBuyers = debounce(async (keyword) => {
  if (keyword.length < 2) return;

  const response = await fetch(
    `/api/search/buyers?q=${encodeURIComponent(keyword)}`,
    {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    }
  );

  const { buyers } = await response.json();
  updateAutocompleteList(buyers);
}, 300);
```

### Dashboard Statistics Widget
```javascript
// Fetch and display dashboard stats
async function loadDashboardStats() {
  const response = await fetch('/api/dashboard/stats', {
    headers: { 'Authorization': `Bearer ${token}` }
  });

  const { stats } = await response.json();

  // Update UI
  document.getElementById('totalSales').textContent = stats.totalSales;
  document.getElementById('totalRevenue').textContent =
    `€${stats.totalRevenue.toFixed(2)}`;
  document.getElementById('salesGrowth').textContent =
    `${stats.salesGrowth.toFixed(1)}%`;
}
```

### Revenue Chart (Chart.js)
```javascript
// Load sales data and render chart
async function renderRevenueChart() {
  const response = await fetch(
    '/api/dashboard/sales-by-date?startDate=2026-01-01&endDate=2026-01-31&groupBy=day',
    {
      headers: { 'Authorization': `Bearer ${token}` }
    }
  );

  const { data } = await response.json();

  const chart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: data.map(d => d.date),
      datasets: [{
        label: 'Revenue',
        data: data.map(d => d.revenue),
        borderColor: 'rgb(75, 192, 192)',
        tension: 0.1
      }]
    }
  });
}
```

### Activity Feed
```javascript
// Display recent activity
async function loadActivityFeed() {
  const response = await fetch('/api/dashboard/recent-activity?limit=10', {
    headers: { 'Authorization': `Bearer ${token}` }
  });

  const { activities } = await response.json();

  const html = activities.map(activity => `
    <div class="activity-item">
      <span class="activity-icon ${activity.type}"></span>
      <div class="activity-content">
        <strong>${activity.title}</strong>
        <p>${activity.description}</p>
        <small>${formatDate(activity.timestamp)} by ${activity.user}</small>
      </div>
    </div>
  `).join('');

  document.getElementById('activityFeed').innerHTML = html;
}
```

---

## Next Steps

1. ✅ Task #13: Implement Sales CRUD Lambda functions - **COMPLETE**
2. ✅ Task #14: Implement Buyers CRUD Lambda functions - **COMPLETE**
3. ✅ Task #15: Implement Producers CRUD Lambda functions - **COMPLETE**
4. ✅ Task #16: Implement Invoice Generation Lambda functions - **COMPLETE**
5. ✅ Task #17: Implement File Upload Lambda functions - **COMPLETE**
6. ✅ Task #18: Implement Search and Dashboard Lambda functions - **COMPLETE**
7. ⏳ Task #19: Connect Lambda functions to API Gateway routes - **NEXT**
8. ⏳ Task #20: Write unit tests for Lambda functions
9. ⏳ Task #21: Create integration tests for API endpoints

---

**Status**: ✅ Search and Dashboard Complete
**Date**: January 29, 2026
**Handlers**: 7/7 implemented
**Build**: ✅ Successful
**Location**:
- `/Users/vicio/i2speedex/lambda-building-blocks/functions/sale-module-api/src/handlers/search/`
- `/Users/vicio/i2speedex/lambda-building-blocks/functions/sale-module-api/src/handlers/dashboard/`
**Features**: Full-text search, dashboard KPIs, time-series analysis, top buyers, activity feed
