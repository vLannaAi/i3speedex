/**
 * Integration Test: Buyers API
 *
 * Tests basic CRUD operations for buyers
 */

import { setupTests, teardownTests, TestContext } from '../helpers/setup';
import { createTestBuyer, createTestBuyers } from '../helpers/test-data';

describe('Buyers API Integration Tests', () => {
  let context: TestContext;

  beforeAll(async () => {
    context = await setupTests();
  });

  afterAll(async () => {
    await teardownTests(context);
  });

  describe('POST /api/buyers', () => {
    it('should create a new buyer', async () => {
      const { adminClient, cleanup } = context;

      const buyerData = createTestBuyer();
      const response = await adminClient.post('/api/buyers', buyerData);

      expect(response.statusCode).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.buyer).toMatchObject({
        companyName: buyerData.companyName,
        vatNumber: buyerData.vatNumber,
        city: buyerData.city,
        country: buyerData.country,
        status: 'active',
      });

      cleanup.trackBuyer(response.body.data.buyer.buyerId);
    });

    it('should reject duplicate VAT number', async () => {
      const { adminClient, cleanup } = context;

      const buyerData = createTestBuyer({ vatNumber: 'IT99999999999' });
      const response1 = await adminClient.post('/api/buyers', buyerData);
      expect(response1.statusCode).toBe(201);
      cleanup.trackBuyer(response1.body.data.buyer.buyerId);

      // Try to create another buyer with same VAT
      const duplicateData = createTestBuyer({ vatNumber: 'IT99999999999' });
      const response2 = await adminClient.post('/api/buyers', duplicateData);
      expect(response2.statusCode).toBe(409);
      expect(response2.body.message).toContain('already exists');
    });

    it('should validate required fields', async () => {
      const { adminClient } = context;

      const invalidData = {
        companyName: 'Test Company',
        // Missing required fields like vatNumber, address, etc.
      };

      const response = await adminClient.post('/api/buyers', invalidData);
      expect(response.statusCode).toBe(422);
      expect(response.body.error).toBe('Validation Error');
    });
  });

  describe('GET /api/buyers/:id', () => {
    it('should retrieve a buyer by ID', async () => {
      const { adminClient, cleanup } = context;

      // Create a buyer
      const buyerData = createTestBuyer();
      const createRes = await adminClient.post('/api/buyers', buyerData);
      const buyerId = createRes.body.data.buyer.buyerId;
      cleanup.trackBuyer(buyerId);

      // Retrieve it
      const getRes = await adminClient.get(`/api/buyers/${buyerId}`);
      expect(getRes.statusCode).toBe(200);
      expect(getRes.body.data.buyer.buyerId).toBe(buyerId);
      expect(getRes.body.data.buyer.companyName).toBe(buyerData.companyName);
    });

    it('should return 404 for non-existent buyer', async () => {
      const { adminClient } = context;

      const response = await adminClient.get('/api/buyers/NONEXISTENT');
      expect(response.statusCode).toBe(404);
    });
  });

  describe('GET /api/buyers', () => {
    it('should list all buyers', async () => {
      const { adminClient, cleanup } = context;

      // Create multiple buyers
      const buyers = createTestBuyers(3);
      for (const buyer of buyers) {
        const res = await adminClient.post('/api/buyers', buyer);
        cleanup.trackBuyer(res.body.data.buyer.buyerId);
      }

      // List buyers
      const response = await adminClient.get('/api/buyers');
      expect(response.statusCode).toBe(200);
      expect(response.body.data.buyers.length).toBeGreaterThanOrEqual(3);
    });

    it('should paginate results', async () => {
      const { adminClient, cleanup } = context;

      // Create multiple buyers
      const buyers = createTestBuyers(15);
      for (const buyer of buyers) {
        const res = await adminClient.post('/api/buyers', buyer);
        cleanup.trackBuyer(res.body.data.buyer.buyerId);
      }

      // Get first page
      const page1 = await adminClient.get('/api/buyers', { limit: '5' });
      expect(page1.statusCode).toBe(200);
      expect(page1.body.data.buyers).toHaveLength(5);
      expect(page1.body.data.hasMore).toBe(true);
    });
  });

  describe('PUT /api/buyers/:id', () => {
    it('should update a buyer', async () => {
      const { adminClient, cleanup } = context;

      // Create a buyer
      const buyerData = createTestBuyer();
      const createRes = await adminClient.post('/api/buyers', buyerData);
      const buyerId = createRes.body.data.buyer.buyerId;
      cleanup.trackBuyer(buyerId);

      // Update it
      const updateData = {
        companyName: 'Updated Company Name',
        email: 'updated@test.com',
      };

      const updateRes = await adminClient.put(`/api/buyers/${buyerId}`, updateData);
      expect(updateRes.statusCode).toBe(200);
      expect(updateRes.body.data.buyer.companyName).toBe('Updated Company Name');
      expect(updateRes.body.data.buyer.email).toBe('updated@test.com');
    });

    it('should return 404 when updating non-existent buyer', async () => {
      const { adminClient } = context;

      const response = await adminClient.put('/api/buyers/NONEXISTENT', {
        companyName: 'New Name',
      });
      expect(response.statusCode).toBe(404);
    });
  });

  describe('DELETE /api/buyers/:id', () => {
    it('should soft delete a buyer', async () => {
      const { adminClient, cleanup } = context;

      // Create a buyer
      const buyerData = createTestBuyer();
      const createRes = await adminClient.post('/api/buyers', buyerData);
      const buyerId = createRes.body.data.buyer.buyerId;
      cleanup.trackBuyer(buyerId);

      // Delete it
      const deleteRes = await adminClient.delete(`/api/buyers/${buyerId}`);
      expect(deleteRes.statusCode).toBe(200);

      // Verify it's not accessible
      const getRes = await adminClient.get(`/api/buyers/${buyerId}`);
      expect(getRes.statusCode).toBe(404);
    });

    it('should return 404 when deleting non-existent buyer', async () => {
      const { adminClient } = context;

      const response = await adminClient.delete('/api/buyers/NONEXISTENT');
      expect(response.statusCode).toBe(404);
    });
  });

  describe('GET /api/search/buyers', () => {
    it('should search buyers by company name', async () => {
      const { adminClient, cleanup } = context;

      // Create a buyer with unique name
      const uniqueName = `Unique Test Company ${Date.now()}`;
      const buyerData = createTestBuyer({ companyName: uniqueName });
      const createRes = await adminClient.post('/api/buyers', buyerData);
      cleanup.trackBuyer(createRes.body.data.buyer.buyerId);

      // Search for it
      const searchRes = await adminClient.get('/api/search/buyers', {
        q: uniqueName.split(' ')[0], // Search for "Unique"
      });

      expect(searchRes.statusCode).toBe(200);
      expect(searchRes.body.data.buyers.length).toBeGreaterThan(0);
      expect(
        searchRes.body.data.buyers.some((b: any) => b.companyName === uniqueName)
      ).toBe(true);
    });

    it('should return empty results for non-matching search', async () => {
      const { adminClient } = context;

      const searchRes = await adminClient.get('/api/search/buyers', {
        q: 'NonExistentCompanyXYZ123',
      });

      expect(searchRes.statusCode).toBe(200);
      expect(searchRes.body.data.buyers).toEqual([]);
      expect(searchRes.body.data.totalMatches).toBe(0);
    });
  });
});
