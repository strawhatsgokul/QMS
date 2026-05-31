# API Documentation

## Base URL
`http://localhost:4000/api`

## Authentication
All endpoints except `/auth/*` require a Bearer token in the Authorization header.

### Auth Endpoints

#### POST /auth/login
```json
{
  "email": "admin@qms.local",
  "password": "admin123"
}
// Response:
{
  "success": true,
  "data": {
    "accessToken": "eyJ...",
    "refreshToken": "eyJ...",
    "expiresAt": "2024-01-01T00:00:00.000Z",
    "user": { "id": "...", "email": "...", "name": "...", "role": "admin" }
  }
}
```

#### POST /auth/register
```json
{
  "email": "user@example.com",
  "password": "password123",
  "name": "User Name",
  "role": "teacher"
}
```

#### POST /auth/refresh
```json
{ "refreshToken": "eyJ..." }
```

### Dashboard

#### GET /dashboard/stats
Returns aggregated statistics: total/online/offline/locked computers, active users, today's activity minutes, recent alerts.

#### GET /dashboard/system-health
Returns health status of all integrated services.

### Computers

#### GET /computers?roomId=&status=&search=
List computers with optional filtering.

#### GET /computers/:id
Get computer details including room and group memberships.

#### POST /computers
Create a new computer. Requires admin or teacher role.
```json
{
  "hostname": "PC-001",
  "ipAddress": "192.168.1.101",
  "macAddress": "AA:BB:CC:DD:EE:01",
  "roomId": "uuid"
}
```

### Veyon Control

#### POST /veyon/screen/lock
```json
{ "computerIds": ["uuid1", "uuid2"] }
```

#### POST /veyon/screen/unlock
#### POST /veyon/power/restart
#### POST /veyon/power/shutdown
#### POST /veyon/power/wake (admin only)
#### POST /veyon/message
```json
{ "computerIds": ["uuid"], "message": "Attention!", "title": "Alert" }
```

#### POST /veyon/file/copy
```json
{ "computerIds": ["uuid"], "sourcePath": "/path/file", "destinationPath": "/dest/file" }
```

#### POST /veyon/demo/start
#### POST /veyon/demo/stop

#### GET /veyon/screen/:computerId
Returns base64-encoded screenshot.

### ActivityWatch

#### GET /activity/buckets
List all ActivityWatch buckets.

#### GET /activity/metrics?period=day|week|month
Return productivity metrics including categorized time, top applications, hourly breakdown.

#### GET /activity/applications?period=day
Top applications by usage time.

#### GET /activity/categories?period=day
Category breakdown with percentages.

#### GET /activity/export
Export activity data as JSON.

### Users (admin only)

#### GET /users
#### GET /users/:id
#### PATCH /users/:id
#### DELETE /users/:id

### Rooms

#### GET /rooms
#### GET /rooms/:id (includes computers)
#### POST /rooms (admin only)
#### PATCH /rooms/:id (admin only)
#### DELETE /rooms/:id (admin only)
