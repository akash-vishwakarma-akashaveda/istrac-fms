# 🛰️ ISTRAC-SIMS — Backend Architecture & Developer Guide

## 1. Executive Summary & Technology Stack

The **ISTRAC-SIMS Backend API** is an enterprise-grade, secure, air-gapped REST and WebSocket server built for high-reliability telemetry archiving, mission document management, and ground station coordination.

### Core Stack
- **Runtime:** [Node.js v24.x](https://nodejs.org/) (ES Modules, Native Fetch, Native Web Crypto)
- **Language:** [TypeScript 5.x](https://www.typescriptlang.org/) in strict mode
- **Web Framework:** [Express 5](https://expressjs.com/) (`express@5.2.1`)
- **Database & ORM:** [MariaDB 10.x / MySQL 8.x](https://mariadb.org/) with [Prisma ORM 7](https://www.prisma.io/) (`@prisma/client@7.x`)
- **Caching & Event Bus:** [Redis 7 / Valkey](https://redis.io/) via `ioredis` with an automatic **In-Memory Fallback Engine**
- **Security & Middleware:**
  - `bcrypt` (`bcrypt@6.0.0`) for salted PBKDF/SHA password hashing
  - `jsonwebtoken` (`jsonwebtoken@9.0.3`) for stateless claims with short TTL access tokens
  - `helmet` (`helmet@8.1.0`) for strict CSP, HSTS, and frame protections
  - `cors` (`cors@2.8.6`) with dynamic RFC 1918 intranet and loopback whitelisting
  - `express-rate-limit` (`express-rate-limit@8.3.1`) for brute-force prevention
- **Real-Time Communication:** Native `ws` (`ws@8.19.0`) WebSocket server with Redis pub/sub synchronization and client heartbeats
- **File & Storage Engine:** Streaming multipart uploads with SHA-256 integrity verification, storage quotas, and hard drive mount monitoring (`/mnt/istrac_storage`)

---

## 2. Directory Structure & Code References

```
backend/
├── prisma/
│   ├── schema.prisma                  # Data models, relations, indexes, enums
│   ├── seed.ts                        # Non-destructive seed script (idempotent)
│   └── migrations/                    # Versioned SQL migration history
├── prisma.config.ts                   # Prisma 7 root datasource configuration
├── dist/                              # Compiled JavaScript output (ESM)
├── src/
│   ├── config/                        # Core runtime configurations
│   │   ├── env.ts                     # Strict environment variable parser & validator
│   │   ├── db.ts                      # Prisma client singleton instance
│   │   ├── redis.ts                   # Redis connection & pub/sub clients
│   │   └── cors.ts                    # Dynamic origin validator (intranet & localhost)
│   ├── controllers/                   # HTTP Request Handlers (Business Logic)
│   │   ├── auth.controller.ts         # Login, logout, refresh, password reset
│   │   ├── file.controller.ts         # Upload, download, streaming, versioning
│   │   ├── department.controller.ts   # Department CRUD and telemetry grouping
│   │   ├── satellite.controller.ts    # Satellite fleet metadata & pass schedules
│   │   ├── admin.controller.ts        # User provisioning, audit trail, system metrics
│   │   └── cms.controller.ts          # Operational bulletins & notices
│   ├── middleware/                    # Express Middleware Chain
│   │   ├── auth.middleware.ts         # Bearer token verification & token blacklist check
│   │   ├── admin.middleware.ts        # Role guard strictly enforcing 'ADMIN'
│   │   ├── deptAccess.middleware.ts   # Department-level read/write permission verification
│   │   ├── hddAvailability.middleware.ts # Proactive check for /mnt/istrac_storage readiness
│   │   ├── rateLimiter.ts             # IP-based rate limiting for authentication routes
│   │   └── errorHandler.ts            # Centralized exception formatter & error logger
│   ├── routes/                        # Express Router Definitions
│   │   ├── auth.routes.ts             # /api/auth endpoints
│   │   ├── file.routes.ts             # /api/files endpoints
│   │   ├── department.routes.ts       # /api/departments endpoints
│   │   ├── satellite.routes.ts        # /api/satellites endpoints
│   │   ├── admin.routes.ts            # /api/admin endpoints
│   │   ├── cms.routes.ts              # /api/cms endpoints
│   │   └── health.routes.ts           # /api/health probe (/health, /api/health)
│   ├── services/                      # Reusable Domain & Infrastructure Services
│   │   ├── fileStorage.service.ts     # Chunked writes, SHA-256 verification, disk quotas
│   │   ├── hddHealth.service.ts       # Active disk I/O probe & degradation monitoring
│   │   └── token.service.ts           # JWT generation, cookie serialization, blacklist
│   ├── jobs/                          # Background Cron & Scheduled Jobs
│   │   └── mission-event.worker.ts    # Satellite telemetry refresh and pass event engine
│   ├── ws/                            # WebSocket Server Implementation
│   │   └── wsServer.ts                # WebSocket lifecycle, heartbeat, Redis pub/sub bridge
│   ├── lib/                           # Utility libraries
│   │   └── logger.ts                  # Structured logging (INFO, WARN, ERROR, DEBUG)
│   ├── types/                         # TypeScript interfaces and Express declaration merging
│   ├── index.ts                       # Main application bootstrap (Express + HTTP Server)
│   └── worker.ts                      # Standalone background worker daemon entrypoint
├── package.json                       # Runtime dependencies & npm scripts
└── tsconfig.json                      # Strict NodeNext TypeScript compiler options
```

---

## 3. Database Architecture & Prisma 7 Workflow

### 3.1. Prisma 7 Modern Configuration
In Prisma 7, the `DATABASE_URL` is configured in `prisma.config.ts` rather than hardcoded in `schema.prisma`. This guarantees full compliance with air-gapped runtimes.

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

### 3.2. Data Models & Schema Overview (`prisma/schema.prisma`)
The schema enforces strict referential integrity across the following core models:
1. `User`: User accounts with role-based permissions (`Role: ADMIN | MEMBER`).
2. `Department`: Operational ground divisions (e.g., Mission Operations, Telemetry Tracking, Data Processing).
3. `Satellite`: Spacecraft fleet registry (e.g., Aditya-L1, Chandrayaan-3, Ground Station Bengaluru).
4. `File` & `FileVersion`: Binary metadata, SHA-256 checksums, byte sizes, physical disk paths, and hierarchical folders.
5. `FilePermission` & `UserDepartmentAccess`: Fine-grained Access Control Lists (ACLs).
6. `AuditLog`: Immutable, append-only security logs for all access, downloads, deletions, and logins.
7. `RefreshToken`: Cryptographic token tracking for revocation and rotation.

---

## 4. Key Middleware & Security Pipeline

```
Incoming Request
      │
      ▼
┌──────────────┐
│ Helmet       │ ──> Security headers, CSP, Anti-Clickjacking
└──────┬───────┘
      │
      ▼
┌──────────────┐
│ CORS Policy  │ ──> Allows localhost:* and private RFC1918 IPs (10.x, 172.16-31.x, 192.168.x)
└──────┬───────┘
      │
      ▼
┌──────────────┐
│ Rate Limiter │ ──> Max 100 req/min for general API, 10 req/min for auth
└──────┬───────┘
      │
      ▼
┌──────────────┐
│ Auth Guard   │ ──> Validates Bearer JWT; checks token blacklist
└──────┬───────┘
      │
      ▼
┌──────────────┐
│ Dept Access  │ ──> Confirms user's role or department authorization (Cached)
└──────┬───────┘
      │
      ▼
┌──────────────┐
│ Storage Probe│ ──> Confirms /mnt/istrac_storage is mounted and writable
└──────┬───────┘
      │
      ▼
┌──────────────┐
│ Controller   │ ──> Executes business logic and database transaction
└──────────────┘
```

### 4.1. Resilient CORS Policy (`src/config/cors.ts`)
The server dynamically recognizes:
- Any `localhost` or `127.0.0.1` origin on any port (supporting port-forwarded SSH or VirtualBox tunnels).
- All private intranet ranges: `10.0.0.0/8`, `172.16.0.0/12`, and `192.168.0.0/16`.
- Any custom domain specified in `.env` under `ALLOWED_ORIGINS`.

---

## 5. Storage Subsystem & HDD Monitoring (`/mnt/istrac_storage`)

- **Physical Storage Location:** Configured via `HDD_MOUNT_PATH` in `.env` (default: `/mnt/istrac_storage`).
- **Directory Layout:**
  - `/mnt/istrac_storage/uploads/` — Staging for multipart chunked uploads.
  - `/mnt/istrac_storage/files/<deptId>/<year>/<month>/` — Permanent binary storage organized by department and timestamp.
  - `/mnt/istrac_storage/quarantine/` — Corrupted files or failed integrity checks.
- **Integrity Verification:** Every upload calculates an incremental SHA-256 hash. Before writing to the database, the hash is matched against the client's payload.
- **Proactive Health Check:** `hddAvailability.middleware.ts` executes non-blocking `fs.access` read/write tests. If the storage volume is disconnected or full, the API responds with `503 Storage Unavailable` to prevent database corruption.

---

## 6. How to Update & Extend the Backend

### 6.1. How to Add a New Database Model

1. **Edit `prisma/schema.prisma`:**
   ```prisma
   model GroundStationAntenna {
     id          String   @id @default(uuid())
     name        String
     diameter    Float    // in meters, e.g., 32.0
     frequencyBand String // S-Band, X-Band, Ka-Band
     createdAt   DateTime @default(now())
   }
   ```

2. **Generate a Migration:**
   ```bash
   cd backend
   npx prisma migrate dev --name add_ground_station_antenna
   ```

3. **Deploy Migration Offline:**
   On the air-gapped RHEL server:
   ```bash
   cd /opt/istrac-fms/backend
   node ./node_modules/prisma/build/index.js migrate deploy
   ```

---

### 6.2. How to Add a New API Endpoint

1. **Create Controller (`src/controllers/antenna.controller.ts`):**
   ```typescript
   import type { Request, Response, NextFunction } from 'express'
   import { prisma } from '../config/db.js'

   export async function listAntennas(req: Request, res: Response, next: NextFunction) {
     try {
       const antennas = await prisma.groundStationAntenna.findMany()
       res.json({ success: true, data: antennas })
     } catch (err) {
       next(err)
     }
   }
   ```

2. **Create Route (`src/routes/antenna.routes.ts`):**
   ```typescript
   import { Router } from 'express'
   import { listAntennas } from '../controllers/antenna.controller.js'
   import { authMiddleware } from '../middleware/auth.middleware.js'

   const router = Router()
   router.get('/', authMiddleware, listAntennas)

   export { router as antennaRouter }
   ```

3. **Register in `src/index.ts`:**
   ```typescript
   import { antennaRouter } from './routes/antenna.routes.js'

   app.use('/api/antennas', antennaRouter)
   ```

---

### 6.3. How to Rebuild the Backend

```bash
cd backend
npm run build
```

This compiles TypeScript into `dist/`. On the RHEL server:
```bash
sudo cp -rf dist/* /opt/istrac-fms/backend/dist/
sudo systemctl restart istrac-backend
```
