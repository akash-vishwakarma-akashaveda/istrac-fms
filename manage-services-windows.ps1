# ==============================================================================
# 🛰️ ISTRAC-SIMS — Service Management CLI Utility for Windows
# Usage: .\manage-services-windows.ps1 [-Action status|start|stop|restart|logs|backup]
# ==============================================================================

param(
    [Parameter(Position=0)]
    [ValidateSet("status", "start", "stop", "restart", "logs", "backup")]
    [string]$Action = "status"
)

$rootDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$backendDir = Join-Path $rootDir "backend"
$storageDir = "D:\istrac_storage"
$backupDir = "D:\backups\istrac-sims"

function Write-Cyan($msg) { Write-Host $msg -ForegroundColor Cyan }
function Write-Green($msg) { Write-Host $msg -ForegroundColor Green }
function Write-Yellow($msg) { Write-Host $msg -ForegroundColor Yellow }
function Write-Red($msg) { Write-Host $msg -ForegroundColor Red }

switch ($Action) {
    "status" {
        Write-Host "==============================================================================" -ForegroundColor Cyan
        Write-Host " 🛰️  ISTRAC-SIMS — WINDOWS SERVICES & SUBSYSTEM STATUS" -ForegroundColor Cyan
        Write-Host "==============================================================================" -ForegroundColor Cyan

        # Check MariaDB / MySQL
        $mysqlService = Get-Service -Name "MariaDB", "MySQL" -ErrorAction SilentlyContinue | Select-Object -First 1
        if ($mysqlService -and $mysqlService.Status -eq 'Running') {
            Write-Green "• Database ($($mysqlService.Name)):          RUNNING (Port 3306)"
        } else {
            Write-Red   "• Database:                       STOPPED / NOT FOUND"
        }

        # Check Apache Windows Service
        $apacheService = Get-Service -Name "Apache2.4", "Apache" -ErrorAction SilentlyContinue | Select-Object -First 1
        if ($apacheService -and $apacheService.Status -eq 'Running') {
            Write-Green "• Web Server ($($apacheService.Name)):       RUNNING (Port 80/443)"
        } else {
            Write-Yellow "• Web Server (Apache):            NOT RUNNING AS SERVICE"
        }

        # Check PM2 processes if installed
        if (Get-Command pm2 -ErrorAction SilentlyContinue) {
            Write-Cyan "• PM2 Process Status:"
            pm2 status
        } else {
            # Check Node listener on port 3000
            $nodeListening = Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue
            if ($nodeListening) {
                Write-Green "• Node.js Backend API:            LISTENING on Port 3000 (PID: $($nodeListening.OwningProcess))"
            } else {
                Write-Red   "• Node.js Backend API:            NOT LISTENING on Port 3000"
            }
        }

        # Check Storage
        if (Test-Path $storageDir) {
            Write-Green "• Storage Volume ($storageDir):  ACCESSIBLE"
        } else {
            Write-Yellow "• Storage Volume ($storageDir):  DIRECTORY NOT FOUND"
        }

        # Health probe test
        Write-Host "`nHealth Probe Test:" -ForegroundColor Cyan
        try {
            $health = Invoke-RestMethod -Uri "http://127.0.0.1:3000/api/health" -TimeoutSec 3 -ErrorAction Stop
            Write-Green "Status: $($health.status) | DB: $($health.db) | Redis: $($health.redis) | HDD: $($health.hdd)"
        } catch {
            Write-Red "Backend health probe failed: $_"
        }
        Write-Host ""
    }

    "start" {
        Write-Cyan "Starting ISTRAC-SIMS services on Windows..."
        $mysqlService = Get-Service -Name "MariaDB", "MySQL" -ErrorAction SilentlyContinue | Select-Object -First 1
        if ($mysqlService) { Start-Service $mysqlService.Name }

        $apacheService = Get-Service -Name "Apache2.4", "Apache" -ErrorAction SilentlyContinue | Select-Object -First 1
        if ($apacheService) { Start-Service $apacheService.Name }

        if (Get-Command pm2 -ErrorAction SilentlyContinue) {
            pm2 start (Join-Path $backendDir "dist\src\index.js") --name "istrac-backend"
            pm2 start (Join-Path $backendDir "dist\src\worker.js") --name "istrac-worker"
        } else {
            Start-Process -FilePath "node.exe" -ArgumentList "dist/src/index.js" -WorkingDirectory $backendDir -WindowStyle Hidden
            Start-Process -FilePath "node.exe" -ArgumentList "dist/src/worker.js" -WorkingDirectory $backendDir -WindowStyle Hidden
        }
        Write-Green "Services started."
    }

    "stop" {
        Write-Yellow "Stopping ISTRAC-SIMS services on Windows..."
        if (Get-Command pm2 -ErrorAction SilentlyContinue) {
            pm2 stop istrac-backend, istrac-worker
        } else {
            Get-Process -Name "node" -ErrorAction SilentlyContinue | Stop-Process -Force
        }
        $apacheService = Get-Service -Name "Apache2.4", "Apache" -ErrorAction SilentlyContinue | Select-Object -First 1
        if ($apacheService) { Stop-Service $apacheService.Name }
        Write-Green "Services stopped."
    }

    "restart" {
        Write-Cyan "Restarting ISTRAC-SIMS services..."
        & $PSCommandPath -Action stop
        Start-Sleep -Seconds 2
        & $PSCommandPath -Action start
    }

    "logs" {
        if (Get-Command pm2 -ErrorAction SilentlyContinue) {
            pm2 logs istrac-backend --lines 50
        } else {
            Write-Yellow "PM2 is not installed. To view realtime logs, run node from terminal: cd backend; node dist/src/index.js"
        }
    }

    "backup" {
        New-Item -ItemType Directory -Path $backupDir -Force | Out-Null
        $timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
        $backupFile = Join-Path $backupDir "istrac_fms_backup_$timestamp.sql"
        
        $mysqlDump = (Get-Command mysqldump -ErrorAction SilentlyContinue)?.Source
        if (-not $mysqlDump) {
            $mysqlDump = "C:\Program Files\MariaDB 10.11\bin\mysqldump.exe"
        }
        
        if (Test-Path $mysqlDump) {
            Write-Cyan "Creating database backup to $backupFile..."
            & $mysqlDump -u istrac_user -p"IstracSecurePass123!" --databases istrac_fms > $backupFile
            Write-Green "Database backup complete: $backupFile"
        } else {
            Write-Red "mysqldump utility not found at '$mysqlDump'. Please verify MariaDB installation path."
        }
    }
}
