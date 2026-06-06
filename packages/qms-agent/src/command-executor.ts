import { Transport } from './transport.js';
import { AgentQueue } from './queue.js';
import { executeCommand } from './commands/veyon.js';
import type { AgentConfig } from './config.js';
import { logger } from './logger.js';

export async function pollAndExecuteCommands(transport: Transport, queue: AgentQueue, config?: AgentConfig): Promise<void> {
  try {
    const commands = await transport.get<Array<{ id: string; type: string; params?: string }>>('/api/v1/agent/commands');

    if (!commands || commands.length === 0) return;

    for (const cmd of commands) {
      logger.info(`Executing command: ${cmd.type} (${cmd.id})`);
      const result = await executeCommand(cmd.type, cmd.params ?? undefined, transport, queue, config);

      try {
        await transport.post(`/api/v1/agent/commands/${cmd.id}/result`, {
          status: result.status,
          result: result.result,
          errorMessage: result.errorMessage,
        });
        logger.info(`Command ${cmd.id} reported as ${result.status}`);
      } catch (err) {
        logger.warn(`Failed to report command result, queuing locally: ${cmd.id}`);
        queue.enqueueCommand(cmd.id, cmd.type, cmd.params ?? undefined);
      }
    }
  } catch (err) {
    logger.warn('Command poll failed (server may be unreachable)');
  }
}

export async function flushLocalQueue(transport: Transport, queue: AgentQueue, config?: AgentConfig): Promise<void> {
  const pending = queue.dequeuePending();
  if (pending.length === 0) return;

  logger.info(`Flushing ${pending.length} locally queued commands...`);
  for (const cmd of pending) {
    const result = await executeCommand(cmd.type, cmd.params ?? undefined, transport, queue, config);
    try {
      await transport.post(`/api/v1/agent/commands/${cmd.id}/result`, {
        status: result.status,
        result: result.result,
        errorMessage: result.errorMessage,
      });
      queue.markCommandCompleted(cmd.id);
      logger.info(`Local command ${cmd.id} flushed and reported`);
    } catch {
      queue.markCommandFailed(cmd.id, 'Server unreachable during flush');
      logger.warn(`Local command ${cmd.id} still pending - server unreachable`);
    }
  }
}
