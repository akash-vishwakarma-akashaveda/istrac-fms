# ISTRAC-SIMS — Air-Gapped Intranet Server Deployment & Operations Guide

> **System:** ISRO Telemetry, Tracking & Command Network (ISTRAC) — Satellite Information Management System (ISTRAC-SIMS)  
> **Environment:** Air-Gapped / Isolated Intranet Operations (Zero Public Internet Access)  
> **Target OS:** Red Hat Enterprise Linux (RHEL) 8 / 9 · Rocky Linux 8 / 9 · AlmaLinux 8 / 9 · Ubuntu 22.04 / 24.04 LTS  
> **Classification:** Restricted — ISRO Internal Network  
> **Document Version:** 1.0.0 Production Baseline  
> **Location:** `documents/INTRANET_SERVER_SETUP_GUIDE.md`

---

## 📑 Table of Contents

1. [Architectural Overview on the Intranet](#1-architectural-overview-on-the-intranet)
2. [Server Prerequisites & Network Topology](#2-server-prerequisites--network-topology)
3. [Pre-Deployment Packaging on Staging Machine](#3-pre-deployment-packaging-on-staging-machine)
4. [Step-by-Step Server Setup (Air-Gapped Host)](#4-step-by-step-server-setup-air-gapped-host)
   - [4.1 Storage Partitioning & Mount Initialization](#41-storage-partitioning--mount-initialization)
   - [4.2 Offline RHEL / Linux Package Installation](#42-offline-rhel--linux-package-installation)
   - [4.3 Node.js 20 LTS Runtime Setup](#43-nodejs-20-lts-runtime-setup)
   - [4.4 MariaDB 10.11 Database Setup & Hardening](#44-mariadb-1011-database-setup--hardening)
   - [4.5 Redis 7 Cache & Message Broker Setup](#45-redis-7-cache--message-broker-setup)
   - [4.6 Deploying Application Artifacts & Database Migration](#46-deploying-application-artifacts--database-migration)
   - [4.7 Backend Process Management via PM2](#47-backend-process-management-via-pm2)
   - [4.8 Nginx Web Server & Reverse Proxy Configuration](#48-nginx-web-server--reverse-proxy-configuration)
   - [4.9 SELinux & Firewalld Hardening](#49-selinux--firewalld-hardening)
5. [Intranet Domain, DNS & SSL/TLS Setup](#5-intranet-domain-dns--ssltls-setup)
6. [System Verification & Health Check](#6-system-verification--health-check)
7. [Operational Management & Maintenance Runbook](#7-operational-management--maintenance-runbook)
   - [7.1 Service Management Commands](#71-service-management-commands)
   - [7.2 Automated Database Backups](#72-automated-database-backups)
   - [7.3 Storage Mount Monitoring](#73-storage-mount-monitoring)
8. [Intranet Troubleshooting & Diagnostic Matrix](#8-intranet-troubleshooting--diagnostic-matrix)

---

## 1. Architectural Overview on the Intranet

In an **air-gapped intranet environment**, the host server operates with **no direct internet access**. All client access arrives from internal mission networks (e.g. `10.x.x.x` or `172.16.x.x` or `192.168.x.x`) or localized ground station subnets.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           ISRO INTRANET NETWORK                             │
│                                                                             │
│   ┌───────────────────────────┐         ┌───────────────────────────────┐   │
│   │   Mission Control MOX     │         │   Tracking Station Consoles   │   │
│   │   Consoles (10.20.1.0/24) │         │   (Port Blair, Byalalu, etc)  │   │
│   └─────────────┬─────────────┘         └───────────────┬───────────────┘   │
│                 │                                       │                   │
│                 │ HTTPS (Port 443) / WSS (/ws)          │                   │
│                 ▼                                       ▼                   │
│   ┌─────────────────────────────────────────────────────────────────────┐   │
│   │               INTRANET DNS: sims.istrac.gov.in / IP                 │   │
│   ├─────────────────────────────────────────────────────────────────────┤   │
│   │                    Nginx Web Server (Port 443)                      │   │
│   │  • Static Frontend SPA (/var/www/istrac-sims/frontend/dist)         │   │
│   │  • Reverse Proxy /api/  ──► http://127.0.0.1:3000                    │   │
│   │  • Reverse Proxy /ws    ──► http://127.0.0.1:3000/ws (WebSocket)    │   │
│   │  • Max Upload Size: 500MB (client_max_body_size 500M)               │   │
│   └──────────────────────────────────┬──────────────────────────────────┘   │
│                                      │ Internal Loopback (127.0.0.1)        │
│                                      ▼                                      │
│   ┌─────────────────────────────────────────────────────────────────────┐   │
│   │               Node.js Express 5 API Server (PM2)                    │   │
│   │  • Port 3000 (Internal Only) · PID Managed by systemd               │   │
│   │  • BigInt File Sizes · 15-min HDD Sync · 60s Storage Probe          │   │
│   └───────────────┬───────────────────┬───────────────────┬─────────────┘   │
│                   │                   │                   │                 │
│                   ▼                   ▼                   ▼                 │
│   ┌───────────────────────┐ ┌───────────────────┐ ┌─────────────────────┐   │
│   │     MariaDB 10.11     │ │      Redis 7      │ │ Primary Data Mount  │   │
│   │  (127.0.0.1:3306 TCP) │ │(127.0.0.1:6379 TCP│ │  /mnt/istrac_data  │   │
│   └───────────────────────┘ └───────────────────┘ └─────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Server Prerequisites & Network Topology

### Hardware Specifications
| Parameter | Minimum (Test/Lab) | Recommended (Mission Production) |
| :--- | :--- | :--- |
| **CPU** | 4 Cores (x86_64) | 8 to 16 Cores (Intel Xeon / AMD EPYC) |
| **RAM** | 8 GB ECC DDR4 | 16 GB to 32 GB ECC DDR4/DDR5 |
| **OS Disk** | 50 GB SSD (RAID-1) | 100 GB NVMe / Enterprise SAS (RAID-1) |
| **Data Storage Mount** | 500 GB (`/mnt/istrac_data`) | 4 TB to 20 TB RAID-6 / SAN / NAS Mount |
| **Network Interface** | 1 Gbps Ethernet | Dual 10 Gbps Bonded NICs (LACP) |

### Network & Port Allocation
| Port | Protocol | Binding / Scope | Purpose |
| :--- | :--- | :--- | :--- |
| **80** | TCP | `0.0.0.0` (All Interfaces) | HTTP (Auto-redirects to HTTPS 443) |
| **443** | TCP | `0.0.0.0` (All Interfaces) | HTTPS + Secure WebSockets (Main Gateway) |
| **3000** | TCP | `127.0.0.1` (**Localhost Only**) | Node.js Backend API Server |
| **3306** | TCP | `127.0.0.1` (**Localhost Only**) | MariaDB Relational Database |
| **6379** | TCP | `127.0.0.1` (**Localhost Only**) | Redis In-Memory Cache & Pub/Sub |
| **22** | TCP | Intranet Admin Subnet Only | SSH Administrative Console |

---

## 3. Pre-Deployment Packaging on Staging Machine

Because the production server has **no internet access**, prepare the complete self-contained deployment bundle on an internet-connected build workstation.

### Step 3.1: Build Frontend and Install Backend Dependencies
On your staging/development workstation:

```bash
# 1. Navigate to the project root
cd /path/to/istrac-fms

# 2. Configure frontend environment variables for Intranet
# Edit frontend/.env.production (or frontend/.env)
cat << 'EOF' > frontend/.env.production
VITE_API_URL=/api
VITE_WS_URL=/ws
EOF

# 3. Install dependencies and build frontend bundle
cd frontend
npm ci
npm run build
cd ..

# 4. Install production dependencies and compile backend
cd backend
npm ci
npx prisma generate
npm run build
cd ..
```

### Step 3.2: Create Self-Contained Air-Gap Archive
```bash
# 5. Create deployment bundle excluding temporary files and git history
tar -czvf istrac-sims-airgap-v1.0.0.tar.gz \
  --exclude='.git' \
  --exclude='.github' \
  --exclude='backend/src' \
  --exclude='frontend/src' \
  --exclude='frontend/node_modules' \
  --exclude='*.tmp' \
  backend/dist \
  backend/node_modules \
  backend/prisma \
  backend/package.json \
  frontend/dist \
  setup-rhel.sh \
  manage-services-rhel.sh \
  nginx-istrac-sims.conf \
  ecosystem.config.cjs

# 6. Compute SHA-256 hash of the archive for transfer verification
sha256sum istrac-sims-airgap-v1.0.0.tar.gz > istrac-sims-airgap-v1.0.0.tar.gz.sha256
```

### Step 3.3: Secure Media Transfer
Transfer `istrac-sims-airgap-v1.0.0.tar.gz` and `istrac-sims-airgap-v1.0.0.tar.gz.sha256` to the air-gapped server via authorized optical media (CD/DVD-R) or scanned encrypted USB drive as per ISRO Air-Gap Security Guidelines.

On the target server, verify hash before proceeding:
```bash
sha256sum -c istrac-sims-airgap-v1.0.0.tar.gz.sha256
# Output must state: istrac-sims-airgap-v1.0.0.tar.gz: OK
```

---

## 4. Step-by-Step Server Setup (Air-Gapped Host)

Run all commands on the target air-gapped server as `root` (or via `sudo`).

### 4.1 Storage Partitioning & Mount Initialization
Create the dedicated storage mount for telemetry and mission repositories:

```bash
# Create mount directory
mkdir -p /mnt/istrac_data

# Create dedicated service user
useradd -r -s /sbin/nologin -d /var/www/istrac-sims istrac || true

# Set directory permissions
chown -R istrac:istrac /mnt/istrac_data
chmod -R 750 /mnt/istrac_data

# Ensure mount persists across reboots (add to /etc/fstab if dedicated partition/LUN)
# Example fstab entry for dedicated partition /dev/sdb1:
# /dev/sdb1  /mnt/istrac_data  ext4  defaults,noatime  0  2
```

---

### 4.2 Offline RHEL / Linux Package Installation
If using RHEL Local Repository Mirror / ISO DVD:

```bash
# Install required system packages from local RHEL ISO/mirror
dnf install -y \
  nginx \
  mariadb-server \
  mariadb \
  redis \
  policycoreutils-python-utils \
  tar \
  gzip \
  curl \
  util-linux
```

For Ubuntu / Debian offline systems:
```bash
apt-get update && apt-get install -y nginx mariadb-server redis-server
```

---

### 4.3 Node.js 20 LTS Runtime Setup
If Node.js 20 is not in your local repository, extract the official Node.js Linux x64 binary tarball:

```bash
# Extract Node.js binary (transferred via offline media)
tar -xvf node-v20.18.0-linux-x64.tar.xz -C /usr/local/ --strip-components=1

# Verify Node.js and NPM versions
node -v # Should display v20.x.x
npm -v  # Should display 10.x.x

# Install PM2 globally (offline from pre-packaged tarball or copy)
npm install -g pm2
```

---

### 4.4 MariaDB 10.11 Database Setup & Hardening

1. **Configure MariaDB UTF8mb4 & TCP Socket Settings:**
```ini
# Create /etc/my.cnf.d/istrac-sims.cnf (or /etc/mysql/conf.d/istrac.cnf on Ubuntu)
cat << 'EOF' > /etc/my.cnf.d/istrac-sims.cnf
[mysqld]
bind-address = 127.0.0.1
port = 3306
character-set-server = utf8mb4
collation-server = utf8mb4_unicode_ci
max_connections = 300
innodb_buffer_pool_size = 2G
innodb_log_file_size = 512M
innodb_file_per_table = 1
default_storage_engine = InnoDB
max_allowed_packet = 128M

[client]
default-character-set = utf8mb4
EOF
```

2. **Start and Enable MariaDB:**
```bash
systemctl daemon-reload
systemctl enable --now mariadb
systemctl status mariadb
```

3. **Initialize Database & Application User:**
Execute the database initialization SQL:
```bash
mysql -u root << 'EOF'
-- Create Database
CREATE DATABASE IF NOT EXISTS istrac_sims
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

-- Create Dedicated User (TCP Host 127.0.0.1 is critical for Node.js adapter)
CREATE USER IF NOT EXISTS 'istrac_app'@'127.0.0.1' IDENTIFIED BY 'ChangeThisDatabasePassword123!';
CREATE USER IF NOT EXISTS 'istrac_app'@'localhost' IDENTIFIED BY 'ChangeThisDatabasePassword123!';

-- Grant Privileges
GRANT ALL PRIVILEGES ON istrac_sims.* TO 'istrac_app'@'127.0.0.1';
GRANT ALL PRIVILEGES ON istrac_sims.* TO 'istrac_app'@'localhost';

FLUSH PRIVILEGES;
EOF
```

---

### 4.5 Redis 7 Cache & Message Broker Setup

1. **Configure Redis:**
```bash
# Ensure Redis binds strictly to localhost and sets memory limit
sed -i 's/^bind .*/bind 127.0.0.1/' /etc/redis/redis.conf || sed -i 's/^bind .*/bind 127.0.0.1/' /etc/redis.conf
sed -i 's/^# maxmemory <bytes>/maxmemory 1gb/' /etc/redis/redis.conf || sed -i 's/^# maxmemory <bytes>/maxmemory 1gb/' /etc/redis.conf
sed -i 's/^# maxmemory-policy .*/maxmemory-policy allkeys-lru/' /etc/redis/redis.conf || sed -i 's/^# maxmemory-policy .*/maxmemory-policy allkeys-lru/' /etc/redis.conf
```

2. **Start and Enable Redis:**
```bash
systemctl enable --now redis
redis-cli ping # Should respond with: PONG
```

---

### 4.6 Deploying Application Artifacts & Database Migration

1. **Extract Deployment Bundle:**
```bash
mkdir -p /var/www/istrac-sims
tar -xzvf istrac-sims-airgap-v1.0.0.tar.gz -C /var/www/istrac-sims
cd /var/www/istrac-sims
```

2. **Configure Backend Production `.env` File:**
```bash
cat << 'EOF' > /var/www/istrac-sims/backend/.env
# ============================================================
# ISTRAC-SIMS PRODUCTION INTRANET CONFIGURATION
# ============================================================
PORT=3000
NODE_ENV=production

# Database (Ensure 127.0.0.1 is used, NOT localhost)
DATABASE_URL="mysql://istrac_app:ChangeThisDatabasePassword123!@127.0.0.1:3306/istrac_sims"
MYSQL_HOST=127.0.0.1
MYSQL_PORT=3306
MYSQL_DATABASE=istrac_sims
MYSQL_USER=istrac_app
MYSQL_PASSWORD=ChangeThisDatabasePassword123!

# Redis Cache & Message Broker
REDIS_URL="redis://127.0.0.1:6379"

# Cryptographic Keys (Generate with: openssl rand -base64 32)
JWT_SECRET="c6b12a890efd432b1a87e59c03841029e8473210abef49c81203948576dbe123"
JWT_REFRESH_SECRET="e9812734bca098471239847abfe0912384712093847120938471209384712093"

# Storage Subsystem Mount
HDD_MOUNT_PATH=/mnt/istrac_data

# Allowed Intranet Origins (Domain names and IP subnets)
ALLOWED_ORIGINS="https://sims.istrac.gov.in,http://sims.istrac.gov.in,https://10.20.1.50,http://10.20.1.50,http://localhost"
APP_URL="https://sims.istrac.gov.in"

# Internal SMTP Server for Alerting
SMTP_HOST=127.0.0.1
SMTP_PORT=25
ADMIN_EMAIL=flightops-admin@istrac.gov.in

# Operational Logging
LOG_LEVEL=info
DEBUG_PRISMA=false
EOF

# Restrict permissions on .env file containing credentials
chmod 600 /var/www/istrac-sims/backend/.env
```

3. **Execute Prisma Migrations & Seed Default Data:**
```bash
cd /var/www/istrac-sims/backend

# Apply schema migrations
npx prisma migrate deploy

# Run seed script (creates satellites, departments, superadmin)
node -e "import('./dist/services/bootstrap.service.js').then(m => m.bootstrapService.bootstrap()).catch(console.error)" || true
```

4. **Set Directory Ownership:**
```bash
chown -R istrac:istrac /var/www/istrac-sims
```

---

### 4.7 Backend Process Management via PM2

1. **Verify `ecosystem.config.cjs`:**
```js
module.exports = {
  apps: [
    {
      name: 'istrac-backend',
      script: './backend/dist/index.js',
      cwd: '/var/www/istrac-sims',
      instances: 'max', // Utilizes all available CPU cores in cluster mode
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
      max_memory_restart: '1G',
      exp_backoff_restart_delay: 100,
      listen_timeout: 10000,
      kill_timeout: 5000,
      error_file: '/var/log/istrac-sims/backend-error.log',
      out_file: '/var/log/istrac-sims/backend-out.log',
      time: true,
    },
  ],
}
```

2. **Create Log Directory & Launch Backend:**
```bash
mkdir -p /var/log/istrac-sims
chown -R istrac:istrac /var/log/istrac-sims

# Start PM2 process under istrac user
sudo -u istrac pm2 start /var/www/istrac-sims/ecosystem.config.cjs

# Save PM2 process list
sudo -u istrac pm2 save

# Setup PM2 to auto-start on system boot
pm2 startup systemd -u istrac --hp /var/www/istrac-sims
```

---

### 4.8 Nginx Web Server & Reverse Proxy Configuration

Create `/etc/nginx/conf.d/istrac-sims.conf`:

```nginx
# Map WebSocket Upgrade headers
map $http_upgrade $connection_upgrade {
    default upgrade;
    ''      close;
}

# Upstream Node.js API Cluster
upstream istrac_backend {
    server 127.0.0.1:3000 max_fails=3 fail_timeout=10s;
    keepalive 32;
}

# HTTP Server — Redirect all port 80 traffic to HTTPS
server {
    listen 80;
    listen [::]:80;
    server_name sims.istrac.gov.in 10.20.1.50 _;

    # Allow health checks over HTTP for local load balancers
    location /health {
        proxy_pass http://istrac_backend/health;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
    }

    location / {
        return 301 https://$host$request_uri;
    }
}

# HTTPS Production Server
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name sims.istrac.gov.in 10.20.1.50 _;

    # SSL / TLS Configuration (Internal ISRO CA Certificates)
    ssl_certificate     /etc/pki/tls/certs/istrac-sims.crt;
    ssl_certificate_key /etc/pki/tls/private/istrac-sims.key;
    ssl_protocols       TLSv1.2 TLSv1.3;
    ssl_ciphers         HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;
    ssl_session_cache   shared:SSL:10m;
    ssl_session_timeout 1d;

    # Maximum file upload size (matches chunking threshold)
    client_max_body_size 500M;
    client_body_buffer_size 128k;

    # Root directory for compiled frontend SPA
    root /var/www/istrac-sims/frontend/dist;
    index index.html;

    # Security Headers
    add_header X-Frame-Options "DENY" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    # Static Assets with Cache
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 30d;
        add_header Cache-Control "public, no-transform";
        try_files $uri =404;
    }

    # REST API Reverse Proxy
    location /api/ {
        # Strip /api prefix before forwarding to backend Express router
        rewrite ^/api/(.*)$ /$1 break;

        proxy_pass http://istrac_backend;
        proxy_http_version 1.1;

        # Standard Proxy Headers
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # Connection Timeout for large uploads/downloads
        proxy_connect_timeout 60s;
        proxy_send_timeout 300s;
        proxy_read_timeout 300s;
        proxy_buffering off;
    }

    # Real-Time WebSocket Proxy
    location /ws {
        proxy_pass http://istrac_backend/ws;
        proxy_http_version 1.1;

        # WebSocket Upgrade Protocol
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection $connection_upgrade;

        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;

        # Keep alive timers for WebSocket
        proxy_read_timeout 86400s;
        proxy_send_timeout 86400s;
    }

    # Single Page Application (SPA) Fallback Route
    location / {
        try_files $uri $uri/ /index.html;
        add_header Cache-Control "no-store, no-cache, must-revalidate";
    }
}
```

Test and reload Nginx:
```bash
nginx -t
systemctl enable --now nginx
systemctl reload nginx
```

---

### 4.9 SELinux & Firewalld Hardening

#### SELinux Configuration (RHEL / Rocky / AlmaLinux)
Allow Nginx to connect to the internal Node.js backend port over network loopback:

```bash
# Allow Nginx reverse proxy network connections
setsebool -P httpd_can_network_connect 1

# Set correct SELinux file context on web files
semanage fcontext -a -t httpd_sys_content_t "/var/www/istrac-sims/frontend/dist(/.*)?"
restorecon -Rv /var/www/istrac-sims/frontend/dist

# Allow access to storage mount
semanage fcontext -a -t httpd_sys_rw_content_t "/mnt/istrac_data(/.*)?"
restorecon -Rv /mnt/istrac_data
```

#### Firewalld Configuration
Open only HTTP (80) and HTTPS (443). Ensure internal database and cache ports are blocked from external access:

```bash
firewall-cmd --permanent --zone=public --add-service=http
firewall-cmd --permanent --zone=public --add-service=https
firewall-cmd --reload

# Verify active firewall rules
firewall-cmd --list-all
```

---

## 5. Intranet Domain, DNS & SSL/TLS Setup

### Internal Domain Name Resolution
Configure your Intranet DNS Server (BIND / Active Directory DNS) to map:
- `sims.istrac.gov.in` ──► `10.20.1.50` (Server Static IP)

For local console testing without internal DNS, add to client workstation `/etc/hosts` (or `C:\Windows\System32\drivers\etc\hosts`):
```text
10.20.1.50   sims.istrac.gov.in
```

### Self-Signed Certificate Generation (If no internal CA is present)
```bash
mkdir -p /etc/pki/tls/certs /etc/pki/tls/private

openssl req -x509 -nodes -days 1825 -newkey rsa:2048 \
  -keyout /etc/pki/tls/private/istrac-sims.key \
  -out /etc/pki/tls/certs/istrac-sims.crt \
  -subj "/C=IN/ST=Karnataka/L=Bengaluru/O=ISRO/OU=ISTRAC/CN=sims.istrac.gov.in" \
  -addext "subjectAltName=DNS:sims.istrac.gov.in,IP:10.20.1.50,IP:127.0.0.1"

chmod 600 /etc/pki/tls/private/istrac-sims.key
chmod 644 /etc/pki/tls/certs/istrac-sims.crt
```

---

## 6. System Verification & Health Check

Run these automated verification commands on the host:

```bash
# 1. Verify Backend HTTP Health Probe
curl -i http://127.0.0.1:3000/health
# Expected Output: HTTP/1.1 200 OK -> {"status":"ok","db":"ok","redis":"ok","hdd":"ok"}

# 2. Verify Nginx Proxy Route
curl -k -i https://127.0.0.1/api/health
# Expected Output: HTTP/2 200 OK -> {"status":"ok","db":"ok","redis":"ok","hdd":"ok"}

# 3. Verify PM2 Cluster Status
sudo -u istrac pm2 status

# 4. Verify MariaDB Connection
mysql -u istrac_app -h 127.0.0.1 -pChangeThisDatabasePassword123! -e "SELECT count(*) FROM istrac_sims.User;"

# 5. Verify Redis
redis-cli ping
```

---

## 7. Operational Management & Maintenance Runbook

### 7.1 Service Management Commands
The repository includes a helper management utility [`manage-services-rhel.sh`](file:///D:/istrac-fms/manage-services-rhel.sh):

```bash
# Check all services (Nginx, PM2, MariaDB, Redis)
sudo ./manage-services-rhel.sh status

# Restart backend cluster
sudo ./manage-services-rhel.sh restart backend

# View live consolidated logs
sudo ./manage-services-rhel.sh logs backend
sudo ./manage-services-rhel.sh logs nginx

# Reconcile physical storage immediately
curl -X POST -H "Authorization: Bearer <ADMIN_TOKEN>" http://127.0.0.1:3000/admin/sync
```

---

### 7.2 Automated Database Backups
Create an automated daily MariaDB backup script at `/usr/local/bin/backup-istrac-sims.sh`:

```bash
cat << 'EOF' > /usr/local/bin/backup-istrac-sims.sh
#!/usr/bin/env bash
set -euo pipefail

BACKUP_DIR="/mnt/istrac_data/backups/mariadb"
TIMESTAMP=$(date '+%Y%m%d_%H%M%S')
mkdir -p "${BACKUP_DIR}"

# Execute mysqldump with single transaction consistency
mysqldump -u istrac_app -h 127.0.0.1 -p'ChangeThisDatabasePassword123!' \
  --single-transaction \
  --routines \
  --triggers \
  istrac_sims | gzip > "${BACKUP_DIR}/istrac_sims_${TIMESTAMP}.sql.gz"

# Retain backups for 30 days, delete older
find "${BACKUP_DIR}" -type f -name "istrac_sims_*.sql.gz" -mtime +30 -delete

echo "[BACKUP SUCCESS] Backup completed: ${BACKUP_DIR}/istrac_sims_${TIMESTAMP}.sql.gz"
EOF

chmod +x /usr/local/bin/backup-istrac-sims.sh

# Add to crontab for execution at 02:00 AM daily
(crontab -l 2>/dev/null; echo "0 2 * * * /usr/local/bin/backup-istrac-sims.sh >> /var/log/istrac-sims/backup.log 2>&1") | crontab -
```

---

### 7.3 Storage Mount Monitoring
Add a weekly cron to verify physical mount disk space and send alerts:
```bash
# Verify available storage bytes on the data mount
df -h /mnt/istrac_data
```

---

## 8. Intranet Troubleshooting & Diagnostic Matrix

| Symptom / Error | Root Cause | Resolution |
| :--- | :--- | :--- |
| **502 Bad Gateway from Nginx** | 1. SELinux blocking network socket.<br>2. Backend PM2 cluster stopped. | 1. Run `setsebool -P httpd_can_network_connect 1`.<br>2. Run `pm2 restart istrac-backend`. |
| **CORS Blocked in Browser Console** | The Intranet IP or hostname is missing from `ALLOWED_ORIGINS` in `.env`. | Add the exact IP/hostname to `ALLOWED_ORIGINS` in `/var/www/istrac-sims/backend/.env`, e.g. `https://10.20.1.50`. Restart PM2. |
| **401 Unauthorized on WebSocket `/ws`** | Token expired or clock skew between client workstation and server. | Synchronize system clocks via internal NTP: `chronyc tracking` or `systemctl restart chronyd`. |
| **Prisma Connection Error: `ECONNREFUSED 127.0.0.1:3306`** | MariaDB is bound to Unix socket or stopped. | Verify `bind-address = 127.0.0.1` in `/etc/my.cnf.d/istrac-sims.cnf` and run `systemctl restart mariadb`. |
| **File Upload 413 Payload Too Large** | Nginx `client_max_body_size` is default 1MB. | Ensure `client_max_body_size 500M;` is present in `/etc/nginx/conf.d/istrac-sims.conf` and run `nginx -s reload`. |
| **Storage Error 503 `hdd_unavailable`** | Permission denied or mount unmounted on `/mnt/istrac_data`. | Run `chown -R istrac:istrac /mnt/istrac_data` and verify `fs.access` permissions. |
| **Blank Page / 404 on Deep Routes** | Nginx missing SPA fallback `try_files`. | Verify `try_files $uri $uri/ /index.html;` in Nginx config. |
