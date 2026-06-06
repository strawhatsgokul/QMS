<#
.SYNOPSIS
  Deploy QMS Dashboard on Windows Server via NSSM (no Docker).
.DESCRIPTION
  Clones/pulls repo, installs deps, builds, configures .env, creates
  NSSM services for API and Web, and runs a health check.
#>

$ErrorActionPreference = 'Stop'
$InformationPreference = 'Continue'

function Write-Info  { Write-Host "[INFO]  $args" -ForegroundColor Cyan }
function Write-Ok    { Write-Host "[OK]    $args" -ForegroundColor Green }
function Write-Warn  { Write-Host "[WARN]  $args" -ForegroundColor Yellow }
function Write-Err   { Write-Host "[ERROR] $args" -ForegroundColor Red }

# --------------------------------------------------
# Configuration — edit these for your environment
# --------------------------------------------------
$REPO_URL     = "https://github.com/strawhatsgokul/QMS.git"
$BRANCH       = "Developement"
$INSTALL_DIR  = "C:\QMS"
$API_PORT     = 4000
$WEB_PORT     = 3000
$SERVER_IP    = "192.168.29.17"

$NODE_BIN     = (Get-Command node).Source
$NPM_BIN      = (Get-Command npm).Source

# --------------------------------------------------
# 1. Prerequisites
# --------------------------------------------------
Write-Info "=== QMS Dashboard NSSM Deployment ==="
Write-Info "Checking prerequisites..."

if (-not $NODE_BIN) { Write-Err "Node.js not found. Install from https://nodejs.org/"; exit 1 }
$nodeVer = node --version
Write-Ok "Node.js $nodeVer at $NODE_BIN"

$nssmPath = Get-Command nssm -ErrorAction SilentlyContinue
if (-not $nssmPath) {
  Write-Err "NSSM not found. Install from https://nssm.cc/download"
  Write-Err "Place nssm.exe in a PATH directory (e.g. C:\Windows\System32)"
  exit 1
}
Write-Ok "NSSM at $($nssmPath.Source)"

# --------------------------------------------------
# 2. Clone / pull repo
# --------------------------------------------------
if (Test-Path "$INSTALL_DIR\.git") {
  Write-Info "Repository exists at $INSTALL_DIR — pulling latest..."
  Set-Location $INSTALL_DIR
  git fetch origin
  git reset --hard "origin/$BRANCH"
} else {
  Write-Info "Cloning repository to $INSTALL_DIR..."
  git clone --branch $BRANCH $REPO_URL $INSTALL_DIR
  Set-Location $INSTALL_DIR
}
Write-Ok "Repository at $INSTALL_DIR (branch: $BRANCH)"

# --------------------------------------------------
# 3. Install dependencies
# --------------------------------------------------
Write-Info "Installing dependencies..."
npm install --silent --no-audit --no-fund
if ($LASTEXITCODE -ne 0) { Write-Err "npm install failed"; exit 1 }
Write-Ok "Dependencies installed"

# --------------------------------------------------
# 4. Generate Prisma client
# --------------------------------------------------
Write-Info "Generating Prisma client..."
npx prisma generate --schema apps/api/prisma/schema.prisma
Write-Ok "Prisma client generated"

# --------------------------------------------------
# 5. Generate .env with secrets
# --------------------------------------------------
$envFile = "$INSTALL_DIR\apps\api\.env"
if (-not (Test-Path $envFile)) {
  Write-Info "Generating .env with secure secrets..."

  $bytes = [byte[]]::new(48)
  [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
  $jwtSecret = "qs-" + [Convert]::ToBase64String($bytes) -replace '[+/=]', ''

  $encBytes = [byte[]]::new(32)
  [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($encBytes)
  $encKey = [Convert]::ToBase64String($encBytes) -replace '[+/=]', '' -replace '=', ''

  $agentKey = "agent-" + -join ((65..90) + (97..122) + (48..57) | Get-Random -Count 24 | ForEach-Object { [char]$_ })

  @"
# Server
PORT=$API_PORT
NODE_ENV=production

# Database (SQLite)
DATABASE_URL="file:./data/qms.db?connection_limit=10&journal_mode=WAL"

# JWT
JWT_SECRET="${jwtSecret}"
JWT_EXPIRES_IN="24h"
JWT_REFRESH_EXPIRES_IN="7d"

# Veyon — configure after Veyon Master is installed
VEYON_CLI_PATH="veyon-cli"
VEYON_API_KEY=""
VEYON_WEBAPI_URL="http://localhost:11080/api/v1"
VEYON_PRIVATE_KEY_PATH=""
VEYON_KEY_NAME="dashboard-key"

# ActivityWatch
ACTIVITYWATCH_API_URL="http://localhost:5600/api"
ACTIVITYWATCH_API_KEY=""

# Agent
AGENT_KEY="${agentKey}"

# Encryption
ENCRYPTION_KEY="${encKey}"

# CORS
CORS_ORIGIN="http://${SERVER_IP}:${WEB_PORT}"
"@ | Set-Content -Path $envFile -Encoding UTF8

  Write-Ok ".env created at $envFile"
  Write-Warn "AGENT_KEY=${agentKey} — copy this to your agent config"
  Write-Warn "Edit VEYON_* settings after installing Veyon Master"
} else {
  Write-Info ".env already exists, using existing values"
}

# --------------------------------------------------
# 6. Push database schema
# --------------------------------------------------
Write-Info "Setting up database..."
Set-Location "$INSTALL_DIR\apps\api"
npx prisma db push --accept-data-loss
if ($LASTEXITCODE -ne 0) { Write-Err "prisma db push failed"; exit 1 }
Write-Ok "Database schema applied"

# --------------------------------------------------
# 7. Build applications
# --------------------------------------------------
Write-Info "Building API..."
Set-Location "$INSTALL_DIR\apps\api"
npm run build
if ($LASTEXITCODE -ne 0) { Write-Err "API build failed"; exit 1 }
Write-Ok "API built"

Write-Info "Building Web..."
Set-Location "$INSTALL_DIR\apps\web"
npm run build
if ($LASTEXITCODE -ne 0) { Write-Err "Web build failed"; exit 1 }
Write-Ok "Web built"

# --------------------------------------------------
# 8. Stop existing NSSM services if running
# --------------------------------------------------
@('QMS-API', 'QMS-WEB') | ForEach-Object {
  $svc = nssm status $_ 2>&1
  if ($LASTEXITCODE -eq 0) {
    Write-Info "Stopping existing service $_..."
    nssm stop $_ 2>$null
    nssm remove $_ confirm 2>$null
  }
}

# --------------------------------------------------
# 9. Create NSSM services
# --------------------------------------------------
Write-Info "Creating NSSM services..."

nssm install QMS-API "$NODE_BIN"
nssm set    QMS-API AppParameters "$INSTALL_DIR\apps\api\dist\index.js"
nssm set    QMS-API AppDirectory "$INSTALL_DIR\apps\api"
nssm set    QMS-API AppStdout "$INSTALL_DIR\apps\api\logs\api-out.log"
nssm set    QMS-API AppStderr "$INSTALL_DIR\apps\api\logs\api-err.log"
nssm set    QMS-API AppRotateFiles 1
nssm set    QMS-API AppRotateOnline 1
nssm set    QMS-API AppRotateSeconds 86400
nssm set    QMS-API Start SERVICE_AUTO_START
nssm set    QMS-API DisplayName "QMS Dashboard API"
nssm set    QMS-API Description "Backend API for QMS Dashboard"
Write-Ok "QMS-API service created"

nssm install QMS-WEB "$NPM_BIN"
nssm set    QMS-WEB AppParameters "run start"
nssm set    QMS-WEB AppDirectory "$INSTALL_DIR\apps\web"
nssm set    QMS-WEB AppStdout "$INSTALL_DIR\apps\web\logs\web-out.log"
nssm set    QMS-WEB AppStderr "$INSTALL_DIR\apps\web\logs\web-err.log"
nssm set    QMS-WEB AppRotateFiles 1
nssm set    QMS-WEB AppRotateOnline 1
nssm set    QMS-WEB AppRotateSeconds 86400
nssm set    QMS-WEB Start SERVICE_AUTO_START
nssm set    QMS-WEB DisplayName "QMS Dashboard Web"
nssm set    QMS-WEB Description "Next.js frontend for QMS Dashboard"
Write-Ok "QMS-WEB service created"

# --------------------------------------------------
# 10. Start services
# --------------------------------------------------
Write-Info "Starting services..."
nssm start QMS-API
Write-Ok "QMS-API started"

Start-Sleep -Seconds 5

nssm start QMS-WEB
Write-Ok "QMS-WEB started"

# --------------------------------------------------
# 11. Health check
# --------------------------------------------------
Write-Info "Running health check..."
Start-Sleep -Seconds 8

try {
  $response = Invoke-WebRequest -Uri "http://localhost:$API_PORT/api/health" -UseBasicParsing -TimeoutSec 10
  if ($response.StatusCode -eq 200) {
    Write-Ok "API health check passed (HTTP $($response.StatusCode))"
  } else {
    Write-Warn "API returned HTTP $($response.StatusCode)"
  }
} catch {
  Write-Warn "API health check failed: $($_.Exception.Message)"
}

try {
  $response = Invoke-WebRequest -Uri "http://localhost:$WEB_PORT" -UseBasicParsing -TimeoutSec 10
  if ($response.StatusCode -eq 200) {
    Write-Ok "Web health check passed (HTTP $($response.StatusCode))"
  } else {
    Write-Warn "Web returned HTTP $($response.StatusCode)"
  }
} catch {
  Write-Warn "Web health check failed: $($_.Exception.Message)"
}

# --------------------------------------------------
# 12. Summary
# --------------------------------------------------
Write-Host ""
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Green
Write-Host "  Deployment complete!" -ForegroundColor Green
Write-Host "  API:     http://${SERVER_IP}:${API_PORT}" -ForegroundColor Green
Write-Host "  Web:     http://${SERVER_IP}:${WEB_PORT}" -ForegroundColor Green
Write-Host "  Install: ${INSTALL_DIR}" -ForegroundColor Green
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Green
Write-Host ""
Write-Host "  Manage services:" -ForegroundColor Cyan
Write-Host "    nssm status QMS-API" -ForegroundColor Cyan
Write-Host "    nssm status QMS-WEB" -ForegroundColor Cyan
Write-Host "    nssm restart QMS-API" -ForegroundColor Cyan
Write-Host ""
Write-Host "  View logs:" -ForegroundColor Cyan
Write-Host "    ${INSTALL_DIR}\apps\api\logs\api-out.log" -ForegroundColor Cyan
Write-Host "    ${INSTALL_DIR}\apps\web\logs\web-out.log" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Post-install steps:" -ForegroundColor Yellow
Write-Host "  1. Install Veyon Master + configure VEYON_* in .env" -ForegroundColor Yellow
Write-Host "  2. Install ActivityWatch on target computers" -ForegroundColor Yellow
Write-Host "  3. Run deploy-agent.ps1 on target computers" -ForegroundColor Yellow
Write-Host "  4. Access dashboard at http://${SERVER_IP}:${WEB_PORT}" -ForegroundColor Yellow
Write-Host "  5. Login with admin@qserveits.com / admin (change on first login)" -ForegroundColor Yellow