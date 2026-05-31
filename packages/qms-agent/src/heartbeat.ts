import { Transport } from './transport.js';
import { collectSystemStats } from './collectors/system.js';
import { checkActivityWatch } from './collectors/activitywatch.js';
import { checkVeyon } from './collectors/veyon.js';
import { logger } from './logger.js';

export async function sendHeartbeat(transport: Transport): Promise<number> {
  try {
    const [system, aw, veyon] = await Promise.all([
      collectSystemStats(),
      checkActivityWatch(),
      checkVeyon(),
    ]);

    const heartbeat = {
      cpuUsage: system.cpuUsage,
      memoryUsage: system.memoryUsage,
      memoryTotal: system.memoryTotal,
      topProcesses: system.topProcesses,
      activeWindow: aw.currentWindow || null,
      activitySummary: JSON.stringify({ afkStatus: aw.afkStatus }),
      veyonStatus: veyon.status,
      awStatus: aw.status,
    };

    const result = await transport.post<{ commandsPending: number }>('/api/v1/agent/heartbeat', heartbeat);
    logger.info(`Heartbeat sent | CPU:${system.cpuUsage}% MEM:${system.memoryUsage}% AW:${aw.status} Veyon:${veyon.status}${result.commandsPending > 0 ? ` | ${result.commandsPending} pending commands` : ''}`);
    return result.commandsPending;
  } catch (err) {
    logger.error('Heartbeat failed', { error: err instanceof Error ? err.message : String(err) });
    return 0;
  }
}
