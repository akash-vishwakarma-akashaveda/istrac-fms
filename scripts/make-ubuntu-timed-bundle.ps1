# ==============================================================================
# 🛰️ ISTRAC-SIMS — Ubuntu Timed Bundle Packaging Script
# Generates an air-gapped Ubuntu deployment archive with timestamp naming:
# istrac-sims-ubuntu-bundle-<yyyyMMdd_HHmmss>.zip
# ==============================================================================

$ErrorActionPreference = "Stop"

$ts = Get-Date -Format "yyyyMMdd_HHmmss"
$bundleName = "istrac-sims-ubuntu-bundle-$ts"
$distOfflineDir = "D:\istrac-fms\dist-offline"
$destFolder = Join-Path $distOfflineDir $bundleName
$zipFile = Join-Path $distOfflineDir "$bundleName.zip"
$sharedFolder = "D:\Rhel_Shared_Folder"
$sharedZipFile = Join-Path $sharedFolder "$bundleName.zip"

Write-Host "==============================================================================" -ForegroundColor Cyan
Write-Host " 🛰️  BUILDING UBUNTU AIR-GAPPED BUNDLE: $bundleName" -ForegroundColor Cyan
Write-Host "==============================================================================" -ForegroundColor Cyan

# 1. Clean / create destination directory structure
if (Test-Path $destFolder) {
    Remove-Item $destFolder -Recurse -Force
}
New-Item -ItemType Directory -Path $destFolder -Force | Out-Null
New-Item -ItemType Directory -Path (Join-Path $destFolder "deploy") -Force | Out-Null
New-Item -ItemType Directory -Path (Join-Path $destFolder "packages") -Force | Out-Null
New-Item -ItemType Directory -Path (Join-Path $destFolder "frontend") -Force | Out-Null
New-Item -ItemType Directory -Path (Join-Path $destFolder "backend") -Force | Out-Null

# 2. Copy Guides & Launchers (Ubuntu-only)
Write-Host "Copying documentation & Ubuntu launchers..." -ForegroundColor Green
Copy-Item "D:\istrac-fms\QUICK_SETUP_GUIDE.md" (Join-Path $destFolder "QUICK_SETUP_GUIDE.md") -Force
Copy-Item "D:\istrac-fms\STARTUP_GUIDE.md" (Join-Path $destFolder "STARTUP_GUIDE.md") -Force
Copy-Item "D:\istrac-fms\install.sh" (Join-Path $destFolder "install.sh") -Force
Copy-Item "D:\istrac-fms\manage-services-ubuntu.sh" (Join-Path $destFolder "manage-services-ubuntu.sh") -Force

# 3. Copy deploy directory items (Ubuntu-specific)
Write-Host "Copying deployment automation scripts..." -ForegroundColor Green
Copy-Item "D:\istrac-fms\deploy\setup-ubuntu.sh" (Join-Path $destFolder "deploy\setup-ubuntu.sh") -Force
Copy-Item "D:\istrac-fms\deploy\setup-domain.sh" (Join-Path $destFolder "deploy\setup-domain.sh") -Force
Copy-Item "D:\istrac-fms\deploy\verify.sh" (Join-Path $destFolder "deploy\verify.sh") -Force
Copy-Item "D:\istrac-fms\deploy\istrac-backend.service" (Join-Path $destFolder "deploy\istrac-backend.service") -Force
Copy-Item "D:\istrac-fms\deploy\istrac-worker.service" (Join-Path $destFolder "deploy\istrac-worker.service") -Force

# 4. Copy Standalone packages (Node.js 24 and Prisma schema engine)
Write-Host "Copying Node.js 24 binary tarball into packages/..." -ForegroundColor Green
$nodePkg = "D:\istrac-fms\dist-offline\istrac-fms-offline-bundle-20260918\rpms\node-v24.21.0-linux-x64.tar.xz"
if (Test-Path $nodePkg) {
    Copy-Item $nodePkg (Join-Path $destFolder "packages\node-v24.21.0-linux-x64.tar.xz") -Force
} else {
    Write-Warning "Node.js 24 package not found at $nodePkg"
}

Write-Host "Copying Prisma Linux schema engine into packages/..." -ForegroundColor Green
$engineSrc = "D:\istrac-fms\rpms\schema-engine-debian-openssl-3.0.x"
if (Test-Path $engineSrc) {
    Copy-Item $engineSrc (Join-Path $destFolder "packages\schema-engine-debian-openssl-3.0.x") -Force
} else {
    Write-Warning "Prisma engine binary not found at $engineSrc"
}

# Create packages/debs folder and write offline package instructions
New-Item -ItemType Directory -Path (Join-Path $destFolder "packages\debs") -Force | Out-Null
$packagesReadme = @"
==============================================================================
ISTRAC-SIMS — OFFLINE PACKAGES DIRECTORY
==============================================================================
This directory holds offline binaries and packages for Ubuntu 24.04:

1. node-v24.21.0-linux-x64.tar.xz (Included)
   - Standalone Node.js 24 runtime binary. Automatically unpacked to /opt/node.

2. schema-engine-debian-openssl-3.0.x (Included)
   - Prisma ORM schema engine binary for Ubuntu 24.04 (OpenSSL 3.x).

3. Offline Debian Packages (*.deb) (Optional):
   - If your target Ubuntu 24.04 server does not yet have Apache2 or MySQL installed,
     you can copy .deb packages directly into this 'packages/' or 'packages/debs/' folder.
   - The installer (sudo ./install.sh) will automatically detect and install all .deb
     files found here offline using dpkg.
   - To download base deb packages on an internet-enabled Ubuntu machine:
       apt-get download apache2 mysql-server mysql-client curl tar

4. Redis Server Packages (*.deb) (Optional):
   - The application includes an in-memory caching fallback, so Redis is not mandatory.
   - To enable standalone Redis:
       apt-get download redis-server redis-tools libjemalloc2
   - Place them in this 'packages/' folder. The installer will auto-install and start Redis.
==============================================================================
"@
[System.IO.File]::WriteAllText((Join-Path $destFolder "packages\README_PACKAGES.txt"), $packagesReadme.Replace("`r`n", "`n"), (New-Object System.Text.UTF8Encoding($false)))

# 5. Copy Frontend dist
Write-Host "Copying compiled React 19 frontend..." -ForegroundColor Green
Copy-Item "D:\istrac-fms\frontend\dist" (Join-Path $destFolder "frontend\dist") -Recurse -Force

# 6. Copy Backend artifacts
Write-Host "Copying backend dist, prisma, and node_modules..." -ForegroundColor Green
Copy-Item "D:\istrac-fms\backend\dist" (Join-Path $destFolder "backend\dist") -Recurse -Force
Copy-Item "D:\istrac-fms\backend\prisma" (Join-Path $destFolder "backend\prisma") -Recurse -Force
Copy-Item "D:\istrac-fms\backend\package.json" (Join-Path $destFolder "backend\package.json") -Force
Copy-Item "D:\istrac-fms\backend\prisma.config.ts" (Join-Path $destFolder "backend\prisma.config.ts") -Force
Copy-Item "D:\istrac-fms\backend\.env.example" (Join-Path $destFolder "backend\.env.example") -Force

# Copy intact node_modules (production dependencies)
$nmSrc = "D:\istrac-fms\backend\node_modules"
if (-not (Test-Path $nmSrc)) {
    $nmSrc = "D:\istrac-fms\dist-offline\istrac-fms-offline-bundle-20260918\backend\node_modules"
}
Write-Host "Copying offline backend node_modules from $nmSrc..." -ForegroundColor Green
Copy-Item $nmSrc (Join-Path $destFolder "backend\node_modules") -Recurse -Force

# Ensure offline Prisma Linux schema engine binary is inside backend node_modules
if (Test-Path $engineSrc) {
    Write-Host "Verifying Prisma schema engine inside backend node_modules..." -ForegroundColor Green
    $prismaEnginesDir = Join-Path $destFolder "backend\node_modules\@prisma\engines"
    if (-not (Test-Path $prismaEnginesDir)) {
        New-Item -ItemType Directory -Path $prismaEnginesDir -Force | Out-Null
    }
    Copy-Item $engineSrc (Join-Path $prismaEnginesDir "schema-engine-debian-openssl-3.0.x") -Force

    $prismaCliDir = Join-Path $destFolder "backend\node_modules\prisma"
    if (Test-Path $prismaCliDir) {
        Copy-Item $engineSrc (Join-Path $prismaCliDir "schema-engine-debian-openssl-3.0.x") -Force
    }
}

# 7. Normalize line endings (CRLF -> LF) for Linux scripts and configs (skip node_modules for speed)
Write-Host "Normalizing line endings to Unix (LF)..." -ForegroundColor Green
$textFiles = @(
    (Join-Path $destFolder "QUICK_SETUP_GUIDE.md"),
    (Join-Path $destFolder "STARTUP_GUIDE.md"),
    (Join-Path $destFolder "install.sh"),
    (Join-Path $destFolder "manage-services-ubuntu.sh"),
    (Join-Path $destFolder "deploy\setup-ubuntu.sh"),
    (Join-Path $destFolder "deploy\setup-domain.sh"),
    (Join-Path $destFolder "deploy\verify.sh"),
    (Join-Path $destFolder "deploy\istrac-backend.service"),
    (Join-Path $destFolder "deploy\istrac-worker.service"),
    (Join-Path $destFolder "backend\.env.example"),
    (Join-Path $destFolder "backend\package.json"),
    (Join-Path $destFolder "backend\prisma.config.ts")
)
foreach ($filePath in $textFiles) {
    if (Test-Path $filePath) {
        $content = [System.IO.File]::ReadAllText($filePath)
        $content = $content.Replace("`r`n", "`n")
        [System.IO.File]::WriteAllText($filePath, $content, (New-Object System.Text.UTF8Encoding($false)))
    }
}

# 8. Assert NO Windows or RHEL remnants exist at top levels
Write-Host "Verifying absence of Windows and legacy RHEL files..." -ForegroundColor Green
$rootForbidden = Get-ChildItem -Path $destFolder | Where-Object {
    $_.Name -match '\.(bat|ps1)$' -or $_.Name -match '(?i)(windows|rhel)' -or $_.Name -eq 'handover' -or $_.Name -eq 'rpms'
}
if ($rootForbidden) {
    $rootForbidden | Remove-Item -Recurse -Force
}

$deployForbidden = Get-ChildItem -Path (Join-Path $destFolder "deploy") | Where-Object {
    $_.Name -match '\.(bat|ps1)$' -or $_.Name -match '(?i)(rhel|httpd|nginx)'
}
if ($deployForbidden) {
    $deployForbidden | Remove-Item -Recurse -Force
}

# 9. Create Zip Archive using tar.exe (without leading ./ so Windows Explorer can extract cleanly)
Write-Host "Compressing bundle into $zipFile..." -ForegroundColor Green
if (Test-Path $zipFile) { Remove-Item $zipFile -Force }
Push-Location $destFolder
try {
    & tar.exe -a -c -f $zipFile *
} finally {
    Pop-Location
}

$zipItem = Get-Item $zipFile
$zipSizeMB = [math]::Round($zipItem.Length / 1MB, 2)
Write-Host "Archive created: $zipFile ($zipSizeMB MB)" -ForegroundColor Green

# 10. Copy Zip Archive to VM Shared Folder if available
if (Test-Path $sharedFolder) {
    Write-Host "Copying zip to shared folder: $sharedZipFile..." -ForegroundColor Green
    Copy-Item $zipFile $sharedZipFile -Force
    Write-Host "Shared copy complete!" -ForegroundColor Green
}

Write-Host "==============================================================================" -ForegroundColor Cyan
Write-Host " 🎉 UBUNTU AIR-GAPPED BUNDLE READY!" -ForegroundColor Green
Write-Host " Archive: $zipFile" -ForegroundColor Cyan
Write-Host " Size:    $zipSizeMB MB" -ForegroundColor Cyan
Write-Host " Timestamp: $ts" -ForegroundColor Cyan
Write-Host "==============================================================================" -ForegroundColor Cyan
