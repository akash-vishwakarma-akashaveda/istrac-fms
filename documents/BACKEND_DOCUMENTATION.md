# ISTRAC-SIMS Backend Architecture & Technical Reference

> **Application:** ISRO Telemetry, Tracking & Command Network — Satellite Information Management System (Backend)
> **Version:** 1.1.0 (V1 Production Baseline)
> **Runtime:** Node.js 20 LTS · TypeScript 5 · ESM (`"type": "module"`)
> **Core Stack:** Express 5 · Prisma 6 (@prisma/adapter-mariadb) · ioredis · jsonwebtoken · bcrypt · multer · nodemailer · ws

---

## 📑 Table of Contents

1. [Server Entry Point & Startup Sequence](#1-server-entry-point--startup-sequence)
2. [Environment Configuration (`src/config/env.ts`)](#2-environment-configuration-srcconfigenvts)
3. [Database Layer — Prisma + MariaDB Adapter (`src/config/db.ts`)](#3-database-layer--prisma--mariadb-adapter-srcconfigdbts)
4. [Redis Configuration — Tri-Instance Pattern (`src/config/redis.ts`)](#4-redis-configuration--tri-instance-pattern-srcconfigredists)
5. [CORS Configuration (`src/config/cors.ts`)](#5-cors-configuration-srcconfigcorsts)
6. [Middleware Pipeline — Ordered Chain](#6-middleware-pipeline--ordered-chain)
7. [Library Modules (`src/lib/`)](#7-library-modules-srclib)
8. [Services Layer (`src/services/`)](#8-services-layer-srcservices)
9. [WebSocket Server (`src/ws/wsServer.ts`)](#9-websocket-server-srcwswsserverts)
10. [Route Inventory — All API Endpoints](#10-route-inventory--all-api-endpoints)
11. [Background Daemons](#11-background-daemons)
12. [Prisma Schema — Data Model Reference](#12-prisma-schema--data-model-reference)
13. [API Response Envelope Standard](#13-api-response-envelope-standard)
14. [Error Codes Reference](#14-error-codes-reference)

---

## 1. Server Entry Point & Startup Sequence

**File:** `src/index.ts` (110 lines)

### Full Middleware Chain (Order is Critical)
```
Request arrives
  ↓
cors(corsOptions)             — Preflight handled; non-matching origins get 204 with no ACAO header
  ↓
express.json({ limit: '50mb' })   — JSON body parsing; 50MB limit for base64 payloads
  ↓
express.urlencoded({ extended: true, limit: '50mb' })   — Form-encoded body parsing
  ↓
cookieParser()               — Parses httpOnly cookies (used for refreshToken extraction)
  ↓
requestIdMiddleware          — Injects UUID v4 req.requestId, echoes as X-Request-Id header
  ↓
httpLoggerMiddleware         — Hooks res.on('finish') to log method/url/status/duration/user
  ↓
auditMiddleware              — Hooks res.on('finish') to write auditLog for POST/PUT/PATCH/DELETE
  ↓
Routes                       — 12 domain routers
  ↓
globalErrorHandler           — 4-argument Express error handler (MUST be last)
```

### BigInt Serialization Patch
```ts
(BigInt.prototype as any).toJSON = function () { return this.toString() }
```
Prisma returns `sizeBytes` as `BigInt` from MariaDB (because file sizes can exceed `Number.MAX_SAFE_INTEGER` for multi-TB storage). This patch makes `JSON.stringify` serialize BigInt values as strings automatically, ensuring correct JSON output without manual `.toString()` calls in every route handler.

### Graceful Shutdown
Both `SIGINT` (Ctrl+C) and `SIGTERM` (PM2 stop, systemctl stop) trigger `shutdown()`:
1. `server.close()` — stops accepting new connections, waits for in-flight requests to complete.
2. `await prisma.$disconnect()` — flushes connection pool and closes database sockets.
3. `redis.disconnect()` / `redisPub.disconnect()` / `redisSub.disconnect()` — closes all 3 ioredis connections.
4. `process.exit(0)` on success, `process.exit(1)` on error.

---

## 2. Environment Configuration (`src/config/env.ts`)

### `required(key)` Guard
Any missing required environment variable throws immediately at startup with a descriptive error message referencing the `.env.example` file. This fails fast — the server never enters a partially-configured state.

### Dual dotenv Load
```ts
dotenv.config({ path: path.resolve(__dirname, '../../.env') })    // dist/ built output
dotenv.config({ path: path.resolve(__dirname, '../../../.env') }) // src/ dev with ts-node
```
Handles both `npm run dev` (runs from `src/`) and `npm start` (runs from `dist/`) without requiring different config file paths.

### Required Variables
| Variable | Type | Description |
| :--- | :--- | :--- |
| `DATABASE_URL` | string | Prisma DSN (`mysql://user:pass@host:3306/db`) |
| `REDIS_URL` | string | ioredis connection URL (`redis://127.0.0.1:6379`) |
| `JWT_SECRET` | string | 256-bit minimum random secret for access tokens |
| `JWT_REFRESH_SECRET` | string | Separate 256-bit secret for refresh tokens |
| `HDD_MOUNT_PATH` | string | Absolute path to storage mount (`/mnt/istrac_data`) |
| `MYSQL_ROOT_PASSWORD` | string | MariaDB root password (required for adapter initialization) |
| `MYSQL_DATABASE` | string | Database name (e.g., `istrac_sims`) |
| `MYSQL_USER` | string | Application database user |
| `MYSQL_PASSWORD` | string | Application database password |
| `MYSQL_HOST` | string | Database hostname (`127.0.0.1`, not `localhost`) |

### Optional Variables with Defaults
| Variable | Default | Description |
| :--- | :--- | :--- |
| `PORT` | `3000` | HTTP listener port |
| `NODE_ENV` | `development` | Controls error verbosity in `globalErrorHandler` |
| `ALLOWED_ORIGINS` | `['http://localhost:5173', 'http://localhost:3000']` | Comma-separated explicit CORS origins. Trimmed, trailing-slash stripped |
| `APP_URL` | `http://localhost:5173` | Base URL for email links (password reset, approval) |
| `SMTP_HOST` | `localhost` | SMTP mail server hostname |
| `SMTP_PORT` | `25` | SMTP port (25 = no-auth local relay, 587 = STARTTLS) |
| `SMTP_USER` | undefined | SMTP auth username (if required) |
| `SMTP_PASS` | undefined | SMTP auth password (if required) |
| `ADMIN_EMAIL` | `admin@istrac.local` | Destination for system alert emails |
| `DEBUG_PRISMA` | `false` | Set `true` to log raw SQL queries via the structured logger |
| `LOG_LEVEL` | `info` | Minimum log level: `debug`, `http`, `info`, `warn`, `error` |

**Why `MYSQL_HOST = 127.0.0.1` not `localhost`?** On Linux, `localhost` resolves to the Unix socket (`/var/run/mysqld/mysqld.sock`). The `@prisma/adapter-mariadb` library uses the TCP protocol, which requires `127.0.0.1` to route correctly through the network stack.

---

## 3. Database Layer — Prisma + MariaDB Adapter (`src/config/db.ts`)

### Why `@prisma/adapter-mariadb` Instead of Standard Prisma MySQL?
Prisma's standard MySQL connector uses a custom protocol implementation that is incompatible with MariaDB's protocol extensions introduced in MariaDB 10.6+ (specifically the `COM_STMT_BULK_EXECUTE` and `OK_PACKET` differences). `@prisma/adapter-mariadb` wraps the `mariadb` native Node.js driver, which is maintained by the MariaDB Corporation and fully protocol-compatible.

### Prisma Client Configuration
```ts
const adapter = new PrismaMariaDb({
  host: env.MYSQL_HOST,
  port: env.MYSQL_PORT || 3306,
  user: env.MYSQL_USER,
  password: env.MYSQL_PASSWORD,
  database: env.MYSQL_DATABASE,
  allowPublicKeyRetrieval: true,  // required for some MariaDB auth plugin configurations
})
```

### SQL Query Logging Gate
```ts
const shouldLogQueries = process.env.DEBUG_PRISMA === 'true'
```
By default, only `warn` and `error` Prisma events are emitted to stdout. When `DEBUG_PRISMA=true`, the query event is wired to emit full SQL with parameters and execution time via `logger.debug('PRISMA', ...)`. This is intentionally opt-in because in production MariaDB generates hundreds of queries per minute from concurrent dashboard polling, which would fill log files and obscure operational events.

---

## 4. Redis Configuration — Tri-Instance Pattern (`src/config/redis.ts`)

Three **separate ioredis client instances** are created from the same `REDIS_URL`:
```ts
export const redis    = new Redis(env.REDIS_URL, redisOptions)  // General cache + rate limiting
export const redisPub = new Redis(env.REDIS_URL, redisOptions)  // Publish only
export const redisSub = new Redis(env.REDIS_URL, redisOptions)  // Subscribe only
```

**Why 3 instances?** A Redis client enters "subscriber mode" the moment `client.subscribe()` or `client.psubscribe()` is called. In subscriber mode, the only valid commands are subscribe/unsubscribe/psubscribe/punsubscribe/ping/quit. Calling any other command (e.g., `redis.get()`, `redis.setex()`) on a subscribed client throws `ERR Can't call 'get' on connection in subscriber mode`. Separating into 3 clients ensures:
- `redis` — free to run `get`, `set`, `incr`, `expire`, `del` at any time.
- `redisPub` — used only for `publish()` calls from services.
- `redisSub` — dedicated subscriber, receives all channel messages and routes them through the `pubsub` module handlers.

### Resilience Settings
```ts
maxRetriesPerRequest: 1     // Fail fast on individual commands rather than hanging
retryStrategy: (times) => times > 3 ? null : Math.min(times * 100, 2000)  // Stop after 3 retries
reconnectOnError: () => false  // Do not auto-reconnect on Redis errors in production
enableOfflineQueue: false    // Reject commands immediately if disconnected (no silently queuing)
```
These settings ensure Redis connectivity issues never cause requests to silently hang waiting for a Redis reply. All middleware that uses Redis has explicit in-memory fallbacks.

---

## 5. CORS Configuration (`src/config/cors.ts`)

### 4-Rule Origin Check (in priority order)
1. **No origin (server-to-server):** `curl`, mobile apps, Postman — always allowed (`callback(null, true)`).
2. **Explicit whitelist:** Origins in `ALLOWED_ORIGINS` env var (exact string match after normalization).
3. **AWS Amplify pattern:** Regex `/\.amplifyapp\.com$/i` — allows all Amplify app preview branches (`<branch>.<app>.amplifyapp.com`).
4. **AWS CloudFront pattern:** Regex `/\.cloudfront\.net$/i` — allows the distribution URL used as CDN origin.
5. **Localhost pattern:** `/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i` — all local dev ports.

**On rejection:** `callback(null, false)` — this allows CORS to properly omit the `Access-Control-Allow-Origin` header, returning a valid HTTP response (no status code). The original bug was `throw new Error(...)` inside the callback, which caused Express to propagate an uncaught exception → HTTP 500.

### Allowed Headers
`Content-Type`, `Authorization`, `X-Requested-With`, `Accept`, `Origin`, `x-request-id`, `Range`

The `Range` header is required to support resumable/partial file downloads from `GET /files/:id/download`.

### Exposed Headers
`Content-Range`, `Accept-Ranges`, `x-request-id`, `Content-Disposition`

These headers must be explicitly exposed in the CORS response so browser JavaScript can read them. `Content-Disposition` is needed so the browser downloads files with the correct filename. `x-request-id` allows the frontend to show request IDs in error UIs.

### Preflight Caching
`maxAge: 86400` — browsers cache preflight responses for 24 hours. This eliminates the OPTIONS preflight call on every API request, significantly reducing perceived latency on the first request of each hour.

---

## 6. Middleware Pipeline — Ordered Chain

### `requestIdMiddleware` (`src/lib/requestId.ts`)
- Generates `crypto.randomUUID()` (UUID v4) on every request.
- Attaches to `req.requestId` for use in route handlers and error responses.
- Sets `X-Request-Id` response header so clients can correlate frontend errors with backend logs.
- **Must run first** — before any middleware that might generate a response (e.g., CORS) so that even error responses include a request ID.

### `httpLoggerMiddleware` (`src/middleware/logger.middleware.ts`)
- Hooks into `res.on('finish', ...)` — logs **after** the response is sent, adding zero latency to response time.
- Skips `OPTIONS` preflight requests to reduce noise.
- Uses `process.hrtime()` for nanosecond-precision timing (`(diff[0] * 1e3 + diff[1] * 1e-6).toFixed(2)` ms).
- Status code color coding: 2xx → green, 3xx → cyan, 4xx → yellow, 5xx → red.
- If `req.user` is populated (by a downstream `authMiddleware` call), logs the user's email and role.

### `auditMiddleware` (`src/middleware/audit.middleware.ts`)
- Hooks into `res.on('finish', ...)` — **non-blocking, zero latency impact**.
- Only fires for mutating HTTP methods: `POST`, `PUT`, `PATCH`, `DELETE`.
- Only records **successful** operations (`statusCode < 400`) — prevents audit log spam from rejected requests.
- Only records **authenticated** operations — anonymous mutations are not audited.
- Derives `action` string: `POST:/files/upload`, `DELETE:/admin/users/:id`, etc.
- Derives `resourceType` from URL segments (handles `/admin/...` prefix intelligently).
- Uses `req.params.id || req.params.userId || req.params.deptId || req.params.fileId` to extract the resource ID.
- Insert is fire-and-forget (`.catch(...)` logs error, never throws).

### `authMiddleware` (`src/middleware/auth.middleware.ts`)
Applied per-route (not globally). Performs:
1. Extracts `Authorization: Bearer <token>` header; throws `AppError(401)` if missing.
2. `verifyAccessToken(token)` — checks JWT signature + expiry using `JWT_SECRET`.
3. `sessionStore.isBlacklisted(token)` — checks Redis blacklist for revoked tokens (handles logout and admin force-invalidation).
4. Populates `req.user = { id, role, email, name }` from decoded JWT payload.

### `optionalAuthMiddleware` (`src/middleware/auth.middleware.ts`)
Same validation as `authMiddleware`, but returns `next()` without error if no token is present. Used on `GET /departments/public/:id` and similar routes that serve both authenticated and anonymous users with different response shapes.

### `adminMiddleware` (`src/middleware/admin.middleware.ts`)
- Single check: `req.user?.role !== 'ADMIN'` → throws `AppError(403)`.
- **Always chained after `authMiddleware`** — assumes `req.user` is already populated.
- Used on all `/admin/...` routes and write operations that require admin privileges.

### `deptAccessMiddleware` (`src/middleware/deptAccess.middleware.ts`)
- Extracts `deptId` from `req.params.deptId`, `req.body.departmentId`, or `req.query.departmentId` (in that priority order).
- `ADMIN` users bypass the check — `req.deptAccessLevel = 'READ_WRITE'` immediately.
- For `MEMBER` users: checks Redis cache key `dept-access:{userId}:{deptId}` first (TTL: 5 minutes).
- On cache miss: queries `UserDepartmentAccess` table, stores result in Redis for 5 minutes.
- `'none'` is cached for denied access to prevent DB hammering on repeated denied requests.
- Sets `req.deptAccessLevel` to `'READ_ONLY'` or `'READ_WRITE'` for downstream route handlers.

### `hddAvailabilityMiddleware` (`src/middleware/hddAvailability.middleware.ts`)
- Guards all upload/download routes.
- Checks Redis key `hdd:available` (TTL: 30s). Cache hit `'ok'` → immediate pass; cache hit `'fail'` → immediate `503`.
- On cache miss: calls `fs.access(HDD_MOUNT_PATH, R_OK | W_OK)`. If path doesn't exist (dev), auto-creates it with `fs.mkdir`.
- On storage failure: caches `'fail'` for 30s, publishes `'admin.alert'` via Redis Pub/Sub, throws `AppError(503)`.
- **Why 30s TTL?** File upload operations are latency-sensitive. A per-request `fs.access()` call adds ~2–5ms on networked NFS mounts. 30s caching limits this to once per window while still detecting storage failures within half a minute.

### `loginRateLimiter` (`src/middleware/rateLimiter.middleware.ts`)
- Key: `rate:login:{clientIP}`. Window: 15 minutes. Limit: 10 attempts (200 in development).
- Uses Redis `INCR` + `EXPIRE` — atomic, no race condition.
- In-memory `Map<string, {count, expiresAt}>` fallback if Redis is offline.
- Returns `Retry-After` header on `429` with seconds remaining in the window.

### `downloadRateLimiter` (`src/middleware/rateLimiter.middleware.ts`)
- Key: `rate:download:{userId}`. Window: 1 hour. Limit: 100 downloads/hour per user.
- Only applies to authenticated users (`req.user` must be set by prior `authMiddleware`).
- Prevents bulk exfiltration of sensitive telemetry documents via automated scripts.

### `globalErrorHandler` (`src/lib/errors.ts`)
Three error classifications (matched in order):

1. **`AppError` (operational):** Known, expected errors thrown by application code. `statusCode >= 500` → `logger.error`, otherwise `logger.warn`. Response: `{ error: { code, message, ?details }, requestId }`.
2. **Prisma known errors:** `PrismaClientKnownRequestError`. Mapped to HTTP status: `P2002` (unique constraint) → 409 Conflict; `P2025` (record not found) → 404 Not Found; others → 500.
3. **Unknown errors (programmer errors):** In development, full message + stack is returned. In production, generic `"An unexpected error occurred"` — internal details never leak.

---

## 7. Library Modules (`src/lib/`)

### `logger.ts` — Structured Color-Coded Logger
**Class `Logger`** with 5 log levels (weight-ordered):
| Level | Weight | ANSI Color | Usage |
| :--- | :--- | :--- | :--- |
| `debug` | 10 | Gray | SQL queries, cache hits, verbose tracing |
| `http` | 20 | Bright Magenta | HTTP request/response events |
| `info` | 30 | Bright Cyan | Startup, daemon events, business actions |
| `warn` | 40 | Bright Yellow | Recoverable errors, CORS rejections, failed retries |
| `error` | 50 | Bright Red | Exceptions, storage failures, database errors |

Each log line format:
```
2026-08-27 10:30:15.234 [HTTP ] [BOOT] 🛰️  ISTRAC-SIMS Backend active on port 3000
```
- `LOG_LEVEL` env var controls minimum level weight. Default `info` → debug logs suppressed.
- `logger.child('TAG')` creates a pre-tagged sub-logger for scoped modules (used in services as `logger.info('HDD-SYNC', ...)`, `logger.error('WEBSOCKET', ...)`).

### `jwt.ts` — Token Signing & Verification
**Access tokens (15-minute TTL):**
```ts
payload = { id, role, email, name, jti: crypto.randomUUID() }
signed with JWT_SECRET
```
**Refresh tokens (7-day TTL):**
```ts
payload = { sub: userId, jti: crypto.randomUUID() }
signed with JWT_REFRESH_SECRET
```
- Both use separate secrets to prevent a compromised refresh token from forging access tokens.
- `jti` (JWT ID) is a `crypto.randomUUID()` in each token for blacklist lookups (`sessionStore.isBlacklisted`).
- `verifyAccessToken` / `verifyRefreshToken` throw `AppError(401)` (not generic `Error`) so `globalErrorHandler` classifies them as operational errors.

### `errors.ts` — `AppError` Class
```ts
class AppError extends Error {
  readonly code: string         // machine-readable error slug
  readonly statusCode: number   // HTTP status code
  readonly details?: unknown    // optional debug details
  readonly isOperational = true // distinguishes from programmer errors
}
```
`Object.setPrototypeOf(this, new.target.prototype)` restores the prototype chain (required in TypeScript when extending built-in classes compiled to ES5 targets).

`Error.captureStackTrace(this, this.constructor)` trims the `AppError` constructor frames from the stack trace for cleaner logs.

### `pubsub.ts` — Redis Pub/Sub Abstraction
```ts
pubsub.publish(channel, object)  // JSON.stringify → redisPub.publish
pubsub.subscribe(channel, handler)  // redisSub.subscribe + in-memory handlers map
```
**In-memory fallback:** If `redisPub.publish` throws (Redis offline), the message is delivered directly to in-memory handlers registered via `pubsub.subscribe`. This keeps notification delivery working in local development without Redis.

### `requestId.ts` — UUID Request Correlation
- Generates `crypto.randomUUID()` (native Node.js — no library).
- Sets `req.requestId` (TypeScript augmented `Request` type) and `X-Request-Id` response header.
- Request IDs appear in every API error response, every audit log entry, and every HTTP log line — enabling full request tracing from browser to database.

---

## 8. Services Layer (`src/services/`)

### `sessionStore.ts` — Token Blacklist & Session Registry
Redis-backed with in-memory `Map` fallback. Uses two key namespaces:

| Operation | Redis Key | TTL |
| :--- | :--- | :--- |
| `set(userId, tokenId)` | `session:{tokenId}` → `userId` | 7 days |
| `get(tokenId)` | `session:{tokenId}` | — |
| `revoke(tokenId)` | Deletes `session:{tokenId}`, sets `blacklist:{tokenId}` → `'1'` | 7 days |
| `isBlacklisted(tokenId)` | Checks `blacklist:{tokenId}` | — |

**Why store by `tokenId` (jti), not `userId`?** A user may have multiple active sessions (browser + mobile + API). Blacklisting by `userId` would invalidate all sessions on logout. Blacklisting by `jti` allows targeted revocation of a single token (e.g., admin force-logout of a specific session) without affecting other concurrent sessions.

### `fileService.ts` — Upload Pipeline Orchestrator
The complete file upload sequence:
```
1. Validate department (active, not deleted)
2. Validate parent folder (if parentId provided)
3. Build physical storage path:
   {hddPath}/{spacecraft}/{parentFolder}/{sanitized_filename}
   - spacecraft: (params.spacecraft || 'GENERAL').replace(/[^a-zA-Z0-9_-]/g, '_')
   - filename: originalName.replace(/[^a-zA-Z0-9._-]/g, '_')
4. Check for existing file at that path:
   → If exists: create versioned path `.v{N}_{filename}`, increment versionCount
   → If new: use destPath directly
5. hddService.writeFile() — atomic temp-file write
6. hddService.computeChecksum() — SHA-256 via Node.js crypto streams
7. hddService.getFileSize() — fs.stat().size
8. prisma.$transaction():
   → Create FileVersion record
   → Create or update File record with new versionCount
   → Create Report record (if metadata: title, spacecraft, category provided)
9. On DB failure: hddService.deleteFile() (compensation — cleans up physical file)
10. auditService.log() → write audit record
11. notificationService.send() → notify department members of new file
```

### `hddService.ts` — Physical Storage Operations
All operations call `guardPath()` first:
```ts
guardPath(targetPath: string): string {
  const resolved = path.resolve(targetPath)
  if (!resolved.startsWith(MOUNT_ROOT)) {
    throw new AppError('path_traversal', 'Invalid storage path access attempt', 400)
  }
  return resolved
}
```
**Why `guardPath`?** Without this check, a malicious request with `parentId` pointing to a folder like `../../etc` could cause file operations outside the storage mount. `path.resolve()` resolves all `..` components before the `startsWith(MOUNT_ROOT)` check.

**Atomic Write Pattern:**
```ts
const tmpPath = `${safeDest}.${crypto.randomBytes(6).toString('hex')}.tmp`
await fs.writeFile(tmpPath, data)
await fs.rename(tmpPath, safeDest)
```
Writing to a temporary file and renaming is atomic on POSIX filesystems. If the write fails midway, the original file (if any) is untouched. Only a fully written file becomes visible under the final path.

**SHA-256 via streaming:**
```ts
const hash = crypto.createHash('sha256')
const stream = createReadStream(safePath)
await pipeline(stream, hash)  // Node.js stream/promises pipeline
return hash.digest('hex')
```
Uses Node.js streams (not loading the whole file into memory) — essential for large telemetry files that may exceed available RAM.

### `hddSyncService.ts` — Storage Reconciliation Daemon
Runs on startup and every 15 minutes thereafter (configurable). Three-phase reconciliation:

**Phase 1 — Disk → DB (Register Unknown Files):**
- Recursively walks `HDD_MOUNT_PATH` with `getFiles(dir)`.
- Skips dotfiles (`.health_probe`, `.gitkeep`, etc.).
- For each disk file not in DB: looks up matching department by `hddPath` prefix, creates a `File` record with `status: 'UNREGISTERED'`, attributed to the first admin user.
- **Why `UNREGISTERED`?** Files copied directly to storage by engineers bypassing the upload portal need to be visible in the UI so admins can formally register/classify them.

**Phase 2 — DB → Disk (Update `lastSynced`):**
- For each disk file already in DB: updates `lastSynced` and `sizeBytes` (handles files modified externally).

**Phase 3 — DB → Disk (Mark Orphaned):**
- Queries all `ACTIVE` files in DB.
- For each DB file whose `hddPath` no longer exists on disk: marks as `status: 'ORPHANED'`.
- **Why `ORPHANED` status?** Hard-deleting DB records for missing files would lose all metadata (uploader, category, version history). `ORPHANED` preserves the record for audit trail and admin investigation.

After sync: publishes `{ completedAt, stats }` to Redis `hdd.sync` channel → `wsServer` relays as `SYNC_COMPLETE` to all admin WebSocket connections.

### `hddHealthService.ts` — Storage Mount Health Probe
Runs every 60 seconds. Write-Read-Delete probe:
```
1. fs.mkdir(mountRoot, { recursive: true })     — ensure mount exists
2. fs.writeFile('.health_probe', 'probe-{ts}')  — test write access
3. fs.readFile('.health_probe', 'utf8')          — test read access
4. fs.unlink('.health_probe')                   — cleanup probe file
```
On failure:
- Sets Redis key `hdd:degraded` with TTL 120s (2 minutes).
- If this is the first failure (`!hasAlerted`): sends admin alert email via `emailService.sendAdminAlert`.
On recovery:
- Clears `hdd:degraded` from Redis.
- If was previously alerted: sends "Storage Recovered" email.

### `notificationService.ts` — DB + Real-Time Notification Delivery
```ts
notificationService.send({ type, category, actorId?, recipientIds[], resourceType?, resourceId?, message, metadata? })
```
Steps:
1. `prisma.notification.createMany()` — batch insert one row per recipient.
2. For each recipient: `pubsub.publish('notification.{userId}', {...})` → Redis → WebSocket.
3. Fire-and-forget: DB and pubsub calls use `.then().catch()` — never blocks the caller.

```ts
notificationService.sendBroadcast(opts)
```
1. Queries all `ACTIVE` users to build `recipientIds`.
2. Calls `send()` for targeted records.
3. Also publishes to `notification.broadcast` channel → delivered to all connected WebSocket clients simultaneously.

### `emailService.ts` — Nodemailer SMTP Client
Configured with:
- `secure: false` — uses STARTTLS upgrade (port 587) or plain (port 25).
- `ignoreTLS: true` — for internal SMTP relays on ISRO intranet that don't use TLS.
- `auth: undefined` if `SMTP_USER` is not set — allows anonymous relay on internal mail servers.

Email methods (all fire-and-forget):
| Method | Trigger | Subject |
| :--- | :--- | :--- |
| `sendApprovalEmail` | Admin approves user | "Your ISTRAC-FMS account has been approved" |
| `sendRejectionEmail` | Admin rejects user | "ISTRAC-FMS Registration Update" |
| `sendSuspensionEmail` | Admin suspends user | "ISTRAC-FMS Account Suspended" |
| `sendPasswordResetEmail` | User requests reset | "ISTRAC-FMS Password Reset" (15-min link) |
| `sendBroadcastEmail` | Admin sends broadcast | BCC to all users, To: ADMIN_EMAIL |
| `sendAdminAlert` | Storage failure/recovery | "[ALERT] {subject}" to ADMIN_EMAIL |

### `auditService.ts` — Append-Only Audit Logger
```ts
auditService.log({ userId?, action, resourceType?, resourceId?, oldValue?, newValue?, ipAddress?, userAgent? })
```
- `safeStringify()` handles `BigInt` values in `oldValue`/`newValue` JSON.
- Fire-and-forget: `.catch(err => console.error(...))` — audit log failures never block the main flow.
- Called directly in routes that need `oldValue`/`newValue` diff recording (e.g., user status changes, file deletions).

### `bootstrapService.ts` — First-Run Provisioning
Called from `AdminRoute POST /admin/bootstrap`. Idempotently creates:
- 6 default satellites: Aditya-L1, Chandrayaan-3, EOS-08, Cartosat-3, Gaganyaan, NISAR.
- 5 default departments: TTC, FDD, MOX, NETRA, GSO — each with `hddPath`, code, and description.
- Creates physical storage directories for each department via `hddService`.
- Sets `system_setup_complete = true` in `SystemConfig`.
- **Idempotent:** uses `upsert` not `create` — safe to call multiple times.

### `searchService.ts` — Full-Text File Search
```ts
searchService.search({ query, userId?, isAdmin?, departmentId?, page?, limit? })
```
- `limit` capped at 100, minimum 1. `page` minimum 1.
- For `MEMBER` users with department ACLs: pre-queries `UserDepartmentAccess` to build `allowedDeptIds` filter.
- Searches across: `name`, `description`, `extension`, `hddPath`, `report.title`, `report.spacecraft`, `department.name`, `department.code`.
- Runs `prisma.file.count` and `prisma.file.findMany` in `Promise.all` for single round-trip.
- Returns `{ results, total, page, limit }` for frontend pagination.

---

## 9. WebSocket Server (`src/ws/wsServer.ts`)

### Connection Architecture
```
HTTP Server (Node.js http.createServer)
  ↓
WebSocketServer({ server, path: '/ws' })
  ↓
wss.on('connection', (ws, req) => { ... })
```
The WS server shares the same TCP port as the HTTP Express server by attaching to the `http.Server` instance. No separate port is needed.

### Client Registry
```ts
const clients = new Map<string, ConnectedClient[]>()
// Key: userId, Value: array (user can have multiple tabs/connections)
```
Each `ConnectedClient`:
```ts
interface ConnectedClient {
  ws: WebSocket
  userId: string
  role: 'ADMIN' | 'MEMBER'
  deptIds: string[]     // user's department memberships at connection time
  missedPings: number   // increments each heartbeat, reset on pong
  heartbeatTimer: NodeJS.Timeout
}
```

### Connection Handshake
1. Parse `token` from query string: `ws://host/ws?token=<accessToken>`.
2. `verifyAccessToken(token)` — throws on invalid/expired → `ws.close(4401, 'Unauthorized')`.
3. Fetch user's department memberships from DB for scoped notifications.
4. Register client in `clients` Map.
5. Start 30s heartbeat interval.

### Heartbeat & Dead Connection Cleanup
```
Every 30s:
  client.missedPings++
  ws.send({ type: 'ping' })
  
On receiving 'pong':
  client.missedPings = 0

If client.missedPings >= 3 (90s silence):
  clearInterval(heartbeatTimer)
  removeClient(client)
  ws.terminate()         ← force close without waiting for TCP FIN
```
**Why 3 missed pings?** Network interruptions (brief mobile signal loss, VPN reconnect) might cause a single missed ping. 3 consecutive misses (90 seconds of silence) reliably indicates a dead connection without being overly aggressive.

### Targeted Send Functions
```ts
sendToUser(userId, event, payload)    // → user's all open tabs
sendToAll(event, payload)             // → every connected client
sendToAdmins(event, payload)          // → clients with role === 'ADMIN'
sendToDeptUsers(deptId, event, payload) // → clients with deptId in their deptIds[] OR role 'ADMIN'
```

### Redis Pub/Sub → WebSocket Bridge
Two subscription types:

**Exact channel subscriptions:**
```ts
redisSub.subscribe('cms.update', 'hdd.sync', 'notification.broadcast')
```
| Redis Channel | WebSocket Event | Audience |
| :--- | :--- | :--- |
| `cms.update` | `CMS_UPDATE` | All clients |
| `hdd.sync` | `SYNC_COMPLETE` | Admin clients only |
| `notification.broadcast` | `NOTIFICATION` | All clients |

**Pattern subscriptions (wildcard):**
```ts
redisSub.psubscribe('notification.*', 'file.*')
```
| Redis Pattern | WebSocket Event | Audience |
| :--- | :--- | :--- |
| `notification.{userId}` | `NOTIFICATION` | Specific user |
| `file.upload.{deptId}` | `FILE_UPLOAD` | Department members + admins |
| `file.deleted.{deptId}` | `FILE_DELETED` | Department members + admins |

---

## 10. Route Inventory — All API Endpoints

### Auth Routes (`src/routes/auth.routes.ts`) — prefix: `/auth`
| Method | Path | Middleware | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/auth/register` | `loginRateLimiter` | Submit access request; creates user with `status: PENDING` |
| `POST` | `/auth/login` | `loginRateLimiter` | Validate credentials; return access token + set `refreshToken` httpOnly cookie |
| `POST` | `/auth/refresh` | — | Read refresh cookie, verify, return new access token |
| `POST` | `/auth/logout` | `authMiddleware` | Revoke current token; clear refresh cookie |
| `GET` | `/auth/me` | `authMiddleware` | Return full user profile + department access list |
| `PUT` | `/auth/change-password` | `authMiddleware` | Change own password (bcrypt 12 rounds) |
| `PUT` | `/auth/force-password-change` | `authMiddleware` | First-login forced change; clears `tempPass` flag |
| `POST` | `/auth/forgot-password` | `loginRateLimiter` | Generate 15-min reset token; email reset link |
| `POST` | `/auth/reset-password` | `loginRateLimiter` | Validate token from email; set new password |

**Login Flow Detail:**
1. Find user by email (`deletedAt: null`).
2. Check `status !== 'ACTIVE'` → 403 with status-specific message.
3. `bcrypt.compare(password, user.passwordHash)` — 12 rounds.
4. `signAccessToken(user)` → 15-min JWT.
5. `signRefreshToken(user.id)` → 7-day JWT.
6. `sessionStore.set(userId, refreshToken.jti)`.
7. `res.cookie('refreshToken', token, { httpOnly: true, secure: NODE_ENV === 'production', sameSite: 'strict', maxAge: 7d })`.
8. Response: `{ accessToken, user }`.

**Refresh Token Rotation:**
- Reads `req.cookies.refreshToken`.
- `verifyRefreshToken(token)` → checks signature + expiry.
- Checks `sessionStore.get(tokenId)` — must be in valid sessions.
- `sessionStore.revoke(oldTokenId)` — invalidate old refresh token.
- Issues new access + refresh token pair.
- Writes new `refreshToken` cookie.

### Department Routes (`src/routes/department.routes.ts`)
| Method | Path | Middleware | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/departments/public` | — | All `isPageEnabled` departments (no auth required) |
| `GET` | `/departments/public/:id` | `optionalAuthMiddleware` | Single department public page with CMS data |
| `GET` | `/departments` | `authMiddleware` | Departments the user has access to |
| `POST` | `/departments` | `authMiddleware`, `adminMiddleware` | Create department |
| `PUT` | `/departments/:id` | `authMiddleware`, `adminMiddleware` | Update department + CMS fields |
| `DELETE` | `/departments/:id` | `authMiddleware`, `adminMiddleware` | Soft-delete department |
| `GET` | `/admin/departments` | `authMiddleware`, `adminMiddleware` | All departments (with filters) |
| `GET` | `/admin/departments/:id` | `authMiddleware`, `adminMiddleware` | Full department detail |
| `POST` | `/admin/departments/:id/users` | `authMiddleware`, `adminMiddleware` | Grant user access to department |
| `DELETE` | `/admin/departments/:id/users/:userId` | `authMiddleware`, `adminMiddleware` | Revoke user department access |

### File Routes (`src/routes/file.routes.ts`)
| Method | Path | Middleware | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/files/upload` | `auth`, `admin`, `deptAccess`, `hddAvail`, `multer(50MB)` | Single-shot file upload |
| `POST` | `/files/upload/chunk` | `auth`, `admin`, `hddAvail`, `multer(10MB/chunk)` | Upload one chunk of chunked transfer |
| `POST` | `/files/upload/complete` | `auth`, `admin`, `hddAvail` | Assemble chunks → final file |
| `GET` | `/files/:id/download` | `auth`, `downloadRateLimiter` | Stream file from HDD with `Content-Disposition` header |
| `GET` | `/files/:id/stream` | `optionalAuth` | Streaming preview (supports `Range` header for video seek) |
| `GET` | `/files/:id/versions` | `auth` | File version history array |
| `DELETE` | `/files/:id` | `auth`, `admin` | Soft-delete file (sets `deletedAt`) |
| `PUT` | `/files/:id/restore` | `auth`, `admin` | Restore soft-deleted file (clears `deletedAt`) |
| `POST` | `/files/folders` | `auth`, `admin`, `deptAccess` | Create named folder node |
| `GET` | `/admin/files/repository-list` | `auth`, `admin` | Flat file list with search/filter for CMS picker |
| `GET` | `/admin/files/orphaned` | `auth`, `admin` | Files with `status: 'ORPHANED'` |
| `GET` | `/admin/files/unregistered` | `auth`, `admin` | Files auto-discovered by HDD sync |

### User Routes (`src/routes/user.routes.ts`)
| Method | Path | Middleware | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/admin/users` | `auth`, `admin` | Paginated user roster with filters |
| `GET` | `/admin/users/pending` | `auth`, `admin` | Users with `status: 'PENDING'` |
| `POST` | `/admin/users/:id/approve` | `auth`, `admin` | Approve + grant department access |
| `POST` | `/admin/users/:id/reject` | `auth`, `admin` | Reject with optional reason |
| `POST` | `/admin/users/:id/suspend` | `auth`, `admin` | Suspend active user |
| `POST` | `/admin/users/:id/restore` | `auth`, `admin` | Reinstate suspended user |
| `POST` | `/admin/users/:id/reset-password` | `auth`, `admin` | Generate temp password, set `tempPass: true` |
| `PUT` | `/admin/users/:id` | `auth`, `admin` | Update user details |
| `DELETE` | `/admin/users/:id` | `auth`, `admin` | Soft-delete user |
| `GET` | `/user/mission-overview` | `auth` | KPI summary for logged-in user's dashboard |
| `PUT` | `/user/profile` | `auth` | Update own profile fields |

### Browse Routes (`src/routes/browse.routes.ts`)
| Method | Path | Middleware | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/departments/:deptId/files` | `auth`, `deptAccess` | Paginated file listing within a folder |
| `GET` | `/departments/:deptId/tree` | `auth`, `deptAccess` | Recursive folder tree JSON |
| `GET` | `/search` | `auth` | Full-text search via `searchService` |

### Notification Routes (`src/routes/notification.routes.ts`)
| Method | Path | Middleware | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/notifications` | `auth` | Paginated notification inbox |
| `PUT` | `/notifications/:id/read` | `auth` | Mark single notification as read |
| `PUT` | `/notifications/read-all` | `auth` | Mark all as read |
| `DELETE` | `/notifications/:id` | `auth` | Delete notification |

### Event Routes (`src/routes/event.routes.ts`)
| Method | Path | Middleware | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/events` | `auth` | List events (filterable by status, type, satellite, department) |
| `GET` | `/events/active-banner` | — | Public: events with `showOnBanner: true` + active broadcasts |
| `POST` | `/events` | `auth`, `admin` | Create mission event |
| `PUT` | `/events/:id` | `auth`, `admin` | Update event |
| `DELETE` | `/events/:id` | `auth`, `admin` | Delete event |

### CMS Routes (`src/routes/cms.routes.ts`)
| Method | Path | Middleware | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/cms/blocks` | — | All CMS key-value blocks (public) |
| `PUT` | `/cms/blocks/:key` | `auth`, `admin` | Update a CMS block; publishes `cms.update` to Redis |

### Satellite Routes (`src/routes/satellite.routes.ts`)
| Method | Path | Middleware | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/satellites` | `auth` | List all satellites |
| `POST` | `/admin/satellites` | `auth`, `admin` | Create satellite record |
| `PUT` | `/admin/satellites/:id` | `auth`, `admin` | Update satellite |
| `DELETE` | `/admin/satellites/:id` | `auth`, `admin` | Soft-delete satellite |

### Admin Routes (`src/routes/admin.routes.ts`)
| Method | Path | Middleware | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/admin/stats` | `auth`, `admin` | 8-query parallel stats: users, files, depts, storage bytes, pending users, recent files, recent logs |
| `GET` | `/admin/audit-logs` | `auth`, `admin` | Cursor-paginated audit log with filters |
| `GET` | `/admin/settings` | `auth`, `admin` | All SystemConfig key-value pairs |
| `PUT` | `/admin/settings/:key` | `auth`, `admin` | Update a config value |
| `POST` | `/admin/notifications/broadcast` | `auth`, `admin` | Trigger system-wide broadcast notification |
| `GET` | `/admin/drives` | `auth`, `admin` | Detected system drives via `driveDetectorService` |
| `POST` | `/admin/bootstrap` | `auth`, `admin` | First-run setup: create satellites, depts, storage dirs |

### Health Routes (`src/routes/health.routes.ts`)
| Method | Path | Middleware | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/health` | — | Public liveness probe: DB + Redis + HDD → `{status, db, redis, hdd}` |
| `GET` | `/admin/health/hdd` | `auth`, `admin` | Detailed HDD status: mounted flag + `isDegraded` from Redis |

### Report Preset Routes (`src/routes/reportPreset.routes.ts`)
CRUD for `ReportCategoryPreset` and `NamingPreset` — used in upload workflow to autocomplete category and filename pattern fields.

---

## 11. Background Daemons

Two daemons are started at boot from `src/index.ts`:

### `startHddHealthService()` — Storage Mount Health Probe
- Interval: **every 60 seconds**.
- Actions: write/read/delete probe file at `{HDD_MOUNT_PATH}/.health_probe`.
- Alert: emails `ADMIN_EMAIL` on first failure; emails recovery notice when restored.
- Redis: `hdd:degraded` key with 120s TTL used as a circuit breaker by `hddAvailabilityMiddleware`.

### `startHddSyncService(15)` — Storage Reconciliation
- Interval: **every 15 minutes**.
- Runs immediately on startup, then on interval.
- Guard: `if (syncTimer) return` — idempotent, never spawns two simultaneous sync timers.
- Publishes `hdd.sync` to Redis on completion → WebSocket `SYNC_COMPLETE` to admin clients.

---

## 12. Prisma Schema — Data Model Reference

### Core Models

**`User`**
```
id, name, designation, email, employeeId, phone, passwordHash,
role (ADMIN|MEMBER), status (PENDING|ACTIVE|SUSPENDED|REJECTED),
departmentPreference, reasonForAccess, tempPass (bool),
lastLogin, createdAt, deletedAt
```

**`Department`**
```
id, satelliteId (→Satellite), name, code, description,
hddPath, isActive, allowUserFolderCreation, maxFolderDepth,
pageTitle, pageAbout, pageLeadOfficer, pageLeadRole, pageContact,
pageBannerUrl, isPageEnabled,
createdAt, updatedAt, deletedAt
```

**`File`**
```
id, departmentId (→Department), reportId (→Report?),
parentId (→File? self-relation for folders), nodeType (FILE|FOLDER),
name, hddPath, sizeBytes (BigInt), mimeType, extension,
sha256, status (ACTIVE|UNREGISTERED|ORPHANED|DELETED),
description, versionCount, uploaderId (→User),
lastSynced, deletedAt, createdAt, updatedAt
```

**`FileVersion`**
```
id, fileId (→File), versionNum, hddPath, sizeBytes (BigInt),
sha256, uploadedBy (→User), createdAt
```

**`Report`** (optional metadata for uploaded files)
```
id, fileId (→File), title, spacecraft, category
(SPECIAL_OPERATIONS|ANOMALY|STUDY|DAILY_REPORT|OTHER),
classificationLevel, versionLabel, reportNumber, createdAt
```

**`Satellite`**
```
id, name, code (unique), noradId, orbitType,
status (ACTIVE|INACTIVE|DECOMMISSIONED), description,
createdAt, deletedAt
```

**`UserDepartmentAccess`**
```
id, userId (→User), departmentId (→Department),
accessLevel (READ_ONLY|READ_WRITE), createdAt, deletedAt
```

**`AuditLog`**
```
id (BigInt autoincrement), userId (→User?), action,
resourceType, resourceId, oldValue (JSON string), newValue (JSON string),
ipAddress, userAgent, createdAt
```
**Why `BigInt` for `id`?** The audit log is append-only and high-volume. Regular ISRO operations generate thousands of records per day. A 32-bit `INT` (`~2.1 billion`) would be exhausted within years. `BigInt` (`BIGINT UNSIGNED` in MariaDB — ~18.4 quintillion rows) is effectively unlimited.

**`Notification`**
```
id, userId (→User), type, category, actorId (→User?),
resourceType, resourceId, message, metadata (JSON string),
isRead (bool), createdAt
```

**`MissionEvent`**
```
id, title, description, eventType
(MISSION_PASS|LAUNCH|ORBIT_MANEUVER|MAINTENANCE|SEMINAR|ANOMALY),
satelliteId (→Satellite?), departmentId (→Department?),
eventDate, endDate, location, urgency (NORMAL|IMPORTANT|CRITICAL),
status (UPCOMING|IN_PROGRESS|COMPLETED|CANCELLED),
showOnBanner (bool), createdAt, updatedAt
```

**`SystemConfig`**
```
key (unique), value (string), updatedAt
```
Known config keys: `system_setup_complete`, `maintenance_mode`, `max_upload_mb`.

**`CmsBlock`**
```
key (unique), data (JSON string), updatedAt
```
Known keys: `hero`, `announcements`, `about`, `contact`, `featured_reports`, `divisions`.

**`ReportCategoryPreset`** / **`NamingPreset`**
Admin-defined autocomplete suggestions for the upload form.

---

## 13. API Response Envelope Standard

Every successful API response uses this structure:
```json
{
  "data": { ... },
  "requestId": "550e8400-e29b-41d4-a716-446655440000"
}
```

For list responses with pagination:
```json
{
  "data": [ ... ],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 157,
    "hasNext": true
  },
  "requestId": "..."
}
```

For cursor-paginated responses (audit logs):
```json
{
  "data": [ ... ],
  "nextCursor": "9876543",
  "hasMore": true,
  "requestId": "..."
}
```

Every error response:
```json
{
  "error": {
    "code": "not_found",
    "message": "Resource not found",
    "details": "Optional debug info (dev only)"
  },
  "requestId": "..."
}
```

---

## 14. Error Codes Reference

| Code | HTTP Status | Source | Description |
| :--- | :--- | :--- | :--- |
| `missing_token` | 401 | `authMiddleware` | No Bearer token in Authorization header |
| `token_invalid` | 401 | `jwt.ts` | JWT signature invalid or expired |
| `token_revoked` | 401 | `authMiddleware` | Token found in Redis blacklist |
| `refresh_token_invalid` | 401 | `jwt.ts` | Refresh token invalid or expired |
| `unauthorized` | 401 | `authMiddleware` | Generic auth failure |
| `forbidden` | 403 | `adminMiddleware` | User is not ADMIN |
| `dept_access_denied` | 403 | `deptAccessMiddleware` | User not in department's access list |
| `account_inactive` | 403 | `auth.routes.ts` | User `status` is not `ACTIVE` |
| `missing_fields` | 400 | various routes | Required body field absent |
| `invalid_credentials` | 400 | `auth.routes.ts` | Wrong email or password |
| `path_traversal` | 400 | `hddService.guardPath` | Storage path escapes mount root |
| `missing_department` | 400 | `deptAccessMiddleware` | No department ID provided |
| `user_exists` | 409 | `auth.routes.ts` | Email or employeeId already registered |
| `conflict` | 409 | `globalErrorHandler` | Prisma `P2002` unique constraint |
| `not_found` | 404 | `globalErrorHandler` | Prisma `P2025` record not found |
| `department_not_found` | 404 | `fileService` | Department inactive or missing |
| `parent_not_found` | 404 | `fileService` | Parent folder node missing |
| `file_not_found` | 404 | `hddService.streamFile` | Physical file absent from storage mount |
| `rate_limit_exceeded` | 429 | `loginRateLimiter` | >10 login attempts in 15 minutes |
| `download_limit_exceeded` | 429 | `downloadRateLimiter` | >100 downloads/hour |
| `hdd_unavailable` | 503 | `hddAvailabilityMiddleware` | Storage mount not accessible |
| `database_error` | 500 | `globalErrorHandler` | Unhandled Prisma error |
| `internal_error` | 500 | `globalErrorHandler` | Unhandled programmer error |
