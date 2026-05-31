param(
  [string]$OutDir = ".\dist",
  [string]$AgentKey = "test-agent-key-2026",
  [string]$ApiUrl = "http://localhost:4000"
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSCommandPath
Set-Location $root

Write-Host "=== QMS Agent EXE Builder ===" -ForegroundColor Cyan

# Step 1: Build TypeScript
Write-Host "[1/4] Compiling TypeScript..." -ForegroundColor Yellow
npx tsc
if ($LASTEXITCODE -ne 0) { throw "tsc failed" }

# Step 2: Build executable with pkg
Write-Host "[2/4] Bundling executable with pkg..." -ForegroundColor Yellow
New-Item -ItemType Directory -Path $OutDir -Force | Out-Null
npx @yao-pkg/pkg dist/index.js --target node24-win-x64 --output "$OutDir\qms-agent.exe" --compress GZip
if ($LASTEXITCODE -ne 0) { throw "pkg failed" }

# Step 3: Verify
Write-Host "[3/4] Verifying executable..." -ForegroundColor Yellow
$exePath = "$OutDir\qms-agent.exe"
if (Test-Path $exePath) {
  $size = (Get-Item $exePath).Length
  Write-Host "Executable size: $([math]::Round($size / 1MB, 2)) MB"
} else {
  throw "Executable not found at $exePath"
}

# Step 4: Clean up pkg cache
Write-Host "[4/4] Cleaning up..." -ForegroundColor Yellow
Remove-Item -Recurse -Force "$OutDir\blobs" -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force "$root\.pkg-cache" -ErrorAction SilentlyContinue

Write-Host ""
Write-Host "Build complete!" -ForegroundColor Green
Write-Host "Output: $exePath" -ForegroundColor White
Write-Host ""
Write-Host "Test:     & `"$exePath`" --api-url $ApiUrl --agent-key $AgentKey" -ForegroundColor Cyan
Write-Host "Install:  .\scripts\install-agent.ps1 -ApiUrl $ApiUrl -AgentKey $AgentKey" -ForegroundColor Cyan
