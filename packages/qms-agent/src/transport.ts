import axios, { type AxiosInstance, type AxiosRequestConfig, type AxiosResponse } from 'axios';
import https from 'node:https';
import type { AgentConfig } from './config.js';
import { logger } from './logger.js';

export class Transport {
  private client: AxiosInstance;
  private token: string | null = null;

  constructor(private config: AgentConfig) {
    const axiosConfig: AxiosRequestConfig = {
      timeout: 10000,
      headers: { 'Content-Type': 'application/json' },
    };

    if (this.config.useHttps && this.config.certPath) {
      axiosConfig.httpsAgent = new https.Agent({
        rejectUnauthorized: false,
      });
    }

    this.client = axios.create(axiosConfig);
  }

  setToken(token: string | null) {
    this.token = token;
  }

  getToken(): string | null {
    return this.token;
  }

  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {};
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }
    return headers;
  }

  async get<T = unknown>(path: string, retries = 3): Promise<T> {
    const fn = () => this.client.get(`${this.config.apiUrl}${path}`, { headers: this.getHeaders() });
    return this.request<T>(fn, path, retries);
  }

  async post<T = unknown>(path: string, data?: unknown, retries = 3): Promise<T> {
    const fn = () => this.client.post(`${this.config.apiUrl}${path}`, data, { headers: this.getHeaders() });
    return this.request<T>(fn, path, retries);
  }

  private async request<T>(
    fn: () => Promise<AxiosResponse<{ success: boolean; data: T }>>,
    path: string,
    retries: number,
  ): Promise<T> {
    let lastError: Error | null = null;
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const response = await fn();
        if (response.data?.success === false) {
          throw new Error(`API error: ${JSON.stringify(response.data)}`);
        }
        return response.data.data;
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        if (attempt < retries) {
          const delay = Math.min(1000 * Math.pow(2, attempt), 8000);
          logger.warn(`Request failed (attempt ${attempt + 1}/${retries + 1}), retrying in ${delay}ms: ${path}`);
          await new Promise(r => setTimeout(r, delay));
        }
      }
    }
    throw lastError || new Error('Request failed after all retries');
  }

  isConnected(): boolean {
    return this.token !== null;
  }
}
