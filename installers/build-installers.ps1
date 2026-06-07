<#
.SYNOPSIS
  Build QMS Server & Client installers using Inno Setup.
  Downloads Inno Setup automatically if not installed.
#>

param(
  [switch]$SkipAgentBuild,
  [switch]$ServerOnly,
  [switch]$ClientOnly
)

$ErrorActionPreference = "Stop"
$RepoRoot = Split-Path -Parent $PSScriptRoot
$InstallerDir = $PSScriptRoot
$DistDir = "$RepoRoot\dist"
$OutputDir = "$DistDir\installers"

# ── 1. Ensure Inno Setup ───────────────────────────────────
$isccPath = (Get-Command iscc -ErrorAction SilentlyContinue).Source
if (-not $isccPath) {
  $innoDir = "$env:ProgramFiles (x86)\Inno Setup 6"
  if (Test-Path "$innoDir\ISCC.exe") {
    $isccPath = "$innoDir\ISCC.exe"
  }
}
if (-not $isccPath) {
  Write-Host "[INFO] Inno Setup not found. Downloading..." -ForegroundColor Yellow
  $url = "https://jrsoftware.org/download.php/is.exe?site=1"
  $exePath = "$env:TEMP\innosetup-installer.exe"
  [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
  Invoke-WebRequest -Uri $url -OutFile $exePath -UseBasicParsing
  Write-Host "[INFO] Installing Inno Setup silently..." -ForegroundColor Yellow
  Start-Process -FilePath $exePath -ArgumentList "/VERYSILENT /SUPPRESSMSGBOXES /NORESTART /DIR=$innoDir" -Wait
  if (Test-Path "$innoDir\ISCC.exe") {
    $isccPath = "$innoDir\ISCC.exe"
  } else {
    Write-Host "[ERROR] Inno Setup installation failed. Install manually from https://jrsoftware.org/"

    exit 1
  }
}
Write-Host "[OK] Inno Setup at $isccPath" -ForegroundColor Green

# ── 2. Build agent EXE (if not skipped) ────────────────────
$agentExe = "$DistDir\qms-agent.exe"
if (-not $SkipAgentBuild -and -not (Test-Path $agentExe)) {
  Write-Host "[INFO] Building qms-agent.exe..." -ForegroundColor Cyan
  Set-Location "$RepoRoot\packages\qms-agent"
  npm run build
  if ($LASTEXITCODE -ne 0) { Write-Host "[ERROR] Agent TS build failed" -ForegroundColor Red; exit 1 }
  $shell = if (Get-Command pwsh -ErrorAction SilentlyContinue) { "pwsh" } else { "powershell" }
  & $shell -File build-exe.ps1 -OutDir $DistDir
  if ($LASTEXITCODE -ne 0) { Write-Host "[ERROR] Agent EXE build failed" -ForegroundColor Red; exit 1 }
  Write-Host "[OK] Agent EXE built: $agentExe" -ForegroundColor Green
} elseif (Test-Path $agentExe) {
  Write-Host "[OK] Agent EXE found: $agentExe" -ForegroundColor Green
}

# ── 3. Create output directory ─────────────────────────────
New-Item -ItemType Directory -Path $OutputDir -Force | Out-Null

# ── 4. Compile installers ─────────────────────────────────
$installers = @()
if (-not $ClientOnly) {
  $installers += "qms-server-setup.iss"
}
if (-not $ServerOnly) {
  $installers += "qms-client-setup.iss"
}

foreach ($iss in $installers) {
  $issPath = "$InstallerDir\$iss"
  if (-not (Test-Path $issPath)) {
    Write-Host "[WARN] Skipping $iss (file not found)" -ForegroundColor Yellow
    continue
  }
  Write-Host "[INFO] Compiling $iss..." -ForegroundColor Cyan
  Set-Location $InstallerDir
  & $isccPath "/O$OutputDir" "$issPath"
  if ($LASTEXITCODE -eq 0) {
    Write-Host "[OK] $iss compiled successfully" -ForegroundColor Green
  } else {
    Write-Host "[ERROR] $iss compilation failed (exit $LASTEXITCODE)" -ForegroundColor Red
  }
}

# ── 5. Summary ─────────────────────────────────────────────
Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "  Build complete!" -ForegroundColor Green
Write-Host "  Output: $OutputDir" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Get-ChildItem $OutputDir -Filter "*.exe" | ForEach-Object {
  $size = [math]::Round($_.Length / 1MB, 2)
  Write-Host "  $($_.Name)  ($size MB)" -ForegroundColor Cyan
}
