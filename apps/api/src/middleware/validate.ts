import type { Request, Response, NextFunction } from 'express';
import type { ZodSchema } from 'zod';
import { AppError } from './errorHandler.js';
import { logger } from '../config/logger.js';

export function validate(schema: ZodSchema, source: 'body' | 'query' | 'params' = 'body') {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req[source]);
    if (!result.success) {
      const details: Record<string, string[]> = {};
      for (const issue of result.error.issues) {
        const path = issue.path.join('.');
        if (!details[path]) details[path] = [];
        details[path].push(issue.message);
      }
      logger.warn('Validation failed', {
        path: req.path,
        method: req.method,
        source,
        errors: details,
        body: source === 'body' ? sanitizeBody(req.body) : undefined,
      });
      throw new AppError(400, 'VALIDATION_ERROR', 'Validation failed', details);
    }
    req[source] = result.data;
    next();
  };
}

function sanitizeBody(body: unknown): unknown {
  if (!body || typeof body !== 'object') return body;
  const sanitized = { ...body as Record<string, unknown> };
  if (sanitized.password) sanitized.password = '***';
  if (sanitized.newPassword) sanitized.newPassword = '***';
  if (sanitized.privateKey) sanitized.privateKey = '***';
  return sanitized;
}
