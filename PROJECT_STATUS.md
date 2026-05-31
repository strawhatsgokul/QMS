# QMS Dashboard — Project Status & Summary

## Overview

**QMS Dashboard** is a unified web application that integrates **Veyon** (classroom management) and **ActivityWatch** (time tracking) into a single real-time monitoring dashboard with productivity analytics and role-based access control (RBAC).

---

## Technology Stack

| Layer | Technology |
|-------|-----------|
| **Monorepo** | npm workspaces (`apps/*`, `packages/*`) |
| **Frontend** | Next.js 14 (App Router), React 18, Tailwind CSS, Recharts, Zustand, TanStack Query, Socket.IO Client |
| **Backend** | Express 4, TypeScript, Prisma ORM, Socket.IO, Winston Logger |
| **Database** | SQLite (dev) / PostgreSQL (prod) |
| **Auth** | JWT (access + refresh tokens), bcrypt password hashing |
| **Validation** | Zod schemas |
| **Security** | Helmet, CORS, Rate Limiting, RBAC middleware |
| **Containerization** | Docker (docker-compose, multi-stage builds) |

---

## Project Structure

```
veyon-activitywatch-dashboard/
├── apps/
│   ├── api/             # Express REST API + Socket.IO server
│   │   ├── prisma/      # Schema, migrations, seed
│   │   ├── src/
│   │   │   ├── config/      # Env config, Winston logger
│   │   │   ├── middleware/  # auth, errorHandler, validate
│   │   │   ├── routes/      # auth, computers, rooms, activity,
│   │   │   │                #   veyon, users, dashboard
│   │   │   ├── services/    # veyon, activitywatch
│   │   │   ├── utils/       # auth (JWT, bcrypt)
│   │   │   └── index.ts     # Entry point
│   │   └── .env
│   └── web/             # Next.js 14 frontend
│       └── src/
│           ├── app/         # Pages: /, /computers, /analytics,
│           │                #   /login, /settings, /users
│           ├── components/  # Dashboard, computers, layout, UI
│           ├── hooks/       # Custom React hooks
│           ├── lib/         # API client, socket, utils
│           ├── store/       # Zustand stores
│           └── types/       # Frontend type extensions
├── packages/
│   ├── shared/          # Shared types (computer, activity, auth, dashboard, api)
│   │   └── src/constants/ # Veyon command constants, role constants
│   └── config/          # Shared ESLint/TypeScript config
├── docker/
│   ├── docker-compose.yml
│   ├── api.Dockerfile
│   └── web.Dockerfile
└── package.json         # Workspace root
```

---

## Database Schema (Prisma + SQLite/PostgreSQL)

| Model | Purpose |
|-------|---------|
| **User** | Auth + RBAC (admin, teacher, viewer roles) |
| **Computer** | Machines with hostname, IP, MAC, room, status, Veyon info |
| **Room** | Grouping computers by classroom/lab |
| **ComputerGroup** | Custom grouping (M:N with computers) |
| **AuditLog** | User action audit trail |
| **Notification** | User-facing alerts |
| **ActivityWatchInstance** | Remote AW instance connections |
| **CategoryRule** | App categorization rules (pattern → category) |
| **SystemSetting** | Key-value settings |

### Seed Data
- 2 users: `admin@qms.local` / `admin123`, `teacher@qms.local` / `teacher123`
- 2 rooms: Lab A, Lab B
- 9 computers (8 seeded + 1 localhost `127.0.0.1`)
- 16 category rules (development, browsing, communication, etc.)
- 5 system settings

---

## API Endpoints

### Authentication (`/api/auth`)
| Method | Path | Access |
|--------|------|--------|
| POST | `/login` | Public |
| POST | `/register` | Public |
| POST | `/refresh` | Public (refresh token) |
| GET | `/me` | Authenticated |

### Computers (`/api/computers`)
| Method | Path | Access |
|--------|------|--------|
| GET | `/` | Authenticated (query: roomId, status, search) |
| GET | `/:id` | Authenticated |
| POST | `/` | Admin, Teacher |
| PATCH | `/:id` | Admin, Teacher |
| DELETE | `/:id` | Admin |
| POST | `/:id/scan` | Admin, Teacher (Veyon status check) |

### Rooms (`/api/rooms`)
| Method | Path | Access |
|--------|------|--------|
| GET | `/` | Authenticated |
| GET | `/:id` | Authenticated |
| POST | `/` | Admin |
| PATCH | `/:id` | Admin |
| DELETE | `/:id` | Admin |

### Veyon Classroom Management (`/api/veyon`)
| Method | Path | Access |
|--------|------|--------|
| POST | `/screen/lock` | Admin, Teacher |
| POST | `/screen/unlock` | Admin, Teacher |
| GET | `/screen/:computerId` | Admin, Teacher (screenshot) |
| POST | `/power/restart` | Admin, Teacher |
| POST | `/power/shutdown` | Admin, Teacher |
| POST | `/power/wake` | Admin |
| POST | `/message` | Admin, Teacher |
| POST | `/file/copy` | Admin, Teacher |
| POST | `/demo/start` | Admin, Teacher |
| POST | `/demo/stop` | Admin, Teacher |

### ActivityWatch (`/api/activity`)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/buckets` | List AW buckets |
| GET | `/events` | Time range events |
| GET | `/metrics` | Productivity metrics |
| GET | `/summary` | Daily activity summary |
| GET | `/applications` | Top applications |
| GET | `/categories` | Category breakdown |
| GET | `/instances` | AW instances |
| POST | `/export` | Export data |

### Dashboard (`/api/dashboard`)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/stats` | Combined stats (computers + activity) |
| GET | `/recent-activity` | Today's activity summary |
| GET | `/system-health` | Service health check |

### Users (`/api/users`)
| Method | Path | Access |
|--------|------|--------|
| GET | `/` | Admin |
| GET | `/:id` | Admin |
| PATCH | `/:id` | Admin |
| DELETE | `/:id` | Admin |

---

## Frontend Pages

| Route | Page | Features |
|-------|------|----------|
| `/` | **Dashboard** | Stat cards (online computers, active users, activity, alerts), computer grid with status indicators, activity summary |
| `/computers` | **Computer List** | Grid view with search/filter, status icons |
| `/computers/[id]` | **Computer Detail** | Full info, screen preview (screenshot), lock/unlock controls |
| `/analytics` | **Analytics** | Recharts: hourly breakdown, top apps, category pie chart, productivity metrics |
| `/login` | **Login** | JWT-based auth form |
| `/users` | **User Management** | Admin-only: list, edit roles, disable accounts |
| `/settings` | **Settings** | System configuration |

### Key UI Components
- `DashboardLayout` — Sidebar nav, top bar, responsive layout
- `ComputerGrid` — Status-colored computer cards
- `ActivitySummary` — Today's active vs AFK time
- Socket.IO real-time status updates

---

## External Integrations

### Veyon (Classroom Management) — ✅ Fully Working
- **Version**: 4.10.3 (Windows)
- **Integration**: REST WebAPI (`http://localhost:11080/api/v1`)
- **Auth**: KeyFileAuthentication with 4096-bit RSA key pair
- **Feature UUIDs**:
  - Screen Lock: `ccb535a2-1d24-4cc1-a709-8b47d2b2ac79`
  - Screenshot: `d5ee3aac-2a87-4d05-b827-0c20344490bd`
  - Reboot: `4f7d98f0-395a-4fff-b968-e49b8d0f748c`
  - Power Down: `6f5a27a0-0e2f-496e-afcc-7aae62eede10`
  - Text Message: `e75ae9c8-ac17-4d00-8f0d-019346348208`
  - Demo Server: `e4b6e743-1f5b-491d-9364-e091086200f4`
- **VNC Server**: BuiltinUltraVncServer enabled (UUID: `39d7a07f-94db-4912-aa1a-c4df8aee3879`)
- **Service**: Windows Service (`VeyonService`) on ports 11100/11200/11300/11080
- **Verified Operations**: Lock, Unlock, Screenshot (20KB+ PNG), Text Message

### ActivityWatch (Time Tracking) — ✅ Fully Working
- **Version**: 0.13.2 (Windows)
- **Endpoint**: `http://localhost:5600/api`
- **Watchers**: `aw-watcher-window` + `aw-watcher-afk` active
- **Data Flow**: Buckets → Events → Productivity Metrics (categorized by 16 rules)
- **Metrics**: Active/AFK time, top 20 applications, hourly breakdown, focus time, category splits

---

## Current Status

### ✅ Completed
- Monorepo initialized with all workspaces (api, web, shared, config)
- Prisma schema with all 9 models + seed data
- Express API with full CRUD routes, JWT auth, RBAC, Zod validation, rate limiting
- All Veyon WebAPI operations working (lock, unlock, screenshot, message)
- All ActivityWatch routes working (buckets, events, metrics, summary, categories)
- Dashboard stats endpoint combining computer + activity data
- Next.js 14 frontend with all pages (dashboard, computers, analytics, login, users, settings)
- Real-time Socket.IO updates for computer status changes
- Docker setup (docker-compose + multi-stage builds)
- Local loopback computer (`127.0.0.1`) added for testing
- Veyon VNC server enabled (BuiltinUltraVncServer with 1.5s framebuffer init delay)

### 🚧 In Progress
- Data accumulation for ActivityWatch analytics (needs hours of watcher data)
- Production hardening (PostgreSQL, Redis, PM2/container orchestration)

### ❌ Known Issues
- Veyon CLI `config set` requires admin elevation (registry writes) — use WebAPI instead
- Veyon WebAPI /framebuffer returns 503 if called immediately after auth (addressed with 1500ms delay)
- Wake-on-LAN not supported via Veyon WebAPI — would need separate WOL utility

---

## Running the Project

```bash
# Install dependencies
npm install

# Seed the database (SQLite)
npm run db:seed

# Start dev servers (API :4000 + Web :3000)
npm run dev

# Production build
npm run build
```

### Login Credentials
| Email | Password | Role |
|-------|----------|------|
| `admin@qms.local` | `admin123` | Admin |
| `teacher@qms.local` | `teacher123` | Teacher |

### Environment (`.env`)
```
DATABASE_URL="file:./dev.db"
JWT_SECRET="qms-dev-secret-change-in-production-2026"
VEYON_WEBAPI_URL="http://localhost:11080/api/v1"
VEYON_PRIVATE_KEY_PATH="C:\ProgramData\Veyon\keys\private\dashboard-key\key"
VEYON_KEY_NAME="dashboard-key"
ACTIVITYWATCH_API_URL="http://localhost:5600/api"
```

---

## Next Steps

1. Let ActivityWatch watchers accumulate data for analytics to populate
2. Set up PostgreSQL + Redis for production
3. Deploy via Docker Compose
4. Add CI/CD pipeline (lint → typecheck → test → build → deploy)
5. Expand test coverage (Vitest for API + frontend)
6. Add WebSocket-based live screen streaming (Veyon demo mode)
