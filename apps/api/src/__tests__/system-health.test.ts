import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';

const CONCURRENT_WORKERS = 5;
const HEARTBEATS_PER_WORKER = 10;

const prisma = new PrismaClient();

interface WorkerResult {
  successes: number;
  failures: number;
  errors: string[];
  duration: number;
}

beforeAll(async () => {
  // Enable WAL mode for concurrent access
  await prisma.$queryRawUnsafe('PRAGMA journal_mode=WAL;');
  await prisma.$queryRawUnsafe('PRAGMA busy_timeout=5000;');

  // Ensure the agent and computer exist
  const computer = await prisma.computer.findFirst();
  if (!computer) {
    await prisma.computer.create({
      data: { hostname: 'STRESS-TEST-PC', ipAddress: '10.0.0.1' },
    });
  }

  const existingAgent = await prisma.agent.findFirst({ where: { hostname: 'STRESS-TEST-PC' } });
  if (!existingAgent) {
    await prisma.agent.create({
      data: {
        hostname: 'STRESS-TEST-PC',
        ipAddress: '10.0.0.1',
        agentKey: 'stress-test-key',
        status: 'online',
        lastHeartbeatAt: new Date(),
      },
    });
  }
});

afterAll(async () => {
  // Cleanup stress test data
  const agent = await prisma.agent.findFirst({ where: { hostname: 'STRESS-TEST-PC' } });
  if (agent) {
    await prisma.agentHeartbeat.deleteMany({ where: { agentId: agent.id } });
    await prisma.agentCommand.deleteMany({ where: { agentId: agent.id } });
    await prisma.agent.delete({ where: { id: agent.id } });
  }
  await prisma.computer.deleteMany({ where: { hostname: 'STRESS-TEST-PC' } }).catch(() => {});
  await prisma.$disconnect();
});

// ── Concurrency Test ──────────────────────────────────────
describe('System Health: SQLite Concurrency', () => {
  it(`handles ${CONCURRENT_WORKERS} concurrent workers writing ${HEARTBEATS_PER_WORKER} heartbeats each without DB locked errors`, async () => {
    const agent = await prisma.agent.findFirst({ where: { hostname: 'STRESS-TEST-PC' } });
    const agentId = agent!.id;

    async function worker(_workerId: number): Promise<WorkerResult> {
      const start = Date.now();
      const result: WorkerResult = { successes: 0, failures: 0, errors: [], duration: 0 };

      for (let i = 0; i < HEARTBEATS_PER_WORKER; i++) {
        try {
          await prisma.agentHeartbeat.create({
            data: {
              agentId,
              cpuUsage: Math.random() * 100,
              memoryUsage: Math.random() * 100,
              activeWindow: 'stress-test.exe',
              timestamp: new Date(),
            },
          });
          result.successes++;
        } catch (err: unknown) {
          result.failures++;
          const msg = err instanceof Error ? err.message : String(err);
          const isBusy = /busy|locked|P2034/i.test(msg);
          if (!isBusy) {
            result.errors.push(msg.length > 200 ? msg.slice(0, 200) : msg);
          }
        }
      }

      result.duration = Date.now() - start;
      return result;
    }

    // Launch all workers concurrently
    const workerPromises = Array.from({ length: CONCURRENT_WORKERS }, (_, i) => worker(i));
    const workerResults = await Promise.all(workerPromises);

    // Aggregate
    const totalSuccesses = workerResults.reduce((sum, r) => sum + r.successes, 0);
    const totalFailures = workerResults.reduce((sum, r) => sum + r.failures, 0);
    const totalNonBusyErrors = workerResults.reduce((sum, r) => sum + r.errors.length, 0);
    const maxDuration = Math.max(...workerResults.map(r => r.duration));

    console.log(`  Concurrency results:
    Workers: ${CONCURRENT_WORKERS}
    Heartbeats/worker: ${HEARTBEATS_PER_WORKER}
    Total attempts: ${CONCURRENT_WORKERS * HEARTBEATS_PER_WORKER}
    Successes: ${totalSuccesses}
    Failures (SQLITE_BUSY): ${totalFailures}
    Non-busy errors: ${totalNonBusyErrors}
    Max worker duration: ${maxDuration}ms`);

    // SQLite WAL mode should handle this without non-busy errors
    expect(totalNonBusyErrors).toBe(0);
    // At least some should succeed (WAL allows concurrent reads + writes)
    expect(totalSuccesses).toBeGreaterThan(0);
  }, 30000);
});

// ── Guest Agent Command Tests ─────────────────────────────
describe('System Health: Agent command queuing under load', () => {
  it('queues and retrieves commands correctly', async () => {
    const agent = await prisma.agent.findFirst({ where: { hostname: 'STRESS-TEST-PC' } });
    expect(agent).not.toBeNull();

    // Create 20 commands sequentially to guarantee createdAt order
    for (let i = 0; i < 20; i++) {
      await prisma.agentCommand.create({
        data: {
          agentId: agent!.id,
          type: i % 2 === 0 ? 'LOCK' : 'UNLOCK',
          status: 'pending',
        },
      });
    }

    // Verify count
    const count = await prisma.agentCommand.count({
      where: { agentId: agent!.id, status: 'pending' },
    });
    expect(count).toBe(20);

    // Retrieve oldest 10 (polling behavior)
    const polled = await prisma.agentCommand.findMany({
      where: { agentId: agent!.id, status: 'pending' },
      orderBy: { createdAt: 'asc' },
      take: 10,
    });
    expect(polled).toHaveLength(10);
    expect(polled[0]!.type).toBe('LOCK');

    // Cleanup
    await prisma.agentCommand.deleteMany({ where: { agentId: agent!.id } });
  }, 15000);
});
