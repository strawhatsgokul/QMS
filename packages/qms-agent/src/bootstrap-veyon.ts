import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { Transport } from './transport.js';
import { AgentQueue } from './queue.js';
import { logger } from './logger.js';

const VEYON_KEYS_DIR = 'C:\\ProgramData\\Veyon\\keys';
const VEYON_REG_KEY = 'HKLM\\SOFTWARE\\Veyon\\Veyon';
const KEYFILE_AUTH_UUID = '0c69b301-81b4-42d6-8fae-128cdd113314';

export interface VeyonConfig {
  privateKey: string;
  keyName: string;
  apiKey: string;
  webapiUrl: string;
}

function writePrivateKey(keyName: string, keyContent: string): string {
  const keyDir = path.join(VEYON_KEYS_DIR, 'private', keyName);
  const keyPath = path.join(keyDir, 'key');
  fs.mkdirSync(keyDir, { recursive: true });
  fs.writeFileSync(keyPath, keyContent, 'utf-8');
  logger.info(`Veyon private key written: ${keyPath}`);
  return keyPath;
}

function setRegistryValue(keyPath: string, name: string, value: string) {
  try {
    execSync(`reg add "${VEYON_REG_KEY}\\${keyPath}" /v "${name}" /t REG_SZ /d "${value}" /f`, {
      timeout: 5000,
      encoding: 'utf-8',
    });
  } catch (err) {
    logger.warn(`Failed to write registry: ${keyPath}\\${name}`, { error: err instanceof Error ? err.message : String(err) });
    throw err;
  }
}

function configureVeyon(keyPath: string, apiKey: string) {
  setRegistryValue('Authentication', 'AuthenticationMethod', KEYFILE_AUTH_UUID);
  setRegistryValue('Network\\KeyFileAuthentication', 'PrivateKey', keyPath);
  setRegistryValue('Network\\KeyFileAuthentication', 'KeyFile', keyPath);
  if (apiKey) {
    setRegistryValue('Network\\WebAPI', 'AuthenticationKey', apiKey);
    setRegistryValue('Network\\WebAPI', 'Enabled', 'true');
  }
  logger.info('Veyon registry configuration applied');
}

function restartVeyonService(): boolean {
  try {
    execSync('sc stop VeyonService', { timeout: 10000, encoding: 'utf-8' });
    execSync('sc start VeyonService', { timeout: 10000, encoding: 'utf-8' });
    logger.info('Veyon service restarted');
    return true;
  } catch (err) {
    logger.error('Failed to restart Veyon service', { error: err instanceof Error ? err.message : String(err) });
    return false;
  }
}

export async function bootstrapVeyon(transport: Transport, queue: AgentQueue): Promise<boolean> {
  const cachedKey = queue.get('veyonPrivateKey');
  const cachedKeyName = queue.get('veyonKeyName');
  const cachedApiKey = queue.get('veyonWebapiKey');

  if (cachedKey && cachedKeyName) {
    writePrivateKey(cachedKeyName, cachedKey);
    const keyPath = path.join(VEYON_KEYS_DIR, 'private', cachedKeyName, 'key');
    configureVeyon(keyPath, cachedApiKey || '');
    restartVeyonService();
    logger.info('Veyon configured from cached settings');
    return true;
  }

  try {
    logger.info('Fetching Veyon config from server...');
    const config = await transport.get<VeyonConfig>('/api/v1/agent/veyon-config');

    if (!config.privateKey) {
      logger.warn('No Veyon private key received from server - skipping bootstrap');
      return false;
    }

    const keyName = config.keyName || 'dashboard-key';
    const keyPath = writePrivateKey(keyName, config.privateKey);
    configureVeyon(keyPath, config.apiKey);
    restartVeyonService();

    queue.set('veyonPrivateKey', config.privateKey);
    queue.set('veyonKeyName', keyName);
    queue.set('veyonWebapiKey', config.apiKey || '');
    queue.set('veyonWebapiUrl', config.webapiUrl);

    logger.info('Veyon configured successfully from server settings');
    return true;
  } catch (err) {
    logger.warn('Failed to fetch/apply Veyon config from server', { error: err instanceof Error ? err.message : String(err) });
    return false;
  }
}
