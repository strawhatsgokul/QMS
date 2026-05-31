import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../index.js';
import { validate } from '../middleware/validate.js';
import { authorize } from '../middleware/auth.js';
import { AppError } from '../middleware/errorHandler.js';

export const roomsRouter = Router();

const createRoomSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  location: z.string().optional(),
});

roomsRouter.get('/', async (_req, res, next) => {
  try {
    const rooms = await prisma.room.findMany({
      include: {
        _count: { select: { computers: true } },
      },
      orderBy: { name: 'asc' },
    });
    const roomsWithCounts = rooms.map((room: { _count: { computers: number } }) => ({
      ...room,
      computerCount: room._count.computers,
    }));
    res.json({ success: true, data: roomsWithCounts });
  } catch (err) { next(err); }
});

roomsRouter.get('/:id', async (req, res, next) => {
  try {
    const room = await prisma.room.findUnique({
      where: { id: req.params.id },
      include: {
        computers: {
          include: { room: true },
          orderBy: { hostname: 'asc' },
        },
      },
    });
    if (!room) throw new AppError(404, 'NOT_FOUND', 'Room not found');
    res.json({ success: true, data: room });
  } catch (err) { next(err); }
});

roomsRouter.post('/', authorize('admin'), validate(createRoomSchema), async (req, res, next) => {
  try {
    const room = await prisma.room.create({ data: req.body });
    res.status(201).json({ success: true, data: room });
  } catch (err) { next(err); }
});

roomsRouter.patch('/:id', authorize('admin'), async (req, res, next) => {
  try {
    const room = await prisma.room.update({
      where: { id: req.params.id },
      data: req.body,
    });
    res.json({ success: true, data: room });
  } catch (err) { next(err); }
});

roomsRouter.delete('/:id', authorize('admin'), async (req, res, next) => {
  try {
    await prisma.room.delete({ where: { id: req.params.id } });
    res.json({ success: true, data: { id: req.params.id } });
  } catch (err) { next(err); }
});
