import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../index.js';
import { validate } from '../middleware/validate.js';
import { authorize } from '../middleware/auth.js';
import { AppError } from '../middleware/errorHandler.js';
import { veyonService } from '../services/veyon.js';

export const computersRouter = Router();

const createComputerSchema = z.object({
  hostname: z.string().min(1),
  ipAddress: z.string().ip(),
  macAddress: z.string().optional(),
  roomId: z.string().uuid().optional(),
});

computersRouter.get('/', async (req, res, next) => {
  try {
    const { roomId, status, search } = req.query;
    const where: Record<string, unknown> = {};
    if (roomId) where['roomId'] = roomId;
    if (status) where['status'] = status;
    if (search) {
      where['OR'] = [
        { hostname: { contains: search, mode: 'insensitive' } },
        { ipAddress: { contains: search, mode: 'insensitive' } },
      ];
    }
    const computers = await prisma.computer.findMany({
      where,
      include: { room: true },
      orderBy: { hostname: 'asc' },
    });
    res.json({ success: true, data: computers });
  } catch (err) { next(err); }
});

computersRouter.get('/:id', async (req, res, next) => {
  try {
    const computer = await prisma.computer.findUnique({
      where: { id: req.params.id },
      include: { room: true, groups: { include: { group: true } } },
    });
    if (!computer) throw new AppError(404, 'NOT_FOUND', 'Computer not found');
    res.json({ success: true, data: computer });
  } catch (err) { next(err); }
});

computersRouter.post('/', authorize('admin', 'staff'), validate(createComputerSchema), async (req, res, next) => {
  try {
    const computer = await prisma.computer.create({
      data: req.body,
      include: { room: true },
    });
    res.status(201).json({ success: true, data: computer });
  } catch (err) { next(err); }
});

computersRouter.patch('/:id', authorize('admin', 'staff'), async (req, res, next) => {
  try {
    const computer = await prisma.computer.update({
      where: { id: req.params.id },
      data: req.body,
      include: { room: true },
    });
    res.json({ success: true, data: computer });
  } catch (err) { next(err); }
});

computersRouter.delete('/:id', authorize('admin'), async (req, res, next) => {
  try {
    await prisma.computer.delete({ where: { id: req.params.id } });
    res.json({ success: true, data: { id: req.params.id } });
  } catch (err) { next(err); }
});

computersRouter.post('/:id/scan', authorize('admin', 'staff'), async (req, res, next) => {
  try {
    const computer = await prisma.computer.findUnique({ where: { id: req.params.id } });
    if (!computer) throw new AppError(404, 'NOT_FOUND', 'Computer not found');
    const status = await veyonService.getComputerStatus(computer);
    res.json({ success: true, data: status });
  } catch (err) { next(err); }
});
