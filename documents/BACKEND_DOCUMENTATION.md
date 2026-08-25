# ISTRAC-FMS Backend Architecture & Technical Reference

> **System:** Indian Space Research Auxiliary Centres — File Management System (ISTRAC-FMS)  
> **Version:** 1.0.0 (V1 Production Baseline)  
> **Target Environment:** Intranet Air-Gapped / Isolated Ground Station Network  
> **Core Stack:** Express 5 · Node.js 20+ (ESM) · TypeScript 5 · Prisma 7 · MySQL 8.0 · Redis 7.0 · WebSocket (`ws`)

---

## 📑 Table of Contents

1. [Executive Summary & Core Philosophy](#1-executive-summary--core-philosophy)
2. [Architectural Decisions — The "What & Why"](#2-architectural-decisions--the-what--why)
   - [2.1 Metadata-Only Database vs Physical HDD Mount](#21-metadata-only-database-vs-physical-hdd-mount)
   - [2.2 Top-Level Hierarchy: Satellite Station → Department → File](#22-top-level-hierarchy-satellite-station--department--file)
   - [2.3 Tri-Instance Redis Architecture](#23-tri-instance-redis-architecture)
   - [2.4 Authentication & Token Lifecycle Strategy](#24-authentication--token-lifecycle-strategy)
   - [2.5 Storage Pipeline & Compensation Pattern](#25-storage-pipeline--compensation-pattern)
   - [2.6 Asynchronous Non-Blocking Audit Logging](#26-asynchronous-non-blocking-audit-logging)
3. [Complete Codebase Directory Map](#3-complete-codebase-directory-map)
4. [Database Schema & Entity Models](#4-database-schema--entity-models)
5. [Cross-Cutting Middleware Layer](#5-cross-cutting-middleware-layer)
6. [Core Business Logic Services](#6-core-business-logic-services)
7. [REST API Endpoint Specifications](#7-rest-api-endpoint-specifications)
8. [Real-Time WebSocket & PubSub Bridge](#8-real-time-websocket--pubsub-bridge)
9. [Background Daemons & Health Monitoring](#9-background-daemons--health-monitoring)
10. [Security, Concurrency & Defense-in-Depth](#10-security-concurrency--defense-in-depth)

---

## 1. Executive Summary & Core Philosophy

ISTRAC-FMS is an enterprise-grade file management system engineered specifically for telemetry, tracking, command, and mission operations data across ISTRAC ground stations (e.g., ISTRAC Bengaluru, Sriharikota, Port Blair, Mauritius). 

### Key Design Mandates:
- **Intranet Air-Gap Readiness:** Zero external CDN, Google Fonts, or internet analytics dependencies. All assets, fonts, and dependencies run locally.
- **Fail-Safe High Reliability:** Hardware storage faults, unexpected power terminations, or database drops must never leave corrupt orphan files or inconsistent state.
- **Strict Role-Based Multi-Tenancy:** Separation of departmental data across satellite facilities with defense against horizontal privilege escalation.
- **Defense in Depth:** Mandatory token revocation blacklists, rate limiting, request tracing, strict CORS origins, path traversal guards, magic byte inspections, and tamper-evident append-only audit logging.

---

## 2. Architectural Decisions — The "What & Why"

### 2.1 Metadata-Only Database vs Physical HDD Mount

#### What:
The MySQL database stores **only file metadata** (name, MIME type, size in bytes, SHA-256 hash, department ID, version number, uploader ID, status). The raw binary contents of files are never stored in MySQL (no `BLOB` or `LONGBLOB` data types). Instead, files reside directly on a mounted enterprise storage volume at `env.HDD_MOUNT_PATH` (e.g., `/mnt/istrac-data` or a dedicated high-capacity NAS/SAN partition).

#### Why:
1. **Database Sizing & Performance:** Storing multi-gigabyte mission dumps, telemetry recordings, and optical captures inside relational tables degrades B-tree index performance, bloats database backups (mysqldump), causes high memory consumption on `innodb_buffer_pool`, and slows down table scans.
2. **Streaming Efficiency:** Physical file paths allow Node.js to use zero-copy kernel streams (`fs.createReadStream().pipe(res)`) and chunked multipart uploads directly to disk without loading multi-gigabyte payloads into Node.js V8 heap memory.
3. **Backup Decoupling:** Database dumps remain compact (< 100MB) and fast to restore, while the storage volume is independently backed up via snapshotting, RAID-1/RAID-6, or periodic `rsync` mirrors.

---

### 2.2 Top-Level Hierarchy: Satellite Station → Department → File

#### What:
The organizational hierarchy is modeled as:
```
Satellite Station (e.g., "ISTRAC Bengaluru" [code: ISTRAC-BLR])
  └── Department (e.g., "Engineering", "Mission Operations")
        ├── Files & Folders (Recursive FileTree)
        │     └── FileVersion History (v1, v2, v3...)
        └── UserDepartmentAccess (READ_ONLY | READ_WRITE)
```
Every department **must** belong to a `Satellite`, and department names are uniquely scoped per satellite via the database constraint `@@unique([satelliteId, name])`.

#### Why:
1. **Multi-Facility Topology:** ISTRAC operates multiple physical ground stations across India and overseas. Stations have distinct mission allocations, local network drives, and personnel.
2. **Autonomous Scoping:** Scoping departments under satellites prevents naming collisions (e.g., both Bengaluru and Sriharikota can have an "Operations" department without conflict) while allowing the Super Admin to filter statistics and audits per station.

---

### 2.3 Tri-Instance Redis Architecture

#### What:
In [`src/config/redis.ts`](file:///D:/istrac-fms/backend/src/config/redis.ts), three distinct `ioredis` client connections are instantiated:
1. `redis` — General cache, login rate limiting, session TTLs, and revoked token blacklist.
2. `redisPub` — Dedicated Publisher for Redis Pub/Sub channels (`notification.*`, `cms.update`, `hdd.sync`, `file.*`).
3. `redisSub` — Dedicated Subscriber for long-lived Pub/Sub event loops.

#### Why:
According to the Redis protocol specification, once a Redis client enters the `SUBSCRIBE` or `PSUBSCRIBE` state, it is locked into listener mode and can no longer issue regular commands (such as `GET`, `SET`, `INCR`, `EXPIRE`). Separating general operations, publishing, and subscribing into dedicated connection pools prevents command blocking and enables clean horizontal scaling across multiple PM2 worker processes.

---

### 2.4 Authentication & Token Lifecycle Strategy

#### What:
- **Access Tokens:** Short-lived (15 minutes), signed with `env.JWT_SECRET`, containing `AuthUser` claims (`id`, `role: ADMIN | MEMBER`, `email`, `name`). Passed via `Authorization: Bearer <token>` header.
- **Refresh Tokens:** Long-lived (7 days), signed with `env.JWT_REFRESH_SECRET`, delivered via strict `httpOnly`, `sameSite: 'strict'` cookie. The raw token is hashed via SHA-256 before storage in the `RefreshToken` database table.
- **Token Blacklisting:** Explicit logout or account suspension immediately adds the active access token signature to Redis (`blacklist:<token>`) with a 15-minute TTL, and invalidates the refresh session in the database.

#### Why:
1. **XSS Protection:** Refresh tokens stored in `httpOnly` cookies cannot be accessed or stolen by malicious client-side JavaScript.
2. **Instant Revocation:** Standard stateless JWTs cannot be revoked before expiration without a database check. By maintaining a lightweight, in-memory Redis blacklist, any token can be instantly invalidated on logout or admin suspension with sub-millisecond overhead.
3. **Defense Against Token Database Leaks:** Storing only the SHA-256 hash of refresh tokens ensures that a database compromise does not allow an attacker to forge session refresh requests.

---

### 2.5 Storage Pipeline & Compensation Pattern

#### What:
When an upload arrives (`POST /files/upload` or `POST /files/upload/complete`):
1. The destination folder is created on the physical storage mount.
2. The payload is written atomically using a temporary file (`.tmp`) and renamed upon completion.
3. The SHA-256 checksum and exact byte count are computed from disk.
4. A MySQL database transaction (`prisma.$transaction`) inserts the `File` and `FileVersion` records.
5. **Compensation Pattern:** If the MySQL database transaction fails or rolls back, a `catch` block immediately deletes the newly written physical file from disk (`await hddService.deleteFile(...)`) before propagating the error.

#### Why:
Without the compensation pattern, a database failure after writing to disk would leave un-indexed "ghost" files on the storage array that consume disk space without being visible in the application.

---

### 2.6 Asynchronous Non-Blocking Audit Logging

#### What:
Mutating operations (`POST`, `PUT`, `PATCH`, `DELETE`) are captured by [`audit.middleware.ts`](file:///D:/istrac-fms/backend/src/middleware/audit.middleware.ts) using the `res.on('finish', ...)` event after the HTTP response has already been sent to the client. The insertion into `AuditLog` is completely asynchronous and fire-and-forget.

#### Why:
1. **Zero Added Latency:** Logging operations do not delay the client's API response time.
2. **Isolation:** If the audit logging write encounters a momentary issue, it will log to stderr without causing the user's business transaction to fail or roll back.

---

## 3. Complete Codebase Directory Map

```
backend/
├── package.json               # Node.js dependencies, engine specifications, and lifecycle scripts
├── tsconfig.json              # TypeScript compiler configuration (ES2022 / NodeNext module resolution)
├── prisma.config.ts           # Prisma CLI configuration
├── prisma/
│   ├── schema.prisma          # Authoritative Prisma data model (19 tables, 8 enums)
│   ├── seed.ts                # Initial seeder (Satellite, Super Admin, Departments, Sample files)
│   ├── migrations/            # Migration repository for schema version control
│   │   ├── migration_lock.toml
│   │   └── 20260825031935_init_backend_v1/
│   │       └── migration.sql  # Production baseline SQL DDL script
│   └── generated/prisma/      # Compiled Prisma Client runtime
└── src/
    ├── index.ts               # Express application entrypoint, middleware chain & graceful shutdown
    ├── config/
    │   ├── env.ts             # Environment variable loader with fail-fast validation
    │   ├── db.ts              # Prisma MariaDB/MySQL driver-adapter singleton
    │   ├── redis.ts           # Tri-instance Redis pool (general, publisher, subscriber)
    │   └── cors.ts            # Strict origin whitelist and credential configuration
    ├── types/
    │   ├── api.ts             # Shared DTOs, response wrappers, and pagination shapes
    │   ├── express.d.ts       # Express Request interface type augmentation
    │   └── types.ts           # EnvConfig interface declaration
    ├── lib/
    │   ├── errors.ts          # Operational AppError class and global Express error handler
    │   ├── jwt.ts             # Access and refresh token sign/verify utilities
    │   ├── pubsub.ts          # Type-safe wrapper over Redis Pub/Sub channels
    │   └── requestId.ts       # UUID v4 correlation ID middleware
    ├── middleware/
    │   ├── auth.middleware.ts          # JWT verification & Redis blacklist check
    │   ├── admin.middleware.ts         # ADMIN role guard
    │   ├── deptAccess.middleware.ts    # Department membership check with Redis cache
    │   ├── rateLimiter.middleware.ts   # Sliding window login & download rate limiters
    │   ├── audit.middleware.ts         # Post-response state mutation auditor
    │   └── hddAvailability.middleware.ts # Physical mount probe & outage guard
    ├── services/
    │   ├── audit.service.ts         # Append-only audit logger
    │   ├── email.service.ts         # Campus SMTP mailer & notification templates
    │   ├── notification.service.ts  # Database notification creator & Redis publisher
    │   ├── hdd.service.ts           # Low-level atomic file I/O & path traversal defense
    │   ├── hddHealth.service.ts     # 60s background storage probe daemon
    │   ├── hddSync.service.ts       # 15m periodic disk reconciliation walker
    │   ├── search.service.ts        # RBAC-scoped multi-field search engine
    │   └── file.service.ts          # Transactional upload pipeline & compensation
    ├── routes/
    │   ├── auth.routes.ts           # Authentication, token rotation, and password resets
    │   ├── satellite.routes.ts      # Satellite ground station administration
    │   ├── department.routes.ts     # Department management & user membership assignment
    │   ├── user.routes.ts           # User accounts, approval queue, and suspensions
    │   ├── file.routes.ts           # Uploads, chunking, downloads, versioning, folders
    │   ├── browse.routes.ts         # Folder hierarchy trees and search endpoints
    │   ├── notification.routes.ts   # Notification inbox and broadcast delivery
    │   ├── cms.routes.ts            # CMS content blocks and real-time push updates
    │   ├── admin.routes.ts          # Admin metrics, audit log viewer, system settings
    │   └── health.routes.ts         # Liveness and storage hardware health probes
    └── ws/
        └── wsServer.ts              # WebSocket server & Redis event fanout bridge
```

---

## 4. Database Schema & Entity Models

### Core Enums
- **`UserRole`**: `ADMIN`, `MEMBER`
- **`UserStatus`**: `PENDING`, `ACTIVE`, `SUSPENDED`, `REJECTED`
- **`AccessLevel`**: `READ_ONLY`, `READ_WRITE`
- **`FileNodeType`**: `FILE`, `FOLDER`
- **`FileStatus`**: `ACTIVE`, `ORPHANED`, `DELETED`, `UNREGISTERED`
- **`ReportStatus`**: `ACTIVE`, `ARCHIVED`, `DELETED`
- **`ReportCategory`**: `SPECIAL_OPERATIONS`, `ANOMALY`, `STUDY`, `DAILY_REPORT`, `OTHER`
- **`AccessRequestStatus`**: `PENDING`, `APPROVED`, `REJECTED`, `CANCELLED`

### Primary Models Overview

| Model | Description | Key Constraints & Indexes |
|---|---|---|
| **`Satellite`** | Top-level ground station / facility unit | `UNIQUE(code)`, `INDEX(name)`, `INDEX(deletedAt)` |
| **`Department`** | Organizational unit under a Satellite with dedicated HDD path | `UNIQUE(satelliteId, name)`, `INDEX(satelliteId)`, `INDEX(deletedAt)` |
| **`User`** | System operator or administrator account | `UNIQUE(email)`, `UNIQUE(employeeId)` |
| **`UserDepartmentAccess`** | Junction table mapping user permissions to departments | `UNIQUE(userId, departmentId)`, `INDEX(userId)`, `INDEX(departmentId)` |
| **`File`** | Metadata record for a file or folder on disk | `UNIQUE(hddPath)`, `INDEX(departmentId, status)`, `INDEX(parentId)` |
| **`FileVersion`** | Historical versions of a physical file | `UNIQUE(fileId, versionNum)`, `INDEX(fileId)` |
| **`Notification`** | User inbox alerts with JSON metadata | `BIGINT AUTO_INCREMENT PK`, `INDEX(userId, readAt, createdAt)` |
| **`AuditLog`** | Tamper-evident, append-only log of mutations | `BIGINT AUTO_INCREMENT PK`, `INDEX(userId, createdAt)`, `INDEX(action)` |
| **`RefreshToken`** | SHA-256 hashed refresh token session records | `UNIQUE(tokenHash)`, `INDEX(userId)`, `INDEX(expiresAt)` |
| **`CmsBlock`** | Dynamic content blocks for the landing portal | `VARCHAR PK(blockKey)` |
| **`SystemConfig`** | Global runtime configurations (upload caps, rate limits) | `VARCHAR PK(configKey)` |

---

## 5. Cross-Cutting Middleware Layer

```
Incoming Request
       │
       ▼
┌─────────────────────────┐
│       corsOptions       │ ── Rejects unwhitelisted origins
└────────────┬────────────┘
             ▼
┌─────────────────────────┐
│   requestIdMiddleware   │ ── Attaches UUID v4 and X-Request-Id header
└────────────┬────────────┘
             ▼
┌─────────────────────────┐
│     auditMiddleware     │ ── Hooks res.on('finish') for post-response logging
└────────────┬────────────┘
             ▼
┌─────────────────────────┐
│     authMiddleware      │ ── Validates JWT Bearer + checks Redis blacklist
└────────────┬────────────┘
             ▼
┌─────────────────────────┐
│     adminMiddleware     │ ── Enforces req.user.role === 'ADMIN'
└────────────┬────────────┘
             ▼
┌─────────────────────────┐
│  deptAccessMiddleware   │ ── Enforces user department membership (5m Redis cache)
└────────────┬────────────┘
             ▼
┌─────────────────────────┐
│  rateLimiterMiddleware  │ ── Login brute-force (5/15m) & download throttle (100/hr)
└────────────┬────────────┘
             ▼
┌─────────────────────────┐
│ hddAvailabilityMiddle.. │ ── Validates physical mount point accessibility
└────────────┬────────────┘
             ▼
┌─────────────────────────┐
│      Route Handler      │
└────────────┬────────────┘
             ▼
┌─────────────────────────┐
│   globalErrorHandler    │ ── Formats uniform JSON error response
└─────────────────────────┘
```

---

## 6. Core Business Logic Services

### `HddService` ([`src/services/hdd.service.ts`](file:///D:/istrac-fms/backend/src/services/hdd.service.ts))
- **`guardPath(path)`**: Resolves paths against `env.HDD_MOUNT_PATH` and throws `AppError('path_traversal', 400)` if an attempt is made to escape the storage root.
- **`writeFile(destPath, data)`**: Writes to `${destPath}.<random>.tmp` before renaming atomically to avoid partial file writes.
- **`streamFile(filePath)`**: Returns a high-efficiency `ReadableStream` to Express response pipelines.
- **`validateMagicBytes(filePath)`**: Reads the first 8 bytes of files to verify genuine signatures (e.g., `%PDF`, PNG header, JPEG markers, ZIP signatures).

### `FileService` ([`src/services/file.service.ts`](file:///D:/istrac-fms/backend/src/services/file.service.ts))
- Orchestrates multi-step file uploads:
  1. Department & parent folder validation
  2. Physical disk write
  3. SHA-256 computation
  4. Prisma transactional write for `File` + `FileVersion` records
  5. Rollback compensation on error
  6. Non-blocking audit and notification events

### `HddSyncService` ([`src/services/hddSync.service.ts`](file:///D:/istrac-fms/backend/src/services/hddSync.service.ts))
- Runs on boot and every 15 minutes. Walks the physical storage directory tree, compares against database records, flags missing database entries as `status: 'UNREGISTERED'`, and marks database records whose physical files were deleted externally as `status: 'ORPHANED'`.

### `HddHealthService` ([`src/services/hddHealth.service.ts`](file:///D:/istrac-fms/backend/src/services/hddHealth.service.ts))
- Probes the physical mount point every 60 seconds with write/read/unlink tests. On failure, sets `hdd:degraded` in Redis and dispatches an emergency alert to `env.ADMIN_EMAIL`. On recovery, clears flags and sends a recovery notice.

---

## 7. REST API Endpoint Specifications

All endpoints return a uniform JSON response envelope:
```json
{
  "data": { ... },
  "requestId": "c1f7b0f2-7f28-4e50-9d04-9a8c1f0d3e21"
}
```

Error responses:
```json
{
  "error": {
    "code": "department_not_found",
    "message": "Department does not exist or is inactive"
  },
  "requestId": "c1f7b0f2-7f28-4e50-9d04-9a8c1f0d3e21"
}
```

### Route Summary Table

| Method | Endpoint | Auth Level | Description |
|---|---|---|---|
| `POST` | `/auth/register` | Public | Submit registration (status: PENDING) |
| `POST` | `/auth/login` | Public | Authenticate user, issue JWT + httpOnly cookie |
| `POST` | `/auth/refresh` | Public (Cookie) | Rotate refresh token and issue new access token |
| `POST` | `/auth/logout` | Authenticated | Revoke refresh token & blacklist access token |
| `GET` | `/auth/me` | Authenticated | Retrieve profile of authenticated operator |
| `POST` | `/auth/forgot-password` | Public | Dispatch password reset token link |
| `POST` | `/auth/reset-password` | Public | Reset password using verified token |
| `PUT` | `/auth/change-password` | Authenticated | Change active account password |
| `GET` | `/satellites` | Authenticated | List all active satellite stations for UI |
| `GET` | `/admin/satellites` | Admin | List all satellites with department metrics |
| `POST` | `/admin/satellites` | Admin | Register a new satellite ground station |
| `PUT` | `/admin/satellites/:id` | Admin | Update satellite details |
| `DELETE` | `/admin/satellites/:id` | Admin | Soft-deactivate satellite station |
| `GET` | `/departments` | Authenticated | List user's accessible departments |
| `GET` | `/admin/departments` | Admin | List all departments with file & user counts |
| `POST` | `/admin/departments` | Admin | Create department under a satellite |
| `PUT` | `/admin/departments/:id` | Admin | Update department name or folder settings |
| `DELETE` | `/admin/departments/:id` | Admin | Soft-deactivate department |
| `POST` | `/admin/departments/:id/users` | Admin | Grant user `READ_ONLY` or `READ_WRITE` access |
| `DELETE` | `/admin/departments/:id/users/:uid` | Admin | Revoke user department access |
| `GET` | `/admin/users` | Admin | Paginated user roster with search & filters |
| `GET` | `/admin/users/pending` | Admin | Pending registration approval queue |
| `POST` | `/admin/users/:id/approve` | Admin | Approve pending operator registration |
| `POST` | `/admin/users/:id/reject` | Admin | Reject registration with reason |
| `POST` | `/admin/users/:id/suspend` | Admin | Toggle account suspension (revokes tokens) |
| `POST` | `/files/upload` | Authenticated + Dept Access | Single-shot multipart file upload (up to 50MB) |
| `POST` | `/files/upload/chunk` | Authenticated + Dept Access | Upload 10MB chunk to temp storage |
| `POST` | `/files/upload/complete` | Authenticated + Dept Access | Assemble chunks, verify SHA-256, commit file |
| `GET` | `/files/:id/download` | Authenticated + Dept Access | Stream physical file with content disposition |
| `DELETE` | `/files/:id` | Authenticated + Dept Access | Soft-delete file to trash |
| `PUT` | `/files/:id/restore` | Admin | Restore file from trash |
| `GET` | `/files/:id/versions` | Authenticated + Dept Access | Retrieve historical file versions |
| `POST` | `/files/folders` | Authenticated + Dept Access | Create folder node on storage array |
| `GET` | `/departments/:id/files` | Authenticated + Dept Access | Paginated listing of files/folders |
| `GET` | `/departments/:id/tree` | Authenticated + Dept Access | Recursive folder hierarchy tree |
| `GET` | `/search` | Authenticated | RBAC-scoped multi-field search |
| `GET` | `/notifications` | Authenticated | List user notification inbox |
| `PUT` | `/notifications/:id/read` | Authenticated | Mark notification as read |
| `PUT` | `/notifications/read-all` | Authenticated | Mark all notifications read |
| `POST` | `/admin/notifications/broadcast` | Admin | Transmit system broadcast to all users |
| `GET` | `/cms/blocks` | Public | Fetch all landing page content blocks |
| `PUT` | `/cms/blocks/:key` | Admin | Update CMS block and push live update |
| `GET` | `/admin/stats` | Admin | Real-time counts (users, files, storage used) |
| `GET` | `/admin/audit-logs` | Admin | Cursor-paginated audit log viewer |
| `GET` | `/admin/settings` | Admin | System configuration properties |
| `PUT` | `/admin/settings/:key` | Admin | Update system configuration key |
| `GET` | `/health` | Public | Liveness probe (DB, Redis, HDD) |
| `GET` | `/admin/health/hdd` | Admin | Detailed storage mount diagnostics |

---

## 8. Real-Time WebSocket & PubSub Bridge

### Connection & Heartbeat Protocol
- **Endpoint:** `ws://<host>:<port>/ws?token=<accessToken>`
- Handshake validates access token signature via `verifyAccessToken()`. Invalid or expired tokens are immediately rejected with close code `4401`.
- Server sends `{ type: "ping" }` frames every 30 seconds. If a client fails to respond after 3 consecutive intervals, the socket is terminated and removed from the active connection pool.

### Event Dispatch Table

| Event Name | Scope / Target | Trigger Condition |
|---|---|---|
| `NOTIFICATION` | Target `userId` or Broadcast | New user notification or admin broadcast |
| `CMS_UPDATE` | All connected clients | Admin modified a CMS content block |
| `FILE_UPLOAD` | Users assigned to `departmentId` | New file uploaded or version incremented |
| `FILE_DELETED` | Users assigned to `departmentId` | File moved to trash |
| `SYNC_COMPLETE` | Admin users only | Background HDD reconciliation finished |

---

## 9. Background Daemons & Health Monitoring

1. **Storage Availability Probe:** Every 60 seconds (`HddHealthService`) verifies physical directory access and dispatches alerts on failure.
2. **HDD Reconciliation Daemon:** Every 15 minutes (`HddSyncService`) crawls the disk volume to detect unregistered or orphaned files.
3. **Graceful Shutdown Protocol:** On `SIGINT` or `SIGTERM`, the HTTP server ceases accepting new connections, drains existing requests, disconnects from Prisma MySQL, closes all 3 Redis connections, and shuts down cleanly without resource leakage.

---

## 10. Security, Concurrency & Defense-in-Depth

| Threat | Mitigation Mechanism |
|---|---|
| **Directory / Path Traversal** | `hddService.guardPath()` validates all paths against `path.resolve(env.HDD_MOUNT_PATH)`. |
| **Tampered File Uploads** | Magic byte validation inspects binary headers for PDF, PNG, JPG, and ZIP formats. |
| **Brute-Force Authentication** | `loginRateLimiter` enforces 5 attempts per IP per 15 minutes using Redis TTL. |
| **Mass Data Exfiltration** | `downloadRateLimiter` throttles downloads to 100/hr and alerts on >50 downloads in 10 minutes. |
| **Unauthorized Data Access** | `deptAccessMiddleware` checks database permissions with a 5-minute Redis cache. |
| **Stolen Revoked Tokens** | Redis token blacklist checked on every request via `authMiddleware`. |
| **Audit Log Tampering** | `AuditLog` table has no `UPDATE` or `DELETE` API endpoints and uses auto-incrementing IDs. |
