# ==============================================================================
# Package bundle with current date naming (YYYYMMDD)
# ==============================================================================

$currentDate = Get-Date -Format "yyyyMMdd"
Write-Host "Creating offline bundle for date: $currentDate"

$srcFolder = "D:\istrac-fms\dist-offline\istrac-fms-offline-bundle-20260915"
$destFolder = "D:\istrac-fms\dist-offline\istrac-sims-offline-bundle-$currentDate"
$sharedFolder = "D:\Rhel_Shared_Folder\istrac-sims-offline-bundle-$currentDate"
$zipFile = "D:\istrac-fms\dist-offline\istrac-sims-offline-bundle-$currentDate.zip"
$sharedZipFile = "D:\Rhel_Shared_Folder\istrac-sims-offline-bundle-$currentDate.zip"

# 1. Create dated bundle directory in dist-offline
if (-not (Test-Path $destFolder)) {
    New-Item -ItemType Directory -Path $destFolder -Force | Out-Null
}
Copy-Item -Path "$srcFolder\*" -Destination $destFolder -Recurse -Force
Write-Host "Local bundle directory created: $destFolder"

# 2. Copy to VM Shared folder
if (-not (Test-Path $sharedFolder)) {
    New-Item -ItemType Directory -Path $sharedFolder -Force | Out-Null
}
Copy-Item -Path "$destFolder\*" -Destination $sharedFolder -Recurse -Force
Write-Host "Shared folder bundle created: $sharedFolder"

# 3. Create zip using tar.exe
Write-Host "Creating zip archive: $zipFile..."
if (Test-Path $zipFile) { Remove-Item $zipFile -Force }
tar.exe -a -c -f $zipFile -C $destFolder .

# 4. Copy zip to shared folder
Copy-Item -Path $zipFile -Destination $sharedZipFile -Force
$zipSize = (Get-Item $zipFile).Length
$zipSizeMB = [math]::Round($zipSize / 1MB, 2)
Write-Host "Zip archive created successfully ($zipSizeMB MB):"
Write-Host "  $zipFile"
Write-Host "  $sharedZipFile"
