# ISTRAC-FMS Backend Initial Configuration & Setup Guide

> **Target System:** ISTRAC-FMS Node.js/Express Backend  
> **Environment Support:** Windows Server / Linux (RHEL, Ubuntu, Rocky Linux) / Docker  
> **Target Version:** 1.0.0

---

## 📑 Table of Contents

1. [Hardware & Software Prerequisites](#1-hardware--software-prerequisites)
2. [Step-by-Step Local Setup](#2-step-by-step-local-setup)
3. [Environment Configuration Reference (`.env`)](#3-environment-configuration-reference-env)
4. [Database Provisioning & Migration](#4-database-provisioning--migration)
5. [Storage Volume (HDD Mount) Setup](#5-storage-volume-hdd-mount-setup)
6. [Starting the Application (Dev vs Prod)](#6-starting-the-application-dev-vs-prod)
7. [Docker & Containerized Deployment](#7-docker--containerized-deployment)
8. [PM2 Production Process Manager Configuration](#8-pm2-production-process-manager-configuration)
9. [System Health & Verification Checks](#9-system-health--verification-checks)
10. [Troubleshooting & Frequently Encountered Issues](#10-troubleshooting--frequently-encountered-issues)

---

## 1. Hardware & Software Prerequisites

| Component | Minimum Specification | Recommended Specification |
|---|---|---|
| **Node.js** | `>= 20.10.0 LTS` | `20.18.0 LTS` or `22.x LTS` |
| **npm** | `>= 10.0.0` | `10.8.0+` |
| **MySQL** | `8.0.30+` | `8.0.36+` (InnoDB engine enabled) |
| **Redis** | `6.2.0+` | `7.2.0+` (Standalone or Sentinel) |
| **RAM** | `4 GB` | `8 GB+` |
| **Storage (OS/App)** | `20 GB SSD` | `50 GB SSD` |
| **Storage (Data Mount)** | `500 GB HDD` | `2 TB+ Enterprise RAID-1 / RAID-6` |

---

## 2. Step-by-Step Local Setup

### Step 1: Clone or Navigate to the Repository
```bash
cd D:\istrac-fms\backend
# or on Linux:
cd /opt/istrac-fms/backend
```

### Step 2: Install Dependencies
```bash
npm install
```
*This installs runtime dependencies (`express`, `prisma`, `@prisma/client`, `@prisma/adapter-mariadb`, `ioredis`, `bcrypt`, `jsonwebtoken`, `multer`, `nodemailer`, `ws`, `uuid`, `cookie-parser`) and type definitions.*

### Step 3: Configure Environment Variables
Copy `.env.example` located at the root of the project to `backend/.env` (or project root `.env`):
```bash
cp ../.env.example .env
```
Open `.env` in your editor and configure the connection parameters (see Section 3 for detail).

---

## 3. Environment Configuration Reference (`.env`)

Every variable listed below is consumed by [`src/config/env.ts`](file:///D:/istrac-fms/backend/src/config/env.ts). The application executes fail-fast validation on startup and will reject execution if required keys are absent.

```dotenv
# ============================================================
# APPLICATION & RUNTIME
# ============================================================
NODE_ENV=development
PORT=3000
APP_URL=http://localhost:5173
ALLOWED_ORIGINS=http://localhost:5173,http://127.0.0.1:5173

# ============================================================
# DATABASE (MySQL 8.0)
# ============================================================
MYSQL_HOST=localhost
MYSQL_PORT=3306
MYSQL_DATABASE=istrac_fms
MYSQL_USER=istrac_user
MYSQL_PASSWORD=SecurePassword123!
MYSQL_ROOT_PASSWORD=RootPassword123!
DATABASE_URL=mysql://istrac_user:SecurePassword123!@localhost:3306/istrac_fms

# ============================================================
# REDIS (Cache, Blacklist & Pub/Sub)
# ============================================================
REDIS_URL=redis://localhost:6379

# ============================================================
# SECURITY & SECRETS
# ============================================================
JWT_SECRET=generate-a-strong-random-secret-key-at-least-64-chars-long
JWT_REFRESH_SECRET=generate-a-different-strong-random-refresh-secret-64-chars

# ============================================================
# PHYSICAL STORAGE MOUNT
# ============================================================
# Windows local path example: D:/istrac-storage
# Linux production mount: /mnt/istrac-data
HDD_MOUNT_PATH=D:/istrac-storage

# ============================================================
# INTRANET EMAIL (Campus SMTP)
# ============================================================
SMTP_HOST=localhost
SMTP_PORT=25
SMTP_USER=
SMTP_PASS=
ADMIN_EMAIL=admin@istrac.local
```

### Environment Variable Details:

| Variable | Required? | Default / Example | Purpose |
|---|---|---|---|
| `PORT` | No | `3000` | HTTP port the Express server binds to. |
| `NODE_ENV` | Yes | `development` | Environment mode (`development`, `production`, `test`). |
| `ALLOWED_ORIGINS` | Yes | `http://localhost:5173` | Comma-separated list of CORS origins allowed with credentials. |
| `DATABASE_URL` | Yes | `mysql://...` | Prisma connection string. |
| `REDIS_URL` | Yes | `redis://localhost:6379` | Connection URI for ioredis pool. |
| `JWT_SECRET` | Yes | 64+ char secret | Signs 15-minute access tokens. |
| `JWT_REFRESH_SECRET` | Yes | 64+ char secret | Signs 7-day refresh tokens. |
| `HDD_MOUNT_PATH` | Yes | `/mnt/istrac-data` | Absolute path to the physical storage disk mount. |
| `ADMIN_EMAIL` | No | `admin@istrac.local` | Destination for hardware degradation alerts. |

---

## 4. Database Provisioning & Migration

### Step 1: Ensure MySQL Database Exists
Connect to MySQL and create the database if not already created:
```sql
CREATE DATABASE IF NOT EXISTS istrac_fms CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS 'istrac_user'@'%' IDENTIFIED BY 'SecurePassword123!';
GRANT ALL PRIVILEGES ON istrac_fms.* TO 'istrac_user'@'%';
FLUSH PRIVILEGES;
```

### Step 2: Apply Migrations
Apply the baseline schema migration:
```bash
npm run db:deploy
```
*This executes `prisma migrate deploy`, applying [`20260825031935_init_backend_v1`](file:///D:/istrac-fms/backend/prisma/migrations/20260825031935_init_backend_v1/migration.sql) to create all 19 tables, enums, foreign keys, and indexes.*

### Step 3: Seed Initial Data
Seed the top-level station, super administrator, departments, and sample metadata:
```bash
npm run db:seed
```

#### Default Seed Credentials:
- **Satellite Station:** `ISTRAC Bengaluru` (Code: `ISTRAC-BLR`)
- **Super Administrator Email:** `admin@istrac.local`
- **Default Password:** `ChangeMe123!`
- **Role:** `ADMIN`
- **Status:** `ACTIVE`
- **Default Departments:** `Engineering`, `Operations`

---

## 5. Storage Volume (HDD Mount) Setup

The backend stores uploaded files directly on disk at `HDD_MOUNT_PATH`.

### On Linux / Production Server:
1. Create directory mount:
   ```bash
   sudo mkdir -p /mnt/istrac-data
   ```
2. Assign ownership to the application user (e.g., `nodejs`):
   ```bash
   sudo chown -R nodejs:nodejs /mnt/istrac-data
   sudo chmod -R 750 /mnt/istrac-data
   ```

### On Windows / Development Machine:
1. Ensure the directory specified in `HDD_MOUNT_PATH` (e.g. `D:/istrac-storage` or `C:/istrac-storage`) exists.
2. If it does not exist, [`hddAvailabilityMiddleware`](file:///D:/istrac-fms/backend/src/middleware/hddAvailability.middleware.ts) will automatically create it on startup if permissions allow.

---

## 6. Starting the Application (Dev vs Prod)

### Development Mode (with Hot Reloading)
```bash
npm run dev
```
*Uses `tsx watch` to monitor file modifications in `src/` and restart automatically.*

### Production Build & Start
```bash
# 1. Clean dist and compile TypeScript to JavaScript
npm run build

# 2. Run compiled production bundle
npm start
```

---

## 7. Docker & Containerized Deployment

A multi-container setup is pre-configured in `docker-compose.yml` at the project root.

### Booting the Complete Stack:
```bash
docker compose up -d --build
```

### Services Started:
1. **`mysql`**: MySQL 8.0 server on port `3306` with persistent volume `mysql_data`.
2. **`redis`**: Redis 7.0 server on port `6379` with persistent volume `redis_data`.
3. **`backend`**: Node.js backend on port `3000` mounted to `/mnt/istrac-data`.
4. **`frontend`**: Vite frontend on port `5173`.

### Viewing Logs:
```bash
docker compose logs -f backend
```

---

## 8. PM2 Production Process Manager Configuration

For bare-metal or virtual machine deployments (without Docker), PM2 is recommended to manage restarts, clustering, and log rotation.

Create `ecosystem.config.cjs` in the `backend/` directory:

```javascript
module.exports = {
  apps: [
    {
      name: 'istrac-fms-backend',
      script: './dist/index.js',
      instances: 'max',
      exec_mode: 'cluster',
      env_production: {
        NODE_ENV: 'production',
      },
      max_memory_restart: '1G',
      error_file: './logs/err.log',
      out_file: './logs/out.log',
      merge_logs: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    },
  ],
}
```

### PM2 Commands:
```bash
# Start cluster
pm2 start ecosystem.config.cjs --env production

# Save process list on system reboot
pm2 save
pm2 startup
```

---

## 9. System Health & Verification Checks

### 1. HTTP Liveness & Dependency Probe
```bash
curl -i http://localhost:3000/health
```
**Expected Response (`200 OK`):**
```json
{
  "status": "ok",
  "db": "ok",
  "redis": "ok",
  "hdd": "ok",
  "timestamp": "2026-08-25T12:30:00.000Z"
}
```

### 2. Admin Storage Diagnostics Probe
```bash
curl -i http://localhost:3000/admin/health/hdd \
  -H "Authorization: Bearer <ADMIN_JWT_ACCESS_TOKEN>"
```
**Expected Response (`200 OK`):**
```json
{
  "data": {
    "mounted": true,
    "mountPath": "/mnt/istrac-data",
    "isDegraded": false,
    "lastChecked": "2026-08-25T12:30:00.000Z"
  }
}
```

### 3. WebSocket Connection Test
Connect via WebSocket client (e.g., Postman or browser console):
```javascript
const ws = new WebSocket('ws://localhost:3000/ws?token=<ACCESS_TOKEN>');
ws.onopen = () => console.log('WebSocket Connected');
ws.onmessage = (e) => console.log('Received:', JSON.parse(e.data));
```

---

## 10. Troubleshooting & Frequently Encountered Issues

### Issue 1: `CORS blocked: <origin> is not an allowed origin`
- **Cause:** The frontend URL does not match any entry in `env.ALLOWED_ORIGINS`.
- **Solution:** Add your client domain or IP to the `ALLOWED_ORIGINS` variable in `.env` (separated by commas):
  ```dotenv
  ALLOWED_ORIGINS=http://localhost:5173,http://192.168.1.100:5173
  ```

### Issue 2: `Cannot connect to MySQL database / Prisma Client known request error`
- **Cause:** MySQL service is down or database user permissions are insufficient.
- **Solution:** Verify MySQL status and test connectivity with:
  ```bash
  mysql -u istrac_user -p -h localhost istrac_fms
  ```

### Issue 3: `503 { code: 'hdd_unavailable' }`
- **Cause:** The directory specified in `HDD_MOUNT_PATH` is either unmounted, read-only, or does not exist.
- **Solution:** Check permissions of `HDD_MOUNT_PATH`. Ensure the operating system process has read/write (`R_OK | W_OK`) privileges.

### Issue 4: `4401 Unauthorized` on WebSocket Connect
- **Cause:** The token query parameter `?token=<jwt>` is missing, malformed, or expired.
- **Solution:** Request a new access token via `POST /auth/login` or `POST /auth/refresh` and pass it in the connection URL.
