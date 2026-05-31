import { prisma } from '../index.js';
import { logger } from '../config/logger.js';

export interface CreateAlertParams {
  userId: string;
  type: string;
  title: string;
  message: string;
  source?: string;
}

export interface NotificationResponse {
  id: string;
  userId: string;
  type: string;
  title: string;
  message: string;
  read: boolean;
  source: string | null;
  createdAt: string;
}

export async function createAlert(params: CreateAlertParams): Promise<NotificationResponse> {
  try {
    const notification = await prisma.notification.create({
      data: {
        userId: params.userId,
        type: params.type,
        title: params.title,
        message: params.message,
        source: params.source ?? null,
      },
    });
    return {
      id: notification.id,
      userId: notification.userId,
      type: notification.type,
      title: notification.title,
      message: notification.message,
      read: notification.read,
      source: notification.source,
      createdAt: notification.createdAt.toISOString(),
    };
  } catch (err) {
    logger.error('Failed to create notification:', { error: (err as Error).message });
    throw err;
  }
}

export async function getUnreadCount(userId: string): Promise<number> {
  try {
    return await prisma.notification.count({ where: { userId, read: false } });
  } catch (err) {
    logger.error('Failed to get unread count:', { error: (err as Error).message });
    return 0;
  }
}

export async function getNotifications(userId: string, limit = 50): Promise<NotificationResponse[]> {
  try {
    const notifications = await prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
    return notifications.map((n) => ({
      id: n.id,
      userId: n.userId,
      type: n.type,
      title: n.title,
      message: n.message,
      read: n.read,
      source: n.source,
      createdAt: n.createdAt.toISOString(),
    }));
  } catch (err) {
    logger.error('Failed to get notifications:', { error: (err as Error).message });
    return [];
  }
}

export async function markAsRead(notificationId: string, userId: string): Promise<boolean> {
  try {
    const result = await prisma.notification.updateMany({
      where: { id: notificationId, userId },
      data: { read: true },
    });
    return result.count > 0;
  } catch (err) {
    logger.error('Failed to mark notification as read:', { error: (err as Error).message });
    return false;
  }
}

export async function markAllAsRead(userId: string): Promise<number> {
  try {
    const result = await prisma.notification.updateMany({
      where: { userId, read: false },
      data: { read: true },
    });
    return result.count;
  } catch (err) {
    logger.error('Failed to mark all notifications as read:', { error: (err as Error).message });
    return 0;
  }
}

export async function seedDemoNotifications(userId: string): Promise<number> {
  const demos: CreateAlertParams[] = [
    { userId, type: 'info', title: 'System Ready', message: 'Veyon service initialized successfully', source: 'system' },
    { userId, type: 'success', title: 'Sync Complete', message: 'ActivityWatch data synchronized for all instances', source: 'activitywatch' },
    { userId, type: 'warning', title: 'Computer Offline', message: 'Test-Machine-01 has been offline for 30 minutes', source: 'veyon' },
    { userId, type: 'info', title: 'New Computer Added', message: 'Workstation-03 has been added to Test Lab room', source: 'system' },
    { userId, type: 'error', title: 'Connection Timeout', message: 'Failed to connect to Veyon WebAPI on 192.168.1.50', source: 'veyon' },
    { userId, type: 'warning', title: 'Low Productivity', message: 'Activity today is 40% below the weekly average', source: 'activitywatch' },
  ];

  let count = 0;
  for (const demo of demos) {
    try {
      await createAlert(demo);
      count++;
    } catch { /* skip individual failures */ }
  }
  return count;
}
