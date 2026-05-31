import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../index.js';
import { validate } from '../middleware/validate.js';
import { authorize } from '../middleware/auth.js';
import { deleteOldLogs } from '../services/auditLog.js';

export const auditLogsRouter = Router();

const querySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  action: z.string().optional(),
  resource: z.string().optional(),
  userId: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

auditLogsRouter.get('/', authorize('admin'), validate(querySchema, 'query'), async (req, res, next) => {
  try {
    const { page, limit, action, resource, userId, startDate, endDate } = req.query as unknown as z.infer<typeof querySchema>;
    const where: Record<string, unknown> = {};
    if (action) where['action'] = { contains: action, mode: 'insensitive' };
    if (resource) where['resource'] = resource;
    if (userId) where['userId'] = userId;
    if (startDate || endDate) {
      const createdAt: Record<string, Date> = {};
      if (startDate) createdAt['gte'] = new Date(startDate);
      if (endDate) createdAt['lte'] = new Date(endDate);
      where['createdAt'] = createdAt;
    }

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        include: { user: { select: { name: true, email: true } } },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.auditLog.count({ where }),
    ]);

    res.json({
      success: true,
      data: {
        logs: logs.map((l) => ({
          ...l,
          details: l.details ? JSON.parse(l.details) : null,
        })),
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (err) { next(err); }
});

auditLogsRouter.post('/cleanup', authorize('admin'), async (_req, res, next) => {
  try {
    const count = await deleteOldLogs();
    res.json({ success: true, data: { deleted: count } });
  } catch (err) { next(err); }
});
