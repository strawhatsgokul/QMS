import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../index.js';
import { config } from '../config/index.js';
import { logger } from '../config/logger.js';
import { AppError } from '../middleware/errorHandler.js';

const SALT_ROUNDS = 12;

export interface RegisterPayload {
  hostname: string;
  ipAddress: string;
  macAddress?: string;
  os?: string;
  version?: string;
  agentKey: string;
}

export interface HeartbeatPayload {
  cpuUsage: number;
  memoryUsage: number;
  memoryTotal?: number;
  topProcesses?: string;
  activeWindow?: string;
  activitySummary?: string;
  veyonStatus?: string;
  awStatus?: string;
}

export class AgentService {
  async register(payload: RegisterPayload) {
    const existing = await prisma.agent.findFirst({
      where: {
        OR: [
          { hostname: payload.hostname },
          { ipAddress: payload.ipAddress },
        ],
      },
    });

    if (existing) {
      const keyValid = await bcrypt.compare(payload.agentKey, existing.agentKeyHash);
      if (!keyValid) {
        throw new AppError(403, 'AGENT_KEY_INVALID', 'Invalid agent key');
      }
      const token = this._generateToken(existing.id);
      await prisma.agent.update({
        where: { id: existing.id },
        data: {
          agentToken: token,
          ipAddress: payload.ipAddress,
          macAddress: payload.macAddress ?? existing.macAddress,
          os: payload.os ?? existing.os,
          version: payload.version ?? existing.version,
          hostname: payload.hostname,
          status: 'online',
          lastHeartbeatAt: new Date(),
        },
      });
      logger.info(`Agent re-registered: ${payload.hostname} (${existing.id})`);
      return { agentId: existing.id, token };
    }

    const keyHash = await bcrypt.hash(payload.agentKey, SALT_ROUNDS);
    const agent = await prisma.agent.create({
      data: {
        hostname: payload.hostname,
        ipAddress: payload.ipAddress,
        macAddress: payload.macAddress,
        os: payload.os,
        version: payload.version,
        agentKeyHash: keyHash,
        status: 'online',
        lastHeartbeatAt: new Date(),
      },
    });

    const token = this._generateToken(agent.id);
    await prisma.agent.update({
      where: { id: agent.id },
      data: { agentToken: token },
    });

    logger.info(`Agent registered: ${payload.hostname} (${agent.id})`);
    return { agentId: agent.id, token };
  }

  async processHeartbeat(agentId: string, payload: HeartbeatPayload) {
    const agent = await prisma.agent.findUnique({ where: { id: agentId } });
    if (!agent) {
      throw new AppError(404, 'AGENT_NOT_FOUND', 'Agent not found');
    }

    await prisma.agentHeartbeat.create({
      data: {
        agentId,
        cpuUsage: payload.cpuUsage,
        memoryUsage: payload.memoryUsage,
        memoryTotal: payload.memoryTotal,
        topProcesses: payload.topProcesses,
        activeWindow: payload.activeWindow,
        activitySummary: payload.activitySummary,
        veyonStatus: payload.veyonStatus,
        awStatus: payload.awStatus,
      },
    });

    await prisma.agent.update({
      where: { id: agentId },
      data: {
        status: 'online',
        lastHeartbeatAt: new Date(),
      },
    });
  }

  async getPendingCommands(agentId: string) {
    const commands = await prisma.agentCommand.findMany({
      where: { agentId, status: 'pending' },
      orderBy: { createdAt: 'asc' },
      take: 10,
    });
    return commands;
  }

  async reportCommandResult(commandId: string, agentId: string, result: { status: string; result?: string; errorMessage?: string }) {
    const command = await prisma.agentCommand.findFirst({
      where: { id: commandId, agentId },
    });
    if (!command) {
      throw new AppError(404, 'COMMAND_NOT_FOUND', 'Command not found');
    }

    const updateData: Record<string, unknown> = {
      status: result.status,
      result: result.result,
      errorMessage: result.errorMessage,
    };
    if (result.status === 'completed' || result.status === 'failed') {
      updateData['completedAt'] = new Date();
    }

    await prisma.agentCommand.update({
      where: { id: commandId },
      data: updateData as never,
    });

    logger.info(`Command ${commandId} reported as ${result.status} by agent ${agentId}`);
  }

  async getAgentConfig(agentId: string) {
    const agent = await prisma.agent.findUnique({ where: { id: agentId } });
    if (!agent) {
      throw new AppError(404, 'AGENT_NOT_FOUND', 'Agent not found');
    }
    return {
      agentId: agent.id,
      heartbeatInterval: 30,
      commandPollInterval: 5,
      veyonWebapiUrl: config.veyon.webapiUrl,
      activityWatchUrl: config.activityWatch.apiUrl,
    };
  }

  async getVeyonConfig(agentId: string) {
    const agent = await prisma.agent.findUnique({ where: { id: agentId } });
    if (!agent) {
      throw new AppError(404, 'AGENT_NOT_FOUND', 'Agent not found');
    }

    const settings = await prisma.systemSetting.findMany({
      where: { key: { in: ['veyon_private_key', 'veyon_key_name', 'veyon_webapi_key', 'veyon_webapi_url'] } },
    });
    const settingMap = Object.fromEntries(settings.map(s => [s.key, s.value]));

    return {
      privateKey: settingMap['veyon_private_key'] || '',
      keyName: settingMap['veyon_key_name'] || config.veyon.keyName,
      apiKey: settingMap['veyon_webapi_key'] || config.veyon.apiKey,
      webapiUrl: settingMap['veyon_webapi_url'] || config.veyon.webapiUrl,
    };
  }

  async enqueueCommand(agentId: string, type: string, params?: Record<string, unknown>) {
    const agent = await prisma.agent.findUnique({ where: { id: agentId } });
    if (!agent) {
      throw new AppError(404, 'AGENT_NOT_FOUND', 'Agent not found');
    }
    const command = await prisma.agentCommand.create({
      data: {
        agentId,
        type,
        params: params ? JSON.stringify(params) : undefined,
        status: 'pending',
      },
    });
    logger.info(`Command enqueued: ${type} for agent ${agentId} (${command.id})`);
    return command;
  }

  private _generateToken(agentId: string): string {
    return jwt.sign(
      { sub: agentId, type: 'agent' },
      config.jwt.secret,
      { expiresIn: '90d' },
    );
  }
}

export const agentService = new AgentService();
