import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validate.js';
import { authenticateAgent } from '../middleware/agentAuth.js';
import { agentService } from '../services/agent.service.js';

export const agentRouter = Router();

const registerSchema = z.object({
  hostname: z.string().min(1),
  ipAddress: z.string(),
  macAddress: z.string().optional(),
  os: z.string().optional(),
  version: z.string().optional(),
  agentKey: z.string().min(8),
});

const heartbeatSchema = z.object({
  cpuUsage: z.number().min(0).max(100),
  memoryUsage: z.number().min(0),
  memoryTotal: z.number().optional(),
  topProcesses: z.string().optional(),
  activeWindow: z.string().optional(),
  activitySummary: z.string().optional(),
  veyonStatus: z.string().optional(),
  awStatus: z.string().optional(),
});

const commandResultSchema = z.object({
  status: z.enum(['completed', 'failed', 'in_progress']),
  result: z.string().optional(),
  errorMessage: z.string().optional(),
});

agentRouter.post('/v1/agent/register', validate(registerSchema), async (req, res, next) => {
  try {
    const result = await agentService.register(req.body);
    res.status(201).json({ success: true, data: result });
  } catch (err) { next(err); }
});

agentRouter.post('/v1/agent/heartbeat', authenticateAgent, validate(heartbeatSchema), async (req, res, next) => {
  try {
    await agentService.processHeartbeat(req.agent!.agentId, req.body);
    const pendingCount = (await agentService.getPendingCommands(req.agent!.agentId)).length;
    res.json({ success: true, data: { commandsPending: pendingCount } });
  } catch (err) { next(err); }
});

agentRouter.get('/v1/agent/commands', authenticateAgent, async (req, res, next) => {
  try {
    const commands = await agentService.getPendingCommands(req.agent!.agentId);
    res.json({ success: true, data: commands });
  } catch (err) { next(err); }
});

agentRouter.post('/v1/agent/commands/:id/result', authenticateAgent, validate(commandResultSchema), async (req, res, next) => {
  try {
    await agentService.reportCommandResult(req.params.id!, req.agent!.agentId, req.body);
    res.json({ success: true, data: { id: req.params.id } });
  } catch (err) { next(err); }
});

agentRouter.get('/v1/agent/config', authenticateAgent, async (req, res, next) => {
  try {
    const configData = await agentService.getAgentConfig(req.agent!.agentId);
    res.json({ success: true, data: configData });
  } catch (err) { next(err); }
});

agentRouter.get('/v1/agent/veyon-config', authenticateAgent, async (req, res, next) => {
  try {
    const veyonConfig = await agentService.getVeyonConfig(req.agent!.agentId);
    res.json({ success: true, data: veyonConfig });
  } catch (err) { next(err); }
});
