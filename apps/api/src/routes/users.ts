import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../index.js';
import { validate } from '../middleware/validate.js';
import { authorize } from '../middleware/auth.js';
import { AppError } from '../middleware/errorHandler.js';
import { hashPassword } from '../utils/auth.js';
import { logger } from '../config/logger.js';
import { logAction } from '../services/auditLog.js';

export const usersRouter = Router();

const createUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1).max(100),
  role: z.enum(['admin', 'staff', 'viewer']).default('viewer'),
  department: z.string().optional(),
});

const updateUserSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  role: z.enum(['admin', 'staff', 'viewer']).optional(),
  department: z.string().optional(),
  isActive: z.boolean().optional(),
});

usersRouter.get('/', authorize('admin'), async (_req, res, next) => {
  try {
    const users = await prisma.user.findMany({
      select: { id: true, email: true, name: true, role: true, department: true, isActive: true, lastLogin: true, createdAt: true },
      orderBy: { name: 'asc' },
    });
    res.json({ success: true, data: users });
  } catch (err) { next(err); }
});

usersRouter.get('/:id', authorize('admin'), async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.params.id },
      select: { id: true, email: true, name: true, role: true, avatar: true, department: true, isActive: true, lastLogin: true, createdAt: true, updatedAt: true },
    });
    if (!user) throw new AppError(404, 'NOT_FOUND', 'User not found');
    res.json({ success: true, data: user });
  } catch (err) { next(err); }
});

usersRouter.post('/', authorize('admin'), validate(createUserSchema), async (req, res, next) => {
  try {
    const { email, password, name, role, department } = req.body;
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new AppError(409, 'EMAIL_EXISTS', 'A user with this email already exists');
    }
    const passwordHash = await hashPassword(password);
    const user = await prisma.user.create({
      data: { email, passwordHash, name, role, department },
      select: { id: true, email: true, name: true, role: true, department: true, isActive: true, createdAt: true },
    });
    const ip = req.ip || req.socket.remoteAddress || '';
    logAction({ userId: req.user!.sub, action: 'USER_CREATED', resource: 'users', resourceId: user.id, details: { email: user.email, role: user.role }, ipAddress: ip });
    logger.info(`User created: ${user.email} (${user.role}) by admin ${req.user?.sub}`);
    res.status(201).json({ success: true, data: user });
  } catch (err) {
    if (err instanceof AppError) return next(err);
    logger.error('Failed to create user:', { error: (err as Error).message, stack: (err as Error).stack });
    next(err);
  }
});

usersRouter.patch('/:id', authorize('admin'), validate(updateUserSchema), async (req, res, next) => {
  try {
    const user = await prisma.user.update({
      where: { id: req.params.id },
      data: req.body,
      select: { id: true, email: true, name: true, role: true, department: true, isActive: true, lastLogin: true, createdAt: true },
    });
    const ip = req.ip || req.socket.remoteAddress || '';
    logAction({ userId: req.user!.sub, action: 'USER_UPDATED', resource: 'users', resourceId: user.id, details: { email: user.email, changes: Object.keys(req.body) }, ipAddress: ip });
    res.json({ success: true, data: user });
  } catch (err) { next(err); }
});

const resetPasswordSchema = z.object({
  newPassword: z.string().min(8),
});

usersRouter.post('/:id/reset-password', authorize('admin'), validate(resetPasswordSchema), async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!user) throw new AppError(404, 'NOT_FOUND', 'User not found');

    const passwordHash = await hashPassword(req.body.newPassword);
    await prisma.user.update({
      where: { id: req.params.id },
      data: { passwordHash },
    });

    const ip = req.ip || req.socket.remoteAddress || '';
    logAction({ userId: req.user!.sub, action: 'USER_PASSWORD_RESET', resource: 'users', resourceId: user.id, details: { email: user.email }, ipAddress: ip });
    logger.info(`Password reset for user ${user.email} by admin ${req.user?.sub}`);
    res.json({ success: true, data: { message: 'Password reset successfully' } });
  } catch (err) {
    if (err instanceof AppError) return next(err);
    logger.error('Failed to reset password:', { error: (err as Error).message, stack: (err as Error).stack });
    next(err);
  }
});

usersRouter.delete('/:id', authorize('admin'), async (req, res, next) => {
  try {
    if (req.user?.sub === req.params.id) {
      throw new AppError(400, 'SELF_DELETE', 'Cannot delete your own account');
    }
    const user = await prisma.user.findUnique({ where: { id: req.params.id }, select: { id: true, email: true } });
    await prisma.user.delete({ where: { id: req.params.id } });
    const ip = req.ip || req.socket.remoteAddress || '';
    if (user) logAction({ userId: req.user!.sub, action: 'USER_DELETED', resource: 'users', resourceId: req.params.id, details: { email: user.email }, ipAddress: ip });
    res.json({ success: true, data: { id: req.params.id } });
  } catch (err) { next(err); }
});
