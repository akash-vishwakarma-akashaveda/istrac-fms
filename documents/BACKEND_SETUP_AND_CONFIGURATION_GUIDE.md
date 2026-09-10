# ISTRAC-SIMS Backend Initial Configuration & Setup Guide

> **Target System:** ISTRAC-SIMS Node.js/Express Backend  
> **Environment Support:** Windows Server / Linux (Amazon Linux, RHEL, Ubuntu, Rocky Linux) / Docker  
> **Target Version:** 1.1.0 (V1 Production Baseline)

---

## 📑 Table of Contents

1. [Hardware & Software Prerequisites](#1-hardware--software-prerequisites)
2. [Step-by-Step Local Setup](#2-step-by-step-local-setup)
3. [Environment Configuration Reference (`.env`)](#3-environment-configuration-reference-env)
4. [Database Provisioning & Migration](#4-database-provisioning--migration)
5. [Storage Volume (HDD Mount) Setup](#5-storage-volume-hdd-mount-setup)
6. [Starting the Application (Dev vs Prod)](#6-starting-the-application-dev-vs-prod)
7. [PM2 Production Process Manager Configuration](#7-pm2-production-process-manager-configuration)
8. [AWS EC2 + CloudFront Deployment Guide](#8-aws-ec2--cloudfront-deployment-guide)
9. [System Health & Verification Checks](#9-system-health--verification-checks)
10. [Troubleshooting & Frequently Encountered Issues](#10-troubleshooting--frequently-encountered-issues)

---

## 1. Hardware & Software Prerequisites

| Component | Minimum Specification | Recommended Specification |
| :--- | :--- | :--- |
| **Node.js** | `>= 20.10.0 LTS` | `20.18.0 LTS` or `22.x LTS` |
| **npm** | `>= 10.0.0` | `10.8.0+` |
| **MySQL / MariaDB**| `8.0.30+` / `10.5+` | `MySQL 8.0.36+` / `MariaDB 10.11+` |
| **Redis** | `6.2.0+` | `7.2.0+` (Standalone or Sentinel) |
| **RAM** | `4 GB` | `8 GB+` |
| **Storage (OS/App)**| `20 GB SSD` | `50 GB SSD` |
| **Storage (Data Mount)**| `500 GB HDD` | `2 TB+ Enterprise RAID-1 / RAID-6` |

---

## 2. Step-by-Step Local Setup

### Step 1: Navigate to Backend Directory
```bash
cd backend
```

### Step 2: Install Dependencies
```bash
npm install
```

### Step 3: Configure Environment Variables
Copy `.env.example` to `backend/.env`:
```bash
cp ../.env.example .env
```

---

## 3. Environment Configuration Reference (`.env`)

```dotenv
# ============================================================
# APPLICATION & RUNTIME
# ============================================================
NODE_ENV=development
PORT=3000
APP_URL=http://localhost:5173
ALLOWED_ORIGINS=http://localhost:5173,https://*.amplifyapp.com,https://*.cloudfront.net

# ============================================================
# LOGGING CONFIGURATION
# ============================================================
LOG_LEVEL=info           # debug | http | info | warn | error
DEBUG_PRISMA=false       # Set to true only if raw SQL debugging is needed

# ============================================================
# DATABASE (MySQL 8.0 / MariaDB)
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
HDD_MOUNT_PATH=D:/istrac_storage  # or /mnt/istrac_storage on Linux
```

---

## 4. Database Provisioning & Migration

### 1. Apply Prisma Migrations
```bash
npx prisma migrate deploy
```
*This executes all migration steps including `20260825031935_init_backend_v1` and `20260826151000_schema_updates_and_features`.*

### 2. Run Database Seeding
```bash
npm run seed
```
*This seeds operational satellite fleets, division CMS profiles, default users (`admin@istrac.local`), files, and scheduled mission passes.*

---

## 5. Storage Volume (HDD Mount) Setup

Ensure the physical directory configured in `HDD_MOUNT_PATH` exists on your system with proper read/write permissions:

```bash
# On Linux:
sudo mkdir -p /mnt/istrac_storage
sudo chown -R $USER:$USER /mnt/istrac_storage
sudo chmod -R 755 /mnt/istrac_storage

# On Windows:
mkdir D:\istrac_storage
```

---

## 6. Starting the Application

### Development Mode (with Live Reload & TSX)
```bash
npm run dev
```

### Production Build & Execution
```bash
npm run build
npm start
```

---

## 7. PM2 Production Process Manager Configuration

To run the backend continuously on a production server:

```bash
# Install PM2 globally
npm install -g pm2

# Build the TypeScript project
npm run build

# Start with PM2
pm2 start dist/src/index.js --name "istrac-backend" --time

# Save PM2 process list
pm2 save
pm2 startup
```

---

## 8. AWS EC2 + CloudFront Deployment Guide

1. **Deploy EC2 Backend:** Run `npm run build` and launch via PM2.
2. **Configure CloudFront Behavior:**
   - Origin: `http://<EC2_PUBLIC_IP_OR_ALB>:3000`
   - Cache Policy: Set to **`Managed-AllViewerExceptHostHeader`** or **`Managed-CORS-CustomOrigin`** to forward `Origin` and `Authorization` headers.
3. **Verify Health:** Open `https://<your-distribution>.cloudfront.net/health` in your browser. Expected response: `{ "status": "ok", "db": true, "redis": true, "storage": true }`.
