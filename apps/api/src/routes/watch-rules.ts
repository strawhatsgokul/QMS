import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../index.js';
import { validate } from '../middleware/validate.js';
import { authorize } from '../middleware/auth.js';
import { AppError } from '../middleware/errorHandler.js';

export const watchRulesRouter = Router();

const createRuleSchema = z.object({
  name: z.string().min(1).max(100),
  pattern: z.string().min(1).max(200),
  category: z.string().max(50).default('custom'),
  severity: z.enum(['info', 'warning', 'error']).default('warning'),
  notifyAdmins: z.boolean().default(true),
});

const updateRuleSchema = createRuleSchema.partial().extend({
  isActive: z.boolean().optional(),
});

watchRulesRouter.get('/', async (_req, res, next) => {
  try {
    const rules = await prisma.watchRule.findMany({ orderBy: { createdAt: 'desc' } });
    res.json({ success: true, data: rules });
  } catch (err) { next(err); }
});

watchRulesRouter.post('/', authorize('admin'), validate(createRuleSchema), async (req, res, next) => {
  try {
    const rule = await prisma.watchRule.create({ data: req.body });
    res.status(201).json({ success: true, data: rule });
  } catch (err) { next(err); }
});

watchRulesRouter.put('/:id', authorize('admin'), validate(updateRuleSchema), async (req, res, next) => {
  try {
    const existing = await prisma.watchRule.findUnique({ where: { id: req.params.id } });
    if (!existing) throw new AppError(404, 'NOT_FOUND', 'Watch rule not found');
    const rule = await prisma.watchRule.update({
      where: { id: req.params.id },
      data: req.body,
    });
    res.json({ success: true, data: rule });
  } catch (err) { next(err); }
});

watchRulesRouter.delete('/:id', authorize('admin'), async (req, res, next) => {
  try {
    const existing = await prisma.watchRule.findUnique({ where: { id: req.params.id } });
    if (!existing) throw new AppError(404, 'NOT_FOUND', 'Watch rule not found');
    await prisma.watchRule.delete({ where: { id: req.params.id } });
    res.json({ success: true, data: { id: req.params.id } });
  } catch (err) { next(err); }
});
