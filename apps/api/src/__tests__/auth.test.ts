import { describe, it, expect, vi } from 'vitest';

vi.mock('../config/index.js', () => ({
  config: {
    jwt: {
      secret: 'test-secret-key-for-unit-tests',
      expiresIn: '1h',
      refreshExpiresIn: '7d',
    },
  },
}));

vi.mock('bcryptjs', () => ({
  default: {
    hash: vi.fn((pwd: string, rounds: number) => Promise.resolve(`hashed_${pwd}_${rounds}`)),
    compare: vi.fn((pwd: string, hash: string) => Promise.resolve(hash === `hashed_${pwd}_12`)),
  },
  hash: vi.fn((pwd: string, rounds: number) => Promise.resolve(`hashed_${pwd}_${rounds}`)),
  compare: vi.fn((pwd: string, hash: string) => Promise.resolve(hash === `hashed_${pwd}_12`)),
}));

import { hashPassword, verifyPassword, generateToken, verifyRefreshToken } from '../utils/auth.js';

describe('hashPassword', () => {
  it('returns a hashed string', async () => {
    const hash = await hashPassword('MyP@ss123');
    expect(hash).toBeDefined();
    expect(typeof hash).toBe('string');
    expect(hash).toContain('MyP@ss123');
  });

  it('produces different hashes for different passwords', async () => {
    const hash1 = await hashPassword('password1');
    const hash2 = await hashPassword('password2');
    expect(hash1).not.toBe(hash2);
  });
});

describe('verifyPassword', () => {
  it('returns true for matching password', async () => {
    const hash = await hashPassword('correct-password');
    const result = await verifyPassword('correct-password', hash);
    expect(result).toBe(true);
  });

  it('returns false for incorrect password', async () => {
    const hash = await hashPassword('correct-password');
    const result = await verifyPassword('wrong-password', hash);
    expect(result).toBe(false);
  });
});

describe('generateToken', () => {
  const mockUser = { id: 'user-123', role: 'admin' };

  it('returns an AuthResponse with access and refresh tokens', () => {
    const result = generateToken(mockUser);
    expect(result).toHaveProperty('accessToken');
    expect(result).toHaveProperty('refreshToken');
    expect(result).toHaveProperty('expiresAt');
    expect(result).toHaveProperty('user');
  });

  it('accessToken is a valid JWT (3 dot-separated parts)', () => {
    const result = generateToken(mockUser);
    const parts = result.accessToken.split('.');
    expect(parts).toHaveLength(3);
  });

  it('refreshToken is a valid JWT', () => {
    const result = generateToken(mockUser);
    const parts = result.refreshToken.split('.');
    expect(parts).toHaveLength(3);
  });

  it('embeds user id and role in the access token payload', () => {
    const result = generateToken(mockUser);
    const payload = JSON.parse(atob(result.accessToken.split('.')[1]!));
    expect(payload.sub).toBe('user-123');
    expect(payload.role).toBe('admin');
  });

  it('refresh token has type: refresh in payload', () => {
    const result = generateToken(mockUser);
    const payload = JSON.parse(atob(result.refreshToken.split('.')[1]!));
    expect(payload.type).toBe('refresh');
    expect(payload.sub).toBe('user-123');
  });

  it('expiresAt is a future ISO date string', () => {
    const result = generateToken(mockUser);
    const expiresAt = new Date(result.expiresAt);
    expect(expiresAt.getTime()).toBeGreaterThan(Date.now());
  });

  it('returns the user object in the response', () => {
    const result = generateToken(mockUser);
    expect(result.user).toEqual(mockUser);
  });

  it('produces different tokens for different users', () => {
    const result1 = generateToken({ id: 'user-111', role: 'admin' });
    const result2 = generateToken({ id: 'user-222', role: 'staff' });
    expect(result1.accessToken).not.toBe(result2.accessToken);
    expect(result1.refreshToken).not.toBe(result2.refreshToken);
  });
});

describe('verifyRefreshToken', () => {
  const mockUser = { id: 'user-456', role: 'staff' };

  it('returns decoded payload for a valid refresh token', () => {
    const tokens = generateToken(mockUser);
    const decoded = verifyRefreshToken(tokens.refreshToken);
    expect(decoded).not.toBeNull();
    expect(decoded!.sub).toBe('user-456');
    expect(decoded!.role).toBe('staff');
  });

  it('returns null for an access token (wrong type)', () => {
    const tokens = generateToken(mockUser);
    const decoded = verifyRefreshToken(tokens.accessToken);
    expect(decoded).toBeNull();
  });

  it('returns null for a malformed token', () => {
    const decoded = verifyRefreshToken('not-a-valid-jwt');
    expect(decoded).toBeNull();
  });

  it('returns null for an empty string', () => {
    const decoded = verifyRefreshToken('');
    expect(decoded).toBeNull();
  });

  it('returns null for a token signed with a different secret', () => {
    const tokens = generateToken(mockUser);
    const tampered = tokens.refreshToken.split('.').map((p, i) => i === 2 ? 'invalidsignature' : p).join('.');
    const decoded = verifyRefreshToken(tampered);
    expect(decoded).toBeNull();
  });
});
