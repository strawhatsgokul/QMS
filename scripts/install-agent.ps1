param(
  [Parameter(Mandatory)]
  [string]$ApiUrl,
  [Parameter(Mandatory)]
  [string]$AgentKey,
  [string]$ExePath = "..\packages\qms-agent\dist\qms-agent.exe",
  [string]$InstallDir = "$env:ProgramFiles\QMS Agent",
  [string]$ServiceName = "QMSAgent",
  [string]$DataDir = "$env:ProgramData\QMS\agent",
  [switch]$SkipFirewall
)

$ErrorActionPreference = "Stop"

function Write-Step($msg) {
  Write-Host ">>> $msg" -ForegroundColor Yellow
}

function Test-Admin {
  $id = [Security.Principal.WindowsIdentity]::GetCurrent()
  $principal = New-Object Security.Principal.WindowsPrincipal($id)
  return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

if (-not (Test-Admin)) {
  Write-Host "ERROR: Administrator privileges required. Run as Administrator." -ForegroundColor Red
  exit 1
}

Write-Host "=== QMS Agent Installation ===" -ForegroundColor Cyan

# Step 1: Create directories
Write-Step "[1/6] Creating directories..."
New-Item -ItemType Directory -Path $InstallDir -Force | Out-Null
New-Item -ItemType Directory -Path $DataDir -Force | Out-Null
Write-Host "  Install dir: $InstallDir"
Write-Host "  Data dir: $DataDir"

# Step 2: Copy executable
Write-Step "[2/6] Copying executable..."
if (-not (Test-Path $ExePath)) {
  Write-Host "ERROR: Executable not found at $ExePath" -ForegroundColor Red
  Write-Host "Run build-exe.ps1 first or provide the correct path." -ForegroundColor Yellow
  exit 1
}
Copy-Item $ExePath "$InstallDir\qms-agent.exe" -Force
Write-Host "  Copied qms-agent.exe to $InstallDir"

# Step 3: Write config file
Write-Step "[3/6] Writing config file..."
$configPath = "$DataDir\config.json"
$config = @{
  apiUrl = $ApiUrl
  agentKey = $AgentKey
  dataDir = $DataDir
  heartbeatInterval = 30
  commandPollInterval = 5
} | ConvertTo-Json
Set-Content -Path $configPath -Value $config -Encoding UTF8
Write-Host "  Config written to $configPath"

# Step 4: Create Windows service
Write-Step "[4/6] Creating Windows service..."
$existing = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue
if ($existing) {
  Write-Host "  Service $ServiceName already exists, stopping and recreating..."
  Stop-Service $ServiceName -Force -ErrorAction SilentlyContinue
  Start-Sleep 2
  & sc.exe delete $ServiceName
  Start-Sleep 2
}

& sc.exe create $ServiceName binPath="$InstallDir\qms-agent.exe --api-url $ApiUrl --agent-key $AgentKey --data-dir $DataDir" start=auto
if ($LASTEXITCODE -ne 0) { throw "Failed to create service" }

& sc.exe description $ServiceName "QMS Client Agent - Monitors system stats, Veyon, and ActivityWatch for the QMS Dashboard"
& sc.exe failure $ServiceName reset=86400 actions=restart/10000/restart/30000/restart/60000

Write-Host "  Service $ServiceName created (auto-start)"

# Step 5: Create firewall rule
if (-not $SkipFirewall) {
  Write-Step "[5/6] Creating firewall rule..."
  $ruleName = "QMS Agent (Outbound)"
  $existingRule = Get-NetFirewallRule -DisplayName $ruleName -ErrorAction SilentlyContinue
  if (-not $existingRule) {
    New-NetFirewallRule -DisplayName $ruleName -Direction Outbound -Program "$InstallDir\qms-agent.exe" -Action Allow -Profile Any | Out-Null
    Write-Host "  Firewall rule '$ruleName' created"
  } else {
    Write-Host "  Firewall rule already exists, skipping"
  }
} else {
  Write-Step "[5/6] Skipping firewall rule..."
}

# Step 6: Start service
Write-Step "[6/6] Starting service..."
Start-Service $ServiceName
Start-Sleep 3
$svcStatus = Get-Service $ServiceName
if ($svcStatus.Status -eq 'Running') {
  Write-Host "  Service started successfully" -ForegroundColor Green
} else {
  Write-Host "  WARNING: Service status is $($svcStatus.Status)" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "=== Installation Complete ===" -ForegroundColor Green
Write-Host "Service: $ServiceName" -ForegroundColor White
Write-Host "Executable: $InstallDir\qms-agent.exe" -ForegroundColor White
Write-Host "Config: $configPath" -ForegroundColor White
Write-Host "Data: $DataDir" -ForegroundColor White
Write-Host ""
Write-Host "Manage the service:" -ForegroundColor Cyan
Write-Host "  Stop:     sc stop $ServiceName" -ForegroundColor Gray
Write-Host "  Start:    sc start $ServiceName" -ForegroundColor Gray
Write-Host "  Status:   sc query $ServiceName" -ForegroundColor Gray
Write-Host "  Uninstall: .\scripts\uninstall-agent.ps1" -ForegroundColor Gray
