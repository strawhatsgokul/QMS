import { Router } from 'express';
import { z } from 'zod';
import jwt from 'jsonwebtoken';
import { prisma } from '../index.js';
import { config } from '../config/index.js';
import { validate } from '../middleware/validate.js';
import { AppError } from '../middleware/errorHandler.js';
import { agentService } from '../services/agent.service.js';
import { logger } from '../config/logger.js';

export const agentRouter = Router();

const registerSchema = z.object({
  hostname: z.string().min(1).max(255),
  ipAddress: z.string().min(1),
  macAddress: z.string().optional(),
  os: z.string().optional(),
  version: z.string().optional(),
  agentKey: z.string().min(1),
});

const heartbeatSchema = z.object({
  cpuUsage: z.number().optional(),
  memoryUsage: z.number().optional(),
  memoryTotal: z.number().optional(),
  topProcesses: z.array(z.any()).optional(),
  activeWindow: z.string().nullable().optional(),
  activitySummary: z.string().optional(),
  veyonStatus: z.string().optional(),
  awStatus: z.string().optional(),
});

const commandResultSchema = z.object({
  status: z.string(),
  result: z.record(z.unknown()).optional(),
  errorMessage: z.string().nullable().optional(),
});

function generateAgentToken(agentId: string): string {
  return jwt.sign({ sub: agentId, type: 'agent' }, config.jwt.secret, { expiresIn: '7d' });
}

async function authenticateAgent(req: any, res: any, next: any): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'No token provided' } });
    return;
  }
  try {
    const decoded = jwt.verify(authHeader.split(' ')[1], config.jwt.secret) as { sub: string; type: string };
    if (decoded.type !== 'agent') {
      res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Invalid token type' } });
      return;
    }
    req.agentId = decoded.sub;
    next();
  } catch {
    res.status(401).json({ success: false, error: { code: 'TOKEN_EXPIRED', message: 'Agent token expired or invalid' } });
  }
}

agentRouter.post('/register', validate(registerSchema), async (req, res, next) => {
  try {
    const { hostname, ipAddress, agentKey } = req.body;
    const result = await agentService.register({ hostname, ipAddress, agentKey });
    const token = generateAgentToken(result.agentId);
    logger.info(`Agent registered: ${hostname} (${ipAddress}) → ${result.agentId}`);
    res.json({ success: true, data: { agentId: result.agentId, token } });
  } catch (err) { next(err); }
});

agentRouter.post('/heartbeat', authenticateAgent, validate(heartbeatSchema), async (req, res, next) => {
  try {
    const agentId = (req as any).agentId as string;
    const { activeWindow, cpuUsage, memoryUsage } = req.body;
    await agentService.recordHeartbeat(agentId, { activeWindow, cpuUsage, memoryUsage });
    const pendingCount = await prisma.agentCommand.count({ where: { agentId, status: 'pending' } });
    res.json({ success: true, data: { commandsPending: pendingCount } });
  } catch (err) { next(err); }
});

agentRouter.get('/commands', authenticateAgent, async (req, res, next) => {
  try {
    const agentId = (req as any).agentId as string;
    const commands = await agentService.getPendingCommands(agentId);
    res.json({ success: true, data: commands });
  } catch (err) { next(err); }
});

agentRouter.post('/commands/:id/result', authenticateAgent, validate(commandResultSchema), async (req, res, next) => {
  try {
    const id = req.params.id!;
    const { status, result, errorMessage } = req.body;
    if (status === 'completed') {
      await agentService.completeCommand(id, result ?? undefined);
    } else {
      await agentService.completeCommand(id, undefined, errorMessage ?? 'Command failed');
    }
    res.json({ success: true, data: { id, status: 'acknowledged' } });
  } catch (err) { next(err); }
});

agentRouter.get('/veyon-config', authenticateAgent, async (_req, res, next) => {
  try {
    const veyonConfig = agentService.getVeyonConfig();
    if (!veyonConfig) {
      throw new AppError(404, 'VEYON_CONFIG_NOT_FOUND', 'Veyon private key not configured on server');
    }
    res.json({ success: true, data: veyonConfig });
  } catch (err) { next(err); }
});
