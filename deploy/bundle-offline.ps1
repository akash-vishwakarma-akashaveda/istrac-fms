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
Write-Host ">>> PACKAGING ISTRAC-FMS AIR-GAPPED DEPLOYMENT BUNDLE (WINDOWS)" -ForegroundColor Cyan
Write-Host "======================================================================" -ForegroundColor Cyan
Write-Host "Project Root:     $RootDir"
Write-Host "Output Directory: $OutDir"
Write-Host ""

# 1. Clean previous build artifacts
if (Test-Path "$RootDir\dist-offline") {
    Write-Host "[1/5] Cleaning existing dist-offline directory..." -ForegroundColor Yellow
    Remove-Item -Recurse -Force "$RootDir\dist-offline"
}

New-Item -ItemType Directory -Path "$OutDir\rpms" -Force | Out-Null
if (Test-Path "$RootDir\rpms") {
    Copy-Item -Recurse "$RootDir\rpms\*" "$OutDir\rpms"
}
New-Item -ItemType Directory -Path "$OutDir\backend" -Force | Out-Null
New-Item -ItemType Directory -Path "$OutDir\frontend" -Force | Out-Null
New-Item -ItemType Directory -Path "$OutDir\deploy" -Force | Out-Null

# 2. Build Frontend
Write-Host "[2/5] Building Frontend (Vite Production SPA)..." -ForegroundColor Yellow
Set-Location "$RootDir\frontend"
npm run build
Copy-Item -Recurse "$RootDir\frontend\dist" "$OutDir\frontend\dist"

# 3. Build Backend & Prisma Engines
Write-Host "[3/5] Building Backend & Generating Prisma Engines..." -ForegroundColor Yellow
Set-Location "$RootDir\backend"
npx prisma generate
npm run build

Copy-Item -Recurse "$RootDir\backend\dist" "$OutDir\backend\dist"
Copy-Item -Recurse "$RootDir\backend\prisma" "$OutDir\backend\prisma"
Copy-Item "$RootDir\backend\package.json" "$OutDir\backend\package.json"
Copy-Item "$RootDir\backend\package-lock.json" "$OutDir\backend\package-lock.json"

# Package production node_modules
Write-Host "[4/5] Packaging production node_modules..." -ForegroundColor Yellow
npm prune --production
Copy-Item -Recurse "$RootDir\backend\node_modules" "$OutDir\backend\node_modules"

# Restore dev dependencies for local workspace
npm install --silent

# 4. Copy Deployment Scripts
Write-Host "[5/5] Copying deployment configurations and service units..." -ForegroundColor Yellow
Copy-Item -Recurse "$RootDir\deploy\*" "$OutDir\deploy"
Copy-Item "$RootDir\setup-rhel-offline.sh" "$OutDir\setup-rhel-offline.sh"
Copy-Item "$RootDir\setup-offline.sh" "$OutDir\setup-offline.sh"
Copy-Item "$RootDir\manage-services-rhel.sh" "$OutDir\manage-services-rhel.sh"
Copy-Item "$RootDir\OFFLINE_RHEL_SETUP_GUIDE.md" "$OutDir\OFFLINE_RHEL_SETUP_GUIDE.md"
Copy-Item "$RootDir\UBUNTU_24_OFFLINE_SETUP_GUIDE.md" "$OutDir\UBUNTU_24_OFFLINE_SETUP_GUIDE.md"
Copy-Item "$RootDir\STARTUP_GUIDE.md" "$OutDir\STARTUP_GUIDE.md"
if (Test-Path "$RootDir\backup_before_v1.sql") {
    Copy-Item "$RootDir\backup_before_v1.sql" "$OutDir\backup_before_v1.sql"
}
if (Test-Path "$RootDir\deploy\install-apache-offline.sh") {
    Copy-Item "$RootDir\deploy\install-apache-offline.sh" "$OutDir\install.sh" -Force
}

# Normalize line endings to Unix LF (\n) for all shell scripts and configs to prevent \r syntax errors on Linux
Write-Host ">>> Normalizing line endings (CRLF -> LF) for Linux compatibility..." -ForegroundColor Yellow
Get-ChildItem -Path $OutDir -Recurse -Include *.sh, *.service, *.conf | ForEach-Object {
    $content = [System.IO.File]::ReadAllText($_.FullName)
    $content = $content -replace '\r', ''
    [System.IO.File]::WriteAllText($_.FullName, $content, (New-Object System.Text.UTF8Encoding $false))
}

# 5. Create compressed zip archive
Write-Host ">>> Creating compressed zip archive..." -ForegroundColor Yellow
$ZipPath = Join-Path "$RootDir\dist-offline" "$BundleName.zip"
Compress-Archive -Path "$OutDir" -DestinationPath "$ZipPath" -Force

Write-Host ""
Write-Host "======================================================================" -ForegroundColor Green
Write-Host "[SUCCESS] OFFLINE BUNDLE READY FOR AIR-GAPPED TRANSFER!" -ForegroundColor Green
Write-Host "Directory: $OutDir" -ForegroundColor Green
Write-Host "Zip File:  $ZipPath" -ForegroundColor Green
Write-Host "======================================================================" -ForegroundColor Green
