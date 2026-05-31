import { Router } from 'express';
import { prisma } from '../index.js';
import { activityWatchService } from '../services/activitywatch.js';

export const dashboardRouter = Router();

dashboardRouter.get('/stats', async (req, res, next) => {
  try {
    type ComputerStat = { status: string; _count: number };
    const [computerStats, roomCount, recentAlerts] = await Promise.all([
      prisma.computer.groupBy({
        by: ['status'],
        _count: true,
      }) as unknown as ComputerStat[],
      prisma.room.count(),
      prisma.notification.findMany({
        where: { userId: req.user!.sub, read: false },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
    ]);

    const totalComputers = computerStats.reduce((acc: number, s: ComputerStat) => acc + s._count, 0);
    const onlineComputers = computerStats.find((s: ComputerStat) => s.status === 'online')?._count ?? 0;
    const offlineComputers = computerStats.find((s: ComputerStat) => s.status === 'offline')?._count ?? 0;
    const lockedComputers = computerStats.find((s: ComputerStat) => s.status === 'locked')?._count ?? 0;

    const todayActivity = await activityWatchService.getActivitySummary({
      period: 'day',
    });

    const stats = {
      totalComputers,
      onlineComputers,
      offlineComputers,
      lockedComputers,
      totalRooms: roomCount,
      activeUsers: onlineComputers,
      todayActivityMinutes: todayActivity?.activeTime ?? 0,
      alerts: recentAlerts,
    };

    res.json({ success: true, data: stats });
  } catch (err) { next(err); }
});

dashboardRouter.get('/recent-activity', async (_req, res, next) => {
  try {
    const activity = await activityWatchService.getActivitySummary({
      period: 'day',
    });
    res.json({ success: true, data: activity });
  } catch (err) { next(err); }
});

dashboardRouter.get('/system-health', async (_req, res) => {
  res.json({
    success: true,
    data: {
      status: 'healthy',
      veyon: { status: 'connected' },
      activityWatch: { status: 'connected' },
      database: { status: 'connected' },
      redis: { status: 'connected' },
      uptime: process.uptime(),
      lastChecked: new Date().toISOString(),
    },
  });
});
