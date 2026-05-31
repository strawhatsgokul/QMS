param(
  [string]$ServiceName = "QMSAgent",
  [string]$InstallDir = "$env:ProgramFiles\QMS Agent",
  [string]$DataDir = "$env:ProgramData\QMS\agent",
  [switch]$RemoveData
)

$ErrorActionPreference = "Stop"

function Test-Admin {
  $id = [Security.Principal.WindowsIdentity]::GetCurrent()
  $principal = New-Object Security.Principal.WindowsPrincipal($id)
  return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

if (-not (Test-Admin)) {
  Write-Host "ERROR: Administrator privileges required. Run as Administrator." -ForegroundColor Red
  exit 1
}

Write-Host "=== QMS Agent Uninstallation ===" -ForegroundColor Cyan

# Step 1: Stop and delete service
Write-Host "[1/3] Stopping and removing service..."
$svc = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue
if ($svc) {
  Stop-Service $ServiceName -Force -ErrorAction SilentlyContinue
  Start-Sleep 3
  & sc.exe delete $ServiceName
  Start-Sleep 2
  Write-Host "  Service $ServiceName removed"
} else {
  Write-Host "  Service not found, skipping"
}

# Step 2: Remove firewall rule
Write-Host "[2/3] Removing firewall rule..."
$rule = Get-NetFirewallRule -DisplayName "QMS Agent (Outbound)" -ErrorAction SilentlyContinue
if ($rule) {
  Remove-NetFirewallRule -DisplayName "QMS Agent (Outbound)" -ErrorAction SilentlyContinue
  Write-Host "  Firewall rule removed"
} else {
  Write-Host "  Firewall rule not found, skipping"
}

# Step 3: Remove files
Write-Host "[3/3] Removing files..."
if (Test-Path $InstallDir) {
  Remove-Item -Recurse -Force $InstallDir -ErrorAction SilentlyContinue
  Write-Host "  Removed $InstallDir"
}
if ($RemoveData -and (Test-Path $DataDir)) {
  Remove-Item -Recurse -Force $DataDir -ErrorAction SilentlyContinue
  Write-Host "  Removed $DataDir"
} else {
  Write-Host "  Kept $DataDir (use -RemoveData to delete)"
}

Write-Host ""
Write-Host "=== Uninstallation Complete ===" -ForegroundColor Green
