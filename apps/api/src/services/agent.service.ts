import { prisma } from '../index.js';
import { AppError } from '../middleware/errorHandler.js';
import { config } from '../config/index.js';
import { readFileSync } from 'fs';

export const agentService = {
  async register(data: { hostname: string; ipAddress: string; agentKey: string }): Promise<{ agentId: string }> {
    if (data.agentKey !== config.agent.key) {
      throw new AppError(401, 'INVALID_AGENT_KEY', 'Invalid agent key');
    }

    const existing = await prisma.agent.findUnique({ where: { hostname: data.hostname } });
    if (existing) {
      const agent = await prisma.agent.update({
        where: { id: existing.id },
        data: { ipAddress: data.ipAddress, status: 'online', lastHeartbeatAt: new Date(), agentKey: data.agentKey },
      });
      return { agentId: agent.id };
    }

    const agent = await prisma.agent.create({
      data: { hostname: data.hostname, ipAddress: data.ipAddress, status: 'online', lastHeartbeatAt: new Date(), agentKey: data.agentKey },
    });
    return { agentId: agent.id };
  },

  async recordHeartbeat(agentId: string, data: { activeWindow?: string; cpuUsage?: number; memoryUsage?: number }): Promise<void> {
    await prisma.$transaction([
      prisma.agentHeartbeat.create({
        data: { agentId, activeWindow: data.activeWindow, cpuUsage: data.cpuUsage, memoryUsage: data.memoryUsage },
      }),
      prisma.agent.update({
        where: { id: agentId },
        data: { status: 'online', lastHeartbeatAt: new Date() },
      }),
    ]);
  },

  async enqueueCommand(agentId: string, type: string, params?: Record<string, unknown>): Promise<{ commandId: string }> {
    const agent = await prisma.agent.findUnique({ where: { id: agentId } });
    if (!agent) throw new AppError(404, 'AGENT_NOT_FOUND', 'Agent not found');

    const command = await prisma.agentCommand.create({
      data: { agentId, type, params: params ? JSON.stringify(params) : null, status: 'pending' },
    });
    return { commandId: command.id };
  },

  async getPendingCommands(agentId: string): Promise<{ id: string; type: string; params: Record<string, unknown> | null }[]> {
    const commands = await prisma.agentCommand.findMany({
      where: { agentId, status: 'pending' },
      orderBy: { createdAt: 'asc' },
      take: 10,
    });
    return commands.map((c) => ({
      id: c.id,
      type: c.type,
      params: c.params ? JSON.parse(c.params) : null,
    }));
  },

  async completeCommand(commandId: string, result?: Record<string, unknown>, errorMessage?: string): Promise<void> {
    const command = await prisma.agentCommand.findUnique({ where: { id: commandId } });
    if (!command) throw new AppError(404, 'COMMAND_NOT_FOUND', 'Command not found');

    await prisma.agentCommand.update({
      where: { id: commandId },
      data: {
        status: errorMessage ? 'failed' : 'completed',
        result: result ? JSON.stringify(result) : null,
        errorMessage: errorMessage || null,
      },
    });
  },

  getVeyonConfig(): { privateKey: string; keyName: string; webapiUrl: string } | null {
    const keyName = config.veyon.keyName;
    const keyPath = config.veyon.privateKeyPath;
    if (!keyPath) return null;
    try {
      const privateKey = readFileSync(keyPath, 'utf-8');
      return { privateKey, keyName, webapiUrl: config.veyon.webapiUrl };
    } catch {
      return null;
    }
  },
};
