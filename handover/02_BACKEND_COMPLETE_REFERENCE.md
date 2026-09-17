# 🛰️ ISTRAC-SIMS — Backend Architecture & Developer Reference

> **Document Identifier:** ISTRAC-SIMS-BED-V2.0  
> **Classification:** ISRO / ISTRAC Restricted Technical Documentation  
> **Application:** Satellite Information Management System (Backend REST & WebSocket Server)  
> **Version:** 1.1.0 Production Baseline  
> **Runtime Environment:** Node.js v24.21.0 · TypeScript 5 · Express 5.2.1 · Prisma 7 · MariaDB 10 · ESM  
> **Target Deployment:** Air-Gapped Intranet Server (Native Systemd Daemons)  

---

## 📑 Table of Contents

1. [Executive Summary & Technology Stack](#1-executive-summary--technology-stack)
2. [Complete Source Code Directory Map](#2-complete-source-code-directory-map)
3. [Application Bootstrap & Startup Sequence (`src/index.ts`)](#3-application-bootstrap--startup-sequence-srcindexts)
4. [Environment Configuration Reference (`src/config/env.ts`)](#4-environment-configuration-reference-srcconfigenvts)
5. [Database Layer & Prisma 7 Modern Architecture](#5-database-layer--prisma-7-modern-architecture)
6. [Redis Architecture & In-Memory Fallback Subsystem](#6-redis-architecture--in-memory-fallback-subsystem)
7. [Intranet CORS Policy Architecture (`src/config/cors.ts`)](#7-intranet-cors-policy-architecture-srcconfigcorsts)
8. [Middleware Pipeline & Gatekeeping Chain](#8-middleware-pipeline--gatekeeping-chain)
9. [Complete REST API Route Directory (All 13 Modules)](#9-complete-rest-api-route-directory-all-13-modules)
10. [Real-Time WebSocket Server (`src/ws/wsServer.ts`)](#10-real-time-websocket-server-srcwswsserverts)
11. [Background Worker Daemons & Telemetry Automators](#11-background-worker-daemons--telemetry-automators)
12. [Storage Subsystem & Disk Health Probes (`/mnt/istrac_storage`)](#12-storage-subsystem--disk-health-probes-mntistrac_storage)
13. [API Response Envelope & Error Handling Standards](#13-api-response-envelope--error-handling-standards)
14. [Step-by-Step Developer Guides (How to Extend Backend)](#14-step-by-step-developer-guides-how-to-extend-backend)
15. [Build, Verification & Deployment Runbook](#15-build-verification--deployment-runbook)

---

## 1. Executive Summary & Technology Stack

The **ISTRAC-SIMS Backend** is a mission-critical, air-gapped REST and WebSocket server designed to handle satellite telemetry ingestion, user authorization, and storage disk management for ISRO/ISTRAC operations.

### Technology Stack & Architecture Rationale

| Layer | Technology | Version | Engineering Rationale |
|:---|:---|:---|:---|
| **Runtime** | Node.js | `v24.21.0` | Latest LTS engine with native Web Crypto, ES modules, improved V8 performance, and enhanced thread pooling. |
| **Language** | TypeScript | `5.x` | Strict type safety across all controllers, database models, and external socket frames. |
| **Framework** | Express | `5.2.1` | Native Promise error-handling in route handlers, improved route matching, and rock-solid stability. |
| **ORM** | Prisma | `7.x` | Type-safe query builder with automated versioned SQL migrations and query engine decoupling via `prisma.config.ts`. |
| **Database** | MariaDB | `10.x` | Enterprise relational database with full ACID compliance, utf8mb4 encoding, and socket authentication. |
| **Cache & Bus** | Redis / Valkey | `7.x` | Tri-instance Pub/Sub event bus with automatic in-memory fallback when Redis service is inactive. |
| **Password Hash** | bcrypt | `6.0.0` | Cryptographic PBKDF2/SHA salting (12 rounds) resistant to offline brute-force attacks. |
| **Authentication** | jsonwebtoken | `9.0.3` | Dual-token authentication (short-lived access tokens + rotating refresh tokens in httpOnly cookies). |
| **Security** | Helmet | `8.1.0` | Comprehensive HTTP security headers (strict CSP, HSTS, X-Frame-Options, XSS protection). |
| **CORS** | CORS | `2.8.6` | Dynamic origin validator automatically accepting localhost and private RFC 1918 intranet IP blocks. |
| **Multipart Upload**| Multer | `2.0.2` | Disk-buffered chunk streaming to prevent server RAM exhaustion on multi-GB telemetry datasets. |
| **WebSockets** | ws | `8.19.0` | Ultra-lean RFC 6455 WebSocket engine with client heartbeats and Redis message broadcasting. |

---

## 2. Complete Source Code Directory Map

```
backend/
├── prisma/
│   ├── migrations/                    # Versioned, reproducible SQL migration scripts
│   ├── schema.prisma                  # Master database models, relations, and enums
│   └── seed.ts                        # Idempotent database seeder (safe against existing data)
├── prisma.config.ts                   # Prisma 7 root datasource configuration file
├── dist/                              # Transpiled JavaScript production output (ESM)
├── src/
│   ├── config/                        # Core runtime configuration modules
│   │   ├── cors.ts                    # Dynamic CORS validator for intranet and loopback
│   │   ├── db.ts                      # Prisma client singleton instance
│   │   ├── env.ts                     # Strict environment variable parser and validator
│   │   └── redis.ts                   # Tri-instance Redis client with offline fault tolerance
│   ├── controllers/                   # HTTP Request Controllers (Business Logic)
│   │   ├── admin.controller.ts        # User provisioning, approval queues, disk metrics
│   │   ├── auth.controller.ts         # Login, logout, refresh, OTP dispatch and reset
│   │   ├── cms.controller.ts          # Landing page notices and banner management
│   │   ├── department.controller.ts   # Operational division management and quotas
│   │   ├── file.controller.ts         # Upload, download, streaming, metadata, ACLs
│   │   └── satellite.controller.ts    # Spacecraft fleet metadata and telemetry links
│   ├── jobs/                          # Scheduled background automation jobs
│   │   └── mission-event.worker.ts    # Satellite pass state automator and telemetry refresher
│   ├── lib/                           # Foundational libraries
│   │   └── logger.ts                  # Structured terminal and journald logger
│   ├── middleware/                    # Express request processing middleware
│   │   ├── admin.middleware.ts        # Role guard strictly enforcing 'ADMIN'
│   │   ├── audit.middleware.ts        # Non-repudiation audit trail logger for mutating requests
│   │   ├── auth.middleware.ts         # Bearer token verification and revocation check
│   │   ├── deptAccess.middleware.ts   # Department-level read/write ACL enforcement
│   │   ├── errorHandler.ts            # Centralized exception handler and error envelope
│   │   ├── hddAvailability.middleware.ts # Live /mnt/istrac_storage read/write disk probe
│   │   ├── logger.middleware.ts       # HTTP request method, latency, and status logging
│   │   └── rateLimiter.middleware.ts  # IP-based rate limiting for authentication and API
│   ├── routes/                        # Express API route modules (13 files)
│   │   ├── admin.routes.ts            # /api/admin endpoints
│   │   ├── auth.routes.ts             # /api/auth endpoints
│   │   ├── browse.routes.ts           # /api/browse file tree endpoints
│   │   ├── cms.routes.ts              # /api/cms announcement endpoints
│   │   ├── department.routes.ts       # /api/departments endpoints
│   │   ├── event.routes.ts            # /api/events tracking pass endpoints
│   │   ├── file.routes.ts             # /api/files upload and download endpoints
│   │   ├── health.routes.ts           # /api/health and /health system probes
│   │   ├── notification.routes.ts     # /api/notifications alerts endpoints
│   │   ├── reportPreset.routes.ts     # /api/report-presets template endpoints
│   │   ├── satellite.routes.ts        # /api/satellites fleet endpoints
│   │   ├── scheduler.routes.ts        # /api/scheduler background frequency endpoints
│   │   └── user.routes.ts             # /api/users profile and preference endpoints
│   ├── services/                      # Domain services
│   │   ├── fileStorage.service.ts     # Chunk reassembly, SHA-256 validation, quota check
│   │   ├── hddHealth.service.ts       # Disk I/O benchmark and degradation flag tracking
│   │   └── token.service.ts           # JWT generation, cookie serialization, blacklist
│   ├── types/                         # Express request type extensions and TypeScript models
│   ├── ws/                            # Real-time WebSocket server
│   │   └── wsServer.ts                # WebSocket lifecycle, heartbeat, Redis pub/sub bridge
│   ├── index.ts                       # Main application entrypoint (HTTP + Express)
│   └── worker.ts                      # Standalone background worker daemon entrypoint
├── package.json                       # Dependencies, build scripts, npm run commands
└── tsconfig.json                      # Strict NodeNext compiler settings
```

---

## 3. Application Bootstrap & Startup Sequence (`src/index.ts`)

```
Server Boot Sequence
  │
  ├─► 1. BigInt Prototype Serialization Patch (sizeBytes -> string)
  ├─► 2. Helmet Security Headers Setup
  ├─► 3. Dynamic CORS origin evaluation (localhost, RFC1918)
  ├─► 4. Express body parsers (JSON & URL-encoded: 50MB limit)
  ├─► 5. CookieParser (httpOnly refresh token extraction)
  ├─► 6. Request ID Injection (UUID v4)
  ├─► 7. HTTP Request Logger & Non-Repudiation Audit Logger
  ├─► 8. Route Dispatcher (Mounting all 13 route modules)
  ├─► 9. Centralized Error Handler (4-argument catch-all)
  └─► 10. WebSocket Upgrade Hook & HTTP Listener Launch on Port 3000
```

### Critical Code: BigInt JSON Serialization
In MariaDB, file sizes exceed `2^31 - 1` bytes and are mapped by Prisma to JavaScript `BigInt`. Standard `JSON.stringify` throws a `TypeError: Do not know how to serialize a BigInt`. `src/index.ts` patches this globally on line 1:
```typescript
;(BigInt.prototype as any).toJSON = function () {
  return this.toString()
}
```

### Graceful Termination Handlers:
Both `SIGTERM` (issued by `systemctl stop`) and `SIGINT` (Ctrl+C) trigger an asynchronous graceful shutdown:
1. `httpServer.close()`: Stops accepting incoming sockets, allowing existing requests to finish.
2. `prisma.$disconnect()`: Drains database connection pools cleanly.
3. `redis.disconnect()` / `redisPub.disconnect()` / `redisSub.disconnect()`: Closes event sockets.
4. Process terminates with exit code `0`.

---

## 4. Environment Configuration Reference (`src/config/env.ts`)

The server enforces fail-fast startup: if any required environment variable is missing, the application halts immediately with a clear error.

| Variable Name | Required? | Default | Description |
|:---|:---:|:---|:---|
| `PORT` | Optional | `3000` | HTTP listener port on loopback interface (`127.0.0.1`). |
| `NODE_ENV` | Optional | `production` | Operational mode (`production` disables debug stacks). |
| `DATABASE_URL` | **Required** | None | MariaDB connection string (`mysql://user:pass@127.0.0.1:3306/db`). |
| `MYSQL_HOST` | Optional | `127.0.0.1` | Host IP (must be `127.0.0.1` on Linux to avoid socket errors). |
| `MYSQL_PORT` | Optional | `3306` | MariaDB TCP port. |
| `MYSQL_DATABASE`| Optional | `istrac_fms` | Database name. |
| `MYSQL_USER` | Optional | `istrac_user`| Application database user. |
| `MYSQL_PASSWORD`| Optional | None | Database password. |
| `REDIS_URL` | **Required** | `redis://127.0.0.1:6379`| Connection string for Redis/Valkey cache and pub/sub. |
| `JWT_SECRET` | **Required** | None | 256-bit cryptographic secret for signing access tokens. |
| `JWT_REFRESH_SECRET`| **Required** | None | 256-bit cryptographic secret for signing refresh tokens. |
| `HDD_MOUNT_PATH`| **Required** | `/mnt/istrac_storage`| Path to physical disk volume for telemetry archives. |
| `ALLOWED_ORIGINS`| Optional | `http://localhost,http://127.0.0.1` | Comma-separated trusted origins (intranet IPs auto-allowed). |
| `APP_URL` | Optional | `http://localhost` | Canonical base URL for system alerts and links. |
| `LOG_LEVEL` | Optional | `info` | Minimum logging verbosity (`debug`, `info`, `warn`, `error`). |
| `DEBUG_PRISMA` | Optional | `false` | When `true`, prints raw SQL queries to stdout. |

---

## 5. Database Layer & Prisma 7 Modern Architecture

### 5.1. Prisma 7 Configuration Standard (`prisma.config.ts`)
In Prisma 7, the database connection URL is defined in `prisma.config.ts`, while `prisma/schema.prisma` maintains the pure database schema definition without embedded secrets:

```typescript
// backend/prisma.config.ts
import { defineConfig } from '@prisma/config'
import dotenv from 'dotenv'

dotenv.config()

export default defineConfig({
  earlyAccess: true,
  schema: './prisma/schema.prisma',
  datasource: {
    url: process.env.DATABASE_URL || 'mysql://istrac_user:IstracSecurePass123!@127.0.0.1:3306/istrac_fms',
  },
})
```

### 5.2. Core Database Models Summary (`prisma/schema.prisma`)
- `User`: Operator credentials, role (`ADMIN` or `MEMBER`), temporary password flag, account approval state.
- `Department`: Operational ground divisions (e.g. MOX-1, Byalalu DSN, Telemetry Tracking).
- `Satellite`: Fleet metadata (Aditya-L1, Chandrayaan-3, payload configs, orbit parameters).
- `File` & `FileVersion`: Binary metadata, physical disk relative path, SHA-256 hash, byte size, category.
- `FilePermission`: Fine-grained Access Control Lists (ACLs) per user or department.
- `AuditLog`: Immutable, append-only log of every security-relevant event (logins, downloads, deletions).
- `RefreshToken`: Cryptographic token hash tracking to facilitate single-session revocation and rotation.
- `PasswordResetToken`: Cryptographic 6-digit OTP codes for air-gapped operator password resets.
- `MissionEvent`: Scheduled tracking passes, acquisition-of-signal (AOS) times, loss-of-signal (LOS) times.

### 5.3. Idempotent Seeding Safeguards (`prisma/seed.ts`)
The seed script includes an explicit safety guard:
```typescript
const existingUserCount = await prisma.user.count()
if (existingUserCount > 0) {
  console.log(`ℹ️ Database already contains ${existingUserCount} user(s). Skipping destructive purge to preserve existing data.`)
  return
}
```
This guarantees that re-running deployment scripts or updating services **never purges production users or records**.

---

## 6. Redis Architecture & In-Memory Fallback Subsystem

The backend implements the **Tri-Instance Redis Pattern** (`src/config/redis.ts`):
1. `redis`: Default client used for caching permissions, blacklist tokens, and disk metrics.
2. `redisPub`: Dedicated client for publishing WebSocket events.
3. `redisSub`: Dedicated blocking client for subscribing to event topics.

### Automatic In-Memory Fallback:
All three clients are configured with `lazyConnect: true` and custom error suppression:
- **Cache Misses:** If Redis is down, `deptAccess.middleware.ts` automatically queries MariaDB directly.
- **Token Blacklist:** `auth.middleware.ts` falls back to an internal in-process `Map`.
- **Worker Daemon:** `worker.ts` logs:
  `[Scheduler] Redis is offline. Operating in standalone in-memory scheduler mode.`
  and manages scheduling intervals locally.
- **Health Check Probe:** Reports `redis: "error"`, but the application continues serving traffic without crashing.

---

## 7. Intranet CORS Policy Architecture (`src/config/cors.ts`)

CORS validation is dynamically calculated per incoming request to ensure seamless operation on local consoles, remote intranet workstations, and port-forwarded tunnels:

```typescript
export const corsOptions: CorsOptions = {
  origin: (origin, callback) => {
    // 1. Allow server-to-server, curl, mobile, and non-browser clients (no Origin header)
    if (!origin) return callback(null, true)

    const normalizedOrigin = origin.trim().replace(/\/+$/, '')

    // 2. Exact match against trusted production origins & .env custom origins
    if (TRUSTED_PRODUCTION_ORIGINS.includes(normalizedOrigin) || isEnvAllowed(normalizedOrigin)) {
      return callback(null, true)
    }

    // 3. Allow loopback on any port (supporting port-forwarded SSH and VirtualBox tunnels)
    const isLocalhost = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(normalizedOrigin)
    if (isLocalhost) return callback(null, true)

    // 4. Allow all RFC 1918 private intranet IP ranges on any port
    const isPrivateIp = /^https?:\/\/(10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3})(:\d+)?$/i.test(normalizedOrigin)
    if (isPrivateIp) return callback(null, true)

    logger.warn('CORS', `Blocked unauthorized origin: ${origin}`)
    return callback(null, false)
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD'],
  maxAge: 86400, // Cache preflight responses for 24 hours
}
```

---

## 8. Middleware Pipeline & Gatekeeping Chain

Requests traverse a sequential chain of 7 security and operational middlewares:

```
Incoming HTTP Request
       │
       ▼
┌───────────────────────────────┐
│ 1. rateLimiter.middleware.ts  │ ──► Prevents brute-force on /api/auth routes
└──────────────┬────────────────┘
               │
               ▼
┌───────────────────────────────┐
│ 2. auth.middleware.ts         │ ──► Decodes Bearer JWT; verifies revocation in Redis/memory
└──────────────┬────────────────┘
               │
               ▼
┌───────────────────────────────┐
│ 3. admin.middleware.ts        │ ──► Role gate strictly requiring req.user.role === 'ADMIN'
└──────────────┬────────────────┘
               │
               ▼
┌───────────────────────────────┐
│ 4. deptAccess.middleware.ts   │ ──► Validates member read/write ACLs for specific divisions
└──────────────┬────────────────┘
               │
               ▼
┌───────────────────────────────┐
│ 5. hddAvailability.middleware │ ──► Verifies /mnt/istrac_storage is writable before handling uploads
└──────────────┬────────────────┘
               │
               ▼
┌───────────────────────────────┐
│ 6. audit.middleware.ts        │ ──► Commits non-repudiation audit records upon response finish
└──────────────┬────────────────┘
               │
               ▼
┌───────────────────────────────┐
│ 7. errorHandler.ts            │ ──► Standardized JSON error envelope on uncaught exceptions
└───────────────────────────────┘
```

---

## 9. Complete REST API Route Directory (All 13 Modules)

| Route Prefix | Source File | Key Endpoints | Security Scope |
|:---|:---|:---|:---|
| `/api/auth` | `auth.routes.ts` | `/login`, `/logout`, `/refresh`, `/otp/request`, `/otp/verify` | Public / Cookie Authenticated |
| `/api/users` | `user.routes.ts` | `/profile`, `/change-password`, `/preferences` | Authenticated Operators |
| `/api/admin` | `admin.routes.ts` | `/users`, `/approvals`, `/audit-logs`, `/metrics`, `/system-config`| Super Admin Only |
| `/api/departments`| `department.routes.ts`| `GET /`, `POST /`, `/:id/members`, `/:id/quotas` | Authenticated / Admin |
| `/api/satellites` | `satellite.routes.ts` | `GET /`, `POST /`, `/:id/telemetry`, `/:id/passes` | Authenticated Operators |
| `/api/files` | `file.routes.ts` | `/upload/chunk`, `/:id/download`, `/:id/permissions` | Authenticated Operators |
| `/api/browse` | `browse.routes.ts` | `/folders`, `/files`, `/breadcrumbs` | Authenticated Operators |
| `/api/cms` | `cms.routes.ts` | `/articles`, `/notices`, `/banners`, `/media/upload` | Public Read / Admin Write |
| `/api/events` | `event.routes.ts` | `/passes`, `/calendar`, `/schedule` | Authenticated Operators |
| `/api/notifications`| `notification.routes.ts`| `/unread`, `/mark-read`, `/broadcast` | Authenticated Operators |
| `/api/report-presets`| `reportPreset.routes.ts`| `/templates`, `/generate` | Authenticated Operators |
| `/api/scheduler`| `scheduler.routes.ts`| `/interval`, `/status`, `/trigger` | Super Admin Only |
| `/api/health` | `health.routes.ts` | `/health`, `/admin/health/hdd` | Public Liveness / Admin Detailed |

---

## 10. Real-Time WebSocket Server (`src/ws/wsServer.ts`)

- **Protocol:** RFC 6455 native WebSocket server integrated with Express HTTP server via the `'upgrade'` event.
- **Authentication:** Token extracted from query parameter (`?token=...`) or cookies during handshake.
- **Pub/Sub Bridge:** Subscribes to Redis channels:
  - `cms.update`: Broadcasts updated bulletins to all connected clients.
  - `notification.broadcast`: Delivers urgent ground alerts.
  - `file.uploaded`: Notifies department members of newly indexed telemetry files.

---

## 11. Background Worker Daemons & Telemetry Automators

Managed as a native systemd unit (`istrac-worker.service`) running `src/worker.ts`:
- **Job Engine:** `src/jobs/mission-event.worker.ts`.
- **Pass Status Automation:** Checks upcoming satellite passes every 60 seconds:
  - Updates passes entering acquisition-of-signal window to `ACTIVE`.
  - Transitions passes beyond loss-of-signal window to `COMPLETED`.
- **Disk Space Poller:** Tests `/mnt/istrac_storage` write availability every 60 seconds; sets a degradation flag if storage drops below 5GB.

---

## 12. Storage Subsystem & Disk Health Probes (`/mnt/istrac_storage`)

Physical file storage is completely separated from the operating system drive:
- **Base Path:** `/mnt/istrac_storage` (owned by `istrac:istrac`, permissions `770`).
- **Directory Hierarchy:**
  ```
  /mnt/istrac_storage/
  ├── uploads/                       # Temporary holding directory for incoming chunks
  │   └── <upload-session-uuid>/     # Sliced 5MB binary chunks
  ├── files/                         # Permanent indexed storage
  │   └── <department-id>/
  │       └── <year>/
  │           └── <month>/
  │               └── <file-uuid>.<ext>
  └── quarantine/                    # Corrupted uploads or failed checksum files
  ```

---

## 13. API Response Envelope & Error Handling Standards

### 13.1. Standard Success Envelope:
```json
{
  "success": true,
  "data": {
    "id": "SAT-CH-3",
    "name": "Chandrayaan-3 Lunar Relay",
    "status": "ACTIVE"
  },
  "timestamp": "2026-09-17T06:00:00.000Z"
}
```

### 13.2. Standard Error Envelope:
```json
{
  "success": false,
  "error": {
    "code": "unauthorized_access",
    "message": "Bearer access token has expired or is invalid.",
    "details": null
  },
  "timestamp": "2026-09-17T06:00:00.000Z"
}
```

---

## 14. Step-by-Step Developer Guides (How to Extend Backend)

### 14.1. How to Add a New Database Table & Migration

1. Edit `prisma/schema.prisma` and define the model:
   ```prisma
   model GroundAntenna {
     id         String   @id @default(uuid())
     name       String
     diameterM  Float
     createdAt  DateTime @default(now())
   }
   ```
2. Generate migration on your development machine:
   ```bash
   cd backend
   npx prisma migrate dev --name add_ground_antenna
   ```
3. Deploy migration offline on the RHEL server:
   ```bash
   cd /opt/istrac-fms/backend
   node ./node_modules/prisma/build/index.js migrate deploy
   ```

---

### 14.2. How to Add a New REST Endpoint

1. Create a route file in `src/routes/antenna.routes.ts`:
   ```typescript
   import { Router } from 'express'
   import { prisma } from '../config/db.js'
   import { authMiddleware } from '../middleware/auth.middleware.js'

   const router = Router()

   router.get('/', authMiddleware, async (_req, res, next) => {
     try {
       const antennas = await prisma.groundAntenna.findMany()
       res.json({ success: true, data: antennas })
     } catch (err) {
       next(err)
     }
   })

   export { router as antennaRouter }
   ```
2. Mount the router in `src/index.ts`:
   ```typescript
   import { antennaRouter } from './routes/antenna.routes.js'
   app.use('/api/antennas', antennaRouter)
   ```

---

## 15. Build, Verification & Deployment Runbook

### Compiling Backend Assets:
```bash
cd /path/to/istrac-fms/backend
npm run build
```

### Deploying to Production RHEL Server:
```bash
# Copy compiled dist to production directory
sudo cp -rf dist/* /opt/istrac-fms/backend/dist/

# Restart backend daemon
sudo systemctl restart istrac-backend

# Verify logs
sudo journalctl -u istrac-backend -n 50 --no-pager
```
