import { Router } from 'express';
import { z } from 'zod';
import { readFileSync, existsSync, statSync, readdirSync } from 'fs';
import { join } from 'path';
import { logger } from '../config/logger.js';
import { validate } from '../middleware/validate.js';
import { authenticate, authorize } from '../middleware/auth.js';
import axios from 'axios';
import { config } from '../config/index.js';

export const logsRouter = Router();

const clientErrorSchema = z.object({
  message: z.string(),
  stack: z.string().optional(),
  componentStack: z.string().optional(),
  userAgent: z.string().optional(),
  url: z.string().optional(),
});

logsRouter.post('/client-error', validate(clientErrorSchema), (req, res) => {
  logger.error('Client-side error reported', {
    source: 'client',
    message: req.body.message,
    stack: req.body.stack,
    componentStack: req.body.componentStack,
    userAgent: req.body.userAgent || req.headers['user-agent'],
    url: req.body.url,
  });
  res.json({ success: true, data: { message: 'Error logged' } });
});

const logsDir = join(process.cwd(), 'logs');

function getLogFiles() {
  if (!existsSync(logsDir)) return [];
  return readdirSync(logsDir)
    .filter((f) => f.endsWith('.log'))
    .map((f) => {
      const stats = statSync(join(logsDir, f));
      return { name: f, size: stats.size, modifiedAt: stats.mtime.toISOString() };
    })
    .sort((a, b) => b.modifiedAt.localeCompare(a.modifiedAt));
}

logsRouter.get('/files', authenticate, authorize('admin'), (_req, res) => {
  const files = getLogFiles();
  res.json({ success: true, data: files });
});

logsRouter.get('/files/:name', authenticate, authorize('admin'), (req, res) => {
  try {
    const name = req.params.name as string;
    const offset = parseInt((req.query.offset as string) || '0');
    let limit = Math.min(parseInt((req.query.limit as string) || '100'), 500);
    const reverse = req.query.reverse === 'true';

    const filePath = join(logsDir, name);
    if (!existsSync(filePath) || !name.endsWith('.log')) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Log file not found' } });
    }

    const content = readFileSync(filePath, 'utf-8');
    const lines = content.split('\n').filter(Boolean);
    const totalLines = lines.length;

    let sliced: string[];
    if (reverse) {
      const start = Math.max(0, totalLines - offset - limit);
      sliced = lines.slice(start, start + limit);
    } else {
      sliced = lines.slice(offset, offset + limit);
    }

    res.json({
      success: true,
      data: {
        name,
        lines: sliced,
        totalLines,
        offset,
        limit,
        hasMore: offset + limit < totalLines,
      },
    });
  } catch (err) {
    logger.error('Failed to read log file:', { error: (err as Error).message });
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to read log file' } });
  }
});

logsRouter.get('/services', authenticate, authorize('admin'), async (_req, res) => {
  const checks: Record<string, { status: string; error?: string }> = {};

  // Database check
  try {
    const { prisma } = await import('../index.js');
    await prisma.$queryRaw`SELECT 1`;
    checks.database = { status: 'connected' };
  } catch {
    checks.database = { status: 'error', error: 'Cannot connect to database' };
  }

  // Veyon WebAPI check
  try {
    await axios.get(`${config.veyon.webapiUrl.replace(/\/api\/v1$/, '')}/api/v1/hoststate/localhost`, { timeout: 5000 });
    checks.veyon = { status: 'connected' };
  } catch {
    checks.veyon = { status: 'error', error: 'Veyon WebAPI unreachable' };
  }

  // ActivityWatch check
  try {
    await axios.get(`${config.activityWatch.apiUrl}/0/buckets`, { timeout: 5000 });
    checks.activityWatch = { status: 'connected' };
  } catch {
    checks.activityWatch = { status: 'error', error: 'ActivityWatch unreachable' };
  }

  res.json({
    success: true,
    data: {
      services: checks,
      uptime: process.uptime(),
      startedAt: new Date(Date.now() - process.uptime() * 1000).toISOString(),
      checkedAt: new Date().toISOString(),
    },
  });
});
