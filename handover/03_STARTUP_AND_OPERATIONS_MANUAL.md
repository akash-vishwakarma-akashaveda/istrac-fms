# 🛰️ ISTRAC-SIMS — Startup & Operations Manual

## 1. System Architecture Overview

The system operates as an air-gapped on-premise service running on **Red Hat Enterprise Linux (RHEL 9 / 10)**.

```
Intranet User Browser
  │
  │ (Port 80 / 443)
  ▼
┌─────────────────────────────────────────────────────────┐
│ Apache HTTP Server (httpd 2.4)                          │
│                                                         │
│  ├── /           ──> Static SPA (/opt/istrac-fms/frontend/dist)
│  ├── /api/*      ──> Reverse Proxy to http://127.0.0.1:3000/api/*
│  ├── /media/*    ──> Reverse Proxy to http://127.0.0.1:3000/media/*
│  └── /ws         ──> WebSocket Proxy to ws://127.0.0.1:3000/ws
└──────────────────────────┬──────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────┐
│ Node.js 24 Application Daemons                          │
│                                                         │
│  ├── istrac-backend.service (API Server on Port 3000)   │
│  └── istrac-worker.service  (Telemetry Background Job) │
└──────────────────────────┬──────────────────────────────┘
                           │
           ┌───────────────┴───────────────┐
           ▼                               ▼
┌──────────────────────┐       ┌──────────────────────────┐
│ MariaDB (Port 3306)  │       │ Storage Volume           │
│ DB: istrac_fms       │       │ Path: /mnt/istrac_storage│
│ User: istrac_user    │       │ Quota: 500GB+            │
└──────────────────────┘       └──────────────────────────┘
```

---

## 2. Service Management CLI Utility

A management CLI is installed at `/opt/istrac-fms/manage-services-rhel.sh`.

```bash
# Display live status of all services, ports, and storage
sudo /opt/istrac-fms/manage-services-rhel.sh status

# Start all system services
sudo /opt/istrac-fms/manage-services-rhel.sh start

# Stop all application services
sudo /opt/istrac-fms/manage-services-rhel.sh stop

# Restart all services (after updates or config changes)
sudo /opt/istrac-fms/manage-services-rhel.sh restart

# Stream live backend logs in real-time
sudo /opt/istrac-fms/manage-services-rhel.sh logs

# Create an automated SQL database backup
sudo /opt/istrac-fms/manage-services-rhel.sh backup
```

---

## 3. Native Linux Systemd Service Control

The application is registered as native `systemd` unit services under `/etc/systemd/system/`:

| Service Name | Description | Ports / Endpoint |
|---|---|---|
| `httpd.service` | Apache 2.4 Web Server & Reverse Proxy | `80`, `443` |
| `istrac-backend.service` | Express API Server Daemon | `127.0.0.1:3000` |
| `istrac-worker.service` | Background Telemetry & Pass Worker | Standalone Process |
| `mariadb.service` | MariaDB Relational Database Server | `127.0.0.1:3306` |
| `redis.service` | Redis In-Memory Cache (Optional) | `127.0.0.1:6379` |

### Common Systemd Commands:
```bash
# Restart the backend API
sudo systemctl restart istrac-backend

# Restart Apache
sudo systemctl restart httpd

# View live backend logs
sudo journalctl -u istrac-backend -f

# View live worker logs
sudo journalctl -u istrac-worker -f

# Check if services start automatically on boot
systemctl is-enabled httpd istrac-backend istrac-worker mariadb
```

---

## 4. Apache Reverse Proxy Configuration

The Apache virtual host is located at:
```
/etc/httpd/conf.d/istrac-fms.conf
```

### Key Directives:
```apache
<VirtualHost *:80>
    ServerName localhost
    DocumentRoot /opt/istrac-fms/frontend/dist

    ProxyPreserveHost On
    ProxyRequests Off
    ProxyTimeout 120

    # WebSocket Proxying
    RewriteEngine On
    RewriteCond %{HTTP:Upgrade} =websocket [NC]
    RewriteCond %{HTTP:Connection} upgrade [NC]
    RewriteRule ^/ws/(.*) ws://127.0.0.1:3000/ws/$1 [P,L]
    RewriteRule ^/ws/?$   ws://127.0.0.1:3000/ws [P,L]

    # REST API Reverse Proxy
    ProxyPass        /api http://127.0.0.1:3000/api retry=0 timeout=120
    ProxyPassReverse /api http://127.0.0.1:3000/api

    # CMS Uploaded Media Reverse Proxy
    ProxyPass        /media http://127.0.0.1:3000/media retry=0 timeout=60
    ProxyPassReverse /media http://127.0.0.1:3000/media

    # SPA Client-Side Routing Fallback (HTML5 PushState)
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
</VirtualHost>
```

---

## 5. Storage Mount Configuration (`/mnt/istrac_storage`)

Files and mission telemetry logs are stored on a dedicated disk volume.

### Setup and Permissions:
```bash
# 1. Create mount directory
sudo mkdir -p /mnt/istrac_storage

# 2. Assign ownership to the application service user
sudo chown -R istrac:istrac /mnt/istrac_storage
sudo chmod -R 770 /mnt/istrac_storage

# 3. Permanent mount entry in /etc/fstab (example for /dev/sdb1):
# UUID=xxxx-xxxx /mnt/istrac_storage ext4 defaults,noatime 0 2
```

---

## 6. Database Backups & Restoration Procedures

### 6.1. Creating a Manual Backup
```bash
sudo mysqldump -u istrac_user -p"IstracSecurePass123!" istrac_fms > /var/backups/istrac_fms_manual_$(date +%Y%m%d_%H%M%S).sql
```

### 6.2. Restoring a Database from Backup
```bash
# 1. Stop backend services
sudo systemctl stop istrac-backend istrac-worker

# 2. Restore SQL dump into MariaDB
mysql -u istrac_user -p"IstracSecurePass123!" istrac_fms < /var/backups/istrac_fms_backup.sql

# 3. Restart backend services
sudo systemctl start istrac-backend istrac-worker
```

---

## 7. First Login & Initial System Configuration

1. Open your browser and navigate to:
   ```
   http://<server-ip-or-hostname>/
   ```
2. **Default Administrator Credentials:**
   - **Email / Username:** `admin@istrac.local`
   - **Password:** `ChangeMe123!`
3. **Security Immediate Action:**
   - Log into the portal.
   - Navigate to **Admin Console** -> **User Management**.
   - Change the default administrator password immediately.
   - Provision ground station members and assign them to respective operational divisions.
