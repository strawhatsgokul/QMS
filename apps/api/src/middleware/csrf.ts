import type { Request, Response, NextFunction } from 'express';
import { config } from '../config/index.js';
import { logger } from '../config/logger.js';

const SAFE_METHODS = ['GET', 'HEAD', 'OPTIONS'];
const ALLOWED_ORIGINS = [config.cors.origin, 'http://localhost:3000', 'http://localhost:4000'];

export function csrfCheck(req: Request, res: Response, next: NextFunction): void {
  if (SAFE_METHODS.includes(req.method)) {
    next();
    return;
  }

  const origin = req.headers['origin'] as string | undefined;
  const referer = req.headers['referer'] as string | undefined;

  if (!origin && !referer) {
    next();
    return;
  }

  const source = (origin || referer || '').toLowerCase();

  const isValid = ALLOWED_ORIGINS.some((allowed) => {
    if (allowed === '*') return true;
    return source.startsWith(allowed.toLowerCase());
  });

  if (!isValid) {
    logger.warn(`CSRF check failed: ${req.method} ${req.path} from origin=${origin} referer=${referer}`);
    res.status(403).json({ success: false, error: 'CSRF validation failed' });
    return;
  }

  next();
}
