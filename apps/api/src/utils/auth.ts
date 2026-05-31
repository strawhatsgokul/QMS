import bcrypt from 'bcryptjs';
import jwt, { type SignOptions } from 'jsonwebtoken';
import { config } from '../config/index.js';
import type { JWTPayload, AuthResponse, User } from '@veyon-aw/shared';

const SALT_ROUNDS = 12;
const HOUR_SECONDS = 3600;

function expiresInToSeconds(expiresIn: string): number {
  const match = expiresIn.match(/^(\d+)([smhd])$/);
  if (!match) return 86400;
  const value = parseInt(match[1]!, 10);
  switch (match[2]) {
    case 's': return value;
    case 'm': return value * 60;
    case 'h': return value * HOUR_SECONDS;
    case 'd': return value * 86400;
    default: return 86400;
  }
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function generateToken(user: { id: string; role: string }): AuthResponse {
  const payload: Record<string, unknown> = {
    sub: user.id,
    role: user.role,
  };

  const accessOptions: SignOptions = {
    expiresIn: expiresInToSeconds(config.jwt.expiresIn),
  };

  const accessToken = jwt.sign(payload, config.jwt.secret, accessOptions);

  const refreshOptions: SignOptions = {
    expiresIn: expiresInToSeconds(config.jwt.refreshExpiresIn),
  };

  const refreshToken = jwt.sign(
    { ...payload, type: 'refresh' },
    config.jwt.secret,
    refreshOptions,
  );

  const decoded = jwt.decode(accessToken) as { exp: number };

  return {
    accessToken,
    refreshToken,
    expiresAt: new Date(decoded.exp * 1000).toISOString(),
    user: user as User,
  };
}

export function verifyRefreshToken(token: string): JWTPayload | null {
  try {
    const decoded = jwt.verify(token, config.jwt.secret) as JWTPayload & { type?: string };
    if (decoded.type !== 'refresh') return null;
    return decoded;
  } catch {
    return null;
  }
}
