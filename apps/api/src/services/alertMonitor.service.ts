import { prisma, io } from '../index.js';
import { logger } from '../config/logger.js';
import { activityWatchService } from './activitywatch.js';
import { createAlert } from './notification.service.js';

const POLL_INTERVAL_MS = 30000;
const DEDUP_WINDOW_MINUTES = 5;

class AlertMonitorService {
  private intervalId: NodeJS.Timeout | null = null;
  private knownApps: Map<string, number> = new Map(); // appName -> last notified timestamp

  start(): void {
    if (this.intervalId) return;
    logger.info('AlertMonitor: starting app monitoring (30s interval)');
    this.poll();
    this.intervalId = setInterval(() => this.poll(), POLL_INTERVAL_MS);
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  private async poll(): Promise<void> {
    try {
      const rules = await prisma.watchRule.findMany({ where: { isActive: true } });
      if (rules.length === 0) return;

      const buckets = await activityWatchService.getBuckets();
      const windowBuckets = buckets.filter((b) => b.type === 'currentwindow' && b.client);

      for (const bucket of windowBuckets) {
        try {
          const now = new Date();
          const start = new Date(now.getTime() - 60000).toISOString();
          const { default: axios } = await import('axios');
          const { config } = await import('../config/index.js');

          const baseUrl = bucket.client === 'aw-watcher-window'
            ? config.activityWatch.apiUrl
            : config.activityWatch.apiUrl;

          const url = `${baseUrl}/0/buckets/${bucket.id}/events?start=${encodeURIComponent(start)}&limit=5`;
          const { data: events } = await axios.get(url, { timeout: 5000 });

          for (const event of events) {
            const appName = (event.data?.app as string) || '';
            const hostname = bucket.hostname || 'unknown';

            if (!appName) continue;

            for (const rule of rules) {
              if (appName.toLowerCase().includes(rule.pattern.toLowerCase())) {
                await this.handleMatch(rule, appName, hostname);
              }
            }
          }
        } catch (err) {
          logger.warn(`AlertMonitor: failed to check bucket ${bucket.id}:`, (err as Error).message);
        }
      }
    } catch (err) {
      logger.error('AlertMonitor: poll error:', (err as Error).message);
    }
  }

  private async handleMatch(
    rule: { id: string; name: string; pattern: string; severity: string; notifyAdmins: boolean },
    appName: string,
    hostname: string,
  ): Promise<void> {
    const dedupKey = `${rule.id}:${appName}`;
    const lastNotified = this.knownApps.get(dedupKey) ?? 0;
    const now = Date.now();

    if (now - lastNotified < DEDUP_WINDOW_MINUTES * 60 * 1000) return;
    this.knownApps.set(dedupKey, now);

    const title = `Prohibited App: ${appName}`;
    const message = `Watch rule "${rule.name}" matched — ${appName} detected on ${hostname}`;

    try {
      await prisma.alertDetection.create({
        data: {
          ruleId: rule.id,
          ruleName: rule.name,
          appName,
          hostname,
          matchedPattern: rule.pattern,
          severity: rule.severity,
          title,
          message,
        },
      });

      if (rule.notifyAdmins) {
        const admins = await prisma.user.findMany({ where: { role: 'admin', isActive: true } });
        for (const admin of admins) {
          await createAlert({
            userId: admin.id,
            type: rule.severity,
            title,
            message,
            source: 'activitywatch',
          }).catch(() => {});
        }
      }

      io.emit('alert:app-detected', {
        id: `${rule.id}:${appName}:${now}`,
        ruleId: rule.id,
        ruleName: rule.name,
        appName,
        hostname,
        severity: rule.severity,
        title,
        message,
        timestamp: new Date().toISOString(),
      });

      logger.warn(`AlertMonitor: ${title} — ${message}`);
    } catch (err) {
      logger.error('AlertMonitor: failed to record detection:', (err as Error).message);
    }
  }

  async getRecentDetections(limit = 50): Promise<unknown[]> {
    return prisma.alertDetection.findMany({
      orderBy: { notifiedAt: 'desc' },
      take: limit,
    });
  }

  async getUnreadCount(): Promise<number> {
    return prisma.alertDetection.count({ where: { read: false } });
  }

  async markAsRead(id: string): Promise<void> {
    await prisma.alertDetection.update({ where: { id }, data: { read: true } });
  }

  async markAllAsRead(): Promise<number> {
    const result = await prisma.alertDetection.updateMany({
      where: { read: false },
      data: { read: true },
    });
    return result.count;
  }
}

export const alertMonitorService = new AlertMonitorService();
