import { execSync } from 'node:child_process';
import { logger } from './logger.js';

interface ServiceStatus {
  name: string;
  running: boolean;
}

function checkService(name: string): ServiceStatus {
  try {
    const output = execSync(`sc query "${name}"`, { timeout: 5000, encoding: 'utf-8' });
    const running = output.includes('RUNNING');
    return { name, running };
  } catch {
    return { name, running: false };
  }
}

function startService(name: string): boolean {
  try {
    execSync(`sc start "${name}"`, { timeout: 10000, encoding: 'utf-8' });
    logger.info(`Service started: ${name}`);
    return true;
  } catch (err) {
    logger.error(`Failed to start service ${name}`, { error: err instanceof Error ? err.message : String(err) });
    return false;
  }
}

const servicesToWatch = [
  { name: 'VeyonService', display: 'Veyon' },
  { name: 'activitywatch', display: 'ActivityWatch' },
];

export async function runWatchdog(): Promise<void> {
  for (const svc of servicesToWatch) {
    try {
      const status = checkService(svc.name);
      if (!status.running) {
        logger.warn(`Watchdog: ${svc.display} service is DOWN, attempting restart...`);
        const started = startService(svc.name);
        if (started) {
          logger.info(`Watchdog: ${svc.display} service restarted successfully`);
        }
      }
    } catch (err) {
      logger.error(`Watchdog check failed for ${svc.name}`, { error: err instanceof Error ? err.message : String(err) });
    }
  }
}
