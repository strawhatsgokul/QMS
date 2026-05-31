param(
    [switch]$SkipInstall,
    [switch]$SkipDb
)

Write-Host "=== QMS Dashboard Setup ===" -ForegroundColor Cyan
Write-Host ""

$rootDir = Split-Path -Parent $PSScriptRoot
Set-Location $rootDir

if (-not $SkipInstall) {
    Write-Host "[1/4] Installing dependencies..." -ForegroundColor Yellow
    npm install
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Failed to install dependencies" -ForegroundColor Red
        exit 1
    }
}

Write-Host "[2/4] Building shared packages..." -ForegroundColor Yellow
npm run build:shared
if ($LASTEXITCODE -ne 0) {
    Write-Host "Failed to build shared packages" -ForegroundColor Red
    exit 1
}

if (-not $SkipDb) {
    Write-Host "[3/4] Setting up database..." -ForegroundColor Yellow

    # Check if PostgreSQL is accessible
    $pgExists = Get-Command psql -ErrorAction SilentlyContinue
    if (-not $pgExists) {
        Write-Host "PostgreSQL client not found. Make sure PostgreSQL is installed and running." -ForegroundColor Yellow
        Write-Host "You can still run the app with: npm run dev:api" -ForegroundColor Yellow
    } else {
        Write-Host "Generating Prisma client..." -ForegroundColor Gray
        npm run db:generate

        Write-Host "Pushing database schema..." -ForegroundColor Gray
        npm run db:push

        Write-Host "Seeding database..." -ForegroundColor Gray
        npm run db:seed
    }
}

Write-Host "[4/4] Setup complete!" -ForegroundColor Green
Write-Host ""
Write-Host "To start development:" -ForegroundColor Cyan
Write-Host "  npm run dev          # Start both API and Web" -ForegroundColor White
Write-Host "  npm run dev:api      # Start API only (port 4000)" -ForegroundColor White
Write-Host "  npm run dev:web      # Start Web only (port 3000)" -ForegroundColor White
Write-Host ""
Write-Host "Default credentials:" -ForegroundColor Cyan
Write-Host "  Admin:  admin@qms.local / admin123" -ForegroundColor White
Write-Host "  Teacher: teacher@qms.local / teacher123" -ForegroundColor White
