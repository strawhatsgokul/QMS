import { prisma } from '../index.js';
import { AppError } from '../middleware/errorHandler.js';

export const agentService = {
  async enqueueCommand(_agentId: string, _type: string, _params?: Record<string, unknown>): Promise<void> {
    const agent = await prisma.agent.findUnique({ where: { id: _agentId } });
    if (!agent) throw new AppError(404, 'AGENT_NOT_FOUND', 'Agent not found');
  },
};
