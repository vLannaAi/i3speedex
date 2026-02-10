/**
 * Integration Test Setup and Teardown Helpers
 *
 * Manages test environment setup, authentication, and cleanup
 */

import { ApiClient, createApiClient } from './api-client';
import { resetCounters } from './test-data';

export interface TestContext {
  client: ApiClient;
  adminClient: ApiClient;
  operatorClient: ApiClient;
  cleanup: CleanupTracker;
}

/**
 * Track created resources for cleanup
 */
export class CleanupTracker {
  private sales: string[] = [];
  private buyers: string[] = [];
  private producers: string[] = [];

  trackSale(saleId: string): void {
    this.sales.push(saleId);
  }

  trackBuyer(buyerId: string): void {
    this.buyers.push(buyerId);
  }

  trackProducer(producerId: string): void {
    this.producers.push(producerId);
  }

  getSales(): string[] {
    return [...this.sales];
  }

  getBuyers(): string[] {
    return [...this.buyers];
  }

  getProducers(): string[] {
    return [...this.producers];
  }

  clear(): void {
    this.sales = [];
    this.buyers = [];
    this.producers = [];
  }
}

/**
 * Setup integration test environment
 */
export async function setupTests(): Promise<TestContext> {
  // Reset test data counters
  resetCounters();

  // Create API clients
  const client = createApiClient();
  const adminClient = createApiClient();
  const operatorClient = createApiClient();

  // Get authentication tokens from environment
  const adminToken = process.env.ADMIN_TOKEN;
  const operatorToken = process.env.OPERATOR_TOKEN;

  if (adminToken) {
    adminClient.setAuth(adminToken);
  }

  if (operatorToken) {
    operatorClient.setAuth(operatorToken);
  }

  // Create cleanup tracker
  const cleanup = new CleanupTracker();

  return {
    client,
    adminClient,
    operatorClient,
    cleanup,
  };
}

/**
 * Cleanup test resources
 */
export async function teardownTests(context: TestContext): Promise<void> {
  const { adminClient, cleanup } = context;

  // Delete sales (in reverse order - delete children first)
  for (const saleId of cleanup.getSales().reverse()) {
    try {
      await adminClient.delete(`/api/sales/${saleId}`);
    } catch (error) {
      console.warn(`Failed to cleanup sale ${saleId}:`, error);
    }
  }

  // Delete buyers
  for (const buyerId of cleanup.getBuyers().reverse()) {
    try {
      await adminClient.delete(`/api/buyers/${buyerId}`);
    } catch (error) {
      console.warn(`Failed to cleanup buyer ${buyerId}:`, error);
    }
  }

  // Delete producers
  for (const producerId of cleanup.getProducers().reverse()) {
    try {
      await adminClient.delete(`/api/producers/${producerId}`);
    } catch (error) {
      console.warn(`Failed to cleanup producer ${producerId}:`, error);
    }
  }

  // Clear cleanup tracker
  cleanup.clear();
}

/**
 * Wait for a condition to be true
 */
export async function waitFor(
  condition: () => Promise<boolean>,
  options: {
    timeout?: number;
    interval?: number;
    description?: string;
  } = {}
): Promise<void> {
  const timeout = options.timeout || 5000;
  const interval = options.interval || 100;
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    if (await condition()) {
      return;
    }
    await sleep(interval);
  }

  throw new Error(
    `Timeout waiting for condition${options.description ? `: ${options.description}` : ''}`
  );
}

/**
 * Sleep for specified milliseconds
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Skip test if integration tests are disabled
 */
export function skipIfIntegrationDisabled(): void {
  const isEnabled = process.env.RUN_INTEGRATION_TESTS === 'true';
  if (!isEnabled) {
    console.warn(
      'Integration tests are disabled. Set RUN_INTEGRATION_TESTS=true to enable them.'
    );
    process.exit(0);
  }
}
