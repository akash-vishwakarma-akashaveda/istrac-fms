# 🛰️ ISTRAC-SIMS — Deployment & Operations Manual (Ubuntu Linux & Windows)

> **Document Identifier:** ISTRAC-SIMS-OPS-V3.0  
> **Classification:** ISRO / ISTRAC Restricted Technical Documentation  
> **Application:** Satellite Information Management System (Deployment & Operations Manual)  
> **Version:** 2.0.0 Production Baseline  
> **Target Platforms:** Ubuntu Linux (22.04 LTS / 24.04 LTS) & Microsoft Windows (10 / 11 / Windows Server 2019 / 2022)  
> **Environment:** Air-Gapped Intranet Server / Station Workstation (Zero Public Internet)  

---

## 📑 Table of Contents

1. [Executive Summary & Supported Platforms](#1-executive-summary--supported-platforms)
2. [Hardware & Network Specifications](#2-hardware--network-specifications)
3. [PART I: Ubuntu Linux Deployment & Operations Guide](#3-part-i-ubuntu-linux-deployment--operations-guide)
   - [3.1 Ubuntu Prerequisites & APT Packages](#31-ubuntu-prerequisites--apt-packages)
   - [3.2 Node.js 24 Installation on Ubuntu](#32-nodejs-24-installation-on-ubuntu)
   - [3.3 MariaDB Database Setup & Security](#33-mariadb-database-setup--security)
   - [3.4 Apache2 Web Server & Reverse Proxy Configuration](#34-apache2-web-server--reverse-proxy-configuration)
   - [3.5 Systemd Service Units (`istrac-backend` & `istrac-worker`)](#35-systemd-service-units-istrac-backend--istrac-worker)
   - [3.6 Storage Mount & Permissions (`/mnt/istrac_storage`)](#36-storage-mount--permissions-mntistrac_storage)
   - [3.7 UFW Firewall Rules](#37-ufw-firewall-rules)
   - [3.8 Ubuntu Automated Setup Script](#38-ubuntu-automated-setup-script)
   - [3.9 Ubuntu Service Management CLI (`manage-services-ubuntu.sh`)](#39-ubuntu-service-management-cli-manage-services-ubuntush)
4. [PART II: Windows Deployment & Operations Guide](#4-part-ii-windows-deployment--operations-guide)
   - [4.1 Windows Prerequisites & Toolchain](#41-windows-prerequisites--toolchain)
   - [4.2 Node.js 24 Setup on Windows](#42-nodejs-24-setup-on-windows)
   - [4.3 MariaDB / MySQL Setup on Windows](#43-mariadb--mysql-setup-on-windows)
   - [4.4 Web Server & Reverse Proxy on Windows (Apache Lounge / Nginx)](#44-web-server--reverse-proxy-on-windows-apache-lounge--nginx)
   - [4.5 Running Backend as Native Windows Service (PM2 / NSSM)](#45-running-backend-as-native-windows-service-pm2--nssm)
   - [4.6 Storage Volume Setup on Windows (`D:\istrac_storage`)](#46-storage-volume-setup-on-windows-distrac_storage)
   - [4.7 Windows Defender Firewall Configuration](#47-windows-defender-firewall-configuration)
   - [4.8 Windows PowerShell Management Utility (`manage-services.ps1`)](#48-windows-powershell-management-utility-manage-servicesps1)
5. [Environment Configuration Reference (`.env`)](#5-environment-configuration-reference-env)
6. [Database Backup & Disaster Recovery Procedures](#6-database-backup--disaster-recovery-procedures)
7. [Application Update & Hotfix Deployment Runbook](#7-application-update--hotfix-deployment-runbook)
8. [Intranet DNS & Domain Configuration](#8-intranet-dns--domain-configuration)
9. [Production Readiness Security Checklist](#9-production-readiness-security-checklist)

---

## 1. Executive Summary & Supported Platforms

The **ISTRAC-SIMS** platform is engineered to operate on both **Ubuntu Linux** (production ground station rackmount servers) and **Microsoft Windows** (ground station operator consoles, telemetry processing workstations, and Windows Server clusters).

```
Intranet Client Consoles (MOX-1 / MOX-2 / Byalalu)
          │
          │ TCP Port 80 (HTTP) / Port 443 (HTTPS)
          ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ UBUNTU LINUX SERVER or WINDOWS SERVER HOST                                  │
│                                                                             │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │ Web Server & Reverse Proxy (Apache2 / Apache Lounge / Nginx)          │  │
│  │                                                                       │  │
│  │  • DocumentRoot frontend/dist (React SPA HTML5 PushState)             │  │
│  │  • ProxyPass /api   ──► http://127.0.0.1:3000/api                     │  │
│  │  • ProxyPass /media ──► http://127.0.0.1:3000/media                   │  │
│  │  • ProxyPass /ws    ──► ws://127.0.0.1:3000/ws (WebSocket Tunnel)     │  │
│  └──────────────────────────────────┬────────────────────────────────────┘  │
│                                     │ Internal Loopback 127.0.0.1           │
│                                     ▼                                       │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │ Node.js v24.21.0 Daemons (backend)                                    │  │
│  │                                                                       │  │
│  │  • Backend API Server (Port 3000, Express 5 + Prisma 7)               │  │
│  │  • Background Worker  (Telemetry Pass Automator & Health Probe)       │  │
│  └───────────────────────┬───────────────────────────┬───────────────────┘  │
│                          │                           │                      │
│                          ▼                           ▼                      │
│  ┌───────────────────────────────┐       ┌───────────────────────────────┐  │
│  │ MariaDB 10 / MySQL Database   │       │ Dedicated Storage Directory   │  │
│  │ Port 3306 (Internal Loopback) │       │ Ubuntu: /mnt/istrac_storage   │  │
│  │ User: istrac_user             │       │ Windows: D:\istrac_storage    │  │
│  │ DB: istrac_fms                │       │ SHA-256 Verified Telemetry    │  │
│  └───────────────────────────────┘       └───────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Hardware & Network Specifications

| Parameter | Minimum (Testing / Operator Workstation) | Recommended (Mission Production Server) |
|:---|:---|:---|
| **Operating System** | Ubuntu 22.04 / 24.04 LTS or Windows 10/11 Pro | Ubuntu 24.04 LTS Server or Windows Server 2022 |
| **Processor (CPU)** | 4 Cores (x86_64) | 8 to 16 Cores (Intel Xeon / AMD EPYC / Core i7+) |
| **System Memory (RAM)**| 8 GB | 16 GB to 64 GB ECC |
| **System Drive (OS)** | 60 GB SSD | 120 GB NVMe / Enterprise SSD |
| **Telemetry Storage** | 100 GB | 2 TB to 20 TB RAID / SAN |
| **Network** | 1 Gbps Ethernet | Dual 10 Gbps Bonded NICs |

---

## 3. PART I: Ubuntu Linux Deployment & Operations Guide

### 3.1 Ubuntu Prerequisites & APT Packages

In an air-gapped Ubuntu deployment, packages can be pre-downloaded via `apt-offline` or installed from an Ubuntu ISO / local apt mirror:

```bash
# Update and install core toolchain
sudo apt update
sudo apt install -y apache2 libapache2-mod-security2 mariadb-server mariadb-client \
  curl wget tar gzip rsync ufw policykit-1
```

---

### 3.2 Node.js 24 Installation on Ubuntu

For zero-internet air-gapped environments, use the official Node.js standalone Linux binary:

```bash
# 1. Extract official Node.js 24 binary tarball
sudo tar -xf node-v24.21.0-linux-x64.tar.xz -C /opt/
sudo mv /opt/node-v24.21.0-linux-x64 /opt/node

# 2. Symlink to standard system bin paths
sudo ln -sf /opt/node/bin/node /usr/bin/node
sudo ln -sf /opt/node/bin/npm /usr/bin/npm
sudo ln -sf /opt/node/bin/npx /usr/bin/npx

# 3. Verify
node -v   # Output: v24.21.0
npm -v    # Output: 10.x.x
```

---

### 3.3 MariaDB Database Setup & Security

```bash
# 1. Start and enable MariaDB service
sudo systemctl enable --now mariadb

# 2. Initialize database and user via root socket
sudo mysql <<EOF
CREATE DATABASE IF NOT EXISTS \`istrac_fms\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS 'istrac_user'@'127.0.0.1' IDENTIFIED BY 'IstracSecurePass123!';
GRANT ALL PRIVILEGES ON \`istrac_fms\`.* TO 'istrac_user'@'127.0.0.1';
CREATE USER IF NOT EXISTS 'istrac_user'@'localhost' IDENTIFIED BY 'IstracSecurePass123!';
GRANT ALL PRIVILEGES ON \`istrac_fms\`.* TO 'istrac_user'@'localhost';
FLUSH PRIVILEGES;
EOF
```

---

### 3.4 Apache2 Web Server & Reverse Proxy Configuration

Enable required Apache modules on Ubuntu:
```bash
sudo a2enmod proxy proxy_http proxy_wstunnel rewrite headers
```

Create `/etc/apache2/sites-available/istrac-fms.conf`:
```apache
<VirtualHost *:80>
    ServerName localhost
    DocumentRoot /opt/istrac-fms/frontend/dist

    ProxyPreserveHost On
    ProxyRequests Off
    ProxyTimeout 120
    RequestHeader set X-Forwarded-Proto "http"

    # 1. Real-Time WebSocket Proxying
    RewriteEngine On
    RewriteCond %{HTTP:Upgrade} =websocket [NC]
    RewriteCond %{HTTP:Connection} upgrade [NC]
    RewriteRule ^/ws/(.*)           ws://127.0.0.1:3000/ws/$1 [P,L]
    RewriteRule ^/ws/?$             ws://127.0.0.1:3000/ws [P,L]

    # 2. REST API Reverse Proxy (No trailing slash)
    ProxyPass        /api http://127.0.0.1:3000/api retry=0 timeout=120
    ProxyPassReverse /api http://127.0.0.1:3000/api

    # 3. CMS Uploaded Media Proxy
    ProxyPass        /media http://127.0.0.1:3000/media retry=0 timeout=60
    ProxyPassReverse /media http://127.0.0.1:3000/media

    # 4. SPA Client-Side Routing Fallback (HTML5 PushState)
    <Directory "/opt/istrac-fms/frontend/dist">
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

    ErrorLog ${APACHE_LOG_DIR}/istrac_error.log
    CustomLog ${APACHE_LOG_DIR}/istrac_access.log combined
</VirtualHost>
```

Activate the site and restart Apache:
```bash
sudo a2dissite 000-default.conf
sudo a2ensite istrac-fms.conf
sudo systemctl restart apache2
```

---

### 3.5 Systemd Service Units (`istrac-backend` & `istrac-worker`)

Create application service account:
```bash
sudo useradd -r -s /bin/false -d /opt/istrac-fms istrac || true
```

#### Backend API Unit (`/etc/systemd/system/istrac-backend.service`):
```ini
[Unit]
Description=ISTRAC FMS Backend API Server
After=network.target mariadb.service
Wants=mariadb.service

[Service]
Type=simple
User=istrac
Group=istrac
WorkingDirectory=/opt/istrac-fms/backend
ExecStart=/usr/bin/node dist/src/index.js
Restart=always
RestartSec=5
LimitNOFILE=65535
StandardOutput=journal
StandardError=journal
EnvironmentFile=/opt/istrac-fms/backend/.env

[Install]
WantedBy=multi-user.target
```

#### Worker Daemon Unit (`/etc/systemd/system/istrac-worker.service`):
```ini
[Unit]
Description=ISTRAC FMS Background Telemetry Worker
After=network.target mariadb.service istrac-backend.service
Wants=mariadb.service

[Service]
Type=simple
User=istrac
Group=istrac
WorkingDirectory=/opt/istrac-fms/backend
ExecStart=/usr/bin/node dist/src/worker.js
Restart=always
RestartSec=10
LimitNOFILE=65535
StandardOutput=journal
StandardError=journal
EnvironmentFile=/opt/istrac-fms/backend/.env

[Install]
WantedBy=multi-user.target
```

Reload and enable:
```bash
sudo systemctl daemon-reload
sudo systemctl enable --now istrac-backend istrac-worker
```

---

### 3.6 Storage Mount & Permissions (`/mnt/istrac_storage`)

```bash
sudo mkdir -p /mnt/istrac_storage
sudo chown -R istrac:istrac /mnt/istrac_storage
sudo chmod -R 770 /mnt/istrac_storage
```

---

### 3.7 UFW Firewall Rules

```bash
sudo ufw allow 80/tcp comment 'ISTRAC Web Portal'
sudo ufw allow 443/tcp comment 'ISTRAC Web Portal SSL'
sudo ufw allow 22/tcp comment 'SSH Management'
sudo ufw enable
```

---

### 3.8 Ubuntu Automated Setup Script

A self-contained Ubuntu installer is provided at `deploy/setup-ubuntu.sh`:
```bash
chmod +x deploy/setup-ubuntu.sh
sudo ./deploy/setup-ubuntu.sh
```

---

### 3.9 Ubuntu Service Management CLI (`manage-services-ubuntu.sh`)

```bash
# Check status of all daemons
sudo /opt/istrac-fms/manage-services-ubuntu.sh status

# View live streaming backend logs
sudo /opt/istrac-fms/manage-services-ubuntu.sh logs

# Restart all services
sudo /opt/istrac-fms/manage-services-ubuntu.sh restart

# Create database backup
sudo /opt/istrac-fms/manage-services-ubuntu.sh backup
```

---

## 4. PART II: Windows Deployment & Operations Guide

### 4.1 Windows Prerequisites & Toolchain

The system can run directly on **Windows 10 / 11 Pro** or **Windows Server 2019 / 2022**:
- **Administrator Privileges:** PowerShell must be opened with "Run as Administrator".
- **Execution Policy:** Allow scripts to run:
  ```powershell
  Set-ExecutionPolicy RemoteSigned -Scope CurrentUser -Force
  ```

---

### 4.2 Node.js 24 Setup on Windows

1. Download or transfer the official Node.js v24.x LTS Windows Installer (`.msi`) or Standalone zip.
2. Run installer and verify in PowerShell:
   ```powershell
   node -v
   npm -v
   ```

---

### 4.3 MariaDB / MySQL Setup on Windows

1. Download the **MariaDB 10.x Windows MSI installer** (e.g. `mariadb-10.11.x-winx64.msi`).
2. During setup:
   - Install as a Windows Service named `MySQL` or `MariaDB`.
   - Set root password (e.g. `IstracSecurePass123!`).
   - Default character set: `utf8mb4`.
3. Open PowerShell and provision the database:
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

### 4.4 Web Server & Reverse Proxy on Windows (Apache Lounge / Nginx)

You can use **Apache 2.4 for Windows (Apache Lounge)** or **Nginx for Windows**:

#### Apache Lounge Configuration (`httpd.conf` on Windows):
Extract Apache to `C:\Apache24`:
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

# Reverse Proxy Rules
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

Install and start Apache Windows Service:
```powershell
C:\Apache24\bin\httpd.exe -k install -n "Apache2.4"
Start-Service Apache2.4
```

---

### 4.5 Running Backend as Native Windows Service (PM2 / NSSM)

#### Option A: Using PM2 Windows Service (Recommended)
```powershell
# Install PM2 globally
npm install -g pm2 pm2-windows-service

# Navigate to backend directory
cd D:\istrac-fms\backend

# Start backend and worker daemons
pm2 start dist/src/index.js --name "istrac-backend"
pm2 start dist/src/worker.js --name "istrac-worker"

# Save PM2 process list for auto-boot
pm2 save

# Install as Windows service that starts on boot
pm2-service-install -n "ISTRAC-FMS"
```

#### Option B: Using NSSM (Non-Sucking Service Manager)
```powershell
nssm install IstracBackend "C:\Program Files\nodejs\node.exe" "dist\src\index.js"
nssm set IstracBackend AppDirectory "D:\istrac-fms\backend"
nssm start IstracBackend

nssm install IstracWorker "C:\Program Files\nodejs\node.exe" "dist\src\worker.js"
nssm set IstracWorker AppDirectory "D:\istrac-fms\backend"
nssm start IstracWorker
```

---

### 4.6 Storage Volume Setup on Windows (`D:\istrac_storage`)

Create dedicated storage directory:
```powershell
New-Item -ItemType Directory -Path "D:\istrac_storage" -Force
```

---

### 4.7 Windows Defender Firewall Configuration

Open port 80 and 443 in Windows Firewall for intranet clients:
```powershell
New-NetFirewallRule -DisplayName "ISTRAC Web Portal (HTTP)" -Direction Inbound -Protocol TCP -LocalPort 80 -Action Allow
New-NetFirewallRule -DisplayName "ISTRAC Web Portal (HTTPS)" -Direction Inbound -Protocol TCP -LocalPort 443 -Action Allow
```

---

### 4.8 Windows PowerShell Management Utility (`manage-services.ps1`)

Use the included PowerShell CLI `manage-services.ps1`:
```powershell
# Check status of services and ports
.\manage-services.ps1 -Action status

# Restart services
.\manage-services.ps1 -Action restart

# View backend logs
.\manage-services.ps1 -Action logs

# Create database backup
.\manage-services.ps1 -Action backup
```

---

## 5. Environment Configuration Reference (`.env`)

File location:
- **Ubuntu:** `/opt/istrac-fms/backend/.env`
- **Windows:** `D:\istrac-fms\backend\.env`

```env
NODE_ENV=production
PORT=3000
APP_URL=http://localhost
ALLOWED_ORIGINS=http://localhost,http://127.0.0.1
LOG_LEVEL=info
DEBUG_PRISMA=false

# Database
MYSQL_HOST=127.0.0.1
MYSQL_PORT=3306
MYSQL_DATABASE=istrac_fms
MYSQL_USER=istrac_user
MYSQL_PASSWORD=IstracSecurePass123!
DATABASE_URL="mysql://istrac_user:IstracSecurePass123!@127.0.0.1:3306/istrac_fms"

# Redis (Automatic in-memory fallback if not running)
REDIS_URL="redis://127.0.0.1:6379"

# Security Secrets (256-bit random strings)
JWT_SECRET=rDirso2AXb709KGiFgA8371ZZUvP0mdJ
JWT_REFRESH_SECRET=OlyASgitiXj9ToQwTxUMblEr9Sibmldh

# Storage Subsystem Path
# Ubuntu: HDD_MOUNT_PATH=/mnt/istrac_storage
# Windows: HDD_MOUNT_PATH=D:\istrac_storage
HDD_MOUNT_PATH=/mnt/istrac_storage
```

---

## 6. Database Backup & Disaster Recovery Procedures

### 6.1 Ubuntu Linux Backup:
```bash
sudo mkdir -p /var/backups/istrac-sims
mysqldump -u istrac_user -p"IstracSecurePass123!" istrac_fms > /var/backups/istrac-sims/backup_$(date +%Y%m%d_%H%M%S).sql
```

### 6.2 Windows Backup (PowerShell):
```powershell
$backupDir = "D:\backups\istrac-sims"
New-Item -ItemType Directory -Path $backupDir -Force
$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
& "C:\Program Files\MariaDB 10.11\bin\mysqldump.exe" -u istrac_user -p"IstracSecurePass123!" istrac_fms > "$backupDir\istrac_fms_$timestamp.sql"
```

---

## 7. Application Update & Hotfix Deployment Runbook

### On Ubuntu:
```bash
sudo cp -rf /path/to/new/frontend/dist/* /opt/istrac-fms/frontend/dist/
sudo cp -rf /path/to/new/backend/dist/* /opt/istrac-fms/backend/dist/
sudo systemctl restart istrac-backend apache2
```

### On Windows:
```powershell
Copy-Item -Path ".\frontend\dist\*" -Destination "D:\istrac-fms\frontend\dist\" -Recurse -Force
Copy-Item -Path ".\backend\dist\*" -Destination "D:\istrac-fms\backend\dist\" -Recurse -Force
Restart-Service Apache2.4
pm2 restart istrac-backend
```

---

## 8. Intranet DNS & Domain Configuration

To bind a custom domain such as `sims.istrac.gov.in`:
1. Add entry to your intranet DNS server or local hosts file:
   - **Ubuntu:** `/etc/hosts`
   - **Windows:** `C:\Windows\System32\drivers\etc\hosts`
   ```
   10.20.1.50   sims.istrac.gov.in
   ```
2. Append to `ALLOWED_ORIGINS` in `.env`:
   ```env
   ALLOWED_ORIGINS=http://localhost,http://127.0.0.1,http://sims.istrac.gov.in
   ```
3. Update `ServerName sims.istrac.gov.in` in Apache configuration and reload.

---

## 9. Production Readiness Security Checklist

- [ ] **Default Admin Password Changed:** Super Admin password changed from `ChangeMe123!`.
- [ ] **Firewall Active:** Only port 80 and 443 are open to the intranet; ports 3000 and 3306 remain bound to `127.0.0.1`.
- [ ] **Storage Verified:** Dedicated storage path configured and writable (`/mnt/istrac_storage` or `D:\istrac_storage`).
- [ ] **Backup Verified:** Automated backup command tested and confirmed restorable.
- [ ] **Permissions Protected:** `.env` file readable only by application account.
