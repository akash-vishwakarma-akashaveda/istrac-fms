# 🛰️ ISTRAC-SIMS — Engineering Handover Package
## Indian Space Research Organisation — ISTRAC Satellite Information Management System

> **Document Identifier:** ISTRAC-SIMS-HOP-V3.0  
> **System Version:** 2.0.0 Production Baseline  
> **Handover Date:** September 2026  
> **Classification:** Internal Engineering — ISRO/ISTRAC Ground Network  
> **Target Platforms:** Ubuntu Linux (22.04 / 24.04 LTS) & Microsoft Windows (10 / 11 / Windows Server 2019 / 2022)  
> **Target Audience:** Successor Engineers, Ground Station Administrators, System Developers  

---

## 📋 Handover Package Contents

This folder contains the complete engineering handover documentation for ISTRAC-SIMS. Every document was generated from direct inspection of the source code and configuration for **Ubuntu Linux** and **Windows**.

| # | Document | File | Lines | Audience | Purpose |
|---|---|---|---|---|---|
| 1 | **Frontend Complete Reference** | [`01_FRONTEND_COMPLETE_REFERENCE.md`](./01_FRONTEND_COMPLETE_REFERENCE.md) | ~500+ | Frontend Developers | React 19 architecture, all 29 pages, Axios client, Zustand stores, WebSocket client, TanStack Query, build and deploy instructions for Ubuntu & Windows |
| 2 | **Backend Complete Reference** | [`02_BACKEND_COMPLETE_REFERENCE.md`](./02_BACKEND_COMPLETE_REFERENCE.md) | ~600+ | Backend Developers | Node.js 24 + Express 5 architecture, all 7 middleware, Prisma 7 + MariaDB models, Redis fallback, all API routes, extending the system |
| 3 | **Deployment & Operations Manual** | [`03_DEPLOYMENT_AND_OPERATIONS_MANUAL.md`](./03_DEPLOYMENT_AND_OPERATIONS_MANUAL.md) | ~550+ | System Administrators | Dual-platform operations: Part I for Ubuntu Linux (APT, Apache2, Systemd, UFW) & Part II for Windows (PowerShell, Apache Lounge/Nginx, PM2/NSSM, Windows Firewall) |
| 4 | **Troubleshooting Manual** | [`04_TROUBLESHOOTING_COMPLETE_MANUAL.md`](./04_TROUBLESHOOTING_COMPLETE_MANUAL.md) | ~450+ | All Engineers & Admins | 20 real-world issues across Ubuntu & Windows with root cause, diagnostic commands, and verified resolutions |
| 5 | **Credentials & Security Reference** | [`05_CREDENTIALS_AND_SECURITY_REFERENCE.md`](./05_CREDENTIALS_AND_SECURITY_REFERENCE.md) | ~350+ | System Administrators | All service credentials, JWT architecture, password reset procedures, security hardening on Ubuntu & Windows |
| 6 | **REST API Endpoint Reference** | [`06_REST_API_ENDPOINT_REFERENCE.md`](./06_REST_API_ENDPOINT_REFERENCE.md) | ~600+ | Integration Teams | Every API endpoint with method, auth, request schema, response shape, error codes |

---

## ⚡ Critical Quick Reference

### System Architecture
```
┌────────────────────────────────────────────────────────────────────────┐
│                      ISRO INTRANET GROUND NETWORK                      │
│                                                                        │
│  Mission Control Consoles ──────────────────► Ground Station Workstations
│      (10.20.1.x)              Port 80/443         (192.168.x.x)        │
│                                    │                                   │
│                                    ▼                                   │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │              Web Server / Reverse Proxy                         │   │
│  │  Ubuntu: Apache2 (/etc/apache2/sites-available/istrac-fms.conf) │   │
│  │  Windows: Apache Lounge (httpd.exe) or Nginx                    │   │
│  │                                                                 │   │
│  │  Port 80 ─► Serves Static SPA: frontend/dist                    │   │
│  │         ─► ProxyPass /api → http://127.0.0.1:3000/api           │   │
│  │         ─► ProxyPass /media → http://127.0.0.1:3000/media       │   │
│  │         ─► WebSocket /ws → ws://127.0.0.1:3000/ws               │   │
│  └───────────────────────────┬─────────────────────────────────────┘   │
│                              │ Internal Loopback 127.0.0.1             │
│                              ▼                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  Backend API Server — Node.js 24 + Express 5 on Port 3000      │   │
│  │  Background Worker  — Telemetry Pass Automator Daemon           │   │
│  │  Ubuntu: Systemd units (/etc/systemd/system/istrac-*.service)   │   │
│  │  Windows: PM2 / NSSM Native Windows Services                   │   │
│  └───────────┬─────────────────────┬──────────────────────────────┘   │
│              │                     │                    │              │
│              ▼                     ▼                    ▼              │
│  ┌─────────────────┐  ┌──────────────────┐  ┌───────────────────────┐ │
│  │ MariaDB / MySQL │  │  Redis / Valkey   │  │ Storage Volume        │ │
│  │ Port 3306       │  │  Port 6379        │  │ Ubuntu: /mnt/...      │ │
│  │ DB: istrac_fms  │  │  Fallback: Memory │  │ Windows: D:\storage   │ │
│  │ User:istrac_user│  │  (Zero crashes)   │  │ SHA-256 verified      │ │
│  └─────────────────┘  └──────────────────┘  └───────────────────────┘ │
└────────────────────────────────────────────────────────────────────────┘
```

---

### Platform Comparison Matrix

| Operational Aspect | Ubuntu Linux (22.04 / 24.04 LTS) | Microsoft Windows (10/11 / Server 2022) |
|:---|:---|:---|
| **Package Manager** | `apt` / `apt-get` | Manual MSI Installers / winget |
| **Node.js 24 Runtime**| Linux binary tarball -> `/usr/bin/node` | Official Windows `.msi` / `node.exe` |
| **Web Server** | `apache2` (with `proxy_wstunnel`, `rewrite`) | Apache 2.4 for Windows (`httpd.exe`) / Nginx |
| **Service Manager** | Native `systemd` (`systemctl`) | PM2 (`pm2-windows-service`) or NSSM |
| **Database** | `mariadb-server` via APT | MariaDB 10.x Windows Service |
| **Firewall** | `ufw allow 80/tcp` | `New-NetFirewallRule -LocalPort 80` |
| **Storage Directory** | `/mnt/istrac_storage` (chmod 770) | `D:\istrac_storage` (NTFS ACLs) |
| **Management CLI** | `sudo ./manage-services-ubuntu.sh` | `.\manage-services-windows.ps1` |

---

### Default Credentials (Change Immediately After First Login)

> [!CAUTION]
> Change the default admin password immediately after first login.

| Service | Credential | Default Value |
|:---|:---|:---|
| **Web Portal — Super Admin** | Email | `admin@istrac.local` |
| **Web Portal — Super Admin** | Password | `ChangeMe123!` |
| **MariaDB — App User** | Username / Password | `istrac_user` / `IstracSecurePass123!` |
| **MariaDB — Root** | Username | `root` (socket auth on Ubuntu, password on Windows) |
| **Redis** | Auth | None (local loopback binding only) |
| **Portal URL (Local)** | Address | `http://localhost/` |
| **Portal URL (Intranet)** | Address | `http://<server-ip>/` (e.g. `http://10.20.1.50/`) |

---

### Essential Operational Commands

#### On Ubuntu Linux:
```bash
# Check status of all services
sudo /opt/istrac-fms/manage-services-ubuntu.sh status

# Stream live backend logs
sudo journalctl -u istrac-backend -f -n 50

# Restart backend and Apache
sudo systemctl restart istrac-backend apache2

# Create database backup
sudo /opt/istrac-fms/manage-services-ubuntu.sh backup

# Test API health
curl http://localhost/api/health
```

#### On Microsoft Windows (PowerShell as Administrator):
```powershell
# Check status of services
.\manage-services-windows.ps1 -Action status

# View live backend logs (if running via PM2)
pm2 logs istrac-backend --lines 50

# Restart services
.\manage-services-windows.ps1 -Action restart

# Create database backup
.\manage-services-windows.ps1 -Action backup

# Test API health
Invoke-RestMethod -Uri "http://localhost:3000/api/health"
```

---

### Key Engineering Decisions (Rationale Summary)

| Decision | Why |
|---|---|
| **Cross-Platform Ubuntu & Windows Support** | Ground stations utilize Ubuntu for centralized rack servers and Windows for engineering consoles. The entire codebase is 100% cross-platform compatible. |
| **Apache with `mod_proxy_wstunnel`** | Provides robust HTTP reverse proxying and native bi-directional WebSocket tunneling without custom compilation on both Ubuntu (`apache2`) and Windows (`Apache24`). |
| **Prisma 7 `prisma.config.ts`** | Prisma 7 decoupled `DATABASE_URL` from `schema.prisma` into `prisma.config.ts`, ensuring zero hardcoded secrets in the schema. |
| **Relative `/api` BaseURL (No `VITE_API_URL` required)** | The frontend and backend are served from the same web origin, allowing the app to run on any intranet IP, hostname, or port without rebuilding. |
| **Single ADMIN Architecture** | Enforces ISRO operational security: exactly one named Super Administrator (`admin@istrac.local`) holds system privileges. Operators register as `MEMBER` and are cleared via `/admin/approvals`. |
| **Idempotent Installation** | Setup scripts preserve existing database records, user passwords, and `.env` secrets when run repeatedly for updates. |
| **In-Memory Redis Fallback** | When Redis is stopped or offline, the backend seamlessly falls back to in-memory caching and scheduling with zero service interruption. |
| **SHA-256 Telemetry Verification** | Every uploaded file chunk is hashed incrementally to guarantee binary data integrity for mission telemetry archives. |

---

### Technology Versions

| Component | Version | Notes |
|:---|:---|:---|
| **Node.js** | v24.21.0 | LTS runtime on Ubuntu & Windows |
| **Web Server** | Apache 2.4 | `apache2` (Ubuntu) / `Apache24` (Windows) |
| **Database** | MariaDB 10.x / MySQL 8.x | Port 3306 (Loopback only) |
| **React** | 19.2.7 | Production build in `frontend/dist` |
| **Vite** | 8.1.5 | Client bundler (offline pre-compiled) |
| **Express** | 5.2.1 | Backend API framework |
| **Prisma** | 7.x | Object-Relational Mapping |
| **TypeScript**| 5.x | Strict ESM transpiled to `backend/dist` |
| **Tailwind**  | 4.x | Ground control orbital dark theme |
