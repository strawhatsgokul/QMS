import { describe, it, expect, vi } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import { csrfCheck } from './csrf.js';

function mockReq(method: string, origin?: string, referer?: string): Partial<Request> {
  return {
    method,
    headers: { origin, referer } as Record<string, string | undefined>,
    path: '/api/test',
  } as Partial<Request>;
}

function mockRes(): Response {
  const res: Partial<Response> = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res as unknown as Response;
}

describe('csrfCheck', () => {
  it('allows safe methods (GET, HEAD, OPTIONS)', () => {
    const req = mockReq('GET') as Request;
    const res = mockRes();
    const next = vi.fn() as unknown as NextFunction;
    csrfCheck(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  it('allows POST without origin or referer (e.g., server-side clients)', () => {
    const req = mockReq('POST') as Request;
    const res = mockRes();
    const next = vi.fn() as unknown as NextFunction;
    csrfCheck(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  it('allows POST from allowed origin', () => {
    const req = mockReq('POST', 'http://localhost:3000') as Request;
    const res = mockRes();
    const next = vi.fn() as unknown as NextFunction;
    csrfCheck(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  it('blocks POST from unknown origin', () => {
    const req = mockReq('POST', 'https://evil.com') as Request;
    const res = mockRes();
    const next = vi.fn() as unknown as NextFunction;
    csrfCheck(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ success: false, error: 'CSRF validation failed' });
    expect(next).not.toHaveBeenCalled();
  });
});
