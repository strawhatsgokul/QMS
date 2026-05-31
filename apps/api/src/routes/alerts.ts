import { Router } from 'express';
import { alertMonitorService } from '../services/alertMonitor.service.js';

export const alertsRouter = Router();

alertsRouter.get('/detections', async (req, res, next) => {
  try {
    const limit = Math.min(parseInt((req.query.limit as string) || '50'), 200);
    const detections = await alertMonitorService.getRecentDetections(limit);
    const unreadCount = await alertMonitorService.getUnreadCount();
    res.json({ success: true, data: { detections, unreadCount } });
  } catch (err) { next(err); }
});

alertsRouter.put('/detections/:id/read', async (req, res, next) => {
  try {
    await alertMonitorService.markAsRead(req.params.id);
    res.json({ success: true, data: { id: req.params.id, read: true } });
  } catch (err) { next(err); }
});

alertsRouter.post('/detections/read-all', async (_req, res, next) => {
  try {
    const count = await alertMonitorService.markAllAsRead();
    res.json({ success: true, data: { markedRead: count } });
  } catch (err) { next(err); }
});
