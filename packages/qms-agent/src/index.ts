import fs from 'node:fs';
import { loadConfig } from './config.js';
import { initLogger, logger } from './logger.js';
import { Transport } from './transport.js';
import { SessionStore } from './session.store.js';
import { AgentQueue } from './queue.js';
import { registerOrAuthenticate } from './registration.js';
import { sendHeartbeat } from './heartbeat.js';
import { pollAndExecuteCommands, flushLocalQueue } from './command-executor.js';
import { runWatchdog } from './watchdog.js';
import { bootstrapVeyon } from './bootstrap-veyon.js';
import { setVeyonCollectorConfig } from './collectors/veyon.js';
import { setVeyonWebapiUrl } from './commands/veyon.js';

async function main() {
  const config = loadConfig();

  fs.mkdirSync(config.dataDir, { recursive: true });
  initLogger(config.dataDir);

  logger.info('=== QMS Agent v1.0.0 ===');
  logger.info(`API: ${config.apiUrl}`);
  logger.info(`Data dir: ${config.dataDir}`);
  logger.info(`Heartbeat interval: ${config.heartbeatInterval}s`);
  logger.info(`Command poll interval: ${config.commandPollInterval}s`);

  const transport = new Transport(config);
  const sessionStore = new SessionStore(config.dataDir);
  const queue = new AgentQueue(config.dataDir);

  // ── Restore previous session or register fresh ──
  const existingSession = sessionStore.getSession();
  if (existingSession) {
    transport.setToken(existingSession.token);
    logger.info(`Session restored | AgentId: ${existingSession.agentId}`);
  } else {
    try {
      const reg = await registerOrAuthenticate(transport, sessionStore, config.agentKey);
      logger.info(`Agent registered | ID: ${reg.agentId}`);
    } catch (err) {
      logger.error('Failed to register agent. Exiting.', { error: err instanceof Error ? err.message : String(err) });
      sessionStore.close();
      queue.close();
      process.exit(1);
    }
  }

  // Bootstrap Veyon configuration if needed
  const veyonBootstrapped = await bootstrapVeyon(transport, queue);
  if (veyonBootstrapped) {
    const veyonUrl = queue.get('veyonWebapiUrl') || config.veyonWebapiUrl;
    const veyonApiKey = queue.get('veyonWebapiKey') || config.veyonApiKey;
    setVeyonCollectorConfig(veyonUrl, veyonApiKey);
    setVeyonWebapiUrl(veyonUrl);
  }

  try {
    await flushLocalQueue(transport, queue);
  } catch { /* ignore */ }

  async function heartbeatLoop() {
    const pending = await sendHeartbeat(transport);
    if (pending > 0) {
      await pollAndExecuteCommands(transport, queue, config);
    }
  }

  async function commandPollLoop() {
    await pollAndExecuteCommands(transport, queue, config);
  }

  async function watchdogLoop() {
    await runWatchdog();
  }

  heartbeatLoop();
  setInterval(heartbeatLoop, config.heartbeatInterval * 1000);
  setInterval(commandPollLoop, config.commandPollInterval * 1000);
  setInterval(watchdogLoop, 30_000);

  const shutdown = () => {
    logger.info('Shutting down...');
    sessionStore.close();
    queue.close();
    process.exit(0);
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
