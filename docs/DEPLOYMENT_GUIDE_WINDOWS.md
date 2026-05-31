# QMS Dashboard — Windows Deployment Guide

**Complete guide for deploying the QMS Dashboard server and client agents on a fresh Windows environment.**

---

## Table of Contents

- [Architecture Overview](#architecture-overview)
- [Part 1: Server Deployment (Windows Server)](#part-1-server-deployment-windows-server)
- [Part 2: Client Agent Deployment (Windows 10/11)](#part-2-client-agent-deployment-windows-1011)
- [Part 3: Verification](#part-3-verification)
- [Part 4: Maintenance & Troubleshooting](#part-4-maintenance--troubleshooting)
- [Appendix A: Network Requirements](#appendix-a-network-requirements)
- [Appendix B: Agent Configuration Reference](#appendix-b-agent-configuration-reference)
- [Appendix C: Complete Checklist](#appendix-c-complete-checklist)

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                   SERVER (Windows Server)                       │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                 Docker Desktop                            │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌────────────────┐ │   │
│  │  │   Caddy       │  │  Next.js     │  │  Express API   │ │   │
│  │  │   :80 / :443  │▶│  :3000       │  │  :4000         │ │   │
│  │  │   Reverse     │  │  (web)       │  │  (api)         │ │   │
│  │  │   Proxy       │  └──────────────┘  │  + Socket.IO   │ │   │
│  │  └──────────────┘                    └────────┬─────────┘ │   │
│  │                                                │           │   │
│  │                                       ┌────────▼────────┐ │   │
│  │                                       │  SQLite DB      │ │   │
│  │                                       │  ./data/qms.db  │ │   │
│  │                                       └─────────────────┘ │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                           │ HTTPS or HTTP
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                   CLIENTS (Windows 10/11)                       │
│                                                                 │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  QMS Agent (Windows Service)                               │ │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  │ │
│  │  │ Heartbeat │  │  Poll    │  │ Execute  │  │ Watchdog │  │ │
│  │  │  30s     │  │  Commands│  │ Commands │  │  30s     │  │ │
│  │  │          │  │  5s      │  │          │  │          │  │ │
│  │  └──────────┘  └──────────┘  └──────────┘  └──────────┘  │ │
│  │                                                           │ │
│  │  ┌──────────┐  ┌──────────────┐  ┌────────────────────┐  │ │
│  │  │ Veyon    │  │ ActivityWatch│  │ Windows Services   │  │ │
│  │  │ Service  │  │ Service      │  │ (sc query/start)   │  │ │
│  │  └──────────┘  └──────────────┘  └────────────────────┘  │ │
│  └────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

---

## Part 1: Server Deployment (Windows Server)

Deploy the QMS Dashboard server (API + Web + Reverse Proxy) on **Windows Server 2019/2022** or **Windows 10/11 Pro** with Docker Desktop.

### 1.1 Prerequisites

| Requirement | Minimum | Recommended |
|---|---|---|
| **OS** | Windows 10 Pro/Enterprise | Windows Server 2022 |
| **CPU** | 4 cores | 8+ cores |
| **RAM** | 8 GB | 16+ GB |
| **Disk** | 20 GB free | 50+ GB SSD |
| **Docker** | Docker Desktop 4.x | Latest stable |
| **PowerShell** | 7.x | 7.4+ |
| **Domain** | Optional | Recommended for HTTPS |
| **Ports** | 80, 443 (inbound) | 80, 443, 3389 (optional RDP) |

### 1.2 Install Docker Desktop

```powershell
# Step 1: Download Docker Desktop Installer
# Download from: https://docs.docker.com/desktop/setup/install/windows-install/
# Or use winget:
winget install Docker.DockerDesktop

# Step 2: Run the installer
# - Check "Use WSL 2 instead of Hyper-V" (recommended for Windows 10/11)
# - Check "Add shortcut to desktop"
# - Complete installation and restart if prompted

# Step 3: Start Docker Desktop
Start-Process "C:\Program Files\Docker\Docker\Docker Desktop.exe"

# Step 4: Verify installation
docker --version
docker compose version
```

### 1.3 Install Required Tools

```powershell
# Install Git
winget install Git.Git

# Install Node.js (required for build steps only)
winget install OpenJS.NodeJS.LTS

# Install PowerShell 7+ (if not already installed)
winget install Microsoft.PowerShell

# Verify
git --version
node --version
npm --version
```

### 1.4 Prepare the Project

```powershell
# Clone the repository
cd C:\
git clone <your-repo-url> C:\qms-dashboard
cd C:\qms-dashboard

# The deploy.ps1 script handles everything from here
```

### 1.5 Deploy (Recommended — One Command)

Open **PowerShell 7 as Administrator** and run:

```powershell
.\deploy.ps1
```

The script will:
1. Verify Docker and Docker Compose are installed
2. Create `C:\qms-dashboard\data\` directory for persistent SQLite storage
3. Generate `.env` with a cryptographic random `JWT_SECRET`
4. Run `npm install` to ensure `package-lock.json` exists
5. Build Docker images and start containers: `docker compose up -d --build`
6. Wait 10 seconds, then health-check `http://localhost/api/health`
7. Print the access URL

**Expected output:**
```
[OK]    Docker: Docker version 24.0.7
[OK]    Compose: Docker Compose version v2.24.0
[OK]    Data directory: ./data
[OK]    .env created with a random JWT_SECRET
[OK]    Dependencies installed
[OK]    Containers started
[OK]    Health check passed (http://localhost/api/health → 200)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Dashboard is live at:
    http://localhost
    http://192.168.1.100
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### 1.6 Manual Deployment (Step-by-Step)

If you prefer to deploy manually:

```powershell
# Step 1: Generate .env with secure secrets
$jwtSecret = -join ((48..127) + (48..127) | Get-Random -Count 48 | ForEach-Object { [char]$_ })
@"
JWT_SECRET=$jwtSecret
DATABASE_URL=file:./data/qms.db?connection_limit=10&journal_mode=WAL
NODE_ENV=production
"@ | Set-Content -Path .env -NoNewline

# Step 2: Build and start containers
docker compose up -d --build

# Step 3: Check logs
docker compose logs -f

# Step 4: Verify health
Invoke-RestMethod -Uri "http://localhost/api/health"
# Expected: {"status":"ok","timestamp":"2026-06-01T..."}
```

### 1.7 Configure Domain & HTTPS

#### Option A: With a Domain Name

If you have a domain pointing to your server, edit `Caddyfile` and replace the `:80` block with your domain:

```caddyfile
dashboard.yourcompany.com {
    @websockets {
        header Connection *Upgrade*
        header Upgrade websocket
    }
    reverse_proxy @websockets web:3000

    handle /api/* {
        reverse_proxy api:4000
    }

    handle {
        reverse_proxy web:3000
    }

    header / {
        X-Content-Type-Options "nosniff"
        X-Frame-Options "DENY"
        Referrer-Policy "strict-origin-when-cross-origin"
    }
}
```

Then restart Caddy:

```powershell
docker compose restart reverse-proxy
```

Caddy will automatically obtain and renew Let's Encrypt TLS certificates.

#### Option B: Without a Domain (Local Network Only)

The default `Caddyfile` already has an HTTP-only `:80` block. If you need HTTPS with a self-signed certificate, you can generate one:

```powershell
# Generate a self-signed certificate for testing
New-SelfSignedCertificate -DnsName "localhost","qms-server" -CertStoreLocation "Cert:\LocalMachine\My" -NotAfter (Get-Date).AddYears(5)
```

However, for simplicity in a local network, **HTTP is sufficient** for internal deployments.

#### Option C: Windows IIS as Reverse Proxy (Alternative)

If you prefer not to use Docker for the reverse proxy, you can use IIS with URL Rewrite:

```powershell
# Install IIS with URL Rewrite
Install-WindowsFeature -Name Web-Server, Web-Url-Rewrite

# Install Application Request Routing (ARR)
# Download from: https://www.iis.net/downloads/microsoft/application-request-routing
```

Then configure IIS:
- Create a new website on port 80/443
- Add URL Rewrite rules:
  - Match: `/api/*` → Route to `http://localhost:4000/api/{R:1}`
  - Match: `/*` → Route to `http://localhost:3000/{R:0}`
  - Enable WebSocket proxy for Socket.IO

### 1.8 Access the Dashboard

After deployment, open a browser and navigate to:

```
http://<server-ip>
http://localhost
```

**Default login credentials:**
- **Email:** `admin@qserveits.com`
- **Password:** `admin`
- You will be prompted to change your password on first login.

### 1.9 Stopping and Starting the Server

```powershell
# Stop all containers
docker compose down

# Stop and remove volumes (erases database)
docker compose down -v

# Start again
docker compose up -d

# Rebuild and start (after code updates)
docker compose up -d --build

# View logs
docker compose logs -f
docker compose logs -f api
docker compose logs -f web
docker compose logs -f reverse-proxy
```

---

## Part 2: Client Agent Deployment (Windows 10/11)

Deploy the QMS Agent on each **Windows 10/11** machine that needs to be monitored and controlled.

### 2.1 Prerequisites

| Requirement | Details |
|---|---|
| **OS** | Windows 10 (1809+) or Windows 11 |
| **Architecture** | 64-bit (x64) only |
| **RAM** | 256 MB free |
| **Disk** | 100 MB free |
| **Network** | Outbound to QMS server (port 80 or 443) |
| **Veyon** | Veyon 4.x installed *(optional—needed for remote control actions)* |
| **ActivityWatch** | v0.13+ installed *(optional—needed for activity monitoring)* |
| **Permissions** | Administrator access on the target machine |

### 2.2 Build the Agent Executable

On your **build machine** (this can be the server itself or any Windows machine with Node.js):

```powershell
# From the project root directory (C:\qms-dashboard)

# Step 1: Install project dependencies
npm install

# Step 2: Build the standalone EXE
# This compiles TypeScript and bundles everything into a single .exe
.\packages\qms-agent\build-exe.ps1

# Optional: specify output directory
.\packages\qms-agent\build-exe.ps1 -OutDir "C:\deploy"
```

**What it produces:**
```
packages\qms-agent\dist\qms-agent.exe   (~45 MB standalone executable)
```

This executable contains the entire Node.js runtime and all dependencies — no external runtime required on the target machine.

### 2.3 Build the MSI Installer (Optional — For Mass Deployment)

If you need to deploy the agent to many machines via Group Policy or SCCM, build the MSI:

```powershell
# Prerequisite: Install WiX Toolset v3.11
# Download from: https://wixtoolset.org/releases/v3.11/

# Build the MSI
.\scripts\build-msi.ps1

# Output: .\scripts\dist\qms-agent.msi (~6 MB)
```

The MSI installer provides:
- A custom dialog for entering the API URL and Agent Key during interactive install
- Silent install support for automated deployment
- Windows Service creation with auto-start and failure recovery
- Firewall rule creation
- Proper uninstall (removes service, files, and firewall rule)

### 2.4 Generate Agent Keys on the Server

Each agent needs a unique key for authentication. Generate keys on the QMS server:

```powershell
# Generate a random agent key (32 bytes hex)
$key = -join ((0..9 + 'a','b','c','d','e','f') | Get-Random -Count 64 | ForEach-Object { $_ })
Write-Host "Agent Key: $key"

# Generate multiple keys for different machines
1..10 | ForEach-Object {
    $key = -join ((0..9 + 'a','b','c','d','e','f') | Get-Random -Count 64 | ForEach-Object { $_ })
    Write-Host "Machine-PC-$_`: $key"
}
```

### 2.5 Deployment Methods

Choose the method that best fits your environment.

---

#### Method A: PowerShell Install Script (Single Machine)

**Best for:** Deploying to a few machines manually.

Copy these files to the target machine:
- `packages\qms-agent\dist\qms-agent.exe`
- `scripts\install-agent.ps1`

Then on the target machine, open **PowerShell as Administrator** and run:

```powershell
.\install-agent.ps1 -ApiUrl "http://192.168.1.100" -AgentKey "a1b2c3d4e5f6..."

# If the executable is in a different path:
.\install-agent.ps1 -ApiUrl "http://192.168.1.100" -AgentKey "a1b2c3d4e5f6..." -ExePath "D:\deploy\qms-agent.exe"

# To skip creating the firewall rule (e.g., managed by group policy):
.\install-agent.ps1 -ApiUrl "http://192.168.1.100" -AgentKey "a1b2c3d4e5f6..." -SkipFirewall
```

**What the script does (6 steps):**

```
>>> [1/6] Creating directories...
      Install dir: C:\Program Files\QMS Agent
      Data dir: C:\ProgramData\QMS\agent

>>> [2/6] Copying executable...
      Copied qms-agent.exe to C:\Program Files\QMS Agent

>>> [3/6] Writing config file...
      Config written to C:\ProgramData\QMS\agent\config.json

>>> [4/6] Creating Windows service...
      Service QMSAgent created (auto-start)

>>> [5/6] Creating firewall rule...
      Firewall rule 'QMS Agent (Outbound)' created

>>> [6/6] Starting service...
      Service started successfully

=== Installation Complete ===
Service: QMSAgent
Executable: C:\Program Files\QMS Agent\qms-agent.exe
Config: C:\ProgramData\QMS\agent\config.json
Data: C:\ProgramData\QMS\agent
```

---

#### Method B: MSI Silent Install (Scripted / Remote)

**Best for:** Deploying to multiple machines via a script or remote management tool.

```powershell
# Silent install with parameters
msiexec /i "qms-agent.msi" AGENT_API_URL="http://192.168.1.100" AGENT_KEY="a1b2c3d4e5f6..." /qn /norestart

# Silent uninstall
msiexec /x "qms-agent.msi" /qn /norestart

# Or by product upgrade code:
msiexec /x {6b8a7c3e-9f4d-4e2a-b1c5-d7e8f9a0b2c3} /qn /norestart
```

**MSI Parameters:**
| Parameter | Default | Description |
|---|---|---|
| `AGENT_API_URL` | `http://localhost:4000` | QMS server URL (use IP or hostname) |
| `AGENT_KEY` | `change-me` | Agent authentication key |

**Remote deployment via PowerShell:**

```powershell
# Deploy to multiple machines via PSRemoting
$machines = @("PC-01", "PC-02", "PC-03")
$serverUrl = "http://192.168.1.100"
$agentKey = "a1b2c3d4e5f6..."
$msiPath = "\\fileserver\deploy\qms-agent.msi"

foreach ($machine in $machines) {
    Invoke-Command -ComputerName $machine -ScriptBlock {
        param($url, $key, $msi)
        msiexec /i $msi AGENT_API_URL=$url AGENT_KEY=$key /qn /norestart
    } -ArgumentList $serverUrl, $agentKey, $msiPath

    Write-Host "Deployed to $machine"
}
```

---

#### Method C: Group Policy Deployment (Active Directory)

**Best for:** Enterprise-wide deployment to domain-joined machines.

**Step 1 — Prepare the MSI:**
Build the MSI as described in section 2.3.

**Step 2 — Create a network share:**
```powershell
New-Item -ItemType Directory -Path "C:\Shares\Software" -Force
New-SmbShare -Name "Software" -Path "C:\Shares\Software" -FullAccess "Domain Computers"
Copy-Item ".\scripts\dist\qms-agent.msi" "C:\Shares\Software\qms-agent.msi"
```

**Step 3 — Create a transform (MST) for configuration:**
Since GPO doesn't pass MSI properties directly, use a transform:

```powershell
# Install Orca (Windows SDK tool) or use a script to create the MST
# Alternatively, use the PowerShell install script approach for GPO startup scripts
```

**Step 4 — Create GPO for PowerShell script (simpler approach):**
Create a Startup Script GPO at:
```
Computer Configuration → Windows Settings → Scripts → Startup
```

Place this as `C:\Windows\SYSVOL\domain\scripts\deploy-qms-agent.ps1`:

```powershell
$serverUrl = "http://qms-server"
$agentKey = "YOUR_MASTER_AGENT_KEY"
$exePath = "\\fileserver\software\qms-agent.exe"
$installScript = "\\fileserver\software\install-agent.ps1"

if (-not (Get-Service "QMSAgent" -ErrorAction SilentlyContinue)) {
    & $installScript -ApiUrl $serverUrl -AgentKey $agentKey -ExePath $exePath
}
```

> **Note:** For GPO, you may use a shared agent key or generate unique keys per machine using a startup script that creates them dynamically.

---

### 2.6 Post-Installation Verification

On each target machine, verify the agent is running:

```powershell
# Check service status
sc query QMSAgent

# Expected output:
# SERVICE_NAME: QMSAgent
# STATE        : 4  RUNNING
# WIN32_EXIT_CODE  : 0

# View agent logs
Get-Content "$env:ProgramData\QMS\agent\agent.log" -Tail 20

# Expected output:
# [INFO] Registration successful - agentId: abc-123
# [INFO] Heartbeat sent - CPU: 23%, MEM: 45%, Veyon: OK, AW: OK
# [INFO] No pending commands

# Check for errors
Get-Content "$env:ProgramData\QMS\agent\error.log" -Tail 10

# Check config file contents
Get-Content "$env:ProgramData\QMS\agent\config.json"
```

On the **server**, verify the agent appears:

```powershell
# First get an access token (replace with your password)
$login = Invoke-RestMethod -Uri "http://localhost/api/auth/login" -Method Post `
  -ContentType "application/json" `
  -Body '{"email":"admin@qserveits.com","password":"<your-changed-password>"}'

$token = $login.data.accessToken

# List computers with agent status
$computers = Invoke-RestMethod -Uri "http://localhost/api/computers" `
  -Headers @{ Authorization = "Bearer $token" }

$computers.data | Format-Table hostname, status, ipAddress, lastSeen
```

**Expected:** The target machine should appear in the list with an `online` status and a recent `lastSeen` timestamp.

### 2.7 Uninstalling the Agent

```powershell
# Run as Administrator

# Method 1: PowerShell uninstall (keeps data by default)
.\scripts\uninstall-agent.ps1

# Method 2: PowerShell uninstall (remove all data including logs and queue)
.\scripts\uninstall-agent.ps1 -RemoveData

# Method 3: MSI uninstall
msiexec /x "qms-agent.msi" /qn /norestart
```

---

## Part 3: Verification

### 3.1 End-to-End Test

```powershell
# 1. Open the dashboard
#    Browser → http://<server-ip>

# 2. Login with default credentials
#    Email:    admin@qserveits.com
#    Password: admin
#    → You will be redirected to change your password

# 3. Set a new password (minimum 8 characters)

# 4. Verify the dashboard loads
#    → Stats cards show data (total computers, online, locked, alerts)
#    → Computers grid lists all machines
#    → Activity summary shows data

# 5. Verify agent connectivity
#    → Open Computers page
#    → Machines with active agent show "online" status
#    → Last seen timestamps are within the last 2 minutes

# 6. Test remote actions (if Veyon is installed on clients)
#    → Select a computer → Click "Lock Screen"
#    → Confirm the screen locks on the target machine
#    → Click "Unlock" to restore
```

### 3.2 Automated Health Check (PowerShell)

```powershell
# Test the full stack
$health = Invoke-RestMethod -Uri "http://localhost/api/health"
Write-Host "API Health: $($health.status)" -ForegroundColor Green

# Test login
$login = Invoke-RestMethod -Uri "http://localhost/api/auth/login" -Method Post `
  -ContentType "application/json" `
  -Body '{"email":"admin@qserveits.com","password":"<your-password>"}'

if ($login.success) {
    Write-Host "Login: OK" -ForegroundColor Green
} else {
    Write-Host "Login: FAILED" -ForegroundColor Red
}

# Test container status
docker compose ps
```

### 3.3 Browser Verification

| Page | URL | What to check |
|---|---|---|
| Dashboard | `http://server-ip/` | Stats load, computers visible |
| Computers | `http://server-ip/computers` | All machines listed, status indicators |
| Analytics | `http://server-ip/analytics` | Charts render, data available |
| Alerts | `http://server-ip/alerts` | Watch rules configured |
| Users | `http://server-ip/users` | Admin user visible (admin only) |
| Settings | `http://server-ip/settings` | System settings loaded (admin only) |

---

## Part 4: Maintenance & Troubleshooting

### 4.1 Daily Operations

```powershell
# Check all containers are running
docker compose ps

# View recent logs
docker compose logs --tail=50

# Check disk usage of Docker
docker system df

# Restart a service
docker compose restart api

# Full restart
docker compose down && docker compose up -d
```

### 4.2 Backup and Restore

```powershell
# Backup the database
$date = Get-Date -Format "yyyyMMdd_HHmmss"
Copy-Item "C:\qms-dashboard\data\qms.db" "C:\qms-dashboard\data\backup_$date.db"

# Schedule automated backup (Task Scheduler)
$action = New-ScheduledTaskAction -Execute "PowerShell.exe" `
  -Argument "-Command Copy-Item 'C:\qms-dashboard\data\qms.db' 'C:\qms-dashboard\data\backup_$(Get-Date -Format yyyyMMdd).db'"

$trigger = New-ScheduledTaskTrigger -Daily -At 3am
Register-ScheduledTask -TaskName "QMS Database Backup" -Action $action -Trigger $trigger -RunLevel Highest

# Restore the database
docker compose down
Copy-Item "C:\qms-dashboard\data\backup_20260601.db" "C:\qms-dashboard\data\qms.db" -Force
docker compose up -d
```

### 4.3 Updating the Server

```powershell
# Pull latest code
cd C:\qms-dashboard
git pull

# Rebuild and restart
docker compose up -d --build
```

### 4.4 Common Issues

#### Docker Desktop won't start
```powershell
# Enable WSL 2
wsl --set-default-version 2
wsl --update

# Reset Docker Desktop
# Settings → Troubleshoot → Reset to factory defaults

# Or restart the Docker service
Restart-Service com.docker.service
```

#### Port conflict (port 80 or 443 already in use)
```powershell
# Check what's using the port
netstat -ano | findstr ":80 "
netstat -ano | findstr ":443 "

# Common culprits:
# - IIS (stop with: iisreset /stop)
# - World Wide Web Publishing Service (stop with: Stop-Service W3SVC)
# - SQL Server Reporting Services
# - Skype
```

#### Login fails
```powershell
# Ensure you're using admin@qserveits.com
# Default password is admin (expired)
# Check if server is running:
docker compose ps

# If locked out, reset the database:
docker compose down
Remove-Item "C:\qms-dashboard\data\qms.db" -Force
docker compose up -d
# This recreates the database with fresh seed data
```

#### Agent not appearing online on server

```powershell
# On the agent machine, check:
sc query QMSAgent
# Must be: STATE : 4  RUNNING

# Check the agent logs
Get-Content "$env:ProgramData\QMS\agent\agent.log" -Tail 50

# Check the config
Get-Content "$env:ProgramData\QMS\agent\config.json" | ConvertFrom-Json

# Common causes:
# - Wrong apiUrl in config.json (must match server address, not localhost)
# - Firewall blocking outbound traffic
# - Agent key doesn't match server's expected key
# - Server is not running or not reachable
```

To fix a misconfigured agent:
```powershell
sc stop QMSAgent

# Fix the config
$config = Get-Content "$env:ProgramData\QMS\agent\config.json" | ConvertFrom-Json
$config.apiUrl = "http://192.168.1.100"  # Correct server IP
$config | ConvertTo-Json | Set-Content "$env:ProgramData\QMS\agent\config.json"

# Restart
sc start QMSAgent

# Verify
Start-Sleep 3
Get-Content "$env:ProgramData\QMS\agent\agent.log" -Tail 10
```

#### Caddy reverse proxy issues

```powershell
# Check Caddy logs
docker compose logs reverse-proxy

# Common issues:
# - Port 80/443 already in use by IIS or another service
# - Domain not pointing to server (if using HTTPS)
# - Firewall blocking port 80/443 inbound

# Test Caddy routing directly:
Invoke-RestMethod -Uri "http://localhost/api/health"
Invoke-WebRequest -Uri "http://localhost/" -UseBasicParsing
```

### 4.5 Performance Tuning

```powershell
# Adjust Docker resource limits
# Docker Desktop → Settings → Resources
# Recommended:
#   CPUs: 4
#   Memory: 8 GB
#   Swap: 2 GB
#   Disk image size: 64 GB

# Enable Redis caching (optional) for better dashboard performance
# Edit docker-compose.yml and add a redis service, or use the
# postgres+redis variant at docker/docker-compose.yml
```

### 4.6 Monitoring

The server includes a built-in alert monitor:

- **Watch Rules** define patterns to monitor (e.g., YouTube, gaming, social media)
- **Alert Detections** trigger automatically when a pattern matches
- **Real-time notifications** appear on the dashboard via Socket.IO
- Configure at: **Dashboard → Alerts → Watch Rules**

---

## Appendix A: Network Requirements

### Windows Firewall Rules (Server)

| Direction | Port | Protocol | Purpose | Source IP |
|---|---|---|---|---|
| Inbound | 80 | TCP | HTTP traffic | All (or office subnet) |
| Inbound | 443 | TCP | HTTPS traffic | All (or office subnet) |
| Inbound | 3389 | TCP | Remote Desktop (optional) | Admin workstations only |

### Windows Firewall Rules (Client)

| Direction | Port | Protocol | Purpose | Destination |
|---|---|---|---|---|
| Outbound | 80/443 | TCP | Agent to Server API | QMS server IP |

> **Note:** The Docker containers themselves use internal ports 3000 and 4000, which are only accessible on `127.0.0.1` (localhost) — they are not exposed to the network.

### Docker Desktop Resources

| Resource | Recommended |
|---|---|
| CPUs | 4 |
| RAM | 8 GB |
| Disk | 64 GB (dynamic) |

Configure in: **Docker Desktop → Settings → Resources**

---

## Appendix B: Agent Configuration Reference

### Command-Line Arguments

| Argument | Default | Description |
|---|---|---|
| `--api-url` | `http://localhost:4000` | QMS server URL |
| `--agent-key` | *(required)* | Authentication key |
| `--use-https` | `false` | Use HTTPS for server connection |
| `--cert-path` | — | Custom CA certificate file path |
| `--heartbeat-interval` | `30` | Heartbeat interval in seconds |
| `--command-poll-interval` | `5` | Command poll interval in seconds |
| `--data-dir` | `%ProgramData%\QMS\agent` | Data directory |
| `--veyon-webapi-url` | `http://localhost:9799` | Veyon WebAPI URL |
| `--veyon-api-key` | — | Veyon API key |

### Config File

**Location:** `C:\ProgramData\QMS\agent\config.json`

```json
{
  "apiUrl": "http://192.168.1.100",
  "agentKey": "a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1",
  "dataDir": "C:\\ProgramData\\QMS\\agent",
  "heartbeatInterval": 30,
  "commandPollInterval": 5
}
```

### Service Management

```powershell
# Check status
sc query QMSAgent

# Stop
sc stop QMSAgent

# Start
sc start QMSAgent

# Restart
sc stop QMSAgent && sc start QMSAgent

# Remove
sc delete QMSAgent

# View logs
Get-Content "$env:ProgramData\QMS\agent\agent.log" -Tail 50
Get-Content "$env:ProgramData\QMS\agent\error.log" -Tail 50

# Watch logs in real-time
Get-Content "$env:ProgramData\QMS\agent\agent.log" -Wait
```

### Files and Directories

```
C:\Program Files\QMS Agent\
└── qms-agent.exe              # Agent executable (~45 MB)

C:\ProgramData\QMS\agent\
├── config.json                 # Agent configuration
├── agent.log                   # Main log (rotated at 5 MB, 3 files)
├── error.log                   # Error log (rotated at 5 MB, 3 files)
├── qms-agent.db                # Local SQLite queue for offline commands
└── qms-agent.db-wal            # SQLite Write-Ahead Log
```

---

## Appendix C: Complete Deployment Checklist

### Server Deployment Checklist

- [ ] Windows Server 2019/2022 provisioned
- [ ] Docker Desktop installed and running
- [ ] WSL 2 configured (if using WSL backend)
- [ ] Ports 80/443 open in Windows Firewall (inbound)
- [ ] IIS stopped if it's using port 80/443
- [ ] Git installed
- [ ] Project cloned: `C:\qms-dashboard`
- [ ] `.env` generated with secure `JWT_SECRET`
- [ ] `docker compose up -d --build` completed
- [ ] Health check responds 200
- [ ] Login works with `admin@qserveits.com` / `admin`
- [ ] Password changed on first login
- [ ] Server IP noted for agent configuration
- [ ] (Optional) Domain DNS configured
- [ ] (Optional) Domain updated in `Caddyfile`
- [ ] (Optional) HTTPS verified

### Agent Build Checklist

- [ ] Node.js installed on build machine
- [ ] `npm install` completed from project root
- [ ] `.\packages\qms-agent\build-exe.ps1` succeeded
- [ ] Output: `packages\qms-agent\dist\qms-agent.exe`
- [ ] (Optional) WiX Toolset v3.11 installed
- [ ] (Optional) `.\scripts\build-msi.ps1` succeeded
- [ ] (Optional) Output: `scripts\dist\qms-agent.msi`
- [ ] Agent keys generated for each client machine

### Per-Machine Agent Checklist

- [ ] Windows 10 (1809+) or Windows 11 (x64)
- [ ] Administrator access
- [ ] Agent EXE copied to target machine
- [ ] `install-agent.ps1` run as Administrator
- [ ] Correct `ApiUrl` and `AgentKey` used
- [ ] Service is running: `sc query QMSAgent` → `RUNNING`
- [ ] Agent log shows successful registration
- [ ] Machine appears "online" in dashboard
- [ ] Last seen timestamp is recent
- [ ] (Optional) Veyon installed for remote control
- [ ] (Optional) ActivityWatch installed for monitoring

### Post-Deployment Checklist

- [ ] Default admin password changed
- [ ] Additional staff/viewer users created if needed
- [ ] Watch rules configured for monitoring
- [ ] Computers organized into rooms
- [ ] System settings reviewed (Veyon paths, AW URL, session timeout)
- [ ] Database backup scheduled (Task Scheduler)
- [ ] Docker Desktop set to start on boot
- [ ] Docker resource limits configured
- [ ] Log retention configured in Settings
- [ ] All machines appear in Computers list
- [ ] Tested a remote action (lock/unlock)
