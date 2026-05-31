import { Router } from 'express';
import { authorize } from '../middleware/auth.js';
import { AppError } from '../middleware/errorHandler.js';
import {
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  seedDemoNotifications,
} from '../services/notification.service.js';

export const notificationsRouter = Router();

notificationsRouter.get('/', async (req, res, next) => {
  try {
    const userId = req.user!.sub;
    const limit = Math.min(parseInt((req.query.limit as string) || '50'), 100);
    const notifications = await getNotifications(userId, limit);
    const unreadCount = await getUnreadCount(userId);
    res.json({ success: true, data: { notifications, unreadCount } });
  } catch (err) { next(err); }
});

notificationsRouter.put('/:id/read', async (req, res, next) => {
  try {
    const userId = req.user!.sub;
    const success = await markAsRead(req.params.id, userId);
    if (!success) throw new AppError(404, 'NOT_FOUND', 'Notification not found');
    res.json({ success: true, data: { id: req.params.id, read: true } });
  } catch (err) { next(err); }
});

notificationsRouter.post('/read-all', async (req, res, next) => {
  try {
    const userId = req.user!.sub;
    const count = await markAllAsRead(userId);
    res.json({ success: true, data: { markedRead: count } });
  } catch (err) { next(err); }
});

notificationsRouter.post('/seed', authorize('admin'), async (req, res, next) => {
  try {
    const userId = req.user!.sub;
    const count = await seedDemoNotifications(userId);
    res.json({ success: true, data: { seeded: count } });
  } catch (err) { next(err); }
});
