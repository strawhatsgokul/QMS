import os from 'node:os';
import { Transport } from './transport.js';
import { AgentQueue } from './queue.js';
import { logger } from './logger.js';

export interface RegistrationResult {
  agentId: string;
  token: string;
  isNew: boolean;
}

export async function registerOrAuthenticate(transport: Transport, queue: AgentQueue, agentKey: string): Promise<RegistrationResult> {
  const storedToken = queue.get('agentToken');
  const storedAgentId = queue.get('agentId');

  if (storedToken && storedAgentId) {
    transport.setToken(storedToken);
    logger.info('Using stored agent credentials');
    return { agentId: storedAgentId, token: storedToken, isNew: false };
  }

  const hostname = os.hostname();
  const interfaces = os.networkInterfaces();
  let ipAddress = '127.0.0.1';
  let macAddress = '';

  for (const iface of Object.values(interfaces)) {
    if (!iface) continue;
    for (const addr of iface) {
      if (addr.family === 'IPv4' && !addr.internal) {
        ipAddress = addr.address;
        macAddress = addr.mac;
        break;
      }
    }
    if (ipAddress !== '127.0.0.1') break;
  }

  const payload = {
    hostname,
    ipAddress,
    macAddress: macAddress || undefined,
    os: `${os.type()} ${os.release()}`,
    version: '1.0.0',
    agentKey,
  };

  logger.info(`Registering agent: ${hostname} (${ipAddress})`);
  const result = await transport.post<{ agentId: string; token: string }>('/api/v1/agent/register', payload, 5);

  queue.set('agentToken', result.token);
  queue.set('agentId', result.agentId);
  transport.setToken(result.token);

  logger.info(`Registered successfully. AgentId: ${result.agentId}`);
  return { agentId: result.agentId, token: result.token, isNew: true };
}
