import axios from 'axios';
import { readFileSync } from 'fs';
import { prisma, io } from '../index.js';
import { config } from '../config/index.js';
import { logger } from '../config/logger.js';
import type { Computer as PrismaComputer } from '@prisma/client';

const FEATURE_UUIDS = {
  SCREEN_LOCK: 'ccb535a2-1d24-4cc1-a709-8b47d2b2ac79',
  SCREENSHOT: 'd5ee3aac-2a87-4d05-b827-0c20344490bd',
  REBOOT: '4f7d98f0-395a-4fff-b968-e49b8d0f748c',
  POWER_DOWN: '6f5a27a0-0e2f-496e-afcc-7aae62eede10',
  TEXT_MESSAGE: 'e75ae9c8-ac17-4d00-8f0d-019346348208',
  DEMO_SERVER: 'e4b6e743-1f5b-491d-9364-e091086200f4',
};

const AUTH_KEY_METHOD = '0c69b301-81b4-42d6-8fae-128cdd113314';

class VeyonService {
  private baseUrl: string;
  private privateKey: string;
  private keyName: string;
  private cachedCliPath: string | null = null;

  constructor() {
    this.baseUrl = config.veyon.webapiUrl;
    this.keyName = config.veyon.keyName;
    try {
      this.privateKey = readFileSync(config.veyon.privateKeyPath, 'utf-8');
    } catch {
      this.privateKey = '';
      logger.warn('Veyon private key not found at', config.veyon.privateKeyPath);
    }
  }

  async getCliPath(): Promise<string> {
    if (this.cachedCliPath) return this.cachedCliPath;
    try {
      const setting = await prisma.systemSetting.findUnique({ where: { key: 'veyon_cli_path' } });
      this.cachedCliPath = setting?.value || config.veyon.cliPath;
      return this.cachedCliPath;
    } catch {
      return config.veyon.cliPath;
    }
  }

  refreshCliPath(): void {
    this.cachedCliPath = null;
  }

  private async authenticate(host: string): Promise<string> {
    if (!this.privateKey) throw new Error('Veyon private key not configured');

    const { data } = await axios.post(`${this.baseUrl}/authentication/${host}`, {
      method: AUTH_KEY_METHOD,
      credentials: { keyname: this.keyName, keydata: this.privateKey },
    }, { timeout: 10000 });

    return data['connection-uid'];
  }

  private async release(host: string, connUid: string): Promise<void> {
    try {
      await axios.delete(`${this.baseUrl}/authentication/${host}`, {
        headers: { 'Connection-Uid': connUid },
        timeout: 5000,
      });
    } catch { }
  }

  private async runFeature(host: string, featureUid: string, active: boolean, args?: Record<string, string>): Promise<void> {
    const connUid = await this.authenticate(host);
    try {
      const body: Record<string, unknown> = { active };
      if (args) body.arguments = args;
      await axios.put(`${this.baseUrl}/feature/${featureUid}`, body, {
        headers: { 'Connection-Uid': connUid, 'Content-Type': 'application/json' },
        timeout: 15000,
      });
    } finally {
      await this.release(host, connUid);
    }
  }

  async getComputerStatus(computer: Pick<PrismaComputer, 'hostname' | 'ipAddress'>): Promise<{
    online: boolean;
    currentUser?: string;
    uptime?: number;
  }> {
    try {
      const { data } = await axios.get(`${this.baseUrl}/hoststate/${computer.hostname}`, { timeout: 5000 });
      if (data.state !== 'online') return { online: false };

      const connUid = await this.authenticate(computer.hostname);
      try {
        const userResp = await axios.get(`${this.baseUrl}/user`, {
          headers: { 'Connection-Uid': connUid },
          timeout: 5000,
        });
        return {
          online: true,
          currentUser: userResp.data.fullName || userResp.data.login,
        };
      } finally {
        await this.release(computer.hostname, connUid);
      }
    } catch {
      return { online: false };
    }
  }

  async lockScreen(computerId: string): Promise<{ computerId: string; status: string }> {
    const computer = await prisma.computer.findUnique({ where: { id: computerId } });
    if (!computer) throw new Error(`Computer ${computerId} not found`);

    await this.runFeature(computer.hostname, FEATURE_UUIDS.SCREEN_LOCK, true);

    await prisma.computer.update({ where: { id: computerId }, data: { status: 'locked' } });
    io.to(`computer:${computerId}`).emit('computer:status', { computerId, status: 'locked' });

    return { computerId, status: 'locked' };
  }

  async unlockScreen(computerId: string): Promise<{ computerId: string; status: string }> {
    const computer = await prisma.computer.findUnique({ where: { id: computerId } });
    if (!computer) throw new Error(`Computer ${computerId} not found`);

    await this.runFeature(computer.hostname, FEATURE_UUIDS.SCREEN_LOCK, false);

    await prisma.computer.update({ where: { id: computerId }, data: { status: 'online' } });
    io.to(`computer:${computerId}`).emit('computer:status', { computerId, status: 'online' });

    return { computerId, status: 'online' };
  }

  async restartComputer(computerId: string): Promise<{ computerId: string; action: string }> {
    const computer = await prisma.computer.findUnique({ where: { id: computerId } });
    if (!computer) throw new Error(`Computer ${computerId} not found`);

    await this.runFeature(computer.hostname, FEATURE_UUIDS.REBOOT, true);

    await prisma.computer.update({ where: { id: computerId }, data: { status: 'offline' } });
    return { computerId, action: 'restart' };
  }

  async shutdownComputer(computerId: string): Promise<{ computerId: string; action: string }> {
    const computer = await prisma.computer.findUnique({ where: { id: computerId } });
    if (!computer) throw new Error(`Computer ${computerId} not found`);

    await this.runFeature(computer.hostname, FEATURE_UUIDS.POWER_DOWN, true);

    await prisma.computer.update({ where: { id: computerId }, data: { status: 'offline' } });
    return { computerId, action: 'shutdown' };
  }

  async wakeComputer(_computerId: string): Promise<{ computerId: string; action: string }> {
    throw new Error('Wake-on-LAN not supported via WebAPI. Use CLI: power on <MAC>');
  }

  async copyFile(computerId: string, sourcePath: string, destinationPath: string): Promise<{ computerId: string; fileCopied: boolean }> {
    const computer = await prisma.computer.findUnique({ where: { id: computerId } });
    if (!computer) throw new Error(`Computer ${computerId} not found`);

    const connUid = await this.authenticate(computer.hostname);
    try {
      await axios.post(`${this.baseUrl}/file/copy`, {
        sourcePath,
        destinationPath,
      }, {
        headers: { 'Connection-Uid': connUid, 'Content-Type': 'application/json' },
        timeout: 30000,
      });
      return { computerId, fileCopied: true };
    } finally {
      await this.release(computer.hostname, connUid);
    }
  }

  async sendMessage(computerId: string, message: string, title?: string): Promise<{ computerId: string; messageSent: boolean }> {
    const computer = await prisma.computer.findUnique({ where: { id: computerId } });
    if (!computer) throw new Error(`Computer ${computerId} not found`);

    await this.runFeature(computer.hostname, FEATURE_UUIDS.TEXT_MESSAGE, true, {
      message,
      title: title || 'QMS Dashboard',
    });

    return { computerId, messageSent: true };
  }

  async getScreenshot(computerId: string): Promise<{
    computerId: string;
    thumbnail: string;
    timestamp: string;
  }> {
    const computer = await prisma.computer.findUnique({ where: { id: computerId } });
    if (!computer) throw new Error(`Computer ${computerId} not found`);

    const connUid = await this.authenticate(computer.hostname);
    try {
      // VNC framebuffer needs a brief moment to initialize after auth
      await new Promise(r => setTimeout(r, 1500));
      const { data } = await axios.get(`${this.baseUrl}/framebuffer?format=png&width=320&compression=6`, {
        headers: { 'Connection-Uid': connUid },
        responseType: 'arraybuffer',
        timeout: 15000,
      });

      const base64 = Buffer.from(data).toString('base64');
      return { computerId, thumbnail: base64, timestamp: new Date().toISOString() };
    } finally {
      await this.release(computer.hostname, connUid);
    }
  }

  async startDemo(): Promise<{ status: string }> {
    await this.runFeature('127.0.0.1', FEATURE_UUIDS.DEMO_SERVER, true);
    return { status: 'demo_started' };
  }

  async stopDemo(): Promise<{ status: string }> {
    await this.runFeature('127.0.0.1', FEATURE_UUIDS.DEMO_SERVER, false);
    return { status: 'demo_stopped' };
  }
}

export const veyonService = new VeyonService();
