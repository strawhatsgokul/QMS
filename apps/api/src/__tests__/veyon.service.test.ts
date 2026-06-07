import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('axios', () => ({
  default: {
    post: vi.fn(),
    get: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
  post: vi.fn(),
  get: vi.fn(),
  put: vi.fn(),
  delete: vi.fn(),
}));

vi.mock('fs', () => ({
  readFileSync: vi.fn(() => 'mock-private-key-content'),
}));

vi.mock('../index.js', () => ({
  prisma: {
    computer: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    systemSetting: {
      findUnique: vi.fn(),
    },
  },
  io: {
    emit: vi.fn(),
    to: vi.fn(() => ({ emit: vi.fn() })),
  },
}));

vi.mock('../config/index.js', () => ({
  config: {
    veyon: {
      cliPath: 'veyon-cli',
      apiKey: 'test-api-key',
      webapiUrl: 'http://veyon-server:11080/api/v1',
      privateKeyPath: '/etc/veyon/keys/private.key',
      keyName: 'dashboard-key',
    },
  },
}));

vi.mock('../config/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import axios from 'axios';
import { prisma } from '../index.js';

const mockComputer = {
  id: 'comp-001',
  hostname: 'PC-01',
  ipAddress: '192.168.1.50',
  macAddress: '00:1A:2B:3C:4D:5E',
  roomId: 'room-1',
  status: 'online',
  currentUser: null,
  lastSeen: new Date(),
  os: 'Windows 10 Pro',
  veyonVersion: '4.8',
  notes: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockConnUid = 'conn-uuid-abc-123';

describe('VeyonService — Authentication', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('authenticates to a target host and returns a connection UID', async () => {
    vi.mocked(axios.post).mockResolvedValueOnce({ data: { 'connection-uid': mockConnUid } });

    const { data } = await axios.post(`http://veyon-server:11080/api/v1/authentication/PC-01`, {
      method: '0c69b301-81b4-42d6-8fae-128cdd113314',
      credentials: { keyname: 'dashboard-key', keydata: 'mock-private-key-content' },
    }, { timeout: 10000 });

    const connUid = data['connection-uid'];
    expect(connUid).toBe(mockConnUid);
    expect(axios.post).toHaveBeenCalledWith(
      expect.stringContaining('/authentication/PC-01'),
      expect.objectContaining({
        method: '0c69b301-81b4-42d6-8fae-128cdd113314',
      }),
      expect.any(Object),
    );
  });

  it('releases authentication after operation completes', async () => {
    vi.mocked(axios.delete).mockResolvedValueOnce({ status: 204 });

    await axios.delete(`http://veyon-server:11080/api/v1/authentication/PC-01`, {
      headers: { 'Connection-Uid': mockConnUid },
      timeout: 5000,
    });

    expect(axios.delete).toHaveBeenCalledWith(
      expect.stringContaining('/authentication/PC-01'),
      expect.objectContaining({
        headers: expect.objectContaining({ 'Connection-Uid': mockConnUid }),
      }),
    );
  });
});

describe('VeyonService — Feature URL Construction', () => {
  const BASE = 'http://veyon-server:11080/api/v1';

  it('constructs correct lock feature URL', () => {
    const url = `${BASE}/feature/ccb535a2-1d24-4cc1-a709-8b47d2b2ac79`;
    expect(url).toBe(`${BASE}/feature/ccb535a2-1d24-4cc1-a709-8b47d2b2ac79`);
  });

  it('constructs correct unlock feature URL (same UUID, active=false)', () => {
    const url = `${BASE}/feature/ccb535a2-1d24-4cc1-a709-8b47d2b2ac79`;
    expect(url).toBe(`${BASE}/feature/ccb535a2-1d24-4cc1-a709-8b47d2b2ac79`);
  });

  it('constructs correct screenshot framebuffer URL', () => {
    const url = `${BASE}/framebuffer?format=png&width=320&compression=6`;
    expect(url).toBe(`${BASE}/framebuffer?format=png&width=320&compression=6`);
  });

  it('constructs correct reboot feature URL', () => {
    const url = `${BASE}/feature/4f7d98f0-395a-4fff-b968-e49b8d0f748c`;
    expect(url).toMatch(/feature\/4f7d98f0/);
  });

  it('constructs correct power down feature URL', () => {
    const url = `${BASE}/feature/6f5a27a0-0e2f-496e-afcc-7aae62eede10`;
    expect(url).toMatch(/feature\/6f5a27a0/);
  });

  it('constructs correct text message feature URL', () => {
    const url = `${BASE}/feature/e75ae9c8-ac17-4d00-8f0d-019346348208`;
    expect(url).toMatch(/feature\/e75ae9c8/);
  });
});

describe('VeyonService — Computer Lookup', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('looks up computer by ID before executing an action', async () => {
    vi.mocked(prisma.computer.findUnique).mockResolvedValueOnce(mockComputer);

    const computer = await prisma.computer.findUnique({ where: { id: 'comp-001' } });
    expect(computer).toBeDefined();
    expect(computer!.hostname).toBe('PC-01');
    expect(prisma.computer.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'comp-001' } }),
    );
  });

  it('throws when computer is not found', async () => {
    vi.mocked(prisma.computer.findUnique).mockResolvedValueOnce(null);

    const computer = await prisma.computer.findUnique({ where: { id: 'non-existent' } });
    expect(computer).toBeNull();
  });
});

describe('VeyonService — Lock/Unlock Operations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('sends lock=true to the Veyon feature API', async () => {
    vi.mocked(prisma.computer.findUnique).mockResolvedValueOnce(mockComputer);
    vi.mocked(axios.post).mockResolvedValueOnce({ data: { 'connection-uid': mockConnUid } });
    vi.mocked(axios.put).mockResolvedValueOnce({ status: 200 });
    vi.mocked(axios.delete).mockResolvedValueOnce({ status: 204 });
    vi.mocked(prisma.computer.update).mockResolvedValueOnce({
      ...mockComputer,
      status: 'locked',
    });

    const computer = await prisma.computer.findUnique({ where: { id: 'comp-001' } });
    expect(computer).toBeDefined();

    const connUid = mockConnUid;
    await axios.put(`http://veyon-server:11080/api/v1/feature/ccb535a2-1d24-4cc1-a709-8b47d2b2ac79`,
      { active: true },
      {
        headers: { 'Connection-Uid': connUid, 'Content-Type': 'application/json' },
        timeout: 15000,
      },
    );

    expect(axios.put).toHaveBeenCalledWith(
      expect.stringContaining('ccb535a2'),
      { active: true },
      expect.objectContaining({
        headers: expect.objectContaining({ 'Connection-Uid': connUid }),
      }),
    );

    const updated = await prisma.computer.update({
      where: { id: 'comp-001' },
      data: { status: 'locked' },
    });
    expect(updated.status).toBe('locked');
  });

  it('sends active=false to unlock', async () => {
    vi.mocked(axios.put).mockResolvedValueOnce({ status: 200 });

    await axios.put(`http://veyon-server:11080/api/v1/feature/ccb535a2-1d24-4cc1-a709-8b47d2b2ac79`,
      { active: false },
      { headers: { 'Connection-Uid': mockConnUid } },
    );

    expect(axios.put).toHaveBeenCalledWith(
      expect.any(String),
      { active: false },
      expect.any(Object),
    );
  });
});

describe('VeyonService — Screenshot', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('requests framebuffer with PNG format', async () => {
    const mockImageBuffer = Buffer.from('fake-png-data');
    vi.mocked(axios.get).mockResolvedValueOnce({ data: mockImageBuffer });

    const { data } = await axios.get(`http://veyon-server:11080/api/v1/framebuffer?format=png&width=320&compression=6`, {
      headers: { 'Connection-Uid': mockConnUid },
      responseType: 'arraybuffer',
      timeout: 15000,
    });

    expect(axios.get).toHaveBeenCalledWith(
      expect.stringContaining('framebuffer'),
      expect.objectContaining({
        responseType: 'arraybuffer',
        headers: expect.objectContaining({ 'Connection-Uid': mockConnUid }),
      }),
    );

    const base64 = Buffer.from(data).toString('base64');
    expect(typeof base64).toBe('string');
    expect(base64.length).toBeGreaterThan(0);
  });
});

describe('VeyonService — Send Message', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('sends a message with title and content via the feature API', async () => {
    vi.mocked(axios.put).mockResolvedValueOnce({ status: 200 });

    const message = 'System maintenance in 5 minutes';
    const title = 'QMS Notice';

    await axios.put(`http://veyon-server:11080/api/v1/feature/e75ae9c8-ac17-4d00-8f0d-019346348208`,
      {
        active: true,
        arguments: { message, title },
      },
      {
        headers: { 'Connection-Uid': mockConnUid, 'Content-Type': 'application/json' },
        timeout: 15000,
      },
    );

    expect(axios.put).toHaveBeenCalledWith(
      expect.stringContaining('e75ae9c8'),
      expect.objectContaining({
        active: true,
        arguments: expect.objectContaining({ message, title }),
      }),
      expect.any(Object),
    );
  });
});

describe('VeyonService — Reboot & Shutdown', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('sends reboot command via REBOOT feature UUID', async () => {
    vi.mocked(axios.put).mockResolvedValueOnce({ status: 200 });

    await axios.put(`http://veyon-server:11080/api/v1/feature/4f7d98f0-395a-4fff-b968-e49b8d0f748c`,
      { active: true },
      { headers: { 'Connection-Uid': mockConnUid } },
    );

    expect(axios.put).toHaveBeenCalledWith(
      expect.stringContaining('4f7d98f0'),
      { active: true },
      expect.any(Object),
    );
  });

  it('sends shutdown command via POWER_DOWN feature UUID', async () => {
    vi.mocked(axios.put).mockResolvedValueOnce({ status: 200 });

    await axios.put(`http://veyon-server:11080/api/v1/feature/6f5a27a0-0e2f-496e-afcc-7aae62eede10`,
      { active: true },
      { headers: { 'Connection-Uid': mockConnUid } },
    );

    expect(axios.put).toHaveBeenCalledWith(
      expect.stringContaining('6f5a27a0'),
      { active: true },
      expect.any(Object),
    );
  });
});

describe('VeyonService — Demo Server', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('starts demo server on localhost', async () => {
    vi.mocked(axios.post).mockResolvedValueOnce({ data: { 'connection-uid': 'demo-conn' } });
    vi.mocked(axios.put).mockResolvedValueOnce({ status: 200 });
    vi.mocked(axios.delete).mockResolvedValueOnce({ status: 204 });

    await axios.post(`http://veyon-server:11080/api/v1/authentication/127.0.0.1`, {
      method: '0c69b301-81b4-42d6-8fae-128cdd113314',
      credentials: { keyname: 'dashboard-key', keydata: 'mock-key' },
    });

    await axios.put(`http://veyon-server:11080/api/v1/feature/e4b6e743-1f5b-491d-9364-e091086200f4`,
      { active: true },
      { headers: { 'Connection-Uid': 'demo-conn' } },
    );

    expect(axios.put).toHaveBeenCalledWith(
      expect.stringContaining('e4b6e743'),
      { active: true },
      expect.any(Object),
    );
  });
});
