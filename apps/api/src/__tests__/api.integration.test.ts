import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import express from 'express';
import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';
import request from 'supertest';

// Build a test-specific prisma instance
const prisma = new PrismaClient({
  datasources: { db: { url: process.env.DATABASE_URL || 'file:./data/test.db' } },
});

// Mock the production prisma instance BEFORE importing routes
vi.mock('../index.js', () => ({
  prisma,
  io: { emit: vi.fn(), to: vi.fn(() => ({ emit: vi.fn() })) },
}));

// Now import route modules (they'll use the mocked prisma)
const { authRouter } = await import('../routes/auth.js');
const { computersRouter } = await import('../routes/computers.js');
const { usersRouter } = await import('../routes/users.js');
const { dashboardRouter } = await import('../routes/dashboard.js');
const { authenticate } = await import('../middleware/auth.js');
const { errorHandler } = await import('../middleware/errorHandler.js');
const { csrfCheck } = await import('../middleware/csrf.js');

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use(csrfCheck);
  app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));
  app.use('/api/auth', authRouter);
  app.use('/api/computers', authenticate, computersRouter);
  app.use('/api/users', authenticate, usersRouter);
  app.use('/api/dashboard', authenticate, dashboardRouter);
  app.use(errorHandler);
  return app;
}

let app: express.Application;
let adminToken: string;
let testComputerId: string;

beforeAll(async () => {
  // Push schema and seed
  const { execSync } = await import('child_process');
  execSync('npx prisma db push --force-reset --accept-data-loss', {
    cwd: process.cwd(),
    env: { ...process.env, DATABASE_URL: 'file:./data/test.db' },
    stdio: 'pipe',
  }).toString();

  const bcrypt = await import('bcryptjs');
  const hash = await bcrypt.hash('admin123', 12);
  await prisma.user.upsert({
    where: { email: 'admin@test.com' },
    update: { passwordHash: hash, role: 'admin' },
    create: { email: 'admin@test.com', name: 'Admin', passwordHash: hash, role: 'admin' },
  });

  const room = await prisma.room.upsert({
    where: { id: 'room-test-int' },
    update: { name: 'Integration Test Room' },
    create: { id: 'room-test-int', name: 'Integration Test Room' },
  });
  const computer = await prisma.computer.create({
    data: { hostname: 'INTEGRATION-PC', ipAddress: '10.0.0.10', roomId: room.id },
  });
  testComputerId = computer.id;

  app = buildApp();

  const loginRes = await request(app)
    .post('/api/auth/login')
    .send({ email: 'admin@test.com', password: 'admin123' });
  adminToken = loginRes.body.data.accessToken;

  // Verify token was obtained
  if (!adminToken) {
    throw new Error('Failed to get admin token. Login response: ' + JSON.stringify(loginRes.body));
  }
});

afterAll(async () => {
  await prisma.$disconnect();
});

// ── Auth ─────────────────────────────────────────────────
describe('Auth: POST /api/auth/login', () => {
  it('returns 200 + JWT for valid credentials', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: 'admin@test.com', password: 'admin123' });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.accessToken).toBeDefined();
    expect(res.body.data.user.email).toBe('admin@test.com');
    expect(res.body.data.user.role).toBe('admin');
  });

  it('returns 401 for wrong password', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: 'admin@test.com', password: 'wrong' });
    expect(res.status).toBe(401);
  });

  it('returns 401 for non-existent user', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: 'ghost@test.com', password: 'admin123' });
    expect(res.status).toBe(401);
  });

  it('returns 400 for invalid email format', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: 'bademail', password: 'admin123' });
    expect(res.status).toBe(400);
  });
});

describe('Auth: protected routes', () => {
  it('returns 401 without token', async () => {
    const res = await request(app).get('/api/users');
    expect(res.status).toBe(401);
  });

  it('returns 200 with valid token', async () => {
    const res = await request(app).get('/api/users').set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
  });

  it('returns 401 with expired token', async () => {
    const expiredToken = jwt.sign({ sub: 'admin', role: 'admin' }, 'wrong-secret', { expiresIn: '0s' });
    const res = await request(app).get('/api/computers').set('Authorization', `Bearer ${expiredToken}`);
    expect(res.status).toBe(401);
  });
});

describe('Auth: token refresh', () => {
  it('returns new tokens with valid refresh token', async () => {
    const loginRes = await request(app).post('/api/auth/login').send({ email: 'admin@test.com', password: 'admin123' });
    const res = await request(app).post('/api/auth/refresh').send({ refreshToken: loginRes.body.data.refreshToken });
    expect(res.status).toBe(200);
    expect(res.body.data.accessToken).toBeDefined();
  });

  it('returns 400 with missing refresh token', async () => {
    const res = await request(app).post('/api/auth/refresh').send({});
    expect(res.status).toBe(400);
  });
});

// ── Computers ────────────────────────────────────────────
describe('Computers: CRUD', () => {
  it('GET /api/computers returns array', async () => {
    const res = await request(app).get('/api/computers').set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThanOrEqual(1);
    expect(res.body.data[0]).toHaveProperty('hostname');
    expect(res.body.data[0]).toHaveProperty('ipAddress');
  });

  it('GET /api/computers supports search', async () => {
    const res = await request(app).get('/api/computers?search=INTEGRATION').set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThanOrEqual(1);
  });

  it('GET /api/computers/:id returns computer', async () => {
    const res = await request(app).get(`/api/computers/${testComputerId}`).set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.hostname).toBe('INTEGRATION-PC');
  });

  it('GET /api/computers/:id returns 404 for unknown', async () => {
    const res = await request(app).get('/api/computers/00000000-0000-0000-0000-000000000000').set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(404);
  });
});

// ── Dashboard ────────────────────────────────────────────
describe('Dashboard: GET /api/dashboard/stats', () => {
  it('returns stats with totalComputers', async () => {
    const res = await request(app).get('/api/dashboard/stats').set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty('totalComputers');
    expect(typeof res.body.data.totalComputers).toBe('number');
  });

  it('returns 401 without auth', async () => {
    const res = await request(app).get('/api/dashboard/stats');
    expect(res.status).toBe(401);
  });
});

// ── Health ───────────────────────────────────────────────
describe('Health: GET /api/health', () => {
  it('returns 200 with status ok', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });

  it('requires no authentication', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
  });
});
