import { execSync } from 'node:child_process';
import axios from 'axios';
import { logger } from '../logger.js';
import type { Transport } from '../transport.js';
import type { AgentQueue } from '../queue.js';
import { bootstrapVeyon } from '../bootstrap-veyon.js';
import type { AgentConfig } from '../config.js';

export interface CommandResult {
  status: 'completed' | 'failed';
  result?: string;
  errorMessage?: string;
}

let _veyonWebapiUrl = 'http://localhost:11080/api/v1';

export function setVeyonWebapiUrl(url: string) {
  _veyonWebapiUrl = url;
}

async function runVeyonCli(args: string): Promise<string> {
  try {
    const output = execSync(`VeyonController.exe ${args}`, { timeout: 15000, encoding: 'utf-8' });
    return output.trim();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`VeyonController.exe failed: ${msg}`);
  }
}

async function runShell(command: string): Promise<string> {
  try {
    const output = execSync(command, { timeout: 30000, encoding: 'utf-8', shell: 'cmd.exe' });
    return output.trim();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`Shell command failed: ${msg}`);
  }
}

export async function executeCommand(
  type: string,
  params?: string,
  transport?: Transport,
  queue?: AgentQueue,
  config?: AgentConfig,
): Promise<CommandResult> {
  logger.info(`Executing command: ${type}${params ? ` (${params})` : ''}`);
  try {
    switch (type.toUpperCase()) {
      case 'LOCK':
        await runVeyonCli('lock');
        return { status: 'completed', result: 'Workstation locked' };

      case 'SETUP_VEYON': {
        if (!transport || !queue || !config) {
          return { status: 'failed', errorMessage: 'SETUP_VEYON requires transport, queue, and config' };
        }
        const ok = await bootstrapVeyon(transport, queue);
        if (ok) {
          setVeyonWebapiUrl(queue.get('veyonWebapiUrl') || config.veyonWebapiUrl);
          return { status: 'completed', result: 'Veyon configured successfully' };
        }
        return { status: 'failed', errorMessage: 'Veyon bootstrap failed' };
      }

      case 'UNLOCK':
        try {
          await axios.post(`${_veyonWebapiUrl}/unlock`, {}, { timeout: 5000 });
          return { status: 'completed', result: 'Workstation unlocked via WebAPI' };
        } catch {
          return { status: 'failed', errorMessage: 'Unlock via WebAPI failed' };
        }

      case 'REBOOT':
        await runShell('shutdown /r /t 10 /c "QMS Agent: Remote reboot initiated"');
        return { status: 'completed', result: 'Reboot scheduled in 10 seconds' };

      case 'SHUTDOWN':
        await runShell('shutdown /s /t 30 /c "QMS Agent: Remote shutdown initiated"');
        return { status: 'completed', result: 'Shutdown scheduled in 30 seconds' };

      case 'MESSAGE': {
        let title = 'QMS Admin';
        let message = 'Message from administrator';
        if (params) {
          try {
            const parsed = JSON.parse(params) as { title?: string; message?: string };
            title = parsed.title || title;
            message = parsed.message || message;
          } catch {
            message = params;
          }
        }
        const escapedMessage = message.replace(/"/g, '\\"');
        try {
          await runVeyonCli(`message "${escapedMessage}"`);
        } catch {
          await runShell(`msg * /TIME:30 "${escapedMessage}"`);
        }
        return { status: 'completed', result: `Message displayed: ${message.substring(0, 50)}` };
      }

      case 'SCREENSHOT': {
        try {
          const response = await axios.post(`${_veyonWebapiUrl}/screenshot`, {}, {
            timeout: 10000,
            responseType: 'text',
          });
          return { status: 'completed', result: typeof response.data === 'string' ? response.data.substring(0, 200) : 'Screenshot captured' };
        } catch (err) {
          return { status: 'failed', errorMessage: `Screenshot failed: ${err instanceof Error ? err.message : String(err)}` };
        }
      }

      default:
        return { status: 'failed', errorMessage: `Unknown command type: ${type}` };
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error(`Command execution failed: ${type} - ${msg}`);
    return { status: 'failed', errorMessage: msg };
  }
}
