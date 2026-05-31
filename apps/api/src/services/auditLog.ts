import { prisma } from '../index.js';
import { logger } from '../config/logger.js';

interface LogActionParams {
  userId: string;
  action: string;
  resource: string;
  resourceId?: string;
  details?: Record<string, unknown>;
  ipAddress?: string;
}

const DEFAULT_RETENTION_DAYS = 90;

export async function logAction(params: LogActionParams): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        userId: params.userId,
        action: params.action,
        resource: params.resource,
        resourceId: params.resourceId ?? null,
        details: params.details ? JSON.stringify(params.details) : null,
        ipAddress: params.ipAddress ?? null,
      },
    });
  } catch (err) {
    logger.error('Failed to write audit log:', { error: (err as Error).message, action: params.action });
  }
}

export async function getRetentionDays(): Promise<number> {
  try {
    const setting = await prisma.systemSetting.findUnique({ where: { key: 'audit_log_retention_days' } });
    if (setting) {
      const parsed = parseInt(setting.value, 10);
      if (!Number.isNaN(parsed) && parsed > 0) return parsed;
    }
  } catch { /* use default */ }
  return DEFAULT_RETENTION_DAYS;
}

export async function deleteOldLogs(retentionDays?: number): Promise<number> {
  try {
    const days = retentionDays ?? await getRetentionDays();
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);

    const result = await prisma.auditLog.deleteMany({
      where: { createdAt: { lt: cutoff } },
    });

    logger.info(`Audit log cleanup: deleted ${result.count} records older than ${days} days`);
    return result.count;
  } catch (err) {
    logger.error('Failed to clean up audit logs:', { error: (err as Error).message });
    return 0;
  }
}
