<#
.SYNOPSIS
  Deploy QMS Dashboard on Windows Server via NSSM (no Docker).
#>

$ErrorActionPreference = "Stop"

# Auto-detect repo root (where this script lives)
$SCRIPT_DIR = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $SCRIPT_DIR

$REPO_URL    = "https://github.com/strawhatsgokul/QMS.git"
$BRANCH      = "Developement"
$INSTALL_DIR = $SCRIPT_DIR
$API_PORT    = 4000
$WEB_PORT    = 3000
$SERVER_IP   = "192.168.29.17"

# Find git (common install locations)
$GIT_BIN = (Get-Command git -ErrorAction SilentlyContinue).Source
if (-not $GIT_BIN) {
  $candidates = @(
    "$env:ProgramFiles\Git\bin\git.exe",
    "${env:ProgramFiles(x86)}\Git\bin\git.exe",
    "$env:LOCALAPPDATA\Programs\Git\bin\git.exe",
    "$env:USERPROFILE\scoop\shims\git.exe"
  )
  foreach ($c in $candidates) {
    if (Test-Path $c) { $GIT_BIN = $c; break }
  }
}

$NODE_BIN = (Get-Command node -ErrorAction SilentlyContinue).Source
$NPM_BIN  = (Get-Command npm -ErrorAction SilentlyContinue).Source

Write-Host "=== QMS Dashboard NSSM Deployment ===" -ForegroundColor Cyan
Write-Host "[INFO] Checking prerequisites..." -ForegroundColor Cyan

if (-not $NODE_BIN) {
  Write-Host "[ERROR] Node.js not found. Install from https://nodejs.org/" -ForegroundColor Red
  exit 1
}
Write-Host "[OK] Node.js $(node --version) at $NODE_BIN" -ForegroundColor Green

$nssmPath = Get-Command nssm -ErrorAction SilentlyContinue
if (-not $nssmPath) {
  Write-Host "[ERROR] NSSM not found. Install from https://nssm.cc/download" -ForegroundColor Red
  exit 1
}
Write-Host "[OK] NSSM at $($nssmPath.Source)" -ForegroundColor Green

# --------------------------------------------------
# 2. Clone / pull repo
# --------------------------------------------------
if (-not $GIT_BIN) {
  Write-Host "[ERROR] Git not found. Install from https://git-scm.com/" -ForegroundColor Red
  exit 1
}
if (Test-Path "$INSTALL_DIR\.git") {
  Write-Host "[INFO] Repository exists -- pulling latest..." -ForegroundColor Cyan
  & $GIT_BIN fetch origin
  & $GIT_BIN reset --hard "origin/$BRANCH"
} else {
  Write-Host "[INFO] Cloning repository to $INSTALL_DIR..." -ForegroundColor Cyan
  & $GIT_BIN clone --branch $BRANCH $REPO_URL "$INSTALL_DIR"
}
Set-Location $INSTALL_DIR
Write-Host "[OK] Repository at $INSTALL_DIR (branch: $BRANCH)" -ForegroundColor Green

# --------------------------------------------------
# 3. Install dependencies
# --------------------------------------------------
Write-Host "[INFO] Installing dependencies..." -ForegroundColor Cyan
npm install --silent --no-audit --no-fund
if ($LASTEXITCODE -ne 0) {
  Write-Host "[ERROR] npm install failed" -ForegroundColor Red
  exit 1
}
Write-Host "[OK] Dependencies installed" -ForegroundColor Green

# --------------------------------------------------
# 4. Generate Prisma client
# --------------------------------------------------
Write-Host "[INFO] Generating Prisma client..." -ForegroundColor Cyan
npx prisma generate --schema apps/api/prisma/schema.prisma
Write-Host "[OK] Prisma client generated" -ForegroundColor Green

# --------------------------------------------------
# 5. Generate .env with secrets
# --------------------------------------------------
$envFile = "$INSTALL_DIR\apps\api\.env"
if (-not (Test-Path $envFile)) {
  Write-Host "[INFO] Generating .env with secure secrets..." -ForegroundColor Cyan

  $bytes = [byte[]]::new(48)
  [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
  $jwtSecret = "qs-" + [Convert]::ToBase64String($bytes) -replace "[^a-zA-Z0-9]", ""

  $encBytes = [byte[]]::new(32)
  [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($encBytes)
  $encKey = [Convert]::ToBase64String($encBytes) -replace "[^a-zA-Z0-9]", ""

  $agentKey = "agent-" + -join ((65..90) + (97..122) + (48..57) | Get-Random -Count 24 | ForEach-Object { [char]$_ })

  $lines = @()
  $lines += "# Server"
  $lines += "PORT=$API_PORT"
  $lines += "NODE_ENV=production"
  $lines += ""
  $lines += "# Database (SQLite)"
  $lines += 'DATABASE_URL="file:./data/qms.db?connection_limit=10&journal_mode=WAL"'
  $lines += ""
  $lines += "# JWT"
  $lines += "JWT_SECRET=$jwtSecret"
  $lines += "JWT_EXPIRES_IN=24h"
  $lines += "JWT_REFRESH_EXPIRES_IN=7d"
  $lines += ""
  $lines += "# Veyon - configure after Veyon Master is installed"
  $lines += "VEYON_CLI_PATH=veyon-cli"
  $lines += "VEYON_API_KEY="
  $lines += "VEYON_WEBAPI_URL=http://localhost:11080/api/v1"
  $lines += "VEYON_PRIVATE_KEY_PATH="
  $lines += "VEYON_KEY_NAME=dashboard-key"
  $lines += ""
  $lines += "# ActivityWatch"
  $lines += "ACTIVITYWATCH_API_URL=http://localhost:5600/api"
  $lines += "ACTIVITYWATCH_API_KEY="
  $lines += ""
  $lines += "# Agent"
  $lines += "AGENT_KEY=$agentKey"
  $lines += ""
  $lines += "# Encryption"
  $lines += "ENCRYPTION_KEY=$encKey"
  $lines += ""
  $lines += "# CORS"
  $lines += "CORS_ORIGIN=http://${SERVER_IP}:${WEB_PORT}"

  $lines -join [Environment]::NewLine | Set-Content -Path $envFile -Encoding UTF8 -NoNewline

  Write-Host "[OK] .env created at $envFile" -ForegroundColor Green
  Write-Host "[WARN] AGENT_KEY=$agentKey -- copy this to your agent config" -ForegroundColor Yellow
  Write-Host "[WARN] Edit VEYON_* settings after installing Veyon Master" -ForegroundColor Yellow
} else {
  Write-Host "[INFO] .env already exists, using existing values" -ForegroundColor Cyan
}

# --------------------------------------------------
# 6. Push database schema
# --------------------------------------------------
Write-Host "[INFO] Setting up database..." -ForegroundColor Cyan
Set-Location "$INSTALL_DIR\apps\api"
npx prisma db push --accept-data-loss
if ($LASTEXITCODE -ne 0) {
  Write-Host "[ERROR] prisma db push failed" -ForegroundColor Red
  exit 1
}
Write-Host "[OK] Database schema applied" -ForegroundColor Green

# --------------------------------------------------
# 7. Build applications
# --------------------------------------------------
Write-Host "[INFO] Building API..." -ForegroundColor Cyan
Set-Location "$INSTALL_DIR\apps\api"
npm run build
if ($LASTEXITCODE -ne 0) {
  Write-Host "[ERROR] API build failed" -ForegroundColor Red
  exit 1
}
Write-Host "[OK] API built" -ForegroundColor Green

Write-Host "[INFO] Building Web..." -ForegroundColor Cyan
Set-Location "$INSTALL_DIR\apps\web"
npm run build
if ($LASTEXITCODE -ne 0) {
  Write-Host "[ERROR] Web build failed" -ForegroundColor Red
  exit 1
}
Write-Host "[OK] Web built" -ForegroundColor Green

# --------------------------------------------------
# 8. Build agent executable
# --------------------------------------------------
Write-Host "[INFO] Building agent executable..." -ForegroundColor Cyan
Set-Location "$INSTALL_DIR\packages\qms-agent"
npm run build
if ($LASTEXITCODE -ne 0) {
  Write-Host "[ERROR] Agent build failed" -ForegroundColor Red
  exit 1
}
$shell = if (Get-Command pwsh -ErrorAction SilentlyContinue) { "pwsh" } else { "powershell" }
& $shell -File build-exe.ps1 -OutDir "$INSTALL_DIR\dist"
if ($LASTEXITCODE -ne 0) {
  Write-Host "[ERROR] Agent EXE build failed" -ForegroundColor Red
  exit 1
}
Write-Host "[OK] Agent EXE built: $INSTALL_DIR\dist\qms-agent.exe" -ForegroundColor Green

# --------------------------------------------------
# 9. Stop existing NSSM services if running
# --------------------------------------------------
@("QMS-API", "QMS-WEB") | ForEach-Object {
  $svc = nssm status $_ 2>$null
  if ($LASTEXITCODE -eq 0) {
    Write-Host "[INFO] Stopping existing service $_..." -ForegroundColor Cyan
    nssm stop $_ 2>$null
    nssm remove $_ confirm 2>$null
  }
}

# --------------------------------------------------
# 10. Create NSSM services
# --------------------------------------------------
Write-Host "[INFO] Creating NSSM services..." -ForegroundColor Cyan

nssm install QMS-API "$NODE_BIN"
nssm set QMS-API AppParameters "$INSTALL_DIR\apps\api\dist\index.js"
nssm set QMS-API AppDirectory "$INSTALL_DIR\apps\api"
nssm set QMS-API AppStdout "$INSTALL_DIR\apps\api\logs\api-out.log"
nssm set QMS-API AppStderr "$INSTALL_DIR\apps\api\logs\api-err.log"
nssm set QMS-API AppRotateFiles 1
nssm set QMS-API AppRotateOnline 1
nssm set QMS-API AppRotateSeconds 86400
nssm set QMS-API Start SERVICE_AUTO_START
nssm set QMS-API DisplayName "QMS Dashboard API"
nssm set QMS-API Description "Backend API for QMS Dashboard"
Write-Host "[OK] QMS-API service created" -ForegroundColor Green

nssm install QMS-WEB "$NPM_BIN"
nssm set QMS-WEB AppParameters "run start"
nssm set QMS-WEB AppDirectory "$INSTALL_DIR\apps\web"
nssm set QMS-WEB AppStdout "$INSTALL_DIR\apps\web\logs\web-out.log"
nssm set QMS-WEB AppStderr "$INSTALL_DIR\apps\web\logs\web-err.log"
nssm set QMS-WEB AppRotateFiles 1
nssm set QMS-WEB AppRotateOnline 1
nssm set QMS-WEB AppRotateSeconds 86400
nssm set QMS-WEB Start SERVICE_AUTO_START
nssm set QMS-WEB DisplayName "QMS Dashboard Web"
nssm set QMS-WEB Description "Next.js frontend for QMS Dashboard"
Write-Host "[OK] QMS-WEB service created" -ForegroundColor Green

# --------------------------------------------------
# 11. Start services
# --------------------------------------------------
Write-Host "[INFO] Starting services..." -ForegroundColor Cyan
nssm start QMS-API
Write-Host "[OK] QMS-API started" -ForegroundColor Green

Start-Sleep -Seconds 5

nssm start QMS-WEB
Write-Host "[OK] QMS-WEB started" -ForegroundColor Green

# --------------------------------------------------
# 12. Health check
# --------------------------------------------------
Write-Host "[INFO] Running health check..." -ForegroundColor Cyan
Start-Sleep -Seconds 8

try {
  $response = Invoke-WebRequest -Uri "http://localhost:$API_PORT/api/health" -UseBasicParsing -TimeoutSec 10
  if ($response.StatusCode -eq 200) {
    Write-Host "[OK] API health check passed (HTTP $($response.StatusCode))" -ForegroundColor Green
  } else {
    Write-Host "[WARN] API returned HTTP $($response.StatusCode)" -ForegroundColor Yellow
  }
} catch {
  Write-Host "[WARN] API health check failed: $($_.Exception.Message)" -ForegroundColor Yellow
}

try {
  $response = Invoke-WebRequest -Uri "http://localhost:$WEB_PORT" -UseBasicParsing -TimeoutSec 10
  if ($response.StatusCode -eq 200) {
    Write-Host "[OK] Web health check passed (HTTP $($response.StatusCode))" -ForegroundColor Green
  } else {
    Write-Host "[WARN] Web returned HTTP $($response.StatusCode)" -ForegroundColor Yellow
  }
} catch {
  Write-Host "[WARN] Web health check failed: $($_.Exception.Message)" -ForegroundColor Yellow
}

# --------------------------------------------------
# 13. Summary
# --------------------------------------------------
Write-Host ""
Write-Host "===========================================" -ForegroundColor Green
Write-Host "  Deployment complete!" -ForegroundColor Green
Write-Host "  API:     http://${SERVER_IP}:${API_PORT}" -ForegroundColor Green
Write-Host "  Web:     http://${SERVER_IP}:${WEB_PORT}" -ForegroundColor Green
Write-Host "  Install: ${INSTALL_DIR}" -ForegroundColor Green
Write-Host "===========================================" -ForegroundColor Green
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
Write-Host "  3. Copy agent EXE from ${INSTALL_DIR}\dist\qms-agent.exe" -ForegroundColor Yellow
Write-Host "  4. Run scripts\deploy-agent.ps1 on each target machine" -ForegroundColor Yellow
Write-Host "  5. Access dashboard at http://${SERVER_IP}:${WEB_PORT}" -ForegroundColor Yellow
Write-Host "  6. Login with admin@qserveits.com / admin" -ForegroundColor Yellow