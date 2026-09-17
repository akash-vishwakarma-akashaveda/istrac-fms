# 🛰️ ISTRAC-SIMS — Engineering Handover Package
## Indian Space Research Organisation — ISTRAC Satellite Information Management System

> **Document Identifier:** ISTRAC-SIMS-HOP-V2.0  
> **System Version:** 1.1.0 Production Baseline  
> **Handover Date:** September 2026  
> **Classification:** Internal Engineering — ISRO/ISTRAC Ground Network  
> **Prepared By:** Engineering Development Team  
> **Target Audience:** Successor Engineers, System Administrators, Ground Station Directors  

---

## 📋 Handover Package Contents

This folder contains the complete engineering handover documentation for ISTRAC-SIMS. Every document was generated from direct inspection of the source code and deployed system configuration.

| # | Document | File | Lines | Audience | Purpose |
|---|---|---|---|---|---|
| 1 | **Frontend Complete Reference** | [`01_FRONTEND_COMPLETE_REFERENCE.md`](./01_FRONTEND_COMPLETE_REFERENCE.md) | ~500+ | Frontend Developers | React 19 architecture, all 29 pages, Axios client, Zustand stores, WebSocket client, TanStack Query, build and deploy instructions |
| 2 | **Backend Complete Reference** | [`02_BACKEND_COMPLETE_REFERENCE.md`](./02_BACKEND_COMPLETE_REFERENCE.md) | ~600+ | Backend Developers | Node.js 24 + Express 5 architecture, all middleware, Prisma 7 + MariaDB models, Redis fallback, all API routes, extending the system |
| 3 | **Deployment & Operations Manual** | [`03_DEPLOYMENT_AND_OPERATIONS_MANUAL.md`](./03_DEPLOYMENT_AND_OPERATIONS_MANUAL.md) | ~500+ | System Administrators | Air-gapped RHEL installation, Apache config, systemd units, day-to-day ops, database backup/restore, storage management |
| 4 | **Troubleshooting Manual** | [`04_TROUBLESHOOTING_COMPLETE_MANUAL.md`](./04_TROUBLESHOOTING_COMPLETE_MANUAL.md) | ~400+ | All Engineers & Admins | 20 real-world issues with root cause, diagnostic steps, and verified resolutions |
| 5 | **Credentials & Security Reference** | [`05_CREDENTIALS_AND_SECURITY_REFERENCE.md`](./05_CREDENTIALS_AND_SECURITY_REFERENCE.md) | ~350+ | System Administrators | All service credentials, JWT architecture, password reset procedures, security hardening |
| 6 | **REST API Endpoint Reference** | [`06_REST_API_ENDPOINT_REFERENCE.md`](./06_REST_API_ENDPOINT_REFERENCE.md) | ~600+ | Frontend Developers, Integration Teams | Every API endpoint with method, auth, request schema, response shape, error codes |

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
│  │              Apache HTTP Server 2.4 (httpd)                     │   │
│  │  Port 80 ─► Serves Static SPA: /opt/istrac-fms/frontend/dist   │   │
│  │         ─► ProxyPass /api → http://127.0.0.1:3000/api           │   │
│  │         ─► ProxyPass /media → http://127.0.0.1:3000/media       │   │
│  │         ─► WebSocket /ws → ws://127.0.0.1:3000/ws               │   │
│  │  Config: /etc/httpd/conf.d/istrac-fms.conf                      │   │
│  └───────────────────────────┬─────────────────────────────────────┘   │
│                              │ Internal Loopback 127.0.0.1             │
│                              ▼                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  istrac-backend.service — Node.js 24 + Express 5 on Port 3000  │   │
│  │  istrac-worker.service  — Background Telemetry & Pass Worker    │   │
│  │  WorkingDir: /opt/istrac-fms/backend                            │   │
│  │  Config: /opt/istrac-fms/backend/.env (chmod 600)               │   │
│  └───────────┬─────────────────────┬──────────────────────────────┘   │
│              │                     │                    │              │
│              ▼                     ▼                    ▼              │
│  ┌─────────────────┐  ┌──────────────────┐  ┌───────────────────────┐ │
│  │ MariaDB :3306   │  │  Redis :6379      │  │ Storage Volume        │ │
│  │ DB: istrac_fms  │  │  (Optional)       │  │ /mnt/istrac_storage   │ │
│  │ User:istrac_user│  │  Fallback: Memory │  │ SHA-256 verified      │ │
│  └─────────────────┘  └──────────────────┘  └───────────────────────┘ │
└────────────────────────────────────────────────────────────────────────┘
```

---

### Production File System Layout
| Path | Owner | Purpose |
|---|---|---|
| `/opt/istrac-fms/` | `istrac:istrac` | Application root directory |
| `/opt/istrac-fms/frontend/dist/` | `istrac:istrac` | Compiled React SPA (served by Apache) |
| `/opt/istrac-fms/backend/` | `istrac:istrac` | Node.js backend application |
| `/opt/istrac-fms/backend/.env` | `istrac:istrac` (600) | Production environment variables |
| `/opt/istrac-fms/backend/dist/` | `istrac:istrac` | Compiled TypeScript output |
| `/opt/istrac-fms/backend/node_modules/` | `istrac:istrac` | Production dependencies |
| `/opt/istrac-fms/manage-services-rhel.sh` | `root` | Service management CLI utility |
| `/etc/httpd/conf.d/istrac-fms.conf` | `root` | Apache virtual host config |
| `/etc/systemd/system/istrac-backend.service` | `root` | Backend API systemd unit |
| `/etc/systemd/system/istrac-worker.service` | `root` | Worker daemon systemd unit |
| `/mnt/istrac_storage/` | `istrac:istrac` (770) | Mission document & telemetry storage |
| `/var/backups/istrac-sims/` | `root` | Automated SQL database backups |

---

### Default Credentials (Change Immediately After First Login)

> [!CAUTION]
> Change the default admin password immediately after first login. Failure to do so is a critical security risk.

| Service | Credential | Value |
|---|---|---|
| **Web Portal — Admin** | Email | `admin@istrac.local` |
| **Web Portal — Admin** | Password | `ChangeMe123!` |
| **MariaDB — App User** | Username / Password | `istrac_user` / `IstracSecurePass123!` |
| **MariaDB — Root** | Username | `root` (socket auth, no password) |
| **Redis** | Auth | None (localhost only binding) |
| **Portal URL (VM)** | Address | `http://localhost/` or `http://10.0.2.15/` |
| **Portal URL (Host/Windows)** | Address | `http://localhost:8080/` (after port forwarding) |

---

### Essential Operational Commands

```bash
# ─── STATUS CHECK ──────────────────────────────────────────────────────
sudo /opt/istrac-fms/manage-services-rhel.sh status

# ─── API HEALTH PROBE ──────────────────────────────────────────────────
curl http://localhost/api/health

# ─── LIVE BACKEND LOGS ─────────────────────────────────────────────────
sudo journalctl -u istrac-backend -f -n 50

# ─── LIVE WORKER LOGS ──────────────────────────────────────────────────
sudo journalctl -u istrac-worker -f -n 50

# ─── LIVE APACHE LOGS ──────────────────────────────────────────────────
sudo tail -f /var/log/httpd/error_log
sudo tail -f /var/log/httpd/access_log

# ─── RESTART BACKEND + APACHE ──────────────────────────────────────────
sudo systemctl restart istrac-backend httpd

# ─── RESTART ALL SERVICES ──────────────────────────────────────────────
sudo /opt/istrac-fms/manage-services-rhel.sh restart

# ─── VIEW PRODUCTION .env ──────────────────────────────────────────────
sudo cat /opt/istrac-fms/backend/.env

# ─── DATABASE BACKUP ───────────────────────────────────────────────────
sudo mysqldump -u istrac_user -p"IstracSecurePass123!" istrac_fms > \
  /var/backups/istrac-sims/backup_$(date +%Y%m%d_%H%M%S).sql

# ─── UPDATE APPLICATION (WITHOUT TOUCHING DB OR .env) ──────────────────
sudo cp -rf /media/sf_Rhel_Shared_Folder/istrac-fms-offline-bundle-20260915/frontend/dist/* \
  /opt/istrac-fms/frontend/dist/
sudo cp -rf /media/sf_Rhel_Shared_Folder/istrac-fms-offline-bundle-20260915/backend/dist/* \
  /opt/istrac-fms/backend/dist/
sudo chmod -R 755 /opt/istrac-fms/frontend/dist
sudo systemctl restart istrac-backend httpd
```

---

### Key Engineering Decisions (Rationale Summary)

| Decision | Why |
|---|---|
| **Apache httpd over Nginx** | RHEL 9/10 ships Apache as the default HTTP server with better SELinux integration out of the box. Apache's `mod_proxy_wstunnel` handles WebSocket proxying reliably without compilation. |
| **Node.js 24 via tar extraction** | Air-gapped RHEL cannot use NodeSource RPM repositories (requires internet). Pre-downloading the official Node.js 24 Linux binary tarball and symlinking to `/usr/bin/node` is the most reliable offline approach. |
| **Prisma 7 `prisma.config.ts`** | Prisma 7 moved `DATABASE_URL` from `schema.prisma` (datasource block) to a separate `prisma.config.ts` file. This is the correct Prisma 7 configuration pattern. |
| **Relative `/api` baseURL (no `VITE_API_URL` required)** | For intranet deployment where the frontend and backend are served from the same Apache origin, a relative `/api` path means the app works on any IP address, hostname, or port without rebuilding. |
| **Single ADMIN architecture** | ISTRAC operational security policy requires one named system administrator (`admin@istrac.local`) with full accountability for all access grants and system configuration changes. |
| **Idempotent installer** | Running the setup script a second time (for updates) preserves existing database records, JWT secrets, and uploaded files. The seed script checks `user.count() > 0` before any destructive operation. |
| **In-Memory Redis fallback** | Redis is not always available on constrained government RHEL servers. All Redis-dependent features (caching, pub/sub, scheduler intervals) have graceful degradation to in-process memory. |
| **SHA-256 file integrity** | Mission telemetry data integrity is critical. Every uploaded file is checksummed during upload and the hash stored in the database for audit verification. |

---

### Technology Versions at Deployment

| Component | Version | Notes |
|---|---|---|
| **Node.js** | v24.21.0 | Extracted from official tarball, symlinked to `/usr/bin/node` |
| **Apache httpd** | 2.4.63 | RHEL system package |
| **MariaDB** | 10.x (MariaDB Server) | Active, port 3306 |
| **React** | 19.2.7 | Production build in `/opt/istrac-fms/frontend/dist` |
| **Vite** | 8.1.5 | Build tool only (not on server) |
| **Express** | 5.2.1 | Backend framework |
| **Prisma** | 7.x | ORM with MariaDB adapter |
| **TypeScript** | 5.x | Backend compiled to `/opt/istrac-fms/backend/dist` |
| **Tailwind CSS** | 4.x | Utility-first CSS, compiled into production bundle |
| **RHEL** | 9 / 10 (el10_2) | Target operating system |

---

### Document Revision Log

| Version | Date | Author | Changes |
|---|---|---|---|
| 1.0.0 | September 2026 | Engineering Team | Initial deployment documentation |
| 2.0.0 | September 2026 | Engineering Team | Complete handover package with all 6 detailed reference documents. Fixed CORS intranet policy, VITE_API_URL build guard, idempotent installer, ProxyPass trailing slash. |
