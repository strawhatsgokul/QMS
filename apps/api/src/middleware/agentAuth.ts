import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config/index.js';

declare global {
  namespace Express {
    interface Request {
      agent?: { agentId: string };
    }
  }
}

export function authenticateAgent(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'No token provided' } });
    return;
  }

  const token = authHeader.split(' ')[1];
  if (!token) {
    res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Invalid token format' } });
    return;
  }

  try {
    const decoded = jwt.verify(token, config.jwt.secret) as { sub: string; type: string };
    if (decoded.type !== 'agent') {
      res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Not an agent token' } });
      return;
    }
    req.agent = { agentId: decoded.sub };
    next();
  } catch {
    res.status(401).json({ success: false, error: { code: 'TOKEN_EXPIRED', message: 'Agent token expired or invalid' } });
  }
}
