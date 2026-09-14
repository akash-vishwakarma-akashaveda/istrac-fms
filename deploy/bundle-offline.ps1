# ==============================================================================
# ISTRAC-FMS Offline Bundle Packaging Script (Windows PowerShell)
# Produces an air-gapped deployment bundle containing all binaries and assets.
# ==============================================================================

$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RootDir = Split-Path -Parent $ScriptDir
$DateStr = Get-Date -Format "yyyyMMdd"
$BundleName = "istrac-fms-offline-bundle-$DateStr"
$OutDir = Join-Path $RootDir "dist-offline\$BundleName"

Write-Host "======================================================================" -ForegroundColor Cyan
Write-Host "🛰️  PACKAGING ISTRAC-FMS AIR-GAPPED DEPLOYMENT BUNDLE (WINDOWS)" -ForegroundColor Cyan
Write-Host "======================================================================" -ForegroundColor Cyan
Write-Host "Project Root:     $RootDir"
Write-Host "Output Directory: $OutDir`n"

# 1. Clean previous build artifacts
if (Test-Path "$RootDir\dist-offline") {
    Remove-Item -Recurse -Force "$RootDir\dist-offline"
}

New-Item -ItemType Directory -Path "$OutDir\rpms" -Force | Out-Null
New-Item -ItemType Directory -Path "$OutDir\backend" -Force | Out-Null
New-Item -ItemType Directory -Path "$OutDir\frontend" -Force | Out-Null
New-Item -ItemType Directory -Path "$OutDir\deploy" -Force | Out-Null

# 2. Build Frontend
Write-Host "📦 1/4: Building Frontend (Vite Production SPA)..." -ForegroundColor Yellow
Set-Location "$RootDir\frontend"
npm run build
Copy-Item -Recurse "$RootDir\frontend\dist" "$OutDir\frontend\dist"

# 3. Build Backend & Prisma Engines
Write-Host "📦 2/4: Building Backend & Generating Prisma Engines..." -ForegroundColor Yellow
Set-Location "$RootDir\backend"
npx prisma generate
npm run build

Copy-Item -Recurse "$RootDir\backend\dist" "$OutDir\backend\dist"
Copy-Item -Recurse "$RootDir\backend\prisma" "$OutDir\backend\prisma"
Copy-Item "$RootDir\backend\package.json" "$OutDir\backend\package.json"
Copy-Item "$RootDir\backend\package-lock.json" "$OutDir\backend\package-lock.json"

# Package production node_modules
Write-Host "📦 3/4: Packaging production node_modules..." -ForegroundColor Yellow
npm prune --production
Copy-Item -Recurse "$RootDir\backend\node_modules" "$OutDir\backend\node_modules"

# Restore dev dependencies for local workspace
npm install --silent

# 4. Copy Deployment Scripts
Write-Host "📄 4/4: Copying deployment configurations and service units..." -ForegroundColor Yellow
Copy-Item -Recurse "$RootDir\deploy\*" "$OutDir\deploy\"
Copy-Item "$RootDir\deploy\install.sh" "$OutDir\install.sh"

# 5. Create compressed zip archive
Write-Host "🗜️  Creating compressed zip archive..." -ForegroundColor Yellow
$ZipPath = Join-Path "$RootDir\dist-offline" "$BundleName.zip"
Compress-Archive -Path "$OutDir" -DestinationPath "$ZipPath" -Force

Write-Host "`n======================================================================" -ForegroundColor Green
Write-Host "✅ OFFLINE BUNDLE READY FOR AIR-GAPPED TRANSFER!" -ForegroundColor Green
Write-Host "Directory: $OutDir" -ForegroundColor Green
Write-Host "Zip File:  $ZipPath" -ForegroundColor Green
Write-Host "======================================================================" -ForegroundColor Green
