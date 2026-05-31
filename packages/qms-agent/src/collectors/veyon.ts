import axios from 'axios';
import { logger } from '../logger.js';

export interface VeyonStatus {
  status: 'online' | 'offline';
  version?: string;
}

let _defaultUrl = 'http://localhost:11080/api/v1';
let _defaultApiKey = '';

export function setVeyonCollectorConfig(url: string, apiKey?: string) {
  _defaultUrl = url;
  if (apiKey) _defaultApiKey = apiKey;
}

export async function checkVeyon(veyonUrl?: string, apiKey?: string): Promise<VeyonStatus> {
  const baseUrl = veyonUrl || _defaultUrl;
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const key = apiKey || _defaultApiKey;
  if (key) headers['Authorization'] = `Bearer ${key}`;

  try {
    const response = await axios.get(`${baseUrl}/status`, {
      timeout: 5000,
      headers,
      validateStatus: (s) => s < 500,
    });
    if (response.status === 200) {
      return { status: 'online', version: response.data?.version || 'unknown' };
    }
    return { status: 'offline' };
  } catch {
    logger.warn('Veyon WebAPI is offline');
    return { status: 'offline' };
  }
}
