# 🛰️ ISTRAC-SIMS — Deployment & Operations Manual

> **Document Identifier:** ISTRAC-SIMS-OPS-V2.0  
> **Classification:** ISRO / ISTRAC Restricted Technical Documentation  
> **Application:** Satellite Information Management System (Deployment & Operations Manual)  
> **Version:** 1.1.0 Production Baseline  
> **Target Operating System:** Red Hat Enterprise Linux (RHEL 9 / 10), Rocky Linux 9, AlmaLinux 9  
> **Environment:** Air-Gapped Intranet Server (Strictly Zero Public Internet)  

---

## 📑 Table of Contents

1. [Executive Summary & System Architecture](#1-executive-summary--system-architecture)
2. [Hardware & Network Specifications](#2-hardware--network-specifications)
3. [Pre-Deployment Packaging on Workstation (Windows Side)](#3-pre-deployment-packaging-on-workstation-windows-side)
4. [First-Time Automated Installation (Air-Gapped RHEL)](#4-first-time-automated-installation-air-gapped-rhel)
5. [Systemd Service Units & Daemon Control](#5-systemd-service-units--daemon-control)
6. [Apache HTTP Server 2.4 Reverse Proxy Configuration](#6-apache-http-server-24-reverse-proxy-configuration)
7. [Environment Configuration Reference (`.env`)](#7-environment-configuration-reference-env)
8. [VirtualBox NAT Port Forwarding Guide](#8-virtualbox-nat-port-forwarding-guide)
9. [Day-to-Day Service Management CLI (`manage-services-rhel.sh`)](#9-day-to-day-service-management-cli-manage-services-rhelsh)
10. [Database Backup & Disaster Recovery Procedures](#10-database-backup--disaster-recovery-procedures)
11. [Storage Subsystem Administration (`/mnt/istrac_storage`)](#11-storage-subsystem-administration-mntistrac_storage)
12. [Application Update & Hotfix Deployment Runbook](#12-application-update--hotfix-deployment-runbook)
13. [Intranet DNS & Domain Configuration](#13-intranet-dns--domain-configuration)
14. [Security Hardening & Production Checklist](#14-security-hardening--production-checklist)

---

## 1. Executive Summary & System Architecture

The **ISTRAC-SIMS** platform operates in an isolated, air-gapped local area network on RHEL. All application processes run natively on the server host:

```
Intranet Client Consoles (MOX-1 / MOX-2 / Byalalu)
          │
          │ TCP Port 80 (HTTP) / Port 443 (HTTPS)
          ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ Red Hat Enterprise Linux Host Server                                        │
│                                                                             │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │ Apache HTTP Server 2.4 (httpd.service)                                │  │
│  │                                                                       │  │
│  │  • DocumentRoot /opt/istrac-fms/frontend/dist (React SPA HTML5 Push)  │  │
│  │  • ProxyPass /api   ──► http://127.0.0.1:3000/api                     │  │
│  │  • ProxyPass /media ──► http://127.0.0.1:3000/media                   │  │
│  │  • ProxyPass /ws    ──► ws://127.0.0.1:3000/ws (mod_proxy_wstunnel)   │  │
│  └──────────────────────────────────┬────────────────────────────────────┘  │
│                                     │ Internal Loopback 127.0.0.1           │
│                                     ▼                                       │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │ Node.js v24.21.0 Daemons (/opt/istrac-fms/backend)                    │  │
│  │                                                                       │  │
│  │  • istrac-backend.service (Express API Server on Port 3000)           │  │
│  │  • istrac-worker.service  (Telemetry Pass Automator & Health Probe)   │  │
│  └───────────────────────┬───────────────────────────┬───────────────────┘  │
│                          │                           │                      │
│                          ▼                           ▼                      │
│  ┌───────────────────────────────┐       ┌───────────────────────────────┐  │
│  │ MariaDB 10 Database Server    │       │ Dedicated Storage Volume      │  │
│  │ Port 3306 (Internal Loopback) │       │ Mount: /mnt/istrac_storage    │  │
│  │ User: istrac_user             │       │ Perms: 770 (istrac:istrac)    │  │
│  │ DB: istrac_fms                │       │ SHA-256 Verified Telemetry    │  │
│  └───────────────────────────────┘       └───────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Network Port Allocation:
| Port | Protocol | Binding | Component | Access Scope |
|:---|:---|:---|:---|:---|
| **80** | TCP | `0.0.0.0` | Apache `httpd` | Internal Ground Station Subnet |
| **443** | TCP | `0.0.0.0` | Apache `httpd` (SSL) | Internal Ground Station Subnet |
| **3000** | TCP | `127.0.0.1` | Node.js Backend API | Localhost Only (Internal Proxy) |
| **3306** | TCP | `127.0.0.1` | MariaDB SQL Server | Localhost Only |
| **6379** | TCP | `127.0.0.1` | Redis / Valkey Cache | Localhost Only |

---

## 2. Hardware & Network Specifications

| Parameter | Minimum (Testing / Virtual Machine) | Recommended (Mission Production Ground Server) |
|:---|:---|:---|
| **Operating System** | RHEL 9.2+ / RHEL 10 / Rocky Linux 9 | Red Hat Enterprise Linux 9.4 or 10 (`x86_64`) |
| **Processor (CPU)** | 4 Cores | 8 to 16 Enterprise Server Cores (Intel Xeon / AMD EPYC) |
| **System Memory (RAM)**| 8 GB | 32 GB to 64 GB ECC DDR4/DDR5 |
| **OS Storage (Root)** | 60 GB SSD | 120 GB NVMe / SAS SSD (RAID-1 Mirror) |
| **Archive Storage Mount**| 100 GB (`/mnt/istrac_storage`) | 4 TB to 20 TB Enterprise Storage (RAID-6 / SAN) |
| **Network Interfaces** | 1 Gbps Virtual NIC | Dual 10 Gbps Bonded NICs (802.3ad LACP) |

---

## 3. Pre-Deployment Packaging on Workstation (Windows Side)

Because the destination server has no internet access, build artifacts are compiled on the packaging workstation:

```powershell
# 1. Compile Frontend SPA
cd D:\istrac-fms\frontend
npm run build

# 2. Compile Backend TypeScript
cd D:\istrac-fms\backend
npm run build

# 3. Synchronize build artifacts to the VM Shared Folder
Copy-Item -Path "D:\istrac-fms\frontend\dist\*" -Destination "D:\Rhel_Shared_Folder\istrac-fms-offline-bundle-20260915\frontend\dist\" -Recurse -Force
Copy-Item -Path "D:\istrac-fms\backend\dist\*" -Destination "D:\Rhel_Shared_Folder\istrac-fms-offline-bundle-20260915\backend\dist\" -Recurse -Force
Copy-Item -Path "D:\istrac-fms\deploy\*" -Destination "D:\Rhel_Shared_Folder\istrac-fms-offline-bundle-20260915\deploy\" -Recurse -Force
Copy-Item "D:\istrac-fms\deploy\install-apache-offline.sh" "D:\Rhel_Shared_Folder\istrac-fms-offline-bundle-20260915\install.sh" -Force
```

---

## 4. First-Time Automated Installation (Air-Gapped RHEL)

Log into the RHEL console or SSH session:

```bash
# 1. Navigate to the mounted shared folder
cd /media/sf_Rhel_Shared_Folder/istrac-fms-offline-bundle-20260915

# 2. Run the automated installer
sudo ./setup-rhel-offline.sh
```

### What the Automated Script Performs:
1. **System User Creation:** Configures the dedicated system service account `istrac`.
2. **Offline Package Installation:** Installs `httpd`, `mod_ssl`, `mariadb-server`, and dependencies from the local `rpms/` directory.
3. **Node.js 24 Runtime:** Extracts the official Node.js v24.21.0 binary tarball and links it to `/usr/bin/node`.
4. **Database Provisioning:** Starts MariaDB, creates database `istrac_fms`, provisions `istrac_user`, and grants local loopback privileges.
5. **Environment Configuration:** Writes `/opt/istrac-fms/backend/.env` with random 256-bit secrets (or preserves existing ones).
6. **Database Migration & Seeding:** Deploys Prisma SQL migrations offline and seeds the default administrator (`admin@istrac.local`).
7. **Systemd Daemon Setup:** Creates and activates `istrac-backend.service` and `istrac-worker.service`.
8. **Apache Reverse Proxy:** Configures `/etc/httpd/conf.d/istrac-fms.conf`, enables SELinux network proxying, and starts Apache.
9. **Firewall Rules:** Opens TCP ports `80` and `443` in `firewalld`.

---

## 5. Systemd Service Units & Daemon Control

### 5.1. Backend API Service (`/etc/systemd/system/istrac-backend.service`)
```ini
[Unit]
Description=ISTRAC FMS Backend API Server
After=network.target mariadb.service redis.service
Wants=mariadb.service redis.service

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

### 5.2. Background Worker Service (`/etc/systemd/system/istrac-worker.service`)
```ini
[Unit]
Description=ISTRAC FMS Background Telemetry Worker
After=network.target mariadb.service redis.service istrac-backend.service
Wants=mariadb.service redis.service

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

---

## 6. Apache HTTP Server 2.4 Reverse Proxy Configuration

Configuration file location: `/etc/httpd/conf.d/istrac-fms.conf`

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

    # 2. REST API Reverse Proxy (No trailing slashes ensures /api/health works)
    ProxyPass        /api http://127.0.0.1:3000/api retry=0 timeout=120
    ProxyPassReverse /api http://127.0.0.1:3000/api

    # 3. CMS Uploaded Media Proxy
    ProxyPass        /media http://127.0.0.1:3000/media retry=0 timeout=60
    ProxyPassReverse /media http://127.0.0.1:3000/media

    # 4. Single-Page Application (SPA) HTML5 PushState Fallback
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

    ErrorLog /var/log/httpd/istrac_error.log
    CustomLog /var/log/httpd/istrac_access.log combined
</VirtualHost>
```

---

## 7. Environment Configuration Reference (`.env`)

Production file location: `/opt/istrac-fms/backend/.env` (permissions `600`, owned by `istrac:istrac`):

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

# Redis
REDIS_URL="redis://127.0.0.1:6379"

# Security Secrets
JWT_SECRET=rDirso2AXb709KGiFgA8371ZZUvP0mdJ
JWT_REFRESH_SECRET=OlyASgitiXj9ToQwTxUMblEr9Sibmldh

# Storage Mount
HDD_MOUNT_PATH=/mnt/istrac_storage
```

---

## 8. VirtualBox NAT Port Forwarding Guide

When testing on VirtualBox with default NAT networking:
1. Open **VirtualBox Manager** on your Windows host.
2. Select your RHEL Virtual Machine and click **Settings**.
3. Go to **Network** -> **Adapter 1** -> Click **Advanced** -> Click **Port Forwarding**.
4. Add Rule:
   - **Name:** `HTTP_App`
   - **Protocol:** `TCP`
   - **Host Port:** `8080`
   - **Guest Port:** `80`
5. Click **OK**.
6. Access from Windows Chrome/Edge at:
   ```
   http://localhost:8080/
   ```

---

## 9. Day-to-Day Service Management CLI (`manage-services-rhel.sh`)

```bash
# Check status of Apache, Node Backend, Worker, MariaDB, and Storage
sudo /opt/istrac-fms/manage-services-rhel.sh status

# Restart all services after an update
sudo /opt/istrac-fms/manage-services-rhel.sh restart

# Stream live backend API logs in real-time
sudo /opt/istrac-fms/manage-services-rhel.sh logs

# Create an automated SQL database backup
sudo /opt/istrac-fms/manage-services-rhel.sh backup
```

---

## 10. Database Backup & Disaster Recovery Procedures

### 10.1. Creating a Manual SQL Backup
```bash
sudo mkdir -p /var/backups/istrac-sims
sudo mysqldump -u istrac_user -p"IstracSecurePass123!" istrac_fms > \
  /var/backups/istrac-sims/istrac_fms_backup_$(date +%Y%m%d_%H%M%S).sql
```

### 10.2. Restoring Database from SQL Dump
```bash
# 1. Stop application daemons
sudo systemctl stop istrac-backend istrac-worker

# 2. Import backup file
mysql -u istrac_user -p"IstracSecurePass123!" istrac_fms < /path/to/backup.sql

# 3. Restart application services
sudo systemctl start istrac-backend istrac-worker
```

---

## 11. Storage Subsystem Administration (`/mnt/istrac_storage`)

- **Permissions:** Must remain `770` owned by `istrac:istrac`:
  ```bash
  sudo chown -R istrac:istrac /mnt/istrac_storage
  sudo chmod -R 770 /mnt/istrac_storage
  ```
- **Permanent `/etc/fstab` Mount Example (for physical partition `/dev/sdb1`):**
  ```
  /dev/sdb1  /mnt/istrac_storage  ext4  defaults,noatime,nodev  0  2
  ```

---

## 12. Application Update & Hotfix Deployment Runbook

To update frontend or backend code **without reinstalling or losing data**:

```bash
# 1. Copy fresh frontend assets
sudo cp -rf /media/sf_Rhel_Shared_Folder/istrac-fms-offline-bundle-20260915/frontend/dist/* /opt/istrac-fms/frontend/dist/
sudo chmod -R 755 /opt/istrac-fms/frontend/dist

# 2. Copy fresh backend assets
sudo cp -rf /media/sf_Rhel_Shared_Folder/istrac-fms-offline-bundle-20260915/backend/dist/* /opt/istrac-fms/backend/dist/

# 3. Restart backend and web server
sudo systemctl restart istrac-backend httpd

# 4. In browser, force hard refresh
# Press Ctrl + Shift + R
```

---

## 13. Intranet DNS & Domain Configuration

To map a formal ground station intranet domain (e.g. `sims.istrac.gov.in`):
1. Configure your ground station internal DNS server:
   ```
   sims.istrac.gov.in  A  10.20.1.50
   ```
2. In `/opt/istrac-fms/backend/.env`, append the domain to `ALLOWED_ORIGINS`:
   ```env
   ALLOWED_ORIGINS=http://localhost,http://127.0.0.1,http://sims.istrac.gov.in
   ```
3. In `/etc/httpd/conf.d/istrac-fms.conf`, update `ServerName`:
   ```apache
   ServerName sims.istrac.gov.in
   ```
4. Reload services:
   ```bash
   sudo systemctl reload httpd
   sudo systemctl restart istrac-backend
   ```

---

## 14. Security Hardening & Production Checklist

- [ ] **SELinux Enforcing:** Verify `getenforce` reports `Enforcing`. Ensure `setsebool -P httpd_can_network_connect 1` is applied.
- [ ] **Firewalld:** Only ports `80`, `443`, and `22` (SSH) should be public. Ports `3000`, `3306`, and `6379` must remain loopback-only.
- [ ] **Password Rotation:** Default administrator password (`ChangeMe123!`) must be changed immediately after initial login.
- [ ] **Config Permissions:** Verify `/opt/istrac-fms/backend/.env` is strictly `chmod 600` owned by `istrac:istrac`.
- [ ] **Automated Backups:** Verify daily database dump cron job is active under `/etc/cron.daily/`.
