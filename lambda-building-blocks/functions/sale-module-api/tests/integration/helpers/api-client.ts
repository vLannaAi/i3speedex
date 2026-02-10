/**
 * API Client for Integration Tests
 *
 * Provides helper methods to make HTTP requests to the API
 * Handles authentication, headers, and response parsing
 */

import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';

export interface ApiClientConfig {
  baseURL: string;
  accessToken?: string;
  timeout?: number;
}

export interface ApiResponse<T = any> {
  statusCode: number;
  body: T;
  headers: Record<string, string>;
}

/**
 * API Client for making authenticated requests to the Sale Module API
 */
export class ApiClient {
  private client: AxiosInstance;
  private accessToken?: string;

  constructor(config: ApiClientConfig) {
    this.accessToken = config.accessToken;

    this.client = axios.create({
      baseURL: config.baseURL,
      timeout: config.timeout || 10000,
      validateStatus: () => true, // Don't throw on any status code
    });
  }

  /**
   * Set authentication token for subsequent requests
   */
  setAuth(token: string): void {
    this.accessToken = token;
  }

  /**
   * Clear authentication token
   */
  clearAuth(): void {
    this.accessToken = undefined;
  }

  /**
   * Make GET request
   */
  async get<T = any>(path: string, queryParams?: Record<string, string>): Promise<ApiResponse<T>> {
    const config = this.buildConfig();
    if (queryParams) {
      config.params = queryParams;
    }

    const response = await this.client.get(path, config);
    return this.parseResponse(response);
  }

  /**
   * Make POST request
   */
  async post<T = any>(path: string, data?: any): Promise<ApiResponse<T>> {
    const config = this.buildConfig();
    const response = await this.client.post(path, data, config);
    return this.parseResponse(response);
  }

  /**
   * Make PUT request
   */
  async put<T = any>(path: string, data?: any): Promise<ApiResponse<T>> {
    const config = this.buildConfig();
    const response = await this.client.put(path, data, config);
    return this.parseResponse(response);
  }

  /**
   * Make DELETE request
   */
  async delete<T = any>(path: string): Promise<ApiResponse<T>> {
    const config = this.buildConfig();
    const response = await this.client.delete(path, config);
    return this.parseResponse(response);
  }

  /**
   * Build axios config with headers
   */
  private buildConfig(): AxiosRequestConfig {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (this.accessToken) {
      headers['Authorization'] = `Bearer ${this.accessToken}`;
    }

    return { headers };
  }

  /**
   * Parse axios response into ApiResponse format
   */
  private parseResponse<T>(response: AxiosResponse): ApiResponse<T> {
    return {
      statusCode: response.status,
      body: response.data,
      headers: response.headers as Record<string, string>,
    };
  }
}

/**
 * Create API client with default configuration
 */
export function createApiClient(config?: Partial<ApiClientConfig>): ApiClient {
  const defaultConfig: ApiClientConfig = {
    baseURL: process.env.API_BASE_URL || 'http://localhost:3000',
    timeout: 10000,
    ...config,
  };

  return new ApiClient(defaultConfig);
}
