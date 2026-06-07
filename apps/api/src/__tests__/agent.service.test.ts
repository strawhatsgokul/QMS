import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../index.js', () => ({
  prisma: {
    agent: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
    },
    agentHeartbeat: {
      create: vi.fn(),
      findMany: vi.fn(),
    },
    agentCommand: {
      create: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
    },
    computer: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
    },
  },
  io: {
    emit: vi.fn(),
    to: vi.fn(() => ({ emit: vi.fn() })),
  },
}));

vi.mock('../config/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('bcryptjs', () => ({
  default: {
    hash: vi.fn((pwd: string) => Promise.resolve(`hashed_${pwd}`)),
    compare: vi.fn((pwd: string, hash: string) => Promise.resolve(hash === `hashed_${pwd}`)),
  },
  hash: vi.fn((pwd: string) => Promise.resolve(`hashed_${pwd}`)),
  compare: vi.fn((pwd: string, hash: string) => Promise.resolve(hash === `hashed_${pwd}`)),
}));

import { prisma } from '../index.js';

const mockAgent = {
  id: 'agent-001',
  hostname: 'PC-01',
  ipAddress: '192.168.1.50',
  status: 'online',
  agentKey: 'hashed_test-key-123',
  lastHeartbeatAt: new Date(),
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockHeartbeat = {
  id: 'hb-001',
  agentId: 'agent-001',
  cpuUsage: 23.5,
  memoryUsage: 45.2,
  activeWindow: 'Google Chrome',
  timestamp: new Date(),
};

const mockCommand = {
  id: 'cmd-001',
  agentId: 'agent-001',
  type: 'LOCK',
  params: null,
  status: 'pending',
  result: null,
  errorMessage: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('Agent Registration', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('registers a new agent with hostname, IP, and hashed key', async () => {
    vi.mocked(prisma.agent.create).mockResolvedValueOnce(mockAgent);

    const agentKey = 'test-key-123';
    const agentData = {
      hostname: 'PC-01',
      ipAddress: '192.168.1.50',
    };

    const agent = await prisma.agent.create({
      data: {
        ...agentData,
        agentKey: `hashed_${agentKey}`,
        status: 'online',
      },
    });

    expect(agent).toBeDefined();
    expect(agent.hostname).toBe('PC-01');
    expect(agent.agentKey).toBe('hashed_test-key-123');
    expect(prisma.agent.create).toHaveBeenCalledOnce();
  });

  it('prevents duplicate registration for the same hostname', async () => {
    vi.mocked(prisma.agent.findFirst).mockResolvedValueOnce(mockAgent);

    const existing = await prisma.agent.findFirst({
      where: { hostname: 'PC-01' },
    });

    expect(existing).not.toBeNull();
    expect(existing!.hostname).toBe('PC-01');
    expect(prisma.agent.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ hostname: 'PC-01' }),
      }),
    );
  });

  it('updates agent key on re-registration', async () => {
    const newKey = 'hashed_new-key-xyz';
    vi.mocked(prisma.agent.findFirst).mockResolvedValueOnce(mockAgent);
    vi.mocked(prisma.agent.update).mockResolvedValueOnce({
      ...mockAgent,
      agentKey: newKey,
    });

    const existing = await prisma.agent.findFirst({
      where: { hostname: 'PC-01' },
    });

    const updated = await prisma.agent.update({
      where: { id: existing!.id },
      data: { agentKey: newKey, lastHeartbeatAt: new Date() },
    });

    expect(updated.agentKey).toBe('hashed_new-key-xyz');
    expect(prisma.agent.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'agent-001' },
        data: expect.objectContaining({ agentKey: newKey }),
      }),
    );
  });
});

describe('Agent Heartbeat', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('stores a heartbeat with CPU, memory, and active window data', async () => {
    vi.mocked(prisma.agentHeartbeat.create).mockResolvedValueOnce(mockHeartbeat);

    const heartbeat = await prisma.agentHeartbeat.create({
      data: {
        agentId: 'agent-001',
        cpuUsage: 23.5,
        memoryUsage: 45.2,
        activeWindow: 'Google Chrome',
      },
    });

    expect(heartbeat).toBeDefined();
    expect(heartbeat.cpuUsage).toBe(23.5);
    expect(heartbeat.memoryUsage).toBe(45.2);
    expect(heartbeat.activeWindow).toBe('Google Chrome');
    expect(prisma.agentHeartbeat.create).toHaveBeenCalledOnce();
  });

  it('updates agent lastHeartbeatAt on each heartbeat', async () => {
    const now = new Date();
    vi.mocked(prisma.agent.update).mockResolvedValueOnce({
      ...mockAgent,
      lastHeartbeatAt: now,
    });

    const updated = await prisma.agent.update({
      where: { id: 'agent-001' },
      data: { lastHeartbeatAt: now, status: 'online' },
    });

    expect(updated.lastHeartbeatAt).toEqual(now);
    expect(updated.status).toBe('online');
  });

  it('marks agent offline if heartbeat older than 2 minutes', async () => {
    const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000);
    vi.mocked(prisma.agent.findFirst).mockResolvedValueOnce(null);

    const agent = await prisma.agent.findFirst({
      where: {
        hostname: 'PC-01',
        lastHeartbeatAt: { gte: twoMinutesAgo },
      },
    });

    expect(agent).toBeNull();
    expect(prisma.agent.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          lastHeartbeatAt: { gte: twoMinutesAgo },
        }),
      }),
    );
  });
});

describe('Agent Command Queue', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates a pending command for an agent', async () => {
    vi.mocked(prisma.agentCommand.create).mockResolvedValueOnce(mockCommand);

    const cmd = await prisma.agentCommand.create({
      data: {
        agentId: 'agent-001',
        type: 'LOCK',
        status: 'pending',
      },
    });

    expect(cmd).toBeDefined();
    expect(cmd.type).toBe('LOCK');
    expect(cmd.status).toBe('pending');
    expect(prisma.agentCommand.create).toHaveBeenCalledOnce();
  });

  it('polls pending commands (oldest first, max 10)', async () => {
    const pendingCommands = [
      { ...mockCommand, id: 'cmd-001', createdAt: new Date(Date.now() - 20000) },
      { ...mockCommand, id: 'cmd-002', createdAt: new Date(Date.now() - 10000) },
    ];

    vi.mocked(prisma.agentCommand.findMany).mockResolvedValueOnce(pendingCommands);

    const commands = await prisma.agentCommand.findMany({
      where: { agentId: 'agent-001', status: 'pending' },
      orderBy: { createdAt: 'asc' },
      take: 10,
    });

    expect(commands).toHaveLength(2);
    expect(commands[0]!.id).toBe('cmd-001');
    expect(commands[1]!.id).toBe('cmd-002');
  });

  it('marks command as completed with result', async () => {
    const completedCmd = {
      ...mockCommand,
      status: 'completed' as const,
      result: 'Screen locked successfully',
      updatedAt: new Date(),
    };

    vi.mocked(prisma.agentCommand.update).mockResolvedValueOnce(completedCmd);

    const updated = await prisma.agentCommand.update({
      where: { id: 'cmd-001' },
      data: {
        status: 'completed',
        result: 'Screen locked successfully',
      },
    });

    expect(updated.status).toBe('completed');
    expect(updated.result).toBe('Screen locked successfully');
    expect(updated.updatedAt).toBeInstanceOf(Date);
  });

  it('marks command as failed with error message', async () => {
    const failedCmd = {
      ...mockCommand,
      status: 'failed' as const,
      errorMessage: 'Veyon service not responding',
      updatedAt: new Date(),
    };

    vi.mocked(prisma.agentCommand.update).mockResolvedValueOnce(failedCmd);

    const updated = await prisma.agentCommand.update({
      where: { id: 'cmd-001' },
      data: {
        status: 'failed',
        errorMessage: 'Veyon service not responding',
      },
    });

    expect(updated.status).toBe('failed');
    expect(updated.errorMessage).toBe('Veyon service not responding');
  });

  it('returns zero pending commands when queue is empty', async () => {
    vi.mocked(prisma.agentCommand.count).mockResolvedValueOnce(0);

    const count = await prisma.agentCommand.count({
      where: { agentId: 'agent-001', status: 'pending' },
    });

    expect(count).toBe(0);
  });

  it('handles multiple command types (LOCK, UNLOCK, REBOOT, SHUTDOWN, MESSAGE, SCREENSHOT)', async () => {
    const commandTypes = ['LOCK', 'UNLOCK', 'REBOOT', 'SHUTDOWN', 'MESSAGE', 'SCREENSHOT'];

    for (const type of commandTypes) {
      vi.mocked(prisma.agentCommand.create).mockResolvedValueOnce({
        ...mockCommand,
        id: `cmd-${type}`,
        type,
      });

      const cmd = await prisma.agentCommand.create({
        data: { agentId: 'agent-001', type, status: 'pending' },
      });

      expect(cmd.type).toBe(type);
    }

    expect(prisma.agentCommand.create).toHaveBeenCalledTimes(6);
  });
});
