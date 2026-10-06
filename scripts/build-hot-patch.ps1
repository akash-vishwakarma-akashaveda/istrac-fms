# ==============================================================================
# 🛰️ ISTRAC-SIMS — Hot-Patch Builder Script (Windows / Local Dev)
# Usage: powershell -ExecutionPolicy Bypass -File .\scripts\build-hot-patch.ps1
# ==============================================================================

$ErrorActionPreference = "Stop"

$rootDir = Split-Path -Parent $PSScriptRoot
$patchOutDir = Join-Path $rootDir "dist-patch"
$tempPatchDir = Join-Path $patchOutDir "patch-content"
$dateStr = Get-Date -Format "yyyyMMdd_HHmmss"
$archiveName = "istrac-sims-hotpatch-$dateStr.zip"
$archivePath = Join-Path $patchOutDir $archiveName

Write-Host "==============================================================================" -ForegroundColor Cyan
Write-Host "🛰️  BUILDING ISTRAC-SIMS HOT-PATCH BUNDLE ($dateStr)" -ForegroundColor Cyan
Write-Host "==============================================================================" -ForegroundColor Cyan

# 1. Clean & Prepare Workspace
if (Test-Path $tempPatchDir) {
    Remove-Item -Recurse -Force $tempPatchDir
}
New-Item -ItemType Directory -Force -Path $tempPatchDir | Out-Null
New-Item -ItemType Directory -Force -Path (Join-Path $tempPatchDir "frontend\dist") | Out-Null
New-Item -ItemType Directory -Force -Path (Join-Path $tempPatchDir "backend\dist") | Out-Null

# 2. Build Frontend
Write-Host "`n📦 Compiling Frontend (with Legacy Outdated Browser Support)..." -ForegroundColor Yellow
Set-Location (Join-Path $rootDir "frontend")
npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Error "Frontend compilation failed!"
}
Copy-Item -Recurse (Join-Path $rootDir "frontend\dist\*") (Join-Path $tempPatchDir "frontend\dist")

# 3. Build Backend
Write-Host "`n⚙️ Compiling Backend TypeScript..." -ForegroundColor Yellow
Set-Location (Join-Path $rootDir "backend")
npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Error "Backend compilation failed!"
}
Copy-Item -Recurse (Join-Path $rootDir "backend\dist\*") (Join-Path $tempPatchDir "backend\dist")

# 4. Copy Patch Installer & Guide
Set-Location $rootDir
Copy-Item (Join-Path $rootDir "scripts\apply-patch.sh") (Join-Path $tempPatchDir "apply-patch.sh")
Copy-Item (Join-Path $rootDir "documents\HOT_PATCHING_GUIDE.md") (Join-Path $tempPatchDir "HOT_PATCHING_GUIDE.md")

# 5. Compress Bundle
Write-Host "`n📦 Creating Compressed Patch Archive: $archivePath" -ForegroundColor Green
Compress-Archive -Path (Join-Path $tempPatchDir "*") -DestinationPath $archivePath -Force

# 6. Cleanup Temporary Folder
Remove-Item -Recurse -Force $tempPatchDir

Write-Host "`n==============================================================================" -ForegroundColor Green
Write-Host "✅ HOT-PATCH BUILD COMPLETE!" -ForegroundColor Green
Write-Host "File created at: $archivePath" -ForegroundColor Cyan
Write-Host "Transfer this file to customer setup and follow HOT_PATCHING_GUIDE.md" -ForegroundColor White
Write-Host "==============================================================================" -ForegroundColor Green
