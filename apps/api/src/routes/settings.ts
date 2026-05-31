import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../index.js';
import { validate } from '../middleware/validate.js';
import { authorize } from '../middleware/auth.js';
import { logger } from '../config/logger.js';

export const settingsRouter = Router();

function parseSettingValue(value: string): string | number | boolean {
  if (value === 'true') return true;
  if (value === 'false') return false;
  const num = Number(value);
  if (!Number.isNaN(num) && value.trim() !== '') return num;
  return value;
}

settingsRouter.get('/', authorize('admin'), async (_req, res, next) => {
  try {
    const rows = await prisma.systemSetting.findMany();
    const settings: Record<string, string | number | boolean> = {};
    for (const row of rows) {
      settings[row.key] = parseSettingValue(row.value);
    }
    res.json({ success: true, data: settings });
  } catch (err) { next(err); }
});

const settingsUpdateSchema = z.record(
  z.string(),
  z.union([z.string(), z.number(), z.boolean()]),
);

settingsRouter.put('/', authorize('admin'), validate(settingsUpdateSchema), async (req, res, next) => {
  try {
    const entries = Object.entries(req.body as Record<string, string | number | boolean>);
    for (const [key, value] of entries) {
      const strValue = typeof value === 'boolean' ? String(value) : String(value);
      await prisma.systemSetting.upsert({
        where: { key },
        update: { value: strValue },
        create: { key, value: strValue },
      });
    }
    logger.info(`Settings updated by admin ${req.user?.sub}: ${entries.map(([k]) => k).join(', ')}`);
    res.json({ success: true, data: { message: 'Settings saved', updated: entries.length } });
  } catch (err) { next(err); }
});
