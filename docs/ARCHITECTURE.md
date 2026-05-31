# QMS Dashboard Architecture

## System Overview

The QMS Dashboard is a monorepo application integrating Veyon (classroom management) and ActivityWatch (time tracking) into a unified web interface.

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────┐
│                    Client Browser                         │
│  ┌─────────────────────────────────────────────────┐     │
│  │           Next.js Application (Port 3000)        │     │
│  │  ┌──────┐ ┌──────────┐ ┌──────────┐ ┌───────┐  │     │
│  │  │Dashboard│ Computers │ Analytics │Settings│  │     │
│  │  └──────┘ └──────────┘ └──────────┘ └───────┘  │     │
│  │         React Query / Socket.IO Client           │     │
│  └─────────────────────────────────────────────────┘     │
└────────────────────┬────────────────────────────────────┘
                     │ HTTP / WebSocket
                     ▼
┌─────────────────────────────────────────────────────────┐
│              Express API Server (Port 4000)              │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐   │
│  │ Auth     │ │ Computers│ │ Activity │ │ Veyon    │   │
│  │ Routes   │ │ Routes   │ │ Routes   │ │ Routes   │   │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘   │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐                │
│  │ JWT Auth │ │Rate Limit│ │ Zod Valid│                │
│  └──────────┘ └──────────┘ └──────────┘                │
└──────┬────────────────────┬────────────────────────────┘
       │                    │
       ▼                    ▼
┌──────────┐      ┌──────────────────┐
│PostgreSQL│      │     Redis        │
│ (Prisma) │      │   (Cache/Session)│
└──────────┘      └──────────────────┘
       │                    │
       ▼                    ▼
┌──────────┐      ┌──────────────────┐
│  Veyon   │      │  ActivityWatch   │
│  CLI/API │      │  REST API        │
└──────────┘      └──────────────────┘
```

## Tech Stack

- **Frontend**: Next.js 14 (App Router), React 18, Tailwind CSS, Recharts
- **Backend**: Express.js, Prisma ORM, Socket.IO, Zod validation
- **Database**: PostgreSQL (primary), Redis (caching)
- **Auth**: JWT with bcrypt password hashing, role-based access
- **State**: Zustand (client), React Query (server state)

## Directory Structure

```
veyon-activitywatch-dashboard/
├── apps/
│   ├── web/              # Next.js frontend
│   │   └── src/
│   │       ├── app/      # App Router pages
│   │       ├── components/ # React components
│   │       ├── lib/      # Utilities, API client
│   │       └── store/    # Zustand stores
│   └── api/              # Express backend
│       └── src/
│           ├── routes/   # API route handlers
│           ├── services/ # Business logic
│           ├── middleware/ # Auth, validation
│           └── config/   # App configuration
├── packages/
│   ├── shared/           # Shared TypeScript types
│   └── config/           # Shared configurations
├── docker/               # Docker configurations
└── docs/                 # Documentation
```

## Data Flow

1. **Authentication**: JWT tokens issued on login, verified by middleware
2. **Real-time Updates**: Socket.IO for computer status changes and alerts
3. **API Integration**: Express endpoints proxy to Veyon CLI and ActivityWatch REST API
4. **Caching**: Redis caches ActivityWatch data with configurable TTL
5. **Database**: PostgreSQL stores users, computers, rooms, audit logs

## Security

- JWT authentication with configurable expiry
- Role-based access control (admin, teacher, viewer)
- Rate limiting on all API routes
- Input validation with Zod schemas
- Parameterized queries via Prisma (SQL injection prevention)
- CORS configuration for web client origin only
