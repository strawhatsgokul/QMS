# QMS Dashboard

**Unified web dashboard integrating Veyon classroom management and ActivityWatch time tracking** with real-time monitoring, productivity analytics, role-based access control, and per-machine agent deployment.

---

## Table of Contents

- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [Environment Configuration](#environment-configuration)
- [Docker Deployment](#docker-deployment)
- [Manually Deploying to a Server](#manually-deploying-to-a-server)
- [API Endpoints](#api-endpoints)
- [Web Pages](#web-pages)
- [QMS Agent](#qms-agent)
- [Authentication & Authorization](#authentication--authorization)
- [Database](#database)
- [Real-Time Events (Socket.IO)](#real-time-events-socketio)
- [CI/CD](#cicd)
- [Scripts Reference](#scripts-reference)
- [Known Issues](#known-issues)

---

## Architecture

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   Browser    │────▶│    Caddy     │────▶│  Next.js 14  │
│  (React SPA) │     │  Reverse     │     │  (Server SSR)│
└──────────────┘     │  Proxy       │     └──────┬───────┘
                     │  :80 / :443  │            │
                     └──────┬───────┘            │ rewrites /api/*
                            │                    ▼
                            │            ┌──────────────┐
                            ├───────────▶│   Express    │
                            │            │   API :4000  │
                            │            └──────┬───────┘
                            │                    │
                            ▼                    ▼
                     ┌──────────────┐     ┌──────────────┐
                     │  Machine     │     │   SQLite /   │
                     │  Agent       │     │  PostgreSQL  │
                     │  (Windows)   │     │              │
                     └──────────────┘     └──────────────┘
```

**Request flow:**

1. Browser → `https://dashboard.example.com/`
2. Caddy matches non-API routes → proxies to **Next.js** (`web:3000`)
3. Browser → `https://dashboard.example.com/api/...`
4. Caddy matches `/api/*` → proxies directly to **Express API** (`api:4000`)
5. Next.js **server-side** API calls → internal rewrite to `http://api:4000/api/*`
6. **Socket.IO** connections → Caddy upgrades WebSocket → proxies to `web:3000` (Next.js forwards to API)

### Production Deployment (Docker)

```
┌─────────────────────────────────────────────────────────┐
│  docker compose up -d --build                            │
│                                                         │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────┐ │
│  │  reverse-     │  │    web       │  │     api       │ │
│  │  proxy        │  │  :3000       │  │   :4000       │ │
│  │  (caddy:alpine)│  │  Next.js    │  │  Express API  │ │
│  │  :80 / :443   │  │  Standalone  │  │  + Socket.IO  │ │
│  └──────────────┘  └──────────────┘  └───────┬───────┘ │
│                                               │         │
│                                        ┌──────▼──────┐  │
│                                        │  ./data/    │  │
│                                        │  qms.db     │  │
│                                        │  (SQLite)   │  │
│                                        └─────────────┘  │
└─────────────────────────────────────────────────────────┘
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | Next.js 14 (App Router), React 18, TypeScript, Tailwind CSS |
| **State** | Zustand (persisted), TanStack Query (server state) |
| **Charts** | Recharts |
| **Backend** | Express 4, TypeScript, Socket.IO |
| **ORM** | Prisma (SQLite dev / PostgreSQL prod) |
| **Auth** | JWT (access + refresh tokens), bcrypt, Zod validation |
| **Security** | Helmet, CORS, Rate Limiting, RBAC, CSRF (Origin/Referer) |
| **Logging** | Winston (console + file rotation) |
| **Reverse Proxy** | Caddy (auto HTTPS via Let's Encrypt) |
| **Containerization** | Docker, Docker Compose |
| **Agent Runtime** | Node.js standalone EXE (via `@yao-pkg/pkg`) |
| **Agent Installer** | MSI (WiX Toolset v3.11) |
| **CI** | GitHub Actions |
| **Database** | SQLite (dev/local), PostgreSQL (production) |

---

## Project Structure

```
veyon-activitywatch-dashboard/
├── package.json                  # Root monorepo config (npm workspaces)
├── tsconfig.base.json            # Shared TS config
├── .env.example                  # Environment variable template
├── .prettierrc                   # Code formatting
├── .gitignore
│
├── apps/
│   ├── api/                      # Express API server
│   │   ├── Dockerfile
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── prisma/
│   │   │   ├── schema.prisma     # Database schema (16 models)
│   │   │   └── seed.ts           # Default data seeder
│   │   └── src/
│   │       ├── index.ts          # Entry: Express + Socket.IO + cron
│   │       ├── config/           # App config, logger, swagger
│   │       ├── middleware/        # auth, errorHandler, validate, csrf
│   │       ├── routes/           # auth, users, computers, rooms, activity,
│   │       │                     # veyon, dashboard, settings, logs,
│   │       │                     # audit-logs, notifications, watch-rules,
│   │       │                     # alerts, agent
│   │       ├── services/         # activitywatch, veyon, agent, alertMonitor,
│   │       │                     # auditLog, notification, redis
│   │       └── utils/            # auth helpers, hybrid-mode
│   │
│   └── web/                      # Next.js frontend
│       ├── Dockerfile
│       ├── package.json
│       ├── next.config.js        # Standalone output, API rewrites
│       ├── tailwind.config.ts    # Custom theme (primary/surface colors)
│       └── src/
│           ├── app/              # App Router pages
│           │   ├── layout.tsx
│           │   ├── page.tsx              # Dashboard (stats, computers grid)
│           │   ├── login/page.tsx
│           │   ├── change-password/page.tsx
│           │   ├── computers/page.tsx     # List + grid
│           │   ├── computers/[id]/page.tsx# Detail with actions
│           │   ├── analytics/page.tsx     # Charts, import/export
│           │   ├── alerts/page.tsx        # Watch rules + detections
│           │   ├── logs/page.tsx          # Audit + error + API logs
│           │   ├── settings/page.tsx      # System settings (admin)
│           │   ├── users/page.tsx         # User management (admin)
│           │   └── error.tsx
│           ├── components/
│           │   ├── layout/       # DashboardLayout, Sidebar, Header, Providers
│           │   ├── dashboard/    # StatCard, ComputerGrid, ActivitySummary
│           │   └── ui/           # Button, Card, Badge
│           ├── store/            # auth, dashboard, ui (Zustand)
│           ├── lib/              # api (axios), socket (Socket.IO), utils
│           └── public/           # manifest.json, sw.js (PWA)
│
├── packages/
│   ├── shared/                   # @veyon-aw/shared — types + constants
│   │   └── src/
│   │       ├── types/            # auth, api, computer, dashboard, activity
│   │       └── constants/        # roles, veyon-commands
│   │
│   └── qms-agent/                # Windows machine agent
│       ├── package.json
│       ├── build-exe.ps1         # Build standalone EXE
│       └── src/
│           ├── index.ts          # Main loop: register → heartbeat → commands
│           ├── config.ts         # CLI args + env config
│           ├── logger.ts         # Winston (console + file rotation)
│           ├── transport.ts      # Axios HTTP client with retry
│           ├── registration.ts   # Server registration flow
│           ├── heartbeat.ts      # System stats collector
│           ├── command-executor.ts # Command polling + execution
│           ├── queue.ts          # SQLite-backed local command queue
│           ├── watchdog.ts       # Service health monitor (30s)
│           ├── bootstrap-veyon.ts# Veyon auto-configuration
│           ├── collectors/       # system, activitywatch, veyon
│           └── commands/         # veyon command implementations
│
├── docker/
│   ├── docker-compose.yml        # Full stack (PostgreSQL + Redis variant)
│   ├── api.Dockerfile            # API (node:20-alpine, multi-stage)
│   └── web.Dockerfile            # Web (node:20-alpine, multi-stage)
│
├── docker-compose.yml            # Primary stack (SQLite + Caddy)
├── Caddyfile                     # Reverse proxy configuration
├── deploy.sh                     # Linux deployment script
├── deploy.ps1                    # Windows deployment script
│
├── installer/
│   └── qms-agent.wxs             # WiX MSI installer source
│
├── scripts/
│   ├── setup.ps1                 # Initial project setup
│   ├── install-agent.ps1         # Agent deployment script
│   ├── uninstall-agent.ps1       # Agent removal script
│   ├── mock-agent.ps1            # Agent simulator (dev/testing)
│   └── build-msi.ps1             # MSI build script
│
├── .github/workflows/
│   └── ci.yml                    # GitHub Actions CI pipeline
│
└── docs/
    ├── API.md                    # Full API documentation
    └── ARCHITECTURE.md           # System architecture details
```

---

## Getting Started

### Prerequisites

- **Node.js** >= 18
- **npm** >= 9
- **Docker** & **Docker Compose** (for containerized deployment)

### Quick Start (Development)

```bash
# 1. Install dependencies and build shared package
npm install

# 2. Set up database (SQLite)
npm run db:push     # Push schema to SQLite
npm run db:seed     # Seed default data

# 3. Start both servers concurrently
npm run dev
# API  → http://localhost:4000
# Web  → http://localhost:3000
```

**Default login credentials:**
- Email: `admin@qserveits.com`
- Password: `admin`
- You will be prompted to change your password on first login.

### Development Commands

```bash
npm run dev          # Start API + Web concurrently
npm run dev:api      # API only
npm run dev:web      # Web only
npm run build        # Build shared + API + Web
npm run lint         # Lint all packages
npm run typecheck    # TypeScript check all packages
npm run test         # Run all tests
npm run format       # Format code with Prettier
```

---

## Environment Configuration

Copy `.env.example` to `.env` and adjust:

```env
JWT_SECRET=change_this_to_a_secure_random_string
DATABASE_URL=file:./data/qms.db?connection_limit=10&journal_mode=WAL
NODE_ENV=production
```

The Docker deployment script (`deploy.sh`/`deploy.ps1`) generates `.env` automatically with a cryptographically random `JWT_SECRET`.

**Additional environment variables** (optional, see `apps/api/src/config/index.ts`):
- `PORT` — API server port (default: `4000`)
- `CORS_ORIGIN` — Allowed CORS origins (default: `http://localhost:3000`)
- `REDIS_URL` — Redis connection string (optional, for caching)
- `VEYON_API_URL` — Veyon WebAPI base URL
- `ACTIVITYWATCH_API_URL` — ActivityWatch API base URL
- `ENCRYPTION_KEY` — Key for encrypting sensitive data

---

## Docker Deployment

### Single-command deploy (recommended)

```bash
# Linux
chmod +x deploy.sh && ./deploy.sh

# Windows PowerShell
.\deploy.ps1
```

The script handles:
1. **Check** Docker and Docker Compose are installed
2. **Create** `./data/` directory for persistent SQLite storage
3. **Generate** `.env` with random `JWT_SECRET` (if not exists)
4. **Install** npm dependencies (ensures `package-lock.json` for Docker)
5. **Build & Start** containers: `docker compose up -d --build`
6. **Health check** via `http://localhost/api/health`
7. **Output** access URLs (localhost + detected server IP)

### Manual Docker

```bash
# Build and start
docker compose up -d --build

# View logs
docker compose logs -f

# Stop
docker compose down

# Full cleanup (removes volumes)
docker compose down -v
```

### Services

| Service | Port (host) | Port (container) | Description |
|---|---|---|---|
| `reverse-proxy` | `80`, `443` | `80`, `443` | Caddy — TLS termination, routing |
| `web` | `127.0.0.1:3000` | `3000` | Next.js (standalone) |
| `api` | `127.0.0.1:4000` | `4000` | Express API + Socket.IO |

---

## Manually Deploying to a Server

```bash
# 1. Clone and enter project
git clone <repo-url> && cd veyon-activitywatch-dashboard

# 2. Create .env with a secure JWT_SECRET
openssl rand -base64 48 | tr -d '\n' > .env

# 3. Build and start
docker compose up -d --build

# 4. Verify health
curl -s http://localhost/api/health
```

---

## API Endpoints

All endpoints are prefixed with `/api`. Full documentation available at `/api/docs` (Swagger UI) when the server is running.

### Authentication

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/auth/login` | — | Login with email + password |
| POST | `/auth/register` | — | Register new user |
| POST | `/auth/refresh` | — | Refresh access token |
| POST | `/auth/change-password` | JWT | Change password (first-login flow) |
| GET | `/auth/me` | JWT | Get current user profile |

### Users (admin only)

| Method | Path | Description |
|---|---|---|
| GET | `/users` | List all users |
| GET | `/users/:id` | Get user by ID |
| POST | `/users` | Create user |
| PATCH | `/users/:id` | Update user |
| DELETE | `/users/:id` | Delete user |
| POST | `/users/:id/reset-password` | Reset user password |
| POST | `/users/:id/toggle-active` | Toggle user active status |
| POST | `/users/:id/reset-must-change-password` | Clear change-password flag |

### Computers

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/computers` | JWT | List all computers |
| GET | `/computers/:id` | JWT | Get computer details |
| POST | `/computers` | JWT | Create computer |
| PATCH | `/computers/:id` | JWT | Update computer |
| DELETE | `/computers/:id` | JWT | Delete computer |

### Veyon Actions (staff+)

| Method | Path | Description |
|---|---|---|
| POST | `/veyon/lock` | Lock computer screen |
| POST | `/veyon/unlock` | Unlock computer screen |
| POST | `/veyon/restart` | Restart computer |
| POST | `/veyon/shutdown` | Shutdown computer |
| POST | `/veyon/message` | Send message to computer |
| POST | `/veyon/screenshot` | Take screenshot |
| POST | `/veyon/execute` | Execute command |
| POST | `/veyon/filetransfer` | Transfer file |

### Activity & Analytics

| Method | Path | Description |
|---|---|---|
| GET | `/activity/buckets` | List ActivityWatch buckets |
| GET | `/activity/events` | Get bucket events |
| GET | `/activity/metrics` | Productivity metrics |
| POST | `/activity/import` | Import CSV data |
| GET | `/activity/export` | Export activity data |

### Dashboard

| Method | Path | Description |
|---|---|---|
| GET | `/dashboard/stats` | Dashboard statistics |
| GET | `/dashboard/system-health` | System health status |

### Logs & Audit

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/logs/list` | admin | List log files |
| GET | `/logs/view` | admin | View log file content |
| GET | `/logs/download` | admin | Download log file |
| POST | `/logs/client-error` | — | Report client-side error |
| GET | `/audit-logs` | admin | Paginated audit log query |

### Watch Rules & Alerts

| Method | Path | Description |
|---|---|---|
| CRUD | `/watch-rules` | Manage watch rules |
| GET | `/alerts/detections` | List alert detections |
| POST | `/alerts/mark-read/:id` | Mark alert as read |
| POST | `/alerts/mark-all-read` | Mark all alerts as read |

### Agent

| Method | Path | Description |
|---|---|---|
| POST | `/v1/agent/register` | Agent registration |
| POST | `/v1/agent/heartbeat` | Agent heartbeat |
| GET | `/v1/agent/commands` | Get pending commands |
| POST | `/v1/agent/commands/:id/result` | Report command result |

### System

| Method | Path | Description |
|---|---|---|
| GET | `/settings` | Get all settings |
| PATCH | `/settings` | Update settings |
| GET | `/health` | Health check |
| GET | `/rooms` | List rooms |

---

## Web Pages

| Route | Page | Auth | Description |
|---|---|---|---|
| `/login` | Login | — | Email/password login form |
| `/change-password` | Change Password | JWT | Force password change on first login |
| `/` | Dashboard | JWT | Stats cards, computer grid, activity summary |
| `/computers` | Computers | JWT | Computer list with search/filter, actions |
| `/computers/:id` | Computer Detail | JWT | Status, activity timeline, Veyon controls |
| `/analytics` | Analytics | JWT | Charts (productivity, categories, hourly), import/export |
| `/alerts` | Alerts | JWT | Watch rules CRUD, alert detections |
| `/logs` | Logs | JWT | Audit log, error logs, API logs, system health |
| `/settings` | Settings | admin | System configuration form |
| `/users` | Users | admin | User management (CRUD, reset password) |

---

## QMS Agent

The **QMS Agent** is a Windows service that runs on managed machines, providing real-time system monitoring and remote command execution.

### Architecture

```
┌──────────────────────────┐
│      QMS Agent           │
│  (Windows Service)       │
│                          │
│  ┌────────────────────┐  │     HTTP/HTTPS      ┌──────────────────┐
│  │ Heartbeat Loop     │──┼────────────────────▶│  API Server      │
│  │ (every 30s)        │  │                     │  :4000           │
│  └────────────────────┘  │                     └──────────────────┘
│  ┌────────────────────┐  │     HTTP Poll
│  │ Command Poll Loop  │──┼────────────────────▶│
│  │ (every 5s)         │  │                     │
│  └────────────────────┘  │                     │
│  ┌────────────────────┐  │     HTTP Report
│  │ Execute & Report   │──┼────────────────────▶│
│  └────────────────────┘  │                     │
│  ┌────────────────────┐  │
│  │ Watchdog Loop      │  │     Local Windows
│  │ (every 30s)        │──┼────────────────────▶│ sc start/query
│  └────────────────────┘  │                     │
│  ┌────────────────────┐  │
│  │ Local SQLite Queue │  │  (offline fallback)
│  └────────────────────┘  │
└──────────────────────────┘
```

### Agent Setup

```bash
# Register a new agent key on the server (admin API)
POST /api/v1/agent/register

# On each target machine:
.\scripts\install-agent.ps1 -ApiUrl "http://server:4000" -AgentKey "<key>"

# Or via MSI installer:
.\installer\qms-agent.msi API_URL=http://server:4000 AGENT_KEY=<key>
```

### Agent Build

```powershell
# Build standalone EXE
.\packages\qms-agent\build-exe.ps1

# Build MSI installer
.\scripts\build-msi.ps1
```

---

## Authentication & Authorization

### JWT Flow

```
┌────────┐          ┌──────────┐          ┌──────────┐
│ Client │          │  API     │          │  Agent   │
└───┬────┘          └────┬─────┘          └────┬─────┘
    │                    │                     │
    │── POST /auth/login─▶                     │
    │◀─ accessToken +    │                     │
    │   refreshToken     │                     │
    │── GET /users ──────▶ (Bearer token)      │
    │◀─ 200 OK ──────────┤                     │
    │                    │                     │
    │── POST /register ──▶ (Agent key + host)  │
    │  (agent)           │◀────────────────────│
    │◀─ agentToken ──────┤                     │
    │── POST /heartbeat ─▶                     │
    │  (agentToken)      │                     │
    └────────────────────┘                     │
```

### RBAC Roles

| Role | Permissions |
|---|---|
| **admin** | Full access — manage users, settings, logs, all Veyon actions |
| **staff** | Computer operations (lock, unlock, restart, shutdown, message) |
| **viewer** | Read-only — dashboard, analytics, alerts |

### Agent Authentication

Agents authenticate using a separate JWT flow:
1. Register with `agentKey` → receive `agentToken` with `type: 'agent'` claim
2. All subsequent requests (heartbeat, commands) use `agentToken`
3. Token is stored locally in SQLite queue for persistence across restarts

---

## Database

### Schema (16 models)

| Model | Description |
|---|---|
| `User` | System users with roles and auth fields |
| `Computer` | Managed machines with status, room assignment |
| `Room` | Computer grouping/location |
| `ComputerGroup` | Logical computer groups |
| `ComputerGroupMember` | Computer ↔ Group pivot |
| `AuditLog` | Security and activity audit trail |
| `Notification` | User notifications |
| `SystemSetting` | Key-value configuration store |
| `ActivityWatchInstance` | AW API connections |
| `WatchRule` | Pattern-based activity monitoring rules |
| `AlertDetection` | Matched watch rule incidents |
| `CategoryRule` | App categorization rules |
| `ImportedActivityData` | Imported CSV activity records |
| `Agent` | Registered machine agents |
| `AgentHeartbeat` | Agent health telemetry |
| `AgentCommand` | Pending/completed agent commands |

### Database Commands

```bash
npm run db:push        # Push schema (SQLite dev)
npm run db:migrate     # Run migrations (PostgreSQL)
npm run db:seed        # Seed default data
npm run db:generate    # Regenerate Prisma client
```

**SQLite** is the default for development and local Docker deployments. **PostgreSQL** is supported via migration for production deployments (see `docker/docker-compose.yml`).

---

## Real-Time Events (Socket.IO)

The server emits events on the default `/` namespace:

| Event | Payload | Description |
|---|---|---|
| `computer:status` | `{ id, hostname, status, ... }` | Computer status change |
| `alert:new` | `{ title, message, severity, ... }` | Watch rule matched |
| `system:health` | `{ cpu, memory, uptime, ... }` | System health update |

Clients subscribe via:

```ts
import { getSocket } from '@/lib/socket';

const socket = getSocket();
socket.emit('subscribe:computer', 'comp-123');
socket.emit('subscribe:room', 'room-456');

socket.on('computer:status', (data) => {
  console.log('Status update:', data);
});
```

---

## CI/CD

GitHub Actions workflow (`.github/workflows/ci.yml`):

```yaml
on: push to Developement branch
steps:
  - Checkout
  - Setup Node 18
  - npm install
  - npm run typecheck
  - Build agent EXE (build-exe.ps1)
  - Upload as GitHub artifact (7-day retention)
```

---

## Scripts Reference

| Script | Description |
|---|---|
| `npm run dev` | Start API + Web concurrently |
| `npm run build` | Build shared + API + Web |
| `npm run lint` | Lint all packages |
| `npm run typecheck` | TypeScript check all packages |
| `npm run test` | Run all tests |
| `npm run format` | Format code with Prettier |
| `npm run db:push` | Push Prisma schema to SQLite |
| `npm run db:seed` | Seed default data |
| `. deploy.sh` | One-command Docker deployment (Linux) |
| `.\deploy.ps1` | One-command Docker deployment (Windows) |
| `.\scripts\setup.ps1` | Initial project setup (Windows) |
| `.\scripts\install-agent.ps1` | Deploy agent to target machine |
| `.\scripts\uninstall-agent.ps1` | Remove agent from target machine |
| `.\scripts\mock-agent.ps1` | Run simulated agent (dev/testing) |
| `.\scripts\build-msi.ps1` | Build MSI installer |
| `.\packages\qms-agent\build-exe.ps1` | Build standalone agent EXE |

---

## Known Issues

See `KNOWN_ISSUES.md` for a detailed list. Key items:

1. **Veyon 403 Forbidden** — WebAPI returns 403 after VeyonService restart; retry with 2s delay resolves it.
2. **Screenshot on large displays** — VNC-based capture may fail on 4K+ monitors; use demo server mode as fallback.
3. **ActivityWatch connection refused** — AW proxy may not start automatically; restart the service.
4. **ActivityWatch polling errors** — Non-existent buckets log warnings but are non-fatal.
5. **Screenshot timeout** — Default 30s may not be enough for slow connections; increase via config.
6. **Optional Redis** — When Redis is unavailable, the cache layer degrades gracefully (no impact on functionality).
7. **Screenshot on high-DPI screens** — May produce partial captures; closing VeyonController before capture improves reliability.
