@echo off
title ISTRAC-SIMS Service Launcher
echo ======================================================================
echo  ISRO / ISTRAC - Starting All System Services Locally (No Docker)
echo ======================================================================
echo.

echo [1/3] Launching Backend API Server (Port 3000)...
start "ISTRAC-SIMS Backend API" cmd /k "cd /d %~dp0backend && npm run dev"

timeout /t 2 /nobreak >nul

echo [2/3] Launching Mission Event Scheduler Worker...
start "ISTRAC-SIMS Worker Daemon" cmd /k "cd /d %~dp0backend && npm run dev:worker"

timeout /t 1 /nobreak >nul

echo [3/3] Launching Frontend Web Client (Port 5173)...
start "ISTRAC-SIMS Frontend UI" cmd /k "cd /d %~dp0frontend && npm run dev"

echo.
echo ======================================================================
echo  All services have been launched in separate consoles!
echo  - Frontend Web UI:  http://localhost:5173
echo  - Backend API:      http://localhost:3000
echo  - API Health:       http://localhost:3000/health
echo ======================================================================
echo.
pause
