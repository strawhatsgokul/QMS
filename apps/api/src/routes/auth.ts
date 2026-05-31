import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../index.js';
import { hashPassword, verifyPassword, generateToken, verifyRefreshToken } from '../utils/auth.js';
import { AppError } from '../middleware/errorHandler.js';
import { validate } from '../middleware/validate.js';
import { authenticate } from '../middleware/auth.js';
import { logger } from '../config/logger.js';
import { logAction } from '../services/auditLog.js';
import type { User } from '@veyon-aw/shared';

export const authRouter = Router();

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1).max(100),
  role: z.enum(['admin', 'staff', 'viewer']).default('viewer'),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8),
});

authRouter.post('/login', validate(loginSchema), async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const ip = req.ip || req.socket.remoteAddress || '';
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !(await verifyPassword(password, user.passwordHash))) {
      logger.warn('Failed login attempt', { email, ip });
      await logAction({ userId: '00000000-0000-0000-0000-000000000000', action: 'USER_LOGIN_FAILURE', resource: 'auth', details: { email }, ipAddress: ip }).catch(() => {});
      throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid email or password');
    }
    if (!user.isActive) {
      logger.warn('Disabled account login attempt', { email, ip });
      await logAction({ userId: user.id, action: 'USER_LOGIN_FAILURE', resource: 'auth', details: { reason: 'account_disabled' }, ipAddress: ip });
      throw new AppError(403, 'ACCOUNT_DISABLED', 'Account has been disabled');
    }
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLogin: new Date() },
    });
    const { passwordHash: _, ...safeUser } = user;
    const tokens = generateToken(safeUser);
    tokens.user = safeUser as unknown as User;
    logAction({ userId: user.id, action: 'USER_LOGIN_SUCCESS', resource: 'auth', ipAddress: ip });
    res.json({ success: true, data: tokens });
  } catch (err) { next(err); }
});

authRouter.post('/register', validate(registerSchema), async (req, res, next) => {
  try {
    const { email, password, name, role } = req.body;
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new AppError(409, 'EMAIL_EXISTS', 'Email already registered');
    }
    const passwordHash = await hashPassword(password);
    const user = await prisma.user.create({
      data: { email, passwordHash, name, role },
    });
    const tokens = generateToken({ id: user.id, role: user.role });
    logAction({ userId: user.id, action: 'USER_REGISTERED', resource: 'auth', ipAddress: req.ip || req.socket.remoteAddress });
    res.status(201).json({ success: true, data: tokens });
  } catch (err) { next(err); }
});

authRouter.post('/refresh', async (req, res, next) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      throw new AppError(400, 'MISSING_TOKEN', 'Refresh token required');
    }
    const payload = verifyRefreshToken(refreshToken);
    if (!payload) {
      throw new AppError(401, 'INVALID_TOKEN', 'Invalid or expired refresh token');
    }
    const user = await prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user || !user.isActive) {
      throw new AppError(401, 'USER_NOT_FOUND', 'User not found or disabled');
    }
    const tokens = generateToken({ id: user.id, role: user.role });
    logAction({ userId: user.id, action: 'TOKEN_REFRESH', resource: 'auth', ipAddress: req.ip || req.socket.remoteAddress });
    res.json({ success: true, data: tokens });
  } catch (err) { next(err); }
});

authRouter.get('/me', authenticate, async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.sub },
      select: { id: true, email: true, name: true, role: true, avatar: true, department: true, isActive: true, mustChangePassword: true, lastLogin: true, createdAt: true, updatedAt: true },
    });
    if (!user) throw new AppError(404, 'USER_NOT_FOUND', 'User not found');
    res.json({ success: true, data: user });
  } catch (err) { next(err); }
});

authRouter.post('/change-password', authenticate, validate(changePasswordSchema), async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const user = await prisma.user.findUnique({ where: { id: req.user!.sub } });
    if (!user) throw new AppError(404, 'USER_NOT_FOUND', 'User not found');
    if (!(await verifyPassword(currentPassword, user.passwordHash))) {
      throw new AppError(400, 'INVALID_PASSWORD', 'Current password is incorrect');
    }
    const passwordHash = await hashPassword(newPassword);
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash, mustChangePassword: false },
    });
    const tokens = generateToken({ id: user.id, role: user.role });
    logAction({ userId: user.id, action: 'PASSWORD_CHANGED', resource: 'auth', ipAddress: req.ip || req.socket.remoteAddress });
    res.json({ success: true, data: tokens });
  } catch (err) { next(err); }
});
