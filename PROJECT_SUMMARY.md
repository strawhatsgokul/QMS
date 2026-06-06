# Project Summary: QMS (Classroom Management Dashboard)

## 1. Project Overview

**QMS** is a unified web dashboard that integrates **Veyon** (classroom/computer lab management) and **ActivityWatch** (time & activity tracking) into a single platform. It provides real-time computer monitoring, remote control (lock/unlock/restart/shutdown), activity analytics, app usage alerts, and agent-based management for Windows machines.

| Attribute | Value |
|---|---|
| **Repository** | `github.com/strawhatsgokul/QMS.git` |
| **Branch** | `Developement` |
| **Monorepo** | npm workspaces (`apps/*`, `packages/*`) |
| **Node** | >= 18 |
| **TypeScript** | 5.4.5, strict mode |
| **Default DB** | SQLite (WAL mode); PostgreSQL optional |
| **Default Login** | `admin@qserveits.com` / `admin` |

---

## 2. System Architecture

```
Browser --> Caddy (reverse proxy :80/:443)
                |-- /api/* --> Express API (:4000)
                `-- /*     --> Next.js Web (:3000)

Express API connects to:
  |-- SQLite / PostgreSQL (Prisma ORM)
  |-- Redis (caching, optional)
  |-- Veyon WebAPI (classroom control)
  `-- ActivityWatch API (activity tracking)

QMS Agent (Windows EXE on each managed machine):
  `-- POSTs heartbeats & executes commands via Express API
```

**Data flow:**
1. Browser -> Caddy -> Next.js (UI rendering)
2. Browser API calls -> Caddy -> Express API (business logic + DB)
3. Express -> Veyon WebAPI (direct computer control when no agent)
4. Express -> QMS Agent via command queue (when agent is active)
5. Agent -> Express (heartbeat data: CPU, memory, active window, AFK status)
6. Agent -> Veyon CLI (execute lock/restart/message locally)
7. Agent -> ActivityWatch API (fetch active window, AFK status)

---

## 3. Technology Stack

| Layer | Technology |
|---|---|
| **Frontend** | Next.js 14.2 (App Router), React 18.3, TypeScript 5.4 |
| **Styling** | Tailwind CSS 3.4, Radix UI primitives, Lucide icons |
| **Charts** | Recharts 2.12 |
| **State** | Zustand 4.5 (client), TanStack Query 5 (server) |
| **Backend** | Express 4.19, TypeScript |
| **ORM** | Prisma 5.22 (SQLite default / PostgreSQL optional) |
| **Auth** | JWT (jsonwebtoken) + bcryptjs, RBAC (admin/staff/viewer) |
| **Validation** | Zod 3.23 |
| **Real-time** | Socket.IO 4.7 |
| **Caching** | Redis via ioredis |
| **Logging** | Winston 3.13 |
| **Reverse Proxy** | Caddy (auto HTTPS, WebSocket proxy) |
| **Container** | Docker + Docker Compose |
| **CI/CD** | GitHub Actions (windows-latest) |
| **Agent** | Node.js -> standalone EXE via `@yao-pkg/pkg` |

---

## 4. Directory Structure

```
QMS/
|-- apps/
|   |-- api/                     # Express backend (28 source files)
|   |   |-- src/
|   |   |   |-- config/          # app config, logger, swagger
|   |   |   |-- middleware/      # auth, CSRF, validation, error handler
|   |   |   |-- routes/          # 14 route modules
|   |   |   |-- services/        # 7 services
|   |   |   `-- utils/           # JWT/password utils, hybrid-mode
|   |   |-- prisma/
|   |   |   |-- schema.prisma    # 16 models
|   |   |   `-- seed.ts
|   |   |-- Dockerfile
|   |   `-- package.json
|   `-- web/                     # Next.js frontend (30+ source files)
|       |-- src/
|       |   |-- app/             # 9 pages + layout + error
|       |   |-- components/      # layout, dashboard, UI
|       |   |-- lib/             # API client, socket, utils
|       |   `-- store/           # Zustand stores (auth, dashboard, UI)
|       |-- next.config.js
|       |-- Dockerfile
|       `-- package.json
|-- packages/
|   |-- shared/                  # Shared types & constants
|   |   `-- src/
|   |       |-- types/           # auth, computer, activity, dashboard, api
|   |       `-- constants/       # roles, veyon-commands
|   `-- qms-agent/               # Windows agent (standalone EXE)
|       |-- src/
|       |   |-- collectors/      # system, activitywatch, veyon
|       |   |-- commands/        # veyon command executor
|       |   `-- types/
|       `-- build-exe.ps1
|-- .github/workflows/ci.yml
|-- docker-compose.yml
|-- docker/                      # PostgreSQL/Redis alternative
|-- Caddyfile
|-- deploy.sh / deploy.ps1
|-- docs/                        # 7 documentation files
|-- installer/qms-agent.wxs      # MSI installer config
`-- scripts/                     # Setup & agent scripts
```

---

## 5. Backend (API) -- `apps/api`

**14 route modules, 28 source files, 177-line entry point.**

| Route Group | Endpoints | Auth |
|---|---|---|
| `/api/auth` | login, register, refresh, me, change-password | login/register public |
| `/api/computers` | CRUD + scan (status check) | authenticate + role |
| `/api/rooms` | CRUD | authenticate + role |
| `/api/activity` | buckets, events, metrics, summary, apps, categories, import/export, instances | authenticate + role |
| `/api/veyon` | lock, unlock, restart, shutdown, wake, message, file-copy, demo, screenshot | authenticate + role |
| `/api/users` | CRUD, reset-password | admin only |
| `/api/dashboard` | stats (Redis-cached), recent-activity, system-health | authenticate |
| `/api/settings` | GET/PUT system settings | admin |
| `/api/logs` | client-error (public), file listing/viewing, service health | admin for files/health |
| `/api/audit-logs` | paginated listing, manual cleanup | admin |
| `/api/notifications` | list, mark-read, read-all, seed | authenticate |
| `/api/watch-rules` | CRUD + enable/disable | admin for mutations |
| `/api/alerts` | detections listing, mark-read, read-all | authenticate |
| `/api/health` | health check | none |

**7 services:** activitywatch (541 lines, 14 methods), veyon (227 lines, 14 methods), alertMonitor (154 lines, polling loop), auditLog, notification service, redis caching, agent service (stub).

**Middleware stack:** helmet -> cors -> CSRF check -> morgan (custom logging) -> rate limiter (100/15min) -> JSON parser -> routes

---

## 6. Frontend (Web) -- `apps/web`

**Next.js 14 App Router, 9 pages, 3 Zustand stores, TanStack Query.**

| Route | Page | Description |
|---|---|---|
| `/` | Dashboard | Stats cards, computer grid, activity summary |
| `/login` | Login | Email/password form |
| `/change-password` | Change Password | Force change on first login |
| `/computers` | Computer List | Filterable grid, batch actions, add/delete |
| `/computers/[id]` | Computer Detail | Screenshot, Veyon commands, activity timeline |
| `/analytics` | Analytics | Charts, import/export, period filtering |
| `/alerts` | Alerts & Watch Rules | Live detection feed, rule CRUD, Socket.IO push |
| `/users` | User Management | CRUD, role change, password reset (admin) |
| `/settings` | System Settings | Veyon/AW config, notification prefs (admin) |
| `/logs` | Audit Logs | Paginated listing with filters (admin) |

**State management:**
- **Zustand** stores: `useAuthStore` (persisted), `useDashboardStore`, `useUIStore`
- **TanStack Query** for server state with polling (15-60s intervals)
- **Axios** instance with automatic 401 -> token refresh -> retry

**10 UI components:** DashboardLayout, Sidebar, Header, ComputerGrid, StatCard, ActivitySummary, Button, Card, Badge, Providers

---

## 7. Shared Package -- `packages/shared`

**Zero runtime dependencies, pure TypeScript types and constants.**

| Module | Contents |
|---|---|
| `types/auth.ts` | `User`, `UserRole`, `AuthResponse`, `JWTPayload`, `Permission` |
| `types/computer.ts` | `Computer`, `ComputerStatus`, `Room`, `ComputerGroup`, `ScreenPreview`, `PowerAction` |
| `types/activity.ts` | `ProductivityMetrics`, `ActivityEvent`, `WindowEvent`, `AFKEvent`, `ApplicationUsage`, `CategorizedTime`, `HourlyActivity`, `ImportedDayData` |
| `types/dashboard.ts` | `DashboardStats`, `Alert`, `SystemHealth`, `ServiceStatus` |
| `types/api.ts` | `ApiResponse<T>`, `ApiError`, `PaginationMeta`, `WebSocketEvents` |
| `constants/roles.ts` | `ROLES`, `ROLE_PERMISSIONS` (matrix), `ROLE_LABELS` |
| `constants/veyon-commands.ts` | `VEYON_COMMANDS`, `VEYON_FEATURE_NAMES`, `VEYON_COMMAND_TIMEOUTS` |

---

## 8. QMS Agent -- `packages/qms-agent`

**Standalone Windows EXE deployed to managed machines. Built via `@yao-pkg/pkg` targeting `node24-win-x64`.**

**Agent lifecycle:**
1. **Config** -- CLI args or env vars (`--api-url`, `--agent-key`)
2. **Registration** -- collects hostname/IP/MAC/OS -> POST to `/api/v1/agent/register` -> stores JWT locally in SQLite
3. **Veyon Bootstrap** -- fetches Veyon private key & config from server -> writes to disk & registry -> restarts VeyonService
4. **Heartbeat loop** (30s) -- collects system stats, ActivityWatch status, Veyon status -> POST to `/api/v1/agent/heartbeat`
5. **Command poll loop** (5s) -- GET pending commands -> execute via Veyon CLI or shell -> POST results back
6. **Watchdog loop** (30s) -- checks VeyonService & activitywatch services -> restarts if down
7. **Offline resilience** -- commands queued locally in SQLite when server unreachable

**Supported commands:** LOCK, UNLOCK, REBOOT, SHUTDOWN, MESSAGE, SCREENSHOT, SETUP_VEYON

**Collectors:**
- **system.ts** -- CPU load, memory, top 10 processes via `systeminformation`
- **activitywatch.ts** -- active window & AFK status from AW API
- **veyon.ts** -- Veyon WebAPI health check

---

## 9. Database Schema -- 16 Prisma Models

| Model | Table | Key Fields | Relations |
|---|---|---|---|
| **User** | `users` | id, email, passwordHash, name, role, mustChangePassword | -> AuditLog, Notification |
| **Computer** | `computers` | hostname, ipAddress, macAddress, roomId, status, currentUser | -> Room, ComputerGroupMember |
| **Room** | `rooms` | name, description, location | -> Computer[] |
| **ComputerGroup** | `computer_groups` | name, description | -> ComputerGroupMember |
| **ComputerGroupMember** | `computer_group_members` | computerId, groupId | -> Computer, Group |
| **AuditLog** | `audit_logs` | userId, action, resource, details (JSON) | -> User |
| **Notification** | `notifications` | userId, type, title, message, read | -> User |
| **WatchRule** | `watch_rules` | name, pattern, category, severity, isActive | -> AlertDetection |
| **AlertDetection** | `alert_detections` | ruleId, appName, hostname, matchedPattern, severity | -> WatchRule |
| **ActivityWatchInstance** | `activitywatch_instances` | name, hostname, apiUrl, apiKey, isActive | -- |
| **CategoryRule** | `category_rules` | pattern, category, type, priority | -- |
| **SystemSetting** | `system_settings` | key (unique), value | -- |
| **ImportedActivityData** | `imported_activity_data` | date, totalActive, apps, hourlyData, categories (JSON) | -- |
| **Agent** | `agents` | hostname, ipAddress, status, lastHeartbeatAt | -> AgentHeartbeat |
| **AgentHeartbeat** | `agent_heartbeats` | cpuUsage, memoryUsage, activeWindow, timestamp | -> Agent |
| **AgentCommand** | `agent_commands` | type, params, status, result, errorMessage | -> Agent |

---

## 10. Authentication & Authorization

**JWT-based with RBAC (3 roles):**

| Role | Permissions |
|---|---|
| **admin** | Full access -- manage users, settings, audit logs, all Veyon actions |
| **staff** | Classroom operations -- lock/unlock/restart/message computers, view activity |
| **viewer** | Read-only -- dashboard, computers list, analytics, alerts |

**Auth flow:**
1. Login -> `POST /api/auth/login` -> returns `{ accessToken, refreshToken, user }`
2. Access token in `Authorization: Bearer` header for all authenticated requests
3. Token expiry: 24h (access), 7d (refresh)
4. 401 -> Axios interceptor automatically attempts `POST /api/auth/refresh`
5. `mustChangePassword` flag forces redirect to `/change-password` on first login

---

## 11. CI/CD Pipeline

**GitHub Actions** (single workflow):

| Trigger | Branch |
|---|---|
| `push` | `Developement` |
| `pull_request` | `main` |

**Steps:**
1. Checkout + Node 18 setup with npm cache
2. `npm install`
3. `npx prisma generate`
4. `npm run typecheck`
5. Build agent EXE (`pwsh -File build-exe.ps1`)
6. Upload `qms-agent.exe` as artifact (7-day retention)

**Notable gaps:** No test execution, no lint step, no Docker image build/push, no release automation.

---

## 12. Docker & Deployment

**Two Docker topologies:**

| Setup | Root (`docker-compose.yml`) | `docker/docker-compose.yml` |
|---|---|---|
| **DB** | SQLite (file-based) | PostgreSQL 16 |
| **Cache** | None | Redis 7 |
| **Proxy** | Caddy (auto HTTPS) | Caddy |
| **Config** | `.env` file | `.env` file |
| **Services** | api, web, reverse-proxy | api, web, postgres, redis |

**Deployment scripts:**
- `deploy.sh` -- Linux (Bash, 125 lines)
- `deploy.ps1` -- Windows (PowerShell, 133 lines)

Both scripts: check Docker -> create `./data/` -> generate `.env` with secure `JWT_SECRET` -> `npm install` -> `docker compose up -d --build` -> health check.

---

## 13. Documentation (7 files, ~2,800 lines total)

| Document | Lines | Completeness |
|---|---|---|
| **README.md** | 677 | Excellent -- full project guide |
| **PROJECT_STATUS.md** | 270 | Good -- integration details |
| **docs/DEPLOYMENT_GUIDE.md** | 698 | Excellent -- production-ready Linux guide |
| **docs/DEPLOYMENT_GUIDE_WINDOWS.md** | 982 | Excellent -- comprehensive Windows guide |
| **docs/API.md** | 128 | Poor -- only covers core endpoints |
| **docs/ARCHITECTURE.md** | 93 | Fair -- inconsistent with README |
| **KNOWN_ISSUES.md** | 11 | Poor -- missing 7+ documented issues |

---

## 14. Known Issues

1. **Veyon CLI requires admin** -- Agent writes directly to registry (bypasses CLI)
2. **Screenshot 503 error** -- 1.5s delay before framebuffer fetch
3. **ESLint v9 incompatibility** -- `lint:web` excluded; uses `typecheck` instead
4. **Server can't control localhost** -- Install agent on server
5. **`pkg` hangs locally** -- Use GitHub Actions artifact

---

## 15. Recommendations

**Critical:**
1. **`agentService.enqueueCommand` is a stub** -- validates agent existence but never writes to `AgentCommand` queue. Agent dispatch silently no-ops.

**High priority:**
2. **Prisma datasource mismatch** -- schema uses `sqlite` but config defaults to `postgresql` URL
3. **`ComputerGroup` model has no routes** -- schema defines it but no API to manage groups
4. **Dashboard `/system-health` returns hardcoded "healthy"** -- doesn't check actual services
5. **Missing agent scripts** -- `install-agent.ps1`, `uninstall-agent.ps1`, `mock-agent.ps1` referenced but don't exist
6. **`KNOWN_ISSUES.md` incomplete** -- only documents 5 of ~12 known issues

**Medium priority:**
7. In-memory dedup in AlertMonitor (lost on restart)
8. Redis `KEYS` command in `invalidateCache` (blocking in production)
9. No pagination on computer list endpoint
10. Weak default JWT secret falls back to "dev-secret"

**Low priority:**
11. `docs/API.md` missing 15+ endpoint groups
12. Architecture doc contradicts README on DB choice
13. Two parallel Docker setups create confusion
14. CI lacks tests, lint, Docker build steps
