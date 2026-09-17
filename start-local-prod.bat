@echo off
title ISTRAC-SIMS Production Service Launcher
echo ======================================================================
echo  ISRO / ISTRAC - Starting Production Services Locally (Node.js dist)
echo ======================================================================
echo.

echo [1/3] Launching Compiled Backend API (Port 3000)...
start "ISTRAC-SIMS Backend [PROD]" cmd /k "cd /d %~dp0backend && node dist/src/index.js"

timeout /t 2 /nobreak >nul

echo [2/3] Launching Compiled Mission Worker...
start "ISTRAC-SIMS Worker [PROD]" cmd /k "cd /d %~dp0backend && node dist/src/worker.js"

timeout /t 1 /nobreak >nul

echo [3/3] Launching Frontend Production Preview...
start "ISTRAC-SIMS Frontend [PROD]" cmd /k "cd /d %~dp0frontend && npm run preview"

echo.
echo ======================================================================
echo  All production processes launched!
echo  - Frontend Web UI:  http://localhost:4173
echo  - Backend API:      http://localhost:3000
echo ======================================================================
echo.
pause
