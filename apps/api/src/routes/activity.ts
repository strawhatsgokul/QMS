import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validate.js';
import { authorize } from '../middleware/auth.js';
import { activityWatchService } from '../services/activitywatch.js';
import { prisma } from '../index.js';

export const activityRouter = Router();

const timeQuerySchema = z.object({
  start: z.string().datetime().optional(),
  end: z.string().datetime().optional(),
  period: z.enum(['day', 'week', 'month', 'custom']).default('day'),
  instanceId: z.string().uuid().optional(),
  format: z.enum(['json', 'html']).optional(),
});

const exportQuerySchema = z.object({
  start: z.string().datetime().optional(),
  end: z.string().datetime().optional(),
  period: z.enum(['day', 'week', 'month', 'custom']).default('day'),
  instanceId: z.string().uuid().optional(),
  format: z.enum(['json', 'html']).default('html'),
});

activityRouter.get('/buckets', async (_req, res, next) => {
  try {
    const buckets = await activityWatchService.getBuckets();
    res.json({ success: true, data: buckets });
  } catch (err) { next(err); }
});

activityRouter.get('/events', validate(timeQuerySchema, 'query'), async (req, res, next) => {
  try {
    const { start, end, period, instanceId } = req.query as z.infer<typeof timeQuerySchema>;
    const events = await activityWatchService.getEvents({ start, end, period, instanceId });
    res.json({ success: true, data: events });
  } catch (err) { next(err); }
});

activityRouter.get('/metrics', validate(timeQuerySchema, 'query'), async (req, res, next) => {
  try {
    const { start, end, period, instanceId } = req.query as z.infer<typeof timeQuerySchema>;
    const metrics = await activityWatchService.getProductivityMetrics({ start, end, period, instanceId });
    res.json({ success: true, data: metrics });
  } catch (err) { next(err); }
});

activityRouter.get('/summary', validate(timeQuerySchema, 'query'), async (req, res, next) => {
  try {
    const { start, end, period } = req.query as z.infer<typeof timeQuerySchema>;
    const summary = await activityWatchService.getActivitySummary({ start, end, period });
    res.json({ success: true, data: summary });
  } catch (err) { next(err); }
});

activityRouter.get('/applications', validate(timeQuerySchema, 'query'), async (req, res, next) => {
  try {
    const { start, end, period } = req.query as z.infer<typeof timeQuerySchema>;
    const apps = await activityWatchService.getTopApplications({ start, end, period });
    res.json({ success: true, data: apps });
  } catch (err) { next(err); }
});

activityRouter.get('/categories', validate(timeQuerySchema, 'query'), async (req, res, next) => {
  try {
    const { start, end, period } = req.query as z.infer<typeof timeQuerySchema>;
    const categories = await activityWatchService.getCategoryBreakdown({ start, end, period });
    res.json({ success: true, data: categories });
  } catch (err) { next(err); }
});

activityRouter.get('/instances', async (_req, res, next) => {
  try {
    const instances = await activityWatchService.getInstances();
    res.json({ success: true, data: instances });
  } catch (err) { next(err); }
});

activityRouter.post('/export', authorize('admin', 'staff'), validate(exportQuerySchema, 'body'), async (req, res, next) => {
  try {
    const { start, end, period, instanceId, format } = req.body;
    let userInfo;
    if (req.user) {
      const dbUser = await prisma.user.findUnique({ where: { id: req.user.sub } });
      if (dbUser) userInfo = { name: dbUser.name, email: dbUser.email };
    }
    if (format === 'html') {
      const html = await activityWatchService.exportHtml(
        { start, end, period, instanceId },
        userInfo,
        instanceId ? undefined : undefined,
      );
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="activity-report-${period}-${new Date().toISOString().split('T')[0]}.html"`);
      return res.send(html);
    }
    const exportData = await activityWatchService.exportData({ start, end, period, instanceId });
    res.json({ success: true, data: exportData });
  } catch (err) { next(err); }
});

activityRouter.post('/import', authorize('admin', 'staff'), validate(timeQuerySchema, 'body'), async (req, res, next) => {
  try {
    const { start, end, period, instanceId } = req.body;
    const result = await activityWatchService.importData({ start, end, period, instanceId });
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
});

activityRouter.get('/imported', validate(timeQuerySchema, 'query'), async (req, res, next) => {
  try {
    const { start, end, period, instanceId } = req.query as z.infer<typeof timeQuerySchema>;
    const result = await activityWatchService.getImportedData({ start, end, period, instanceId });
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
});
