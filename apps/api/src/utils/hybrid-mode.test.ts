import { describe, it, expect, vi } from 'vitest';

vi.mock('../index.js', () => ({
  prisma: {
    agent: {
      findFirst: vi.fn(),
    },
  },
}));

import { prisma } from '../index.js';
import { hasActiveAgent, getAgentStatus } from './hybrid-mode.js';

const mockComputer = { hostname: 'pc-01', ipAddress: '192.168.1.10' };

describe('hasActiveAgent', () => {
  it('returns active=true when agent heartbeat is within 2 minutes', async () => {
    vi.mocked(prisma.agent.findFirst).mockResolvedValueOnce({
      id: 'agent-1', hostname: 'pc-01', ipAddress: '192.168.1.10',
      macAddress: null, os: null, version: null, status: 'online',
      agentKeyHash: 'hash', agentToken: 'token',
      lastHeartbeatAt: new Date(), createdAt: new Date(), updatedAt: new Date(),
    } as never);

    const result = await hasActiveAgent(mockComputer);
    expect(result.active).toBe(true);
    expect(result.agentId).toBe('agent-1');
  });

  it('returns active=false when no agent found', async () => {
    vi.mocked(prisma.agent.findFirst).mockResolvedValueOnce(null);
    const result = await hasActiveAgent(mockComputer);
    expect(result.active).toBe(false);
    expect(result.agentId).toBeUndefined();
  });

  it('queries by hostname or ipAddress', async () => {
    vi.mocked(prisma.agent.findFirst).mockResolvedValueOnce({} as never);
    await hasActiveAgent(mockComputer);
    expect(prisma.agent.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: expect.arrayContaining([
            expect.objectContaining({ hostname: 'pc-01' }),
          ]),
        }),
      }),
    );
  });
});

describe('getAgentStatus', () => {
  it('returns active status when agent has activeWindow', async () => {
    (prisma.agent.findFirst as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      id: 'agent-1', hostname: 'pc-01', ipAddress: '192.168.1.10',
      macAddress: null, os: null, version: null, status: 'online',
      agentKeyHash: 'hash', agentToken: 'token',
      lastHeartbeatAt: new Date(), createdAt: new Date(), updatedAt: new Date(),
      heartbeats: [{ activeWindow: 'Chrome', timestamp: new Date() }],
    });

    const result = await getAgentStatus(mockComputer);
    expect(result).toEqual({ status: 'active', currentUser: 'Chrome' });
  });

  it('returns null when no agent matches', async () => {
    vi.mocked(prisma.agent.findFirst).mockResolvedValueOnce(null);
    const result = await getAgentStatus(mockComputer);
    expect(result).toBeNull();
  });

  it('returns online status without activeWindow', async () => {
    (prisma.agent.findFirst as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      id: 'agent-1', hostname: 'pc-01', ipAddress: '192.168.1.10',
      macAddress: null, os: null, version: null, status: 'online',
      agentKeyHash: 'hash', agentToken: 'token',
      lastHeartbeatAt: new Date(), createdAt: new Date(), updatedAt: new Date(),
      heartbeats: [{ timestamp: new Date() }],
    });

    const result = await getAgentStatus(mockComputer);
    expect(result).toEqual({ status: 'online', currentUser: undefined });
  });
});
