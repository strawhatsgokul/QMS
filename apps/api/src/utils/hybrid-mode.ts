import { prisma } from '../index.js';
import type { Computer } from '@prisma/client';

export async function hasActiveAgent(
  computer: Pick<Computer, 'hostname' | 'ipAddress'>
): Promise<{ active: boolean; agentId?: string }> {
  const agent = await prisma.agent.findFirst({
    where: {
      OR: [
        { hostname: computer.hostname },
        { ipAddress: computer.ipAddress },
      ],
      lastHeartbeatAt: {
        gte: new Date(Date.now() - 2 * 60 * 1000),
      },
    },
  });

  if (agent) {
    return { active: true, agentId: agent.id };
  }
  return { active: false };
}

export async function getAgentStatus(
  computer: Pick<Computer, 'hostname' | 'ipAddress'>
): Promise<{ status: string; currentUser?: string } | null> {
  const agent = await prisma.agent.findFirst({
    where: {
      OR: [
        { hostname: computer.hostname },
        { ipAddress: computer.ipAddress },
      ],
      lastHeartbeatAt: {
        gte: new Date(Date.now() - 2 * 60 * 1000),
      },
    },
    include: {
      heartbeats: {
        orderBy: { timestamp: 'desc' },
        take: 1,
      },
    },
  });

  if (!agent) return null;

  const latest = agent.heartbeats[0];

  if (agent.status === 'online') {
    return {
      status: latest?.activeWindow ? 'active' : 'online',
      currentUser: latest?.activeWindow ?? undefined,
    };
  }

  return { status: 'offline' };
}
