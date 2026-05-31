#!/usr/bin/env pwsh
<#
.SYNOPSIS
  Deploy the QMS Dashboard using Docker Compose.
.DESCRIPTION
  Checks prerequisites, generates .env secrets, ensures lockfile,
  builds and starts containers, and runs a health check.
#>

$ErrorActionPreference = 'Stop'
$InformationPreference = 'Continue'

function Write-Info  { Write-Host "[INFO]  $args" -ForegroundColor Cyan }
function Write-Ok    { Write-Host "[OK]    $args" -ForegroundColor Green }
function Write-Warn  { Write-Host "[WARN]  $args" -ForegroundColor Yellow }
function Write-Err   { Write-Host "[ERROR] $args" -ForegroundColor Red }

$rootDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $rootDir

Write-Info "=== QMS Dashboard Deployment ==="

# --------------------------------------------------
# 1. Check Docker
# --------------------------------------------------
Write-Info "Checking prerequisites..."

$dockerVer = docker --version 2>$null
if (-not $dockerVer) {
  Write-Err "Docker is not installed or not in PATH."
  Write-Err "Install Docker Desktop first: https://docs.docker.com/desktop/setup/install/windows-install/"
  exit 1
}

$composeVer = docker compose version 2>$null
if (-not $composeVer) {
  Write-Err "Docker Compose (v2) is not available."
  Write-Err "Ensure 'docker compose' (not docker-compose) works."
  exit 1
}

Write-Ok "Docker: $dockerVer"
Write-Ok "Compose: $composeVer"

# --------------------------------------------------
# 2. Create data directory
# --------------------------------------------------
New-Item -ItemType Directory -Path ./data -Force | Out-Null
Write-Ok "Data directory: ./data"

# --------------------------------------------------
# 3. Generate .env with secrets
# --------------------------------------------------
if (-not (Test-Path .env)) {
  Write-Info "Generating .env with secure JWT_SECRET..."

  $bytes = [byte[]]::new(48)
  [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
  $jwtSecret = "qs-" + [Convert]::ToBase64String($bytes) -replace '[+/=]', ''

  @"
JWT_SECRET=${jwtSecret}
DATABASE_URL=file:./data/qms.db?connection_limit=10&journal_mode=WAL
NODE_ENV=production
"@ | Set-Content -Path .env -NoNewline

  Write-Ok ".env created with a random JWT_SECRET"
} else {
  Write-Info ".env already exists, using existing values"
}

# --------------------------------------------------
# 4. Install dependencies (ensures package-lock.json)
# --------------------------------------------------
Write-Info "Installing dependencies to update lockfile..."
npm install --silent --no-audit --no-fund
if ($LASTEXITCODE -ne 0) {
  Write-Err "npm install failed."
  exit 1
}
Write-Ok "Dependencies installed"

# --------------------------------------------------
# 5. Deploy with Docker Compose
# --------------------------------------------------
Write-Info "Building images and starting containers..."
docker compose up -d --build
if ($LASTEXITCODE -ne 0) {
  Write-Err "docker compose up failed."
  exit 1
}
Write-Ok "Containers started"

# --------------------------------------------------
# 6. Health check
# --------------------------------------------------
Write-Info "Waiting for services to be ready..."
Start-Sleep -Seconds 10

$healthUrl = "http://localhost/api/health"
try {
  $response = Invoke-WebRequest -Uri $healthUrl -UseBasicParsing -TimeoutSec 10
  $httpCode = [int]$response.StatusCode
} catch {
  $httpCode = 0
}

if ($httpCode -eq 200) {
  Write-Ok "Health check passed ($healthUrl → $httpCode)"

  $serverIp = (Get-NetIPAddress -AddressFamily IPv4 -InterfaceIndex (
    Get-NetRoute -DestinationPrefix '0.0.0.0/0' |
      Select-Object -First 1 -ExpandProperty InterfaceIndex
  ) 2>$null | Select-Object -First 1 -ExpandProperty IPAddress)

  Write-Host ""
  Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Green
  Write-Host "  Dashboard is live at:" -ForegroundColor Green
  Write-Host "    http://localhost" -ForegroundColor Green
  if ($serverIp) {
    Write-Host "    http://$serverIp" -ForegroundColor Green
  }
  Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Green
} else {
  Write-Warn "Health check returned HTTP $httpCode. Checking container status..."

  docker compose ps --format "table {{.Name}}\t{{.Status}}\t{{.Ports}}"

  Write-Host ""
  Write-Warn "Services may still be starting up. Try:"
  Write-Warn "  docker compose logs --tail=50"
  Write-Warn "  curl -s $healthUrl"
}
