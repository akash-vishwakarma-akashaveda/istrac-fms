# 🛰️ ISTRAC-SIMS — Microsoft Windows Production Deployment & Operations Guide

> **System:** ISRO Telemetry, Tracking and Command Network — Satellite Information Management System (ISTRAC-SIMS)  
> **Target OS:** Microsoft Windows 10 / 11 Pro, Windows Server 2019 / 2022 (x64)  
> **Deployment Model:** Standalone Station Workstation, Ground Console, or Windows Server Cluster  
> **Version:** 2.0.0 (Production Baseline)  

---

## 📑 Table of Contents

1. [Architecture Overview on Windows](#1-architecture-overview-on-windows)
2. [Prerequisites & System Toolchain](#2-prerequisites--system-toolchain)
3. [Step 1: Node.js 24 LTS Installation](#3-step-1-nodejs-24-lts-installation)
4. [Step 2: MariaDB / MySQL Setup on Windows](#4-step-2-mariadb--mysql-setup-on-windows)
5. [Step 3: Storage Directory Configuration (`D:\istrac_storage`)](#5-step-3-storage-directory-configuration-distrac_storage)
6. [Step 4: Backend Service Deployment (PM2 / NSSM)](#6-step-4-backend-service-deployment-pm2--nssm)
7. [Step 5: Web Server & Reverse Proxy (Apache Lounge for Windows)](#7-step-5-web-server--reverse-proxy-apache-lounge-for-windows)
8. [Step 6: Windows Defender Firewall Rules](#8-step-6-windows-defender-firewall-rules)
9. [Daily Operations via PowerShell (`manage-services-windows.ps1`)](#9-daily-operations-via-powershell-manage-services-windowsps1)
10. [Database Backup & Maintenance Runbook](#10-database-backup--maintenance-runbook)
11. [Windows Troubleshooting Matrix](#11-windows-troubleshooting-matrix)

---

## 1. Architecture Overview on Windows

On Microsoft Windows, the system operates with native Windows services or PM2 daemons:

```mermaid
graph TD
    Client["Console Workstations / Browser"]
    
    subgraph "Windows Host (Console / Windows Server)"
        Firewall["Windows Defender Firewall (Port 80 / 443)"]
        Apache["Apache 2.4 for Windows (Apache Lounge)\nDocumentRoot: frontend/dist"]
        PM2["PM2 / NSSM Windows Service Manager"]
        Backend["Node.js 24 Backend API (Port 3000)"]
        Worker["Background Telemetry Worker Daemon"]
        MariaDB[("MariaDB 10 Windows Service on Port 3306")]
        Storage[("NTFS Storage Folder (D:\\istrac_storage)")]
    end

    Client -->|HTTP Port 80| Firewall
    Firewall --> Apache
    Apache -->|Static SPA Assets| Apache
    Apache -->|REST API /api/*| Backend
    Apache -->|WebSocket /ws| Backend
    PM2 --> Backend
    PM2 --> Worker
    Backend --> MariaDB
    Backend --> Storage
    Worker --> MariaDB
```

---

## 2. Prerequisites & System Toolchain

- **Operating System:** Windows 10/11 Pro or Windows Server 2019/2022 (64-bit).
- **PowerShell Execution Policy:**
  Open PowerShell as Administrator and run:
  ```powershell
  Set-ExecutionPolicy RemoteSigned -Scope CurrentUser -Force
  ```

---

## 3. Step 1: Node.js 24 LTS Installation

1. Download and run the official **Node.js 24.x LTS 64-bit Windows Installer** (`node-v24.x-x64.msi`).
2. Verify installation in PowerShell:
   ```powershell
   node -v    # Output: v24.21.0
   npm -v     # Output: 10.x.x
   ```

---

## 4. Step 2: MariaDB / MySQL Setup on Windows

1. Download the **MariaDB 10.11 Windows MSI installer** (`mariadb-10.11.x-winx64.msi`).
2. Run the wizard:
   - Keep default port: `3306`.
   - Set root password: `IstracSecurePass123!`.
   - Check "Install as service" (named `MariaDB` or `MySQL`).
   - UTF-8 as default character set.
3. In PowerShell, create database and application user:
   ```powershell
   & "C:\Program Files\MariaDB 10.11\bin\mysql.exe" -u root -p"IstracSecurePass123!" -e @"
   CREATE DATABASE IF NOT EXISTS istrac_fms CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
   CREATE USER IF NOT EXISTS 'istrac_user'@'127.0.0.1' IDENTIFIED BY 'IstracSecurePass123!';
   GRANT ALL PRIVILEGES ON istrac_fms.* TO 'istrac_user'@'127.0.0.1';
   CREATE USER IF NOT EXISTS 'istrac_user'@'localhost' IDENTIFIED BY 'IstracSecurePass123!';
   GRANT ALL PRIVILEGES ON istrac_fms.* TO 'istrac_user'@'localhost';
   FLUSH PRIVILEGES;
   "@
   ```

---

## 5. Step 3: Storage Directory Configuration (`D:\istrac_storage`)

Create dedicated telemetry storage directory:
```powershell
New-Item -ItemType Directory -Path "D:\istrac_storage" -Force
```

Configure backend `.env` (`D:\istrac-fms\backend\.env`):
```env
HDD_MOUNT_PATH=D:\istrac_storage
DATABASE_URL="mysql://istrac_user:IstracSecurePass123!@127.0.0.1:3306/istrac_fms"
REDIS_URL="redis://127.0.0.1:6379"
NODE_ENV=production
PORT=3000
JWT_SECRET=rDirso2AXb709KGiFgA8371ZZUvP0mdJ
JWT_REFRESH_SECRET=OlyASgitiXj9ToQwTxUMblEr9Sibmldh
```

Deploy Prisma database migrations:
```powershell
cd D:\istrac-fms\backend
node .\node_modules\prisma\build\index.js migrate deploy
node .\dist\prisma\seed.js
```

---

## 6. Step 4: Backend Service Deployment (PM2 / NSSM)

### Using PM2 Windows Service (Recommended):
```powershell
# 1. Install PM2 and Windows service helper globally
npm install -g pm2 pm2-windows-service

# 2. Start services
cd D:\istrac-fms\backend
pm2 start dist/src/index.js --name "istrac-backend"
pm2 start dist/src/worker.js --name "istrac-worker"

# 3. Save process table
pm2 save

# 4. Install as persistent Windows Service (auto-boots with Windows)
pm2-service-install -n "ISTRAC-FMS"
```

---

## 7. Step 5: Web Server & Reverse Proxy (Apache Lounge for Windows)

Download **Apache 2.4 for Windows (Apache Lounge)** and extract to `C:\Apache24`.

Edit `C:\Apache24\conf\httpd.conf`:
```apache
Listen 80

LoadModule proxy_module modules/mod_proxy.so
LoadModule proxy_http_module modules/mod_proxy_http.so
LoadModule proxy_wstunnel_module modules/mod_proxy_wstunnel.so
LoadModule rewrite_module modules/mod_rewrite.so
LoadModule headers_module modules/mod_headers.so

DocumentRoot "D:/istrac-fms/frontend/dist"
<Directory "D:/istrac-fms/frontend/dist">
    Options Indexes FollowSymLinks
    AllowOverride All
    Require all granted
    RewriteEngine On
    RewriteBase /
    RewriteRule ^index\.html$ - [L]
    RewriteCond %{REQUEST_FILENAME} !-f
    RewriteCond %{REQUEST_FILENAME} !-d
    RewriteRule . /index.html [L]
</Directory>

ProxyPreserveHost On
ProxyPass        /api http://127.0.0.1:3000/api retry=0 timeout=120
ProxyPassReverse /api http://127.0.0.1:3000/api

ProxyPass        /media http://127.0.0.1:3000/media retry=0 timeout=60
ProxyPassReverse /media http://127.0.0.1:3000/media

RewriteEngine On
RewriteCond %{HTTP:Upgrade} =websocket [NC]
RewriteCond %{HTTP:Connection} upgrade [NC]
RewriteRule ^/ws/(.*) ws://127.0.0.1:3000/ws/$1 [P,L]
RewriteRule ^/ws/?$   ws://127.0.0.1:3000/ws [P,L]
```

Install and start Apache as a Windows service:
```powershell
C:\Apache24\bin\httpd.exe -k install -n "Apache2.4"
Start-Service Apache2.4
```

---

## 8. Step 6: Windows Defender Firewall Rules

Allow inbound HTTP access for other station operator consoles:
```powershell
New-NetFirewallRule -DisplayName "ISTRAC Web Portal (HTTP)" -Direction Inbound -Protocol TCP -LocalPort 80 -Action Allow
New-NetFirewallRule -DisplayName "ISTRAC Web Portal (HTTPS)" -Direction Inbound -Protocol TCP -LocalPort 443 -Action Allow
```

---

## 9. Daily Operations via PowerShell (`manage-services-windows.ps1`)

From project root:
```powershell
# Check status of ports, MariaDB, and Node.js
.\manage-services-windows.ps1 -Action status

# Restart services
.\manage-services-windows.ps1 -Action restart

# View live backend logs
.\manage-services-windows.ps1 -Action logs

# Take a database snapshot backup
.\manage-services-windows.ps1 -Action backup
```

---

## 10. Database Backup & Maintenance Runbook

```powershell
$backupDir = "D:\backups\istrac-sims"
New-Item -ItemType Directory -Path $backupDir -Force
$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
& "C:\Program Files\MariaDB 10.11\bin\mysqldump.exe" -u istrac_user -p"IstracSecurePass123!" istrac_fms > "$backupDir\istrac_fms_$timestamp.sql"
```

To schedule daily backups on Windows:
Create a task in **Windows Task Scheduler** running `manage-services-windows.ps1 -Action backup` daily at 02:00.

---

## 11. Windows Troubleshooting Matrix

| Issue | Root Cause | Verified Resolution |
|:---|:---|:---|
| **Port 80 Conflict** | Windows IIS / `w3svc` running | Run `Stop-Service W3SVC` and `Set-Service W3SVC -StartupType Disabled`. |
| **Scripts Disabled** | PowerShell ExecutionPolicy | Run `Set-ExecutionPolicy RemoteSigned -Scope CurrentUser -Force`. |
| **ECONNREFUSED 3306** | MariaDB service stopped | Run `Start-Service MariaDB` or verify port `3306` in `my.ini`. |
| **BigInt serialization** | V8 JSON stringify | Verified patched in `src/index.ts`. |
| **Blank Screen** | Stale browser cache | Press `Ctrl + Shift + R` in Chrome/Edge. |
