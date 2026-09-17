# ==============================================================================
# ISTRAC-SIMS Snyk Security Audit Suite (PowerShell)
# ==============================================================================

$RootDir = Split-Path -Parent $MyInvocation.MyCommand.Path

Write-Host "======================================================================" -ForegroundColor Cyan
Write-Host ">>> ISTRAC-SIMS Snyk Security Vulnerability Audit Runner" -ForegroundColor Cyan
Write-Host "======================================================================" -ForegroundColor Cyan
Write-Host ""

# 1. Verify Authentication
Write-Host "[1/4] Verifying Snyk Authentication..." -ForegroundColor Yellow
$authCheck = npx snyk test "$RootDir\backend" --json 2>&1 | Out-String
if ($authCheck -like "*snyk auth*") {
    Write-Host "[!] Snyk authentication required. Launching browser authentication..." -ForegroundColor Yellow
    npx snyk auth
    if ($LASTEXITCODE -ne 0) {
        Write-Host "[X] Snyk authentication was not completed." -ForegroundColor Red
        Write-Host "Tip: Set `$env:SNYK_TOKEN = 'your_snyk_api_token'" -ForegroundColor Yellow
        exit 1
    }
}

# 2. Audit Backend
Write-Host "[2/4] Auditing Backend Dependencies..." -ForegroundColor Yellow
Set-Location "$RootDir\backend"
$backendJson = Join-Path $RootDir "snyk-backend-raw.json"
$backendHtml = Join-Path $RootDir "snyk-backend-report.html"
npx snyk test --json | Out-File -FilePath $backendJson -Encoding utf8
npx snyk-to-html -i $backendJson -o $backendHtml
if (Test-Path $backendJson) { Remove-Item $backendJson -Force }
Write-Host "[OK] Backend Report: $backendHtml" -ForegroundColor Green

# 3. Audit Frontend
Write-Host "[3/4] Auditing Frontend Dependencies..." -ForegroundColor Yellow
Set-Location "$RootDir\frontend"
$frontendJson = Join-Path $RootDir "snyk-frontend-raw.json"
$frontendHtml = Join-Path $RootDir "snyk-frontend-report.html"
npx snyk test --json | Out-File -FilePath $frontendJson -Encoding utf8
npx snyk-to-html -i $frontendJson -o $frontendHtml
if (Test-Path $frontendJson) { Remove-Item $frontendJson -Force }
Write-Host "[OK] Frontend Report: $frontendHtml" -ForegroundColor Green

Set-Location $RootDir

# 4. Open Reports
Write-Host "[4/4] Opening Generated Reports in Browser..." -ForegroundColor Yellow
Start-Process $backendHtml
Start-Process $frontendHtml

Write-Host ""
Write-Host "======================================================================" -ForegroundColor Green
Write-Host "[SUCCESS] Snyk HTML Reports Generated!" -ForegroundColor Green
Write-Host "Backend:  $backendHtml" -ForegroundColor Green
Write-Host "Frontend: $frontendHtml" -ForegroundColor Green
Write-Host "Unified:  $RootDir\security-audit-report.html" -ForegroundColor Green
Write-Host "======================================================================" -ForegroundColor Green
