<#
.SYNOPSIS
  Install/update QMS Agent on a target Windows computer.
.DESCRIPTION
  Downloads the latest agent EXE from GitHub releases (or a network share),
  installs as NSSM service, and registers with the QMS API server.

  Run this on each computer that the QMS Dashboard should manage.
#>

param(
    [Parameter(Mandatory)]
    [string]$ApiUrl,
    [Parameter(Mandatory)]
    [string]$AgentKey,
    [string]$InstallDir = "$env:ProgramFiles\QMS\Agent",
    [string]$Version = "latest"
)

$ErrorActionPreference = 'Stop'

function Write-Info  { Write-Host "[INFO]  $args" -ForegroundColor Cyan }
function Write-Ok    { Write-Host "[OK]    $args" -ForegroundColor Green }
function Write-Err   { Write-Host "[ERROR] $args" -ForegroundColor Red }

Write-Info "=== QMS Agent Deployment ==="
Write-Info "Target: $env:COMPUTERNAME"
Write-Info "API:    $ApiUrl"

# 1. Prerequisites
$nssmPath = Get-Command nssm -ErrorAction SilentlyContinue
if (-not $nssmPath) {
  Write-Err "NSSM not found. Install from https://nssm.cc/download"
  exit 1
}

# 2. Create install directory
New-Item -ItemType Directory -Path $InstallDir -Force | Out-Null

# 3. Download agent EXE
$exePath = "$InstallDir\qms-agent.exe"
if (-not (Test-Path $exePath)) {
  Write-Info "Downloading agent EXE..."
  if ($Version -eq "latest") {
    $releaseUrl = "https://github.com/strawhatsgokul/QMS/releases/latest/download/qms-agent-win-x64.exe"
  } else {
    $releaseUrl = "https://github.com/strawhatsgokul/QMS/releases/download/$Version/qms-agent-win-x64.exe"
  }
  try {
    Invoke-WebRequest -Uri $releaseUrl -OutFile "$exePath.tmp" -UseBasicParsing
    Move-Item "$exePath.tmp" $exePath -Force
  } catch {
    Write-Warn "GitHub download failed: $($_.Exception.Message)"
    Write-Warn "Place qms-agent.exe manually in $InstallDir and re-run"
    exit 1
  }
}
Write-Ok "Agent binary: $exePath"

# 4. Create config file
$configPath = "$InstallDir\config.json"
$config = @{
  apiUrl   = $ApiUrl
  agentKey = $AgentKey
  hostname = $env:COMPUTERNAME
  logLevel = "info"
} | ConvertTo-Json

Set-Content -Path $configPath -Value $config -Encoding UTF8
Write-Ok "Config: $configPath"

# 5. Remove existing service
nssm stop QMS-Agent 2>$null
nssm remove QMS-Agent confirm 2>$null

# 6. Install as NSSM service
nssm install QMS-Agent $exePath
nssm set QMS-Agent AppParameters "--config `"$configPath`""
nssm set QMS-Agent AppDirectory $InstallDir
nssm set QMS-Agent AppStdout "$InstallDir\agent-out.log"
nssm set QMS-Agent AppStderr "$InstallDir\agent-err.log"
nssm set QMS-Agent AppRotateFiles 1
nssm set QMS-Agent AppRotateOnline 1
nssm set QMS-Agent AppRotateSeconds 86400
nssm set QMS-Agent Start SERVICE_AUTO_START
nssm set QMS-Agent DisplayName "QMS Agent"
nssm set QMS-Agent Description "Manages Veyon and ActivityWatch on this machine"
Write-Ok "QMS-Agent service created"

# 7. Start service
nssm start QMS-Agent
Write-Ok "QMS-Agent started"

Write-Host ""
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Green
Write-Host "  Agent deployed successfully on" -ForegroundColor Green
Write-Host "  $env:COMPUTERNAME" -ForegroundColor Green
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Green