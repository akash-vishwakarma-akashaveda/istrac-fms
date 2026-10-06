@echo off
title ISTRAC-SIMS Windows Launcher
echo ======================================================================
echo  🛰️ ISRO / ISTRAC — Satellite Information Management System
echo  Platform: Microsoft Windows (Port 3000)
echo ======================================================================
echo.

cd /d %~dp0backend

if not exist ".env" (
    if exist ".env.example" (
        echo [SETUP] Generating initial .env from .env.example...
        copy .env.example .env >nul
    )
)

echo [1/2] Starting Node.js Backend API (Port 3000)...
start "ISTRAC Backend API" cmd /k "node dist/src/index.js"

timeout /t 2 /nobreak >nul

echo [2/2] Starting Telemetry Background Worker...
start "ISTRAC Worker Daemon" cmd /k "node dist/src/worker.js"

echo.
echo ======================================================================
echo  Backend service running on: http://localhost:3000
echo  Web UI: Connect via configured web server or browser
echo  To stop: Close the launched command windows or run .\manage-services-windows.ps1 -Action stop
echo ======================================================================
echo.
pause
