# ISTRAC-FMS Offline Air-Gapped Installation & Deployment Guide for RHEL 8 / 9

## 1. Executive Summary

This document specifies the end-to-end procedure for packaging, transferring, and installing the **ISTRAC File Management & Telemetry System (ISTRAC-FMS)** on **Red Hat Enterprise Linux (RHEL 8 / RHEL 9)** in an **isolated, air-gapped environment without internet access**.

---

## 2. Air-Gapped Deployment Architecture

```mermaid
flowchart LR
    subgraph S1 [Connected Staging Machine (Internet)]
        A[Git Repository] --> B[npm run build: Frontend & Backend]
        B --> C[dnf download: RHEL RPM Dependencies]
        C --> D[Generate Prisma Linux Binary Engines]
        D --> E[bundle-offline.sh -> istrac-fms-offline-bundle.tar.gz]
    end

    subgraph S2 [Physical Secure Transfer]
        E -. Encrypted Physical Media (USB / HDD) .-> F
    end

    subgraph S3 [Air-Gapped Target Server (RHEL 8/9)]
        F[Extract to /opt/istrac-fms]
        F --> G[dnf localinstall: Offline RPMs]
        G --> H[MariaDB & Redis Initialized]
        H --> I[Prisma DB Migration & Seed]
        I --> J[systemd Services: Backend & Worker]
        J --> K[Nginx Reverse Proxy on Port 80]
    end
```

---

## 3. Hardware & Operating System Requirements

| Specification | Minimum Requirement | Recommended Production |
|---|---|---|
| **Operating System** | RHEL 8.6+ or RHEL 9.0+ (x86_64) | RHEL 9.x (x86_64) |
| **CPU Architecture** | 4 Cores | 8+ Cores |
| **RAM** | 8 GB | 16 GB - 32 GB |
| **OS Disk Space** | 40 GB | 100 GB SSD |
| **Telemetry Data Storage** | 200 GB (`/var/data/istrac_storage`) | RAID-10 / SAN Mount (`/mnt/istrac_storage`) |

---

## 4. Phase 1: Preparation on Internet-Connected Staging Machine

Run this phase on an internet-connected computer (Linux RHEL/Rocky/Ubuntu or WSL2) with Node.js 20+ installed.

### 4.1 Clone Repository & Validate Environment
```bash
git clone https://github.com/Dev-ayansharma/istrac-fms.git
cd istrac-fms
git checkout protov1
```

### 4.2 Run the Automated Offline Bundler
Execute the provided packaging script in the repository:
```bash
chmod +x deploy/bundle-offline.sh
./deploy/bundle-offline.sh
```

What this script executes automatically:
1. **Frontend**: Runs `npm ci` and `npm run build` to generate the production React SPA bundle in `frontend/dist`.
2. **Backend**:
   - Generates Prisma engine binaries for Linux RHEL targets: `rhel-openssl-1.1.x` and `rhel-openssl-3.0.x`.
   - Transpiles TypeScript into JavaScript in `backend/dist`.
   - Compiles database seed logic into `backend/dist/prisma/seed.js`.
   - Prunes dev-dependencies to leave a minimal, production-ready `node_modules`.
3. **RPM Packages**: Downloads all offline RHEL dependencies (Node.js 20, MariaDB-server, Redis, Nginx, rsync, tar) into `rpms/`.
4. **Archive Packaging**: Packages the complete system into `dist-offline/istrac-fms-offline-bundle-YYYYMMDD.tar.gz`.

---

## 5. Phase 2: Transfer to Air-Gapped RHEL Server

1. Calculate the SHA-256 hash on the staging machine:
   ```bash
   sha256sum dist-offline/istrac-fms-offline-bundle-*.tar.gz
   ```
2. Copy the `.tar.gz` file to an authorized USB drive or secure physical transfer media.
3. On the air-gapped target server, copy the archive to `/tmp/` and verify the SHA-256 checksum matches before extracting.

---

## 6. Phase 3: Installation on Air-Gapped RHEL Target Server

### 6.1 Extract the Offline Bundle
```bash
sudo mkdir -p /opt/istrac-fms-staging
cd /opt/istrac-fms-staging
sudo tar -xzvf /tmp/istrac-fms-offline-bundle-*.tar.gz --strip-components=1
```

### 6.2 Execute the One-Step Automated Installer
```bash
sudo chmod +x install.sh deploy/*.sh
sudo ./install.sh
```

The script automatically executes:
- Installs RPMs offline (`dnf localinstall -y rpms/*.rpm`).
- Creates system user `istrac` and configures storage permissions (`/var/data/istrac_storage`).
- Starts and enables `mariadb` and `redis` services.
- Creates the MySQL database `istrac_fms` and database user `istrac_user`.
- Applies Prisma database schema and migrations (`npx prisma migrate deploy`).
- Seeds default satellites, mission events, operational divisions, and admin accounts.
- Registers and starts `istrac-backend.service` and `istrac-worker.service`.
- Configures SELinux booleans and Nginx reverse proxy.
- Opens HTTP port 80 in `firewalld`.

---

## 7. Service Configuration & Architecture Reference

### 7.1 Systemd Services

| Service Name | Description | Command |
|---|---|---|
| `istrac-backend.service` | REST API Server & WebSocket Hub | `sudo systemctl status istrac-backend` |
| `istrac-worker.service` | Mission Event Status Sync & Scheduler | `sudo systemctl status istrac-worker` |
| `mariadb.service` | MySQL-compatible Relational Database | `sudo systemctl status mariadb` |
| `redis.service` | Session Store & Distributed Lock | `sudo systemctl status redis` |
| `nginx.service` | Web Server & Reverse Proxy | `sudo systemctl status nginx` |

### 7.2 Directory Structure on Target Host
```
/opt/istrac-fms/
├── backend/
│   ├── dist/                 # Pre-compiled Express API server
│   ├── node_modules/         # Production runtime dependencies
│   ├── prisma/               # Schema and migration history
│   ├── package.json
│   └── .env                  # Environment variables & secrets
├── frontend/
│   └── dist/                 # Pre-built Vite React SPA
└── deploy/                   # System configurations and scripts

/var/data/istrac_storage/     # Physical file repository root
```

---

## 8. Post-Installation Verification

Run the built-in diagnostic health checker:
```bash
sudo /opt/istrac-fms/deploy/verify.sh
```

Expected Output:
```text
======================================================================
🛰️  ISTRAC-FMS SERVICE HEALTH CHECK
======================================================================
1. Systemd Daemons:
  [OK] mariadb is RUNNING
  [OK] redis is RUNNING
  [OK] istrac-backend is RUNNING
  [OK] istrac-worker is RUNNING
  [OK] nginx is RUNNING

2. Port Listeners:
  [OK] Port 80 is active
  [OK] Port 5000 is active
  [OK] Port 3306 is active
  [OK] Port 6379 is active

3. Backend API Connectivity Check:
  [OK] Backend HTTP probe responded (200 OK)

4. Physical Storage Mount:
  [OK] Storage mount /var/data/istrac_storage is accessible
======================================================================
```

Access the system in a browser:
```text
http://<SERVER_IP_OR_HOSTNAME>
```

---

## 9. Troubleshooting & Operations

### Viewing Live Logs
```bash
# Backend REST & WebSocket API logs
sudo journalctl -u istrac-backend -f

# Mission Event Scheduler logs
sudo journalctl -u istrac-worker -f

# Nginx Access and Error logs
sudo tail -f /var/log/nginx/error.log
```

### Restarting the Entire System
```bash
sudo systemctl restart mariadb redis istrac-backend istrac-worker nginx
```
