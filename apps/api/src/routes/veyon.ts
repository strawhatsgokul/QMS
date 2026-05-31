import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validate.js';
import { authorize } from '../middleware/auth.js';
import { veyonService } from '../services/veyon.js';
import { logAction } from '../services/auditLog.js';

export const veyonRouter = Router();

const computerActionSchema = z.object({
  computerIds: z.array(z.string().min(1)).min(1).max(50),
});

const messageSchema = computerActionSchema.extend({
  message: z.string().min(1).max(500),
  title: z.string().optional(),
});

const fileTransferSchema = computerActionSchema.extend({
  sourcePath: z.string().min(1),
  destinationPath: z.string().min(1),
});

veyonRouter.post('/screen/lock', authorize('admin', 'staff'), validate(computerActionSchema), async (req, res, next) => {
  try {
    const results = await Promise.allSettled(
      req.body.computerIds.map((id: string) => veyonService.lockScreen(id))
    );
    const ip = req.ip || req.socket.remoteAddress || '';
    logAction({ userId: req.user!.sub, action: 'VEYON_LOCK', resource: 'veyon', resourceId: req.body.computerIds.join(','), details: { count: req.body.computerIds.length }, ipAddress: ip });
    res.json({ success: true, data: results.map((r) => r.status === 'fulfilled' ? r.value : { error: r.reason instanceof Error ? r.reason.message : String(r.reason) }) });
  } catch (err) { next(err); }
});

veyonRouter.post('/screen/unlock', authorize('admin', 'staff'), validate(computerActionSchema), async (req, res, next) => {
  try {
    const results = await Promise.allSettled(
      req.body.computerIds.map((id: string) => veyonService.unlockScreen(id))
    );
    const ip = req.ip || req.socket.remoteAddress || '';
    logAction({ userId: req.user!.sub, action: 'VEYON_UNLOCK', resource: 'veyon', resourceId: req.body.computerIds.join(','), details: { count: req.body.computerIds.length }, ipAddress: ip });
    res.json({ success: true, data: results.map((r) => r.status === 'fulfilled' ? r.value : { error: r.reason instanceof Error ? r.reason.message : String(r.reason) }) });
  } catch (err) { next(err); }
});

veyonRouter.post('/power/restart', authorize('admin', 'staff'), validate(computerActionSchema), async (req, res, next) => {
  try {
    const results = await Promise.allSettled(
      req.body.computerIds.map((id: string) => veyonService.restartComputer(id))
    );
    const ip = req.ip || req.socket.remoteAddress || '';
    logAction({ userId: req.user!.sub, action: 'VEYON_RESTART', resource: 'veyon', resourceId: req.body.computerIds.join(','), details: { count: req.body.computerIds.length }, ipAddress: ip });
    res.json({ success: true, data: results.map((r) => r.status === 'fulfilled' ? r.value : { error: r.reason instanceof Error ? r.reason.message : String(r.reason) }) });
  } catch (err) { next(err); }
});

veyonRouter.post('/power/shutdown', authorize('admin', 'staff'), validate(computerActionSchema), async (req, res, next) => {
  try {
    const results = await Promise.allSettled(
      req.body.computerIds.map((id: string) => veyonService.shutdownComputer(id))
    );
    const ip = req.ip || req.socket.remoteAddress || '';
    logAction({ userId: req.user!.sub, action: 'VEYON_SHUTDOWN', resource: 'veyon', resourceId: req.body.computerIds.join(','), details: { count: req.body.computerIds.length }, ipAddress: ip });
    res.json({ success: true, data: results.map((r) => r.status === 'fulfilled' ? r.value : { error: r.reason instanceof Error ? r.reason.message : String(r.reason) }) });
  } catch (err) { next(err); }
});

veyonRouter.post('/power/wake', authorize('admin'), validate(computerActionSchema), async (req, res, next) => {
  try {
    const results = await Promise.allSettled(
      req.body.computerIds.map((id: string) => veyonService.wakeComputer(id))
    );
    const ip = req.ip || req.socket.remoteAddress || '';
    logAction({ userId: req.user!.sub, action: 'VEYON_WAKE', resource: 'veyon', resourceId: req.body.computerIds.join(','), details: { count: req.body.computerIds.length }, ipAddress: ip });
    res.json({ success: true, data: results.map((r) => r.status === 'fulfilled' ? r.value : { error: r.reason instanceof Error ? r.reason.message : String(r.reason) }) });
  } catch (err) { next(err); }
});

veyonRouter.post('/message', authorize('admin', 'staff'), validate(messageSchema), async (req, res, next) => {
  try {
    const results = await Promise.allSettled(
      req.body.computerIds.map((id: string) =>
        veyonService.sendMessage(id, req.body.message, req.body.title)
      )
    );
    const ip = req.ip || req.socket.remoteAddress || '';
    logAction({ userId: req.user!.sub, action: 'VEYON_MESSAGE', resource: 'veyon', resourceId: req.body.computerIds.join(','), details: { message: req.body.message, title: req.body.title, count: req.body.computerIds.length }, ipAddress: ip });
    res.json({ success: true, data: results.map((r) => r.status === 'fulfilled' ? r.value : { error: r.reason instanceof Error ? r.reason.message : String(r.reason) }) });
  } catch (err) { next(err); }
});

veyonRouter.post('/file/copy', authorize('admin', 'staff'), validate(fileTransferSchema), async (req, res, next) => {
  try {
    const results = await Promise.allSettled(
      req.body.computerIds.map((id: string) =>
        veyonService.copyFile(id, req.body.sourcePath, req.body.destinationPath)
      )
    );
    const ip = req.ip || req.socket.remoteAddress || '';
    logAction({ userId: req.user!.sub, action: 'VEYON_FILE_COPY', resource: 'veyon', resourceId: req.body.computerIds.join(','), details: { sourcePath: req.body.sourcePath, destinationPath: req.body.destinationPath, count: req.body.computerIds.length }, ipAddress: ip });
    res.json({ success: true, data: results.map((r) => r.status === 'fulfilled' ? r.value : { error: r.reason instanceof Error ? r.reason.message : String(r.reason) }) });
  } catch (err) { next(err); }
});

veyonRouter.post('/demo/start', authorize('admin', 'staff'), async (req, res, next) => {
  try {
    const result = await veyonService.startDemo();
    const ip = req.ip || req.socket.remoteAddress || '';
    logAction({ userId: req.user!.sub, action: 'VEYON_DEMO_START', resource: 'veyon', ipAddress: ip });
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
});

veyonRouter.post('/demo/stop', authorize('admin', 'staff'), async (req, res, next) => {
  try {
    const result = await veyonService.stopDemo();
    const ip = req.ip || req.socket.remoteAddress || '';
    logAction({ userId: req.user!.sub, action: 'VEYON_DEMO_STOP', resource: 'veyon', ipAddress: ip });
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
});

veyonRouter.get('/screen/:computerId', authorize('admin', 'staff'), async (req, res, next) => {
  try {
    const computerId = req.params.computerId!;
    const screenshot = await veyonService.getScreenshot(computerId);
    const ip = req.ip || req.socket.remoteAddress || '';
    logAction({ userId: req.user!.sub, action: 'VEYON_SCREENSHOT', resource: 'veyon', resourceId: computerId, ipAddress: ip });
    res.json({ success: true, data: screenshot });
  } catch (err) { next(err); }
});
