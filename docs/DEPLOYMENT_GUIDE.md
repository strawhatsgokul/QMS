# QMS Dashboard — Deployment Guide

**Complete guide for deploying the QMS Dashboard server and client agents on a fresh system.**

---

## Table of Contents

- [Architecture Overview](#architecture-overview)
- [Part 1: Server Deployment](#part-1-server-deployment)
- [Part 2: Client Agent Deployment](#part-2-client-agent-deployment)
- [Part 3: Verification](#part-3-verification)
- [Part 4: Maintenance & Troubleshooting](#part-4-maintenance--troubleshooting)
- [Appendix A: Network Requirements](#appendix-a-network-requirements)
- [Appendix B: Agent Configuration Reference](#appendix-b-agent-configuration-reference)
- [Appendix C: Complete Checklist](#appendix-c-complete-checklist)

---

## Architecture Overview

```
┌──────────────────────────────────────────────────────────────────┐
│                        SERVER (Linux)                            │
│                                                                  │
│  ┌──────────────┐   ┌──────────────┐   ┌──────────────────────┐ │
│  │   Caddy       │   │  Next.js     │   │  Express API         │ │
│  │   :80 / :443  │──▶│  :3000       │   │  :4000               │ │
│  │   Reverse     │   │  (web)       │   │  (api)               │ │
│  │   Proxy       │   └──────────────┘   │  + Socket.IO         │ │
│  └──────────────┘                       └──────────┬───────────┘ │
│                                                     │            │
│                                            ┌────────▼────────┐  │
│                                            │  SQLite DB      │  │
│                                            │  ./data/qms.db  │  │
│                                            └─────────────────┘  │
└──────────────────────────────────────────────────────────────────┘
                           │ HTTPS
                           ▼
┌──────────────────────────────────────────────────────────────────┐
│                    CLIENTS (Windows 10/11)                       │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  QMS Agent (Windows Service)                             │   │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌────────┐ │   │
│  │  │ Heartbeat │  │  Poll    │  │ Execute  │  │Watchdog│ │   │
│  │  │  30s     │  │  Commands│  │ Commands │  │  30s   │ │   │
│  │  │          │  │  5s      │  │          │  │        │ │   │
│  │  └──────────┘  └──────────┘  └──────────┘  └────────┘ │   │
│  │                                                          │   │
│  │  ┌──────────┐  ┌──────────────┐  ┌──────────────────┐  │   │
│  │  │ Veyon    │  │ ActivityWatch │  │ Windows Services │  │   │
│  │  │ Service  │  │ Service       │  │ (sc start/query) │  │   │
│  │  └──────────┘  └──────────────┘  └──────────────────┘  │   │
│  └──────────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────────┘
```

---

## Part 1: Server Deployment

Deploy the QMS Dashboard server (API + Web + Reverse Proxy) on a **Linux** server.

### 1.1 Prerequisites

| Requirement | Minimum | Recommended |
|---|---|---|
| **OS** | Ubuntu 20.04 / Debian 11 | Ubuntu 22.04 LTS |
| **CPU** | 2 cores | 4+ cores |
| **RAM** | 2 GB | 4+ GB |
| **Disk** | 10 GB free | 20+ GB SSD |
| **Docker** | 24+ | Latest stable |
| **Docker Compose** | V2 | V2 |
| **Domain** | Optional (for HTTPS) | Recommended |
| **Ports** | 80, 443 (inbound) | 80, 443 (inbound) |

### 1.2 Install Docker

```bash
# Ubuntu / Debian
sudo apt update && sudo apt install -y ca-certificates curl gnupg lsb-release
sudo mkdir -p /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt update && sudo apt install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
sudo systemctl enable --now docker

# Verify
docker --version && docker compose version
```

### 1.3 Prepare the Project

```bash
# Clone the repository
git clone <your-repo-url> /opt/qms-dashboard
cd /opt/qms-dashboard

# Ensure deploy script is executable
chmod +x deploy.sh
```

### 1.4 Deploy (Recommended — One Command)

```bash
./deploy.sh
```

The script will:
1. Verify Docker and Docker Compose are installed
2. Create `./data/` directory for persistent SQLite storage
3. Generate `.env` with a cryptographic random `JWT_SECRET`
4. Run `npm install` to ensure `package-lock.json` exists
5. Build Docker images and start containers: `docker compose up -d --build`
6. Wait 10 seconds, then health-check `http://localhost/api/health`
7. Print the access URL

**Expected output:**
```
[OK]    Docker 24.0.7
[OK]    Compose 2.24.0
[OK]    Data directory: ./data
[OK]    .env created with a random JWT_SECRET
[OK]    Dependencies installed
[OK]    Containers started
[OK]    Health check passed (http://localhost/api/health → 200)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Dashboard is live at:
    http://localhost
    http://192.168.1.100
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### 1.5 Manual Deployment (Step-by-Step)

If you prefer to deploy manually or the script encounters issues:

```bash
# Step 1: Generate .env with secure secrets
openssl rand -base64 48 | tr -d '\n' > .env

# Step 2: Build and start containers
docker compose up -d --build

# Step 3: Check logs
docker compose logs -f

# Step 4: Verify health
curl -s http://localhost/api/health
# Expected: {"status":"ok","timestamp":"2026-06-01T..."}
```

### 1.6 Configure Domain & HTTPS (Optional)

Edit the `Caddyfile` and uncomment/replace the production block:

```caddyfile
dashboard.yourdomain.com {
    # Proxy WebSocket connections
    @websockets {
        header Connection *Upgrade*
        header Upgrade websocket
    }
    reverse_proxy @websockets web:3000

    # API requests go directly to the API service
    handle /api/* {
        reverse_proxy api:4000
    }

    # All other traffic goes to Next.js
    handle {
        reverse_proxy web:3000
    }

    # Security headers
    header / {
        X-Content-Type-Options "nosniff"
        X-Frame-Options "DENY"
        X-XSS-Protection "1; mode=block"
        Referrer-Policy "strict-origin-when-cross-origin"
    }
}
```

Then update your DNS A record to point to your server's IP and reload:

```bash
docker compose restart reverse-proxy
```

Caddy will automatically obtain and renew Let's Encrypt TLS certificates.

### 1.7 Verify the Server

```bash
# Dashboard page (via Caddy)
curl -s -o /dev/null -w "%{http_code}" http://localhost
# Expected: 200

# API health (via Caddy)
curl -s http://localhost/api/health
# Expected: {"status":"ok","timestamp":"..."}

# Swagger docs
curl -s -o /dev/null -w "%{http_code}" http://localhost/api/docs
# Expected: 200

# Login as admin
curl -s -X POST http://localhost/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@qserveits.com","password":"admin"}' | jq .
# Expected: {"success":true,"data":{"accessToken":"...","user":{"name":"Administrator","role":"admin","mustChangePassword":true,...}}}
```

---

## Part 2: Client Agent Deployment

Deploy the QMS Agent on each **Windows 10/11** machine that needs to be monitored and controlled.

### 2.1 Prerequisites

| Requirement | Details |
|---|---|
| **OS** | Windows 10 (1809+) or Windows 11 |
| **Architecture** | 64-bit (x64) |
| **RAM** | 256 MB free |
| **Disk** | 100 MB free |
| **Network** | Outbound HTTPS to QMS server (port 443) |
| **Veyon** | Veyon 4.x installed (for lock/unlock/restart/shutdown) |
| **ActivityWatch** | ActivityWatch v0.13+ installed (for activity monitoring) |
| **Permissions** | Administrator access for installation |

### 2.2 Build the Agent Artifacts

On a **Windows build machine** with Node.js 18+:

```powershell
# From the project root

# Step 1: Install dependencies
npm install

# Step 2: Build the standalone EXE
.\packages\qms-agent\build-exe.ps1
# Output: packages/qms-agent/dist/qms-agent.exe

# Step 3 (optional): Build the MSI installer
# Requires WiX Toolset v3.11: https://wixtoolset.org/releases/
.\scripts\build-msi.ps1
# Output: scripts/dist/qms-agent.msi
```

**Build outputs:**
- `packages/qms-agent/dist/qms-agent.exe` — standalone executable (~45 MB)
- `scripts/dist/qms-agent.msi` — Windows Installer package (~6 MB)

### 2.3 Generate Agent Key on Server

Each agent needs a unique key for authentication. Generate keys on the QMS server:

```bash
# Generate a random agent key
openssl rand -hex 32
# Example output: a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1

# Generate multiple keys for different machines
for i in {1..10}; do
  echo "Machine-PC-$i: $(openssl rand -hex 32)"
done
```

### 2.4 Deployment Methods

#### Method A: PowerShell Script (Recommended)

Copy the built `qms-agent.exe` and `scripts\install-agent.ps1` to the target machine, then run:

```powershell
# Run as Administrator on the target machine
.\install-agent.ps1 -ApiUrl "https://dashboard.yourdomain.com" -AgentKey "a1b2c3d4e5f6..."

# With custom executable path
.\install-agent.ps1 -ApiUrl "https://dashboard.yourdomain.com" -AgentKey "a1b2c3d4e5f6..." -ExePath "D:\deploy\qms-agent.exe"

# Skip firewall rule creation (if managed by group policy)
.\install-agent.ps1 -ApiUrl "https://dashboard.yourdomain.com" -AgentKey "a1b2c3d4e5f6..." -SkipFirewall
```

**What the script does (6 steps):**

```
[1/6] Creating directories...
      Install dir: C:\Program Files\QMS Agent
      Data dir: C:\ProgramData\QMS\agent

[2/6] Copying executable...
      Copied qms-agent.exe to C:\Program Files\QMS Agent

[3/6] Writing config file...
      Config written to C:\ProgramData\QMS\agent\config.json

[4/6] Creating Windows service...
      Service QMSAgent created (auto-start, restart on failure)

[5/6] Creating firewall rule...
      Firewall rule 'QMS Agent (Outbound)' created

[6/6] Starting service...
      Service started successfully

=== Installation Complete ===
Service: QMSAgent
Executable: C:\Program Files\QMS Agent\qms-agent.exe
Config: C:\ProgramData\QMS\agent\config.json
Data: C:\ProgramData\QMS\agent
```

#### Method B: MSI Installer (For Mass Deployment via GPO)

```powershell
# Silent install with parameters
msiexec /i "qms-agent.msi" AGENT_API_URL="https://dashboard.yourdomain.com" AGENT_KEY="a1b2c3d4e5f6..." /qn /norestart

# Silent uninstall
msiexec /x "qms-agent.msi" /qn /norestart

# Or by product code
msiexec /x {6b8a7c3e-9f4d-4e2a-b1c5-d7e8f9a0b2c3} /qn /norestart
```

**MSI Parameters:**
| Parameter | Default | Description |
|---|---|---|
| `AGENT_API_URL` | `http://localhost:4000` | QMS server URL |
| `AGENT_KEY` | `change-me` | Agent authentication key |

#### Method C: Group Policy Deployment (Active Directory)

1. Build the MSI as described above
2. Place the MSI on a network share (e.g., `\\domain\sysvol\qms-agent.msi`)
3. Create a GPO: **Computer Configuration → Software Settings → Software Installation**
4. Right-click → **New → Package** → select the MSI
5. Choose **Assigned** (installed on next boot)
6. Set the transform (MST) or use the property table to pass `AGENT_API_URL` and `AGENT_KEY`

**Note:** For GPO deployment with per-machine configuration, create a transform (MST) using Orca or a script that sets the `AGENT_API_URL` and `AGENT_KEY` properties, as GPO doesn't support passing MSI properties directly.

### 2.5 Post-Installation Verification

On the target client machine, run:

```powershell
# Check service status
sc query QMSAgent

# View agent logs
Get-Content "$env:ProgramData\QMS\agent\agent.log" -Tail 20

# View error logs (if any)
Get-Content "$env:ProgramData\QMS\agent\error.log" -Tail 20
```

**Expected service state:**
```
SERVICE_NAME: QMSAgent
STATE              : 4  RUNNING
```

**Expected log output:**
```
[INFO] Registration successful - agentId: abc-123
[INFO] Heartbeat sent - CPU: 23%, MEM: 45%
[INFO] No pending commands
```

On the server, verify the agent appears:

```bash
# Login first
TOKEN=$(curl -s -X POST http://localhost/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@qserveits.com","password":"<new-password>"}' | jq -r '.data.accessToken')

# Check registered agents (via computers list)
curl -s http://localhost/api/computers \
  -H "Authorization: Bearer $TOKEN" | jq '.data[] | {hostname, status, ipAddress}'
```

### 2.6 Uninstalling the Agent

```powershell
# Run as Administrator

# PowerShell uninstall (keeps data by default)
.\scripts\uninstall-agent.ps1

# PowerShell uninstall (remove all data)
.\scripts\uninstall-agent.ps1 -RemoveData

# MSI uninstall
msiexec /x "qms-agent.msi" /qn /norestart
```

---

## Part 3: Verification

### 3.1 End-to-End Test

```bash
# 1. Open the dashboard
#    Browser → http://<server-ip>/

# 2. Login with default credentials
#    Email:    admin@qserveits.com
#    Password: admin
#    → You will be redirected to change your password

# 3. Set a new password (minimum 8 characters)

# 4. Verify the dashboard loads
#    → Stats cards show data
#    → Computers grid lists all machines
#    → Alerts section loads

# 5. Verify agent connectivity
#    → Computers show "online" status for machines with active agent
#    → Heartbeat timestamps are recent (within 2 minutes)

# 6. Test a remote action
#    → Select a computer → Lock Screen
#    → Confirm the action completes
```

### 3.2 Automated Health Checks

```bash
# Full stack health
curl -s http://localhost/api/health

# Container status
docker compose ps

# Resource usage
docker compose stats --no-stream

# Recent logs
docker compose logs --tail=50
```

---

## Part 4: Maintenance & Troubleshooting

### 4.1 Server Maintenance

```bash
# Update to latest version
git pull
./deploy.sh

# View logs
docker compose logs -f
docker compose logs -f api
docker compose logs -f web
docker compose logs -f reverse-proxy

# Restart a specific service
docker compose restart api
docker compose restart web

# Backup the database
cp ./data/qms.db ./data/qms.db.backup.$(date +%Y%m%d)

# Restore the database
docker compose down
cp ./data/qms.db.backup.20260601 ./data/qms.db
docker compose up -d

# Full cleanup (removes containers, network, volumes)
docker compose down -v
```

### 4.2 Common Issues

#### Server won't start

```bash
# Check if Docker is running
sudo systemctl status docker

# Check port availability
sudo ss -tlnp | grep -E ':(80|443|3000|4000)'

# Check container logs
docker compose logs --tail=100 api
```

#### Login fails

- Ensure you're using `admin@qserveits.com`
- Default password is `admin` (first login forces change)
- If locked out, reset the database: `docker compose down && rm -rf ./data && docker compose up -d`

#### Agent not appearing online

```bash
# On agent machine, check:
sc query QMSAgent          # Service must be RUNNING
Get-Content "$env:ProgramData\QMS\agent\agent.log" -Tail 20  # Check for errors

# Common causes:
# - Wrong API_URL (check config.json)
# - Firewall blocking outbound traffic
# - Agent key mismatch (re-register with a new key)
```

#### Caddy SSL certificate issues

```bash
# Check Caddy logs
docker compose logs reverse-proxy

# Force certificate renewal
docker compose exec reverse-proxy caddy renew --force

# Test with HTTP for debugging (temporarily edit Caddyfile to use :80 only)
```

#### Agent shows "Registering... Registration successful" repeatedly

This means the heartbeat is failing after registration. Check:
- Network connectivity to the server
- Server firewall (port 443 must be open)
- `config.json` values on the agent

### 4.3 Monitoring & Alerts

The server includes a built-in alert monitor that polls every 30 seconds:

- **Watch Rules** define patterns to monitor (e.g., "youtube", "gaming", "social media")
- **Alert Detections** are created when a pattern matches a computer's active window
- **Notifications** are pushed to the dashboard via Socket.IO in real-time
- **Dashboard badge** shows unread alert count

Configure watch rules at: **Dashboard → Alerts → Watch Rules**

### 4.4 Scaling

| Scenario | Action |
|---|---|
| **More clients** | No server changes needed — agents scale horizontally |
| **High traffic** | Increase Docker CPU/memory limits; enable Redis caching |
| **Database growth** | SQLite handles millions of rows; archive old logs via Settings |
| **High availability** | Add PostgreSQL + Redis (see `docker/docker-compose.yml`); add Caddy replicas |

---

## Appendix A: Network Requirements

### Firewall Rules (Server)

| Direction | Port | Protocol | Purpose | Source |
|---|---|---|---|---|
| Inbound | 80 | TCP | HTTP redirect to HTTPS | Any |
| Inbound | 443 | TCP | HTTPS dashboard access | Any (or office IP range) |
| Outbound | 443 | TCP | Let's Encrypt certs | `acme-v02.api.letsencrypt.org` |

### Firewall Rules (Client)

| Direction | Port | Protocol | Purpose | Destination |
|---|---|---|---|---|
| Outbound | 443 | TCP | Agent → Server API | QMS server IP |

### Docker Internal Network

The Docker Compose stack uses an internal bridge network. No ports other than 80/443 are exposed externally:

| Service | Internal Port | External Access |
|---|---|---|
| `reverse-proxy` (Caddy) | 80, 443 | Public |
| `web` (Next.js) | 3000 | `127.0.0.1:3000` only |
| `api` (Express) | 4000 | `127.0.0.1:4000` only |

---

## Appendix B: Agent Configuration Reference

### CLI Arguments

The agent executable accepts the following arguments:

| Argument | Env Var | Default | Description |
|---|---|---|---|
| `--api-url` | `API_URL` | `http://localhost:4000` | QMS server URL |
| `--agent-key` | `AGENT_KEY` | — | Authentication key |
| `--use-https` | `USE_HTTPS` | `false` | Use HTTPS for server connection |
| `--cert-path` | `CERT_PATH` | — | Custom CA certificate path |
| `--heartbeat-interval` | `HEARTBEAT_INTERVAL` | `30` | Heartbeat interval in seconds |
| `--command-poll-interval` | `COMMAND_POLL_INTERVAL` | `5` | Command poll interval in seconds |
| `--data-dir` | `DATA_DIR` | `%ProgramData%\QMS\agent` | Data directory |
| `--veyon-webapi-url` | `VEYON_WEBAPI_URL` | `http://localhost:9799` | Veyon WebAPI URL |
| `--veyon-api-key` | `VEYON_API_KEY` | — | Veyon API key |

### Config File Location

`C:\ProgramData\QMS\agent\config.json`

```json
{
  "apiUrl": "https://dashboard.yourdomain.com",
  "agentKey": "a1b2c3d4e5f6...",
  "dataDir": "C:\\ProgramData\\QMS\\agent",
  "heartbeatInterval": 30,
  "commandPollInterval": 5
}
```

### Service Management

```powershell
# Status
sc query QMSAgent

# Stop
sc stop QMSAgent

# Start
sc start QMSAgent

# Restart
sc stop QMSAgent && sc start QMSAgent

# View logs
Get-Content "$env:ProgramData\QMS\agent\agent.log" -Tail 50
Get-Content "$env:ProgramData\QMS\agent\error.log" -Tail 50
```

### Files and Directories

```
C:\Program Files\QMS Agent\
└── qms-agent.exe          # Executable

C:\ProgramData\QMS\agent\
├── config.json             # Agent configuration
├── agent.log               # Agent log (rotated, 5MB each)
├── error.log               # Error log (rotated, 3 files)
├── qms-agent.db            # Local SQLite queue (offline commands)
└── qms-agent.db-wal        # SQLite WAL file
```

---

## Appendix C: Complete Checklist

### Server Deployment Checklist

- [ ] Ubuntu 22.04+ server provisioned
- [ ] Docker 24+ installed (`docker --version`)
- [ ] Docker Compose V2 installed (`docker compose version`)
- [ ] Firewall allows ports 80, 443 (inbound)
- [ ] Project cloned to server
- [ ] `.env` generated with secure `JWT_SECRET`
- [ ] `docker compose up -d --build` completed successfully
- [ ] Health check responds 200 (`curl http://localhost/api/health`)
- [ ] Login works (`curl -X POST http://localhost/api/auth/login ...`)
- [ ] (Optional) DNS A record configured
- [ ] (Optional) Domain updated in `Caddyfile`
- [ ] (Optional) HTTPS working

### Agent Deployment Checklist (per machine)

- [ ] Windows 10/11 (x64)
- [ ] Node.js installed on build machine
- [ ] Agent EXE built (`build-exe.ps1`)
- [ ] Agent key generated on server
- [ ] Install script run as Administrator
- [ ] Service is RUNNING (`sc query QMSAgent`)
- [ ] Agent appears online in dashboard
- [ ] Agent heartbeat log shows recent timestamps
- [ ] (Optional) Veyon installed (if remote control needed)
- [ ] (Optional) ActivityWatch installed (if activity monitoring needed)
- [ ] (Optional) MSI built for GPO deployment

### Post-Deployment Checklist

- [ ] Default password changed from `admin`
- [ ] Additional users created (if needed)
- [ ] Watch rules configured
- [ ] Computers organized into rooms
- [ ] System settings reviewed (Veyon paths, AW URL, session timeout)
- [ ] Database backup scheduled (cron: `cp ./data/qms.db ./data/backups/`)
- [ ] Log retention configured in Settings
