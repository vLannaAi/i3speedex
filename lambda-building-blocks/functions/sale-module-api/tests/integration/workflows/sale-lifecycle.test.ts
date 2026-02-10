/**
 * Integration Test: Complete Sale Lifecycle
 *
 * Tests the end-to-end workflow of creating and managing a sale:
 * 1. Create buyer and producer
 * 2. Create a sale
 * 3. Add sale lines
 * 4. Confirm the sale
 * 5. Generate invoice
 * 6. List and search sales
 * 7. Cleanup
 */

import { setupTests, teardownTests, TestContext } from '../helpers/setup';
import {
  createTestBuyer,
  createTestProducer,
  createTestSale,
  createTestSaleLine,
} from '../helpers/test-data';

describe('Sale Lifecycle Integration Tests', () => {
  let context: TestContext;

  beforeAll(async () => {
    context = await setupTests();
  });

  afterAll(async () => {
    await teardownTests(context);
  });

  describe('Complete Sale Workflow', () => {
    it('should complete full sale lifecycle from creation to invoice', async () => {
      const { adminClient, cleanup } = context;

      // Step 1: Create a buyer
      const buyerData = createTestBuyer();
      const buyerResponse = await adminClient.post('/api/buyers', buyerData);
      expect(buyerResponse.statusCode).toBe(201);
      expect(buyerResponse.body.success).toBe(true);

      const buyerId = buyerResponse.body.data.buyer.buyerId;
      cleanup.trackBuyer(buyerId);

      // Step 2: Create a producer
      const producerData = createTestProducer();
      const producerResponse = await adminClient.post('/api/producers', producerData);
      expect(producerResponse.statusCode).toBe(201);

      const producerId = producerResponse.body.data.producer.producerId;
      cleanup.trackProducer(producerId);

      // Step 3: Create a sale
      const saleData = createTestSale(buyerId, producerId);
      const saleResponse = await adminClient.post('/api/sales', saleData);
      expect(saleResponse.statusCode).toBe(201);
      expect(saleResponse.body.data.sale.status).toBe('draft');

      const saleId = saleResponse.body.data.sale.saleId;
      cleanup.trackSale(saleId);

      // Step 4: Add sale lines
      const line1Data = createTestSaleLine({
        productCode: 'PROD-001',
        productDescription: 'Widget A',
        quantity: 10,
        unitPrice: 50.00,
      });

      const line1Response = await adminClient.post(`/api/sales/${saleId}/lines`, line1Data);
      expect(line1Response.statusCode).toBe(201);

      const line2Data = createTestSaleLine({
        productCode: 'PROD-002',
        productDescription: 'Widget B',
        quantity: 5,
        unitPrice: 100.00,
      });

      const line2Response = await adminClient.post(`/api/sales/${saleId}/lines`, line2Data);
      expect(line2Response.statusCode).toBe(201);

      // Step 5: Verify sale lines were added
      const linesResponse = await adminClient.get(`/api/sales/${saleId}/lines`);
      expect(linesResponse.statusCode).toBe(200);
      expect(linesResponse.body.data.lines).toHaveLength(2);

      // Step 6: Confirm the sale
      const confirmResponse = await adminClient.post(`/api/sales/${saleId}/confirm`);
      expect(confirmResponse.statusCode).toBe(200);
      expect(confirmResponse.body.data.sale.status).toBe('confirmed');

      // Step 7: Generate HTML invoice
      const htmlInvoiceResponse = await adminClient.post(`/api/sales/${saleId}/invoice/html`, {
        language: 'it',
      });
      expect(htmlInvoiceResponse.statusCode).toBe(200);
      expect(htmlInvoiceResponse.body.data.sale.invoiceGenerated).toBe(true);

      // Step 8: Get invoice download URL
      const downloadUrlResponse = await adminClient.get(
        `/api/sales/${saleId}/invoice/download`,
        { format: 'pdf' }
      );
      expect(downloadUrlResponse.statusCode).toBe(200);
      expect(downloadUrlResponse.body.data.downloadUrl).toBeDefined();

      // Step 9: Search for the sale
      const searchResponse = await adminClient.get('/api/search/sales', {
        q: saleData.referenceNumber!,
      });
      expect(searchResponse.statusCode).toBe(200);
      expect(searchResponse.body.data.sales.length).toBeGreaterThan(0);
      expect(searchResponse.body.data.sales[0].saleId).toBe(saleId);

      // Step 10: Get dashboard stats
      const statsResponse = await adminClient.get('/api/dashboard/stats');
      expect(statsResponse.statusCode).toBe(200);
      expect(statsResponse.body.data.stats.totalSales).toBeGreaterThan(0);
    });

    it('should prevent confirming sale without lines', async () => {
      const { adminClient, cleanup } = context;

      // Create buyer and producer
      const buyer = createTestBuyer();
      const buyerRes = await adminClient.post('/api/buyers', buyer);
      cleanup.trackBuyer(buyerRes.body.data.buyer.buyerId);

      const producer = createTestProducer();
      const producerRes = await adminClient.post('/api/producers', producer);
      cleanup.trackProducer(producerRes.body.data.producer.producerId);

      // Create sale without lines
      const sale = createTestSale(
        buyerRes.body.data.buyer.buyerId,
        producerRes.body.data.producer.producerId
      );
      const saleRes = await adminClient.post('/api/sales', sale);
      const saleId = saleRes.body.data.sale.saleId;
      cleanup.trackSale(saleId);

      // Try to confirm without lines
      const confirmRes = await adminClient.post(`/api/sales/${saleId}/confirm`);
      expect(confirmRes.statusCode).toBe(422);
      expect(confirmRes.body.message).toContain('at least one line');
    });

    it('should prevent modifying confirmed sale', async () => {
      const { adminClient, cleanup } = context;

      // Create and confirm a sale with lines
      const buyer = createTestBuyer();
      const buyerRes = await adminClient.post('/api/buyers', buyer);
      cleanup.trackBuyer(buyerRes.body.data.buyer.buyerId);

      const producer = createTestProducer();
      const producerRes = await adminClient.post('/api/producers', producer);
      cleanup.trackProducer(producerRes.body.data.producer.producerId);

      const sale = createTestSale(
        buyerRes.body.data.buyer.buyerId,
        producerRes.body.data.producer.producerId
      );
      const saleRes = await adminClient.post('/api/sales', sale);
      const saleId = saleRes.body.data.sale.saleId;
      cleanup.trackSale(saleId);

      // Add a line
      const line = createTestSaleLine();
      await adminClient.post(`/api/sales/${saleId}/lines`, line);

      // Confirm sale
      await adminClient.post(`/api/sales/${saleId}/confirm`);

      // Try to update confirmed sale
      const updateRes = await adminClient.put(`/api/sales/${saleId}`, {
        notes: 'Updated notes',
      });
      expect(updateRes.statusCode).toBe(403);
      expect(updateRes.body.message).toContain('confirmed');
    });
  });

  describe('Access Control', () => {
    it('should restrict operators to their own sales', async () => {
      const { adminClient, operatorClient, cleanup } = context;

      // Admin creates a sale
      const buyer = createTestBuyer();
      const buyerRes = await adminClient.post('/api/buyers', buyer);
      cleanup.trackBuyer(buyerRes.body.data.buyer.buyerId);

      const producer = createTestProducer();
      const producerRes = await adminClient.post('/api/producers', producer);
      cleanup.trackProducer(producerRes.body.data.producer.producerId);

      const sale = createTestSale(
        buyerRes.body.data.buyer.buyerId,
        producerRes.body.data.producer.producerId
      );
      const saleRes = await adminClient.post('/api/sales', sale);
      const saleId = saleRes.body.data.sale.saleId;
      cleanup.trackSale(saleId);

      // Operator tries to access admin's sale
      const getRes = await operatorClient.get(`/api/sales/${saleId}`);
      expect(getRes.statusCode).toBe(403);
    });

    it('should allow admin to access all sales', async () => {
      const { adminClient, cleanup } = context;

      // Create multiple sales
      const buyer = createTestBuyer();
      const buyerRes = await adminClient.post('/api/buyers', buyer);
      cleanup.trackBuyer(buyerRes.body.data.buyer.buyerId);

      const producer = createTestProducer();
      const producerRes = await adminClient.post('/api/producers', producer);
      cleanup.trackProducer(producerRes.body.data.producer.producerId);

      const sale1 = createTestSale(
        buyerRes.body.data.buyer.buyerId,
        producerRes.body.data.producer.producerId
      );
      const sale1Res = await adminClient.post('/api/sales', sale1);
      cleanup.trackSale(sale1Res.body.data.sale.saleId);

      const sale2 = createTestSale(
        buyerRes.body.data.buyer.buyerId,
        producerRes.body.data.producer.producerId
      );
      const sale2Res = await adminClient.post('/api/sales', sale2);
      cleanup.trackSale(sale2Res.body.data.sale.saleId);

      // Admin lists all sales
      const listRes = await adminClient.get('/api/sales');
      expect(listRes.statusCode).toBe(200);
      expect(listRes.body.data.sales.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('Validation', () => {
    it('should validate required fields when creating sale', async () => {
      const { adminClient } = context;

      const invalidSale = {
        // Missing buyerId and producerId
        saleDate: '2026-01-30',
      };

      const res = await adminClient.post('/api/sales', invalidSale);
      expect(res.statusCode).toBe(422);
      expect(res.body.error).toBe('Validation Error');
    });

    it('should validate sale line quantities', async () => {
      const { adminClient, cleanup } = context;

      // Create a valid sale first
      const buyer = createTestBuyer();
      const buyerRes = await adminClient.post('/api/buyers', buyer);
      cleanup.trackBuyer(buyerRes.body.data.buyer.buyerId);

      const producer = createTestProducer();
      const producerRes = await adminClient.post('/api/producers', producer);
      cleanup.trackProducer(producerRes.body.data.producer.producerId);

      const sale = createTestSale(
        buyerRes.body.data.buyer.buyerId,
        producerRes.body.data.producer.producerId
      );
      const saleRes = await adminClient.post('/api/sales', sale);
      const saleId = saleRes.body.data.sale.saleId;
      cleanup.trackSale(saleId);

      // Try to add line with invalid quantity
      const invalidLine = createTestSaleLine({
        quantity: -5, // Negative quantity
      });

      const lineRes = await adminClient.post(`/api/sales/${saleId}/lines`, invalidLine);
      expect(lineRes.statusCode).toBe(422);
    });
  });
});
