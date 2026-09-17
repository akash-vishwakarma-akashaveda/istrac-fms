@echo off
title ISTRAC-SIMS Snyk Security Audit Suite
echo ======================================================================
echo  ISRO / ISTRAC - Snyk Security Vulnerability Audit Runner
echo ======================================================================
echo.

echo [1/4] Verifying Snyk Authentication...
call npx snyk test backend --json >nul 2>&1
if %ERRORLEVEL% EQU 2 (
    echo.
    echo [!] Snyk authentication required. Launching browser authentication...
    call npx snyk auth
    if %ERRORLEVEL% NEQ 0 (
        echo [X] Authentication failed or cancelled.
        echo You can also set your token via: set SNYK_TOKEN=your_token_here
        pause
        exit /b 1
    )
)

echo [2/4] Auditing Backend Dependencies (Node.js/Express/Prisma)...
cd /d %~dp0backend
call npx snyk test --json > ..\snyk-backend-raw.json
cd /d %~dp0
call npx snyk-to-html -i snyk-backend-raw.json -o snyk-backend-report.html
del snyk-backend-raw.json 2>nul
echo [OK] Backend report generated: snyk-backend-report.html

echo.
echo [3/4] Auditing Frontend Dependencies (React 19/Vite)...
cd /d %~dp0frontend
call npx snyk test --json > ..\snyk-frontend-raw.json
cd /d %~dp0
call npx snyk-to-html -i snyk-frontend-raw.json -o snyk-frontend-report.html
del snyk-frontend-raw.json 2>nul
echo [OK] Frontend report generated: snyk-frontend-report.html

echo.
echo [4/4] Opening Generated Reports...
start "" "snyk-backend-report.html"
start "" "snyk-frontend-report.html"

echo.
echo ======================================================================
echo  [SUCCESS] Snyk Audit Completed!
echo  - Backend Snyk Report:   %~dp0snyk-backend-report.html
echo  - Frontend Snyk Report:  %~dp0snyk-frontend-report.html
echo  - Unified Audit Report:  %~dp0security-audit-report.html
echo ======================================================================
echo.
pause
