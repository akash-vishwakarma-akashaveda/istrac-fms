# 🛰️ ISTRAC-SIMS — Red Hat Enterprise Linux (RHEL) Production Deployment Guide

> **System:** ISRO Telemetry, Tracking and Command Network — Satellite Information Management System (ISTRAC-SIMS)  
> **Target OS:** Red Hat Enterprise Linux (RHEL 8 / 9), Rocky Linux (8 / 9), AlmaLinux (8 / 9), CentOS Stream  
> **Deployment Model:** Single-Host All-in-One Appliance or Enterprise Clustered Node  
> **Version:** 1.1.0 (Production Baseline)

---

## 📑 Table of Contents

1. [Architecture Overview & Hosted Services](#1-architecture-overview--hosted-services)
2. [Hardware & Software Prerequisites](#2-hardware--software-prerequisites)
3. [Method A: 1-Click Automated Setup (`setup-rhel.sh`)](#3-method-a-1-click-automated-setup-setup-rhelsh)
4. [Method B: Step-by-Step Manual Setup](#4-method-b-step-by-step-manual-setup)
   - [4.1 System Repositories & Base Toolchain](#41-system-repositories--base-toolchain)
   - [4.2 Node.js 20 LTS Installation](#42-nodejs-20-lts-installation)
   - [4.3 MariaDB / MySQL 8.0 Database Provisioning](#43-mariadb--mysql-80-database-provisioning)
   - [4.4 Redis 7.x In-Memory Cache & Pub/Sub Setup](#44-redis-7x-in-memory-cache--pubsub-setup)
   - [4.5 Storage Mount Volume & SELinux Policies](#45-storage-mount-volume--selinux-policies)
   - [4.6 Backend Application Build & Database Migrations](#46-backend-application-build--database-migrations)
   - [4.7 Frontend Production Build](#47-frontend-production-build)
   - [4.8 PM2 Process Manager & Systemd Service](#48-pm2-process-manager--systemd-service)
   - [4.9 Nginx Reverse Proxy & WebSocket Gateway](#49-nginx-reverse-proxy--websocket-gateway)
   - [4.10 Firewalld Network Rules](#410-firewalld-network-rules)
5. [SSL/TLS Certificate Installation (HTTPS)](#5-ssltls-certificate-installation-https)
6. [Daily Operations & Service Management (`manage-services-rhel.sh`)](#6-daily-operations--service-management-manage-services-rhelsh)
7. [Backup, Recovery & Maintenance](#7-backup-recovery--maintenance)
8. [Troubleshooting & Diagnostics](#8-troubleshooting--diagnostics)

---

## 1. Architecture Overview & Hosted Services

All services required by ISTRAC-SIMS run locally on the RHEL server:

```mermaid
graph TD
    Client["Client Browser (Chrome / Firefox / Edge)"]
    
    subgraph "Red Hat Enterprise Linux Server"
        Firewall["Firewalld (Port 80 / 443)"]
        Nginx["Nginx Reverse Proxy & Static SPA Server"]
        PM2["PM2 Process Daemon (Node.js 20 Backend on Port 3000)"]
        MariaDB[("MariaDB 10.11 / MySQL 8.0 on Port 3306")]
        Redis[("Redis 7.0 Cache & Pub/Sub on Port 6379")]
        Storage[("Physical HDD Mount (/mnt/istrac_storage)")]
    end

    Client -->|HTTP / HTTPS / WSS| Firewall
    Firewall --> Nginx
    Nginx -->|SPA Static Files /assets/| Nginx
    Nginx -->|REST API /api/*| PM2
    Nginx -->|WebSocket /ws| PM2
    PM2 --> MariaDB
    PM2 --> Redis
    PM2 --> Storage
```

---

## 2. Hardware & Software Prerequisites

| Component | Minimum Specification | Recommended Specification |
| :--- | :--- | :--- |
| **Operating System** | RHEL 8.8+ / RHEL 9.2+ / Rocky Linux 9 | RHEL 9.4 (x86_64 or aarch64) |
| **CPU** | 4 Cores | 8+ Cores (Xeon / EPYC) |
| **RAM** | 8 GB | 16 GB - 32 GB ECC |
| **Root Disk (OS/Apps)** | 50 GB SSD | 100 GB NVMe |
| **Storage Volume Mount**| 500 GB | 2 TB - 10 TB Enterprise RAID-10 |

---

## 3. Method A: 1-Click Automated Setup (`setup-rhel.sh`)

The repository includes a self-contained, idempotent automation script that provisions all repositories, services, databases, PM2 processes, SELinux contexts, and Nginx configurations automatically:

```bash
# 1. Clone repository to /opt/istrac-fms (or any directory)
cd /opt
sudo git clone https://github.com/Dev-ayansharma/istrac-fms.git
cd /opt/istrac-fms

# 2. Make setup scripts executable
sudo chmod +x setup-rhel.sh manage-services-rhel.sh

# 3. Execute setup
sudo ./setup-rhel.sh
```

---

## 4. Method B: Step-by-Step Manual Setup

### 4.1 System Repositories & Base Toolchain
```bash
sudo dnf install -y epel-release
sudo dnf install -y curl wget git tar gcc-c++ make openssl policycoreutils-python-utils firewalld
```

### 4.2 Node.js 20 LTS Installation
```bash
curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash -
sudo dnf install -y nodejs
```

### 4.3 MariaDB / MySQL 8.0 Database Provisioning
```bash
sudo dnf install -y mariadb-server mariadb
sudo systemctl enable --now mariadb

# Initialize Database & User
sudo mysql -e "CREATE DATABASE IF NOT EXISTS istrac_fms CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
sudo mysql -e "CREATE USER IF NOT EXISTS 'istrac_user'@'localhost' IDENTIFIED BY 'IstracSecurePass123!';"
sudo mysql -e "GRANT ALL PRIVILEGES ON istrac_fms.* TO 'istrac_user'@'localhost';"
sudo mysql -e "CREATE USER IF NOT EXISTS 'istrac_user'@'127.0.0.1' IDENTIFIED BY 'IstracSecurePass123!';"
sudo mysql -e "GRANT ALL PRIVILEGES ON istrac_fms.* TO 'istrac_user'@'127.0.0.1';"
sudo mysql -e "FLUSH PRIVILEGES;"
```

### 4.4 Redis 7.x In-Memory Cache & Pub/Sub Setup
```bash
sudo dnf install -y redis
sudo systemctl enable --now redis
```

### 4.5 Storage Mount Volume & SELinux Policies
```bash
sudo mkdir -p /mnt/istrac_storage
sudo chmod 775 /mnt/istrac_storage

# Configure SELinux contexts for read-write access
sudo semanage fcontext -a -t httpd_sys_rw_content_t "/mnt/istrac_storage(/.*)?"
sudo restorecon -Rv /mnt/istrac_storage
```

### 4.6 Backend Application Build & Database Migrations
```bash
cd /opt/istrac-fms/backend

# Create production .env
cat <<EOF > .env
NODE_ENV=production
PORT=3000
APP_URL=http://localhost
ALLOWED_ORIGINS=http://localhost,http://127.0.0.1
LOG_LEVEL=info
DEBUG_PRISMA=false

MYSQL_HOST=127.0.0.1
MYSQL_PORT=3306
MYSQL_DATABASE=istrac_fms
MYSQL_USER=istrac_user
MYSQL_PASSWORD=IstracSecurePass123!
MYSQL_ROOT_PASSWORD=RootIstracSecure123!
DATABASE_URL=mysql://istrac_user:IstracSecurePass123!@127.0.0.1:3306/istrac_fms

REDIS_URL=redis://127.0.0.1:6379
JWT_SECRET=$(openssl rand -hex 32)
JWT_REFRESH_SECRET=$(openssl rand -hex 32)
HDD_MOUNT_PATH=/mnt/istrac_storage
EOF

# Install dependencies, migrate & seed
npm install
npx prisma generate
npx prisma migrate deploy
npm run seed
npm run build
```

### 4.7 Frontend Production Build
```bash
cd /opt/istrac-fms/frontend

cat <<EOF > .env
VITE_API_URL=/api
VITE_WS_URL=/ws
EOF

npm install
npm run build
sudo chmod -R 755 dist
```

### 4.8 PM2 Process Manager & Systemd Service
```bash
sudo npm install -g pm2
sudo mkdir -p /var/log/istrac-sims

cd /opt/istrac-fms
pm2 start ecosystem.config.cjs --env production
pm2 save
sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u root --hp /root
```

### 4.9 Nginx Reverse Proxy & WebSocket Gateway
```bash
sudo dnf install -y nginx
sudo cp nginx-istrac-sims.conf /etc/nginx/conf.d/istrac-sims.conf

# Allow Nginx to connect to network backends via SELinux
sudo setsebool -P httpd_can_network_connect 1
sudo setsebool -P httpd_read_user_content 1

sudo systemctl enable --now nginx
```

### 4.10 Firewalld Network Rules
```bash
sudo firewall-cmd --permanent --add-service=http
sudo firewall-cmd --permanent --add-service=https
sudo firewall-cmd --reload
```

---

## 5. SSL/TLS Certificate Installation (HTTPS)

### Using Let's Encrypt (Automated Public Certificates)
```bash
sudo dnf install -y certbot python3-certbot-nginx
sudo certbot --nginx -d istrac-sims.yourdomain.com
```

### Using Internal ISRO CA Certificates
Place your certificate and key files:
- Certificate: `/etc/pki/tls/certs/istrac-sims.crt`
- Private Key: `/etc/pki/tls/private/istrac-sims.key`

In `/etc/nginx/conf.d/istrac-sims.conf`, add:
```nginx
server {
    listen 443 ssl http2;
    server_name istrac-portal.isro.local;

    ssl_certificate /etc/pki/tls/certs/istrac-sims.crt;
    ssl_certificate_key /etc/pki/tls/private/istrac-sims.key;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    
    # ... rest of configuration from nginx-istrac-sims.conf ...
}
```
Reload Nginx: `sudo systemctl reload nginx`.

---

## 6. Daily Operations & Service Management (`manage-services-rhel.sh`)

Use the included helper script:

```bash
# Check status of all services
./manage-services-rhel.sh status

# Restart all services
./manage-services-rhel.sh restart

# Stream live backend API logs
./manage-services-rhel.sh logs

# Create instant compressed database backup
./manage-services-rhel.sh backup

# Rebuild frontend and backend after Git updates
./manage-services-rhel.sh rebuild
```

---

## 7. Backup, Recovery & Maintenance

### Automated Daily Database Backup via Cron
Add to `/etc/crontab`:
```bash
0 2 * * * root /opt/istrac-fms/manage-services-rhel.sh backup >/dev/null 2>&1
```

### Storage Volume Backup
Use `rsync` to sync `/mnt/istrac_storage` to your secondary NAS/SAN backup array:
```bash
rsync -avz --delete /mnt/istrac_storage/ /mnt/backup_nas/istrac_storage/
```

---

## 8. Troubleshooting & Diagnostics

| Issue / Symptom | Probable Cause | Resolution |
| :--- | :--- | :--- |
| **502 Bad Gateway on `/api/`** | Backend is stopped or PM2 process crashed. | Run `pm2 status` and check logs: `pm2 logs istrac-sims-backend`. |
| **403 Forbidden on static files** | SELinux or file permissions blocking Nginx. | Run `chmod -R 755 /opt/istrac-fms/frontend/dist` and `setsebool -P httpd_read_user_content 1`. |
| **Database connection refused** | MariaDB service is inactive. | Run `sudo systemctl restart mariadb` and verify `systemctl status mariadb`. |
| **Cannot upload files > 1MB** | `client_max_body_size` not configured in Nginx. | Ensure `client_max_body_size 100M;` is present in `/etc/nginx/conf.d/istrac-sims.conf`. |
| **WebSocket connection fails** | Proxy headers missing. | Verify `Upgrade` and `Connection "Upgrade"` headers are present in the Nginx `/ws` block. |
