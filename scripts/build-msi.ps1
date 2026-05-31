param(
  [string]$WixPath = "${env:ProgramFiles(x86)}\WiX Toolset v3.11\bin",
  [string]$OutDir = ".\dist"
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

Write-Host "=== QMS Agent MSI Builder ===" -ForegroundColor Cyan

# Check WiX is installed
$candle = "$WixPath\candle.exe"
$light = "$WixPath\light.exe"
if (-not (Test-Path $candle)) {
  Write-Host "ERROR: WiX Toolset not found at $WixPath" -ForegroundColor Red
  Write-Host "Install WiX Toolset v3.11 from: https://wixtoolset.org/releases/" -ForegroundColor Yellow
  Write-Host ""
  Write-Host "Or use the PowerShell installer instead:" -ForegroundColor Yellow
  Write-Host "  .\scripts\install-agent.ps1 -ApiUrl http://server:4000 -AgentKey your-key" -ForegroundColor Gray
  exit 1
}

# Step 1: Build the EXE first
Write-Host "[1/4] Building agent executable..." -ForegroundColor Yellow
& "$root\packages\qms-agent\build-exe.ps1"
if ($LASTEXITCODE -ne 0) { throw "Agent build failed" }

# Step 2: Compile WiX source to .wixobj
Write-Host "[2/4] Compiling WiX source..." -ForegroundColor Yellow
New-Item -ItemType Directory -Path "$OutDir\wixobj" -Force | Out-Null
& $candle -arch x64 -out "$OutDir\wixobj\qms-agent.wixobj" "$root\installer\qms-agent.wxs"
if ($LASTEXITCODE -ne 0) { throw "WiX compilation (candle) failed" }

# Step 3: Link to MSI
Write-Host "[3/4] Linking MSI..." -ForegroundColor Yellow
& $light -out "$OutDir\qms-agent.msi" "$OutDir\wixobj\qms-agent.wixobj" -ext WixUIExtension -cultures:en-us
if ($LASTEXITCODE -ne 0) { throw "WiX linking (light) failed" }

# Step 4: Verify
Write-Host "[4/4] Verifying MSI..." -ForegroundColor Yellow
$msiPath = "$OutDir\qms-agent.msi"
if (Test-Path $msiPath) {
  $size = (Get-Item $msiPath).Length
  Write-Host "MSI size: $([math]::Round($size / 1MB, 2)) MB"
  Write-Host "Output: $msiPath"
  Write-Host ""
  Write-Host "Build complete!" -ForegroundColor Green
  Write-Host "Install: msiexec /i `"$msiPath`"" -ForegroundColor Cyan
  Write-Host "Silent:  msiexec /i `"$msiPath`" AGENT_API_URL=`"http://server:4000`" AGENT_KEY=`"your-key`" /qn" -ForegroundColor Gray
} else {
  Write-Host "ERROR: MSI not created" -ForegroundColor Red
  exit 1
}
