# ISTRAC-SIMS Backend — Security Audit & Improvement Guide

> **Scope:** Complete security review of `backend/src/**` against OWASP Top 10 (2021), NIST SP 800-53, and ISRO government-grade information security standards.
> **Review Date:** 2026-08-27
> **Auditor:** Internal engineering review
> **Severity Levels:** 🔴 Critical · 🟠 High · 🟡 Medium · 🟢 Low · 🔵 Improvement

---

## 📑 Table of Contents

1. [What Is Already Secure (Do Not Remove)](#1-what-is-already-secure-do-not-remove)
2. [Security Gaps by Category](#2-security-gaps-by-category)
   - [A. Input Validation & Sanitization](#a-input-validation--sanitization)
   - [B. Authentication & Session Management](#b-authentication--session-management)
   - [C. Authorization & Access Control](#c-authorization--access-control)
   - [D. File Upload & Storage Security](#d-file-upload--storage-security)
   - [E. Rate Limiting & Abuse Prevention](#e-rate-limiting--abuse-prevention)
   - [F. HTTP Security Headers](#f-http-security-headers)
   - [G. Data Exposure & Information Leakage](#g-data-exposure--information-leakage)
   - [H. Logging & Monitoring Gaps](#h-logging--monitoring-gaps)
   - [I. Dependency & Supply-Chain Security](#i-dependency--supply-chain-security)
   - [J. Infrastructure & Deployment Hardening](#j-infrastructure--deployment-hardening)
3. [Prioritized Fix Roadmap](#3-prioritized-fix-roadmap)
4. [Code Implementation Guide for Each Fix](#4-code-implementation-guide-for-each-fix)
5. [Security Standards Checklist](#5-security-standards-checklist)

---

## 1. What Is Already Secure (Do Not Remove)

Before listing gaps, document what is correctly implemented. These are **production-grade decisions** that must be preserved:

| Control | Implementation | Standard |
| :--- | :--- | :--- |
| **Dual JWT secrets** | `JWT_SECRET` (access) + `JWT_REFRESH_SECRET` (refresh) are separate keys | NIST SP 800-63B |
| **Refresh token hashing** | Raw token stored only in browser cookie; SHA-256 hash stored in DB | OWASP Session Management |
| **Refresh token rotation** | Old token revoked atomically on every refresh — prevents token replay | OWASP ASVS V3.3 |
| **httpOnly + SameSite cookie** | `httpOnly: true, sameSite: 'strict'` on refresh cookie | OWASP ASVS V3.4 |
| **Secure cookie in production** | `secure: env.NODE_ENV === 'production'` — HTTPS-only in prod | OWASP ASVS V3.4 |
| **Password reset invalidation** | On password change/reset, all refresh tokens are revoked in a single DB transaction | OWASP ASVS V3.3 |
| **bcrypt 12 rounds** | `bcrypt.hash(password, 12)` — exceeds OWASP minimum of 10 rounds | OWASP ASVS V2.4 |
| **Path traversal guard** | `hddService.guardPath()` — `path.resolve().startsWith(MOUNT_ROOT)` on every file op | OWASP A01 |
| **Atomic file writes** | Temp file + `fs.rename()` prevents corrupted partial files | File system integrity |
| **SHA-256 checksums** | Every uploaded file gets a SHA-256 hash verified on both client and server | Data integrity |
| **Token blacklist** | Redis `blacklist:{token}` checked on every authenticated request | OWASP ASVS V3.3 |
| **IP-based login rate limit** | 10 attempts / 15 min per IP, Redis-backed with in-memory fallback | OWASP ASVS V2.2 |
| **Download rate limit** | 100 downloads/hour per user | Abuse prevention |
| **Forgot-password: no user enumeration** | Always returns same message regardless of whether email exists | OWASP ASVS V2.5 |
| **Admin middleware is server-side** | `adminMiddleware` runs on every admin route — never trusts client role claim | OWASP A01 |
| **Department ACL caching** | Redis cache with DB fallback — not just client-side gating | OWASP A01 |
| **Append-only audit log** | `BigInt` autoincrement ID, no `deletedAt`, fire-and-forget | NIST AU-9 |
| **HDD availability circuit breaker** | 30s Redis TTL prevents repeated slow `fs.access` on failed mount | Availability |
| **Error detail stripping in production** | `globalErrorHandler` returns `"An unexpected error occurred"` without stack trace | OWASP A05 |
| **CORS: null callback not error** | `callback(null, false)` — rejected origins get proper response, not 500 | OWASP A05 |
| **Content-Disposition on download** | `attachment; filename="{encodeURIComponent(name)}"` prevents MIME sniffing runs | OWASP A05 |
| **Cursor pagination on audit logs** | `BigInt` cursor — prevents `LIMIT OFFSET` enumeration attacks on large datasets | Performance + security |

---

## 2. Security Gaps by Category

---

### A. Input Validation & Sanitization

#### 🔴 A1 — No Zod/Joi Schema Validation on Request Bodies
**File:** Every route in `src/routes/*.ts`

**Current state:** Routes destructure `req.body` directly with no type enforcement:
```ts
// auth.routes.ts line 21
const { name, designation, email, employeeId, password, phone, departmentPreference, reasonForAccess } = req.body
if (!name || !email || !password) { ... } // Only basic presence check
```

**Risk:** 
- No type coercion — `name` could be an object `{}` instead of a string, causing Prisma to throw unhandled exceptions.
- No max-length enforcement — a 10MB `name` field will be accepted and stored.
- No email format validation — `"notanemail"` will be stored and break email delivery.
- No integer validation — `req.query.page = "999999999"` skips the `Math.max(1, ...)` guard and causes the DB to scan billions of rows.

**Fix:** Add `zod` schema validation middleware. See Section 4 for implementation.

---

#### 🟠 A2 — Unvalidated `status` and `role` Query Parameters
**File:** `src/routes/user.routes.ts` lines 22-29

**Current state:**
```ts
const status = req.query.status  // any string
const role   = req.query.role    // any string
const where  = { ...(status && { status }), ...(role && { role }) }
```

**Risk:** An attacker sending `status=ACTIVE'; DROP TABLE User; --` won't cause SQL injection (Prisma uses parameterized queries), but sending `status=NONEXISTENT_ENUM` causes a Prisma validation error that leaks the valid enum values in the error message in development mode.

**Fix:** Whitelist allowed values:
```ts
const VALID_STATUSES = ['PENDING', 'ACTIVE', 'SUSPENDED', 'REJECTED'] as const
const VALID_ROLES = ['ADMIN', 'MEMBER'] as const
const status = VALID_STATUSES.includes(req.query.status as any) ? req.query.status : undefined
const role   = VALID_ROLES.includes(req.query.role as any) ? req.query.role : undefined
```

---

#### 🟠 A3 — No Password Strength Enforcement on Server Side
**File:** `src/routes/auth.routes.ts` (register, change-password, reset-password)

**Current state:** Password is only checked for presence (`!password`). No minimum length, no complexity requirements.

**Risk:** Users can set `"a"` as their password. The frontend shows a `PasswordStrengthMeter` but this is purely decorative — a direct API call bypasses it completely.

**Fix:** Server-side validation (NIST SP 800-63B Section 5.1.1 minimums):
```ts
function validatePassword(password: string): void {
  if (password.length < 10) throw new AppError('weak_password', 'Password must be at least 10 characters', 400)
  if (!/[A-Z]/.test(password)) throw new AppError('weak_password', 'Password must contain an uppercase letter', 400)
  if (!/[0-9]/.test(password)) throw new AppError('weak_password', 'Password must contain a number', 400)
  if (!/[^A-Za-z0-9]/.test(password)) throw new AppError('weak_password', 'Password must contain a special character', 400)
}
```

---

#### 🟡 A4 — Missing `email` Format Validation
**File:** `src/routes/auth.routes.ts` line 43

**Current state:** `email.trim().toLowerCase()` is stored but never validated as a valid email format.

**Risk:** `"notanemail"` gets stored, email delivery fails silently for that user.

**Fix:** Use a simple regex or the `zod` `.email()` validator:
```ts
const emailRegex = /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/
if (!emailRegex.test(email)) throw new AppError('invalid_email', 'Invalid email format', 400)
```

---

#### 🟡 A5 — Chunk Assembly Reads ALL Chunks into RAM
**File:** `src/routes/file.routes.ts` lines 202-213

**Current state:**
```ts
const chunkBuffers: Buffer[] = []
for (let i = 0; i < totalChunks; i++) {
  const buf = await fs.readFile(chunkPath) // reads each 5MB chunk into memory
  chunkBuffers.push(buf)
}
const fullBuffer = Buffer.concat(chunkBuffers) // ALL chunks in RAM at once
```

**Risk:** A 500MB file assembled from 100 × 5MB chunks loads all 500MB into Node.js heap simultaneously. With concurrent uploads this causes OOM crashes.

**Fix:** Use streaming concatenation via `fs.createWriteStream` and `pipeline`:
```ts
const outPath = path.join(env.HDD_MOUNT_PATH, '.tmp', `${departmentId}_${safeName}`)
const outStream = fs.createWriteStream(outPath)
for (let i = 0; i < totalChunks; i++) {
  const chunkPath = path.join(chunksDir, `part_${String(i).padStart(5, '0')}`)
  await pipeline(createReadStream(chunkPath), outStream, { end: false })
}
outStream.end()
// then pass outPath to fileService.uploadFileFromPath() instead of Buffer
```

---

#### 🟡 A6 — No `totalChunks` Upper Bound Check
**File:** `src/routes/file.routes.ts` lines 192-235

**Current state:** `totalChunks` is accepted from the request body with no maximum. A malicious actor could send `totalChunks: 99999999` causing the assembly loop to run for billions of iterations.

**Fix:**
```ts
const totalChunksNum = Number(totalChunks)
if (!Number.isInteger(totalChunksNum) || totalChunksNum < 1 || totalChunksNum > 1000) {
  throw new AppError('invalid_chunk_count', 'totalChunks must be between 1 and 1000', 400)
}
```

---

### B. Authentication & Session Management

#### 🟠 B1 — Access Token Blacklist Uses Full Token as Redis Key
**File:** `src/routes/auth.routes.ts` lines 266-271

**Current state:**
```ts
await redis.setex(`blacklist:${token}`, 900, 'revoked')
// token is the full raw JWT string (~600+ bytes)
```

**Risk:** Redis stores the full JWT as a key. A JWT is 600+ bytes. With thousands of logout events per day, Redis key memory usage becomes large. More critically, the key TTL is hardcoded to 900 seconds (15 minutes) instead of matching the token's actual remaining lifetime — a token with 14 minutes left could still be usable for 14 minutes after logout.

**Fix:** Extract the `jti` claim from the decoded token and blacklist by `jti` only (36 bytes UUID vs 600+ bytes JWT):
```ts
import { verifyAccessToken } from '../lib/jwt.js'
const decoded = verifyAccessToken(token) // already verified by authMiddleware
const remainingTtl = Math.ceil((decoded.exp! - Date.now() / 1000))
if (remainingTtl > 0) {
  await redis.setex(`blacklist:${decoded.jti}`, remainingTtl, '1')
}
```
**Note:** `authMiddleware` also needs to be updated to check `blacklist:{payload.jti}` instead of `blacklist:{rawToken}`.

---

#### 🟡 B2 — No Concurrent Session Limit Per User
**File:** `src/routes/auth.routes.ts` (login endpoint), `src/ws/wsServer.ts`

**Current state:** A single user can have an unlimited number of concurrent active refresh tokens stored in the `RefreshToken` table. There is no cap.

**Risk:** A compromised credential used from many locations simultaneously goes undetected. Also, the `clients` Map in `wsServer.ts` stores `ConnectedClient[]` per user — many concurrent connections from the same user could be a sign of session sharing or token theft.

**Fix (ISRO security policy: max 3 concurrent sessions):**
```ts
// In login handler, after bcrypt.compare succeeds:
const activeSessionCount = await prisma.refreshToken.count({
  where: { userId: user.id, revoked: false, expiresAt: { gt: new Date() } },
})
if (activeSessionCount >= 3) {
  // Revoke oldest session to enforce limit
  const oldest = await prisma.refreshToken.findFirst({
    where: { userId: user.id, revoked: false },
    orderBy: { createdAt: 'asc' },
  })
  if (oldest) {
    await prisma.refreshToken.update({ where: { id: oldest.id }, data: { revoked: true, revokedAt: new Date() } })
  }
}
```

---

#### 🟡 B3 — `change-password` Does Not Revoke Access Token
**File:** `src/routes/auth.routes.ts` lines 429-438

**Current state:** Password change revokes all refresh tokens (✅ correct) but does NOT blacklist the currently active access token. The access token remains valid for up to 15 minutes after a password change.

**Risk:** If a user changes their password because they suspect account compromise, the attacker's stolen access token is still valid for ~15 minutes.

**Fix:** After revoking refresh tokens, also blacklist the current access token:
```ts
const decoded = verifyAccessToken(req.headers.authorization!.slice(7))
const remainingTtl = Math.ceil(decoded.exp! - Date.now() / 1000)
if (remainingTtl > 0) {
  await redis.setex(`blacklist:${decoded.jti}`, remainingTtl, '1')
}
```

---

#### 🟢 B4 — `secure` Cookie Flag Not Set in Development
**File:** `src/routes/auth.routes.ts` lines 148-153

**Current state:** `secure: env.NODE_ENV === 'production'` — correct for production, but the comment should note this means the cookie is transmitted in plaintext over HTTP in development.

**Note:** This is acceptable for local dev but must never be deployed to a test/staging environment that operates over HTTP. Add an explicit check for `NODE_ENV !== 'development'` if you have a staging environment over HTTPS.

---

### C. Authorization & Access Control

#### 🔴 C1 — `DELETE /files/:fileId` Missing `adminMiddleware` — Members Can Delete
**File:** `src/routes/file.routes.ts` line 293

**Current state:**
```ts
router.delete('/files/:fileId', authMiddleware, async (req, res, next) => {
  // No adminMiddleware!
  // Then: inline role check
  if (req.user!.role !== 'ADMIN') {
    const hasAccess = await prisma.userDepartmentAccess.findFirst({...})
    if (!hasAccess || hasAccess.accessLevel !== 'READ_WRITE') {
      throw new AppError('permission_denied', ...)
    }
  }
  await fileService.softDeleteFile(file.id, req.user!.id)
})
```

**Risk:** The inline access-level check grants file deletion to any `MEMBER` with `READ_WRITE` access. According to the application's own role model, **all file mutations (upload, delete, restore) should require `ADMIN`**. A member with `READ_WRITE` access is able to delete any file they can see in their department.

**Fix:**
```ts
router.delete('/files/:fileId', authMiddleware, adminMiddleware, async (req, res, next) => {
  // Remove the inline role check — adminMiddleware guarantees req.user.role === 'ADMIN'
```

---

#### 🟠 C2 — `GET /files/:fileId/versions` Has No Department Access Check
**File:** `src/routes/file.routes.ts` lines 348-375

**Current state:**
```ts
router.get('/files/:fileId/versions', authMiddleware, async (req, res, next) => {
  const versions = await prisma.fileVersion.findMany({ where: { fileId, deletedAt: null } })
  // No check: is req.user allowed to see this file's department?
```

**Risk:** Any authenticated user (`MEMBER` in another department) can read version history (including SHA-256 hashes and uploader names) for any file by guessing its UUID.

**Fix:** Add department access verification after fetching the parent file:
```ts
const file = await prisma.file.findUnique({ where: { id: fileId }, select: { departmentId: true } })
if (!file) throw new AppError('file_not_found', 'File not found', 404)
if (req.user!.role !== 'ADMIN') {
  const hasAccess = await prisma.userDepartmentAccess.findFirst({
    where: { userId: req.user!.id, departmentId: file.departmentId, deletedAt: null },
  })
  if (!hasAccess) throw new AppError('dept_access_denied', 'No access to this department', 403)
}
```

---

#### 🟠 C3 — `POST /files/folders` Missing `adminMiddleware`
**File:** `src/routes/file.routes.ts` line 380

**Current state:**
```ts
router.post('/files/folders', authMiddleware, deptAccessMiddleware, async (req, res, next) => {
```

**Risk:** Any authenticated `MEMBER` with `READ_WRITE` department access can create folder nodes. The application's design intent (as seen in the frontend) is that folder creation is an admin operation. Members see `allowUserFolderCreation` department config but `deptAccessMiddleware` alone doesn't check this config field.

**Fix:** Either add `adminMiddleware` or check the department's `allowUserFolderCreation` flag:
```ts
// Option A: Admin-only
router.post('/files/folders', authMiddleware, adminMiddleware, deptAccessMiddleware, ...)

// Option B: Respect department config
const dept = await prisma.department.findUnique({ where: { id: departmentId }, select: { allowUserFolderCreation: true, maxFolderDepth: true } })
if (!dept?.allowUserFolderCreation && req.user!.role !== 'ADMIN') {
  throw new AppError('forbidden', 'Folder creation is restricted for this department', 403)
}
```

---

#### 🟡 C4 — No IDOR Protection on `PUT /admin/settings/:key`
**File:** `src/routes/admin.routes.ts` lines 195-239

**Current state:** Any value can be stored for any config key with no allowlist. An admin can set `configKey = "DATABASE_URL"` which would store a misleading value but not actually override the in-process `env` object. More critically, `configKey` containing path injection characters could be exploited if config keys are ever used in file paths.

**Fix:** Whitelist allowed configuration keys:
```ts
const ALLOWED_CONFIG_KEYS = new Set([
  'maxUploadSizeBytes', 'allowedExtensions', 'virusScanEnabled',
  'guestAccessExpiryDays', 'hddSyncIntervalMinutes', 'downloadRateLimitPerHour',
  'maintenance_mode', 'system_setup_complete',
])
if (!ALLOWED_CONFIG_KEYS.has(key)) {
  throw new AppError('invalid_config_key', 'Unknown configuration key', 400)
}
```

---

#### 🟡 C5 — `GET /files/:fileId/download` — No Soft-Delete Check on File Status
**File:** `src/routes/file.routes.ts` line 251

**Current state:**
```ts
const file = await prisma.file.findUnique({ where: { id: fileId, deletedAt: null } })
```

This correctly filters out soft-deleted files. However, files with `status: 'ORPHANED'` or `status: 'UNREGISTERED'` can still be downloaded by any authenticated user with department access.

**Fix:** Add status check:
```ts
const file = await prisma.file.findUnique({ where: { id: fileId, deletedAt: null, status: 'ACTIVE' } })
if (!file || file.nodeType === 'FOLDER') throw new AppError('file_not_found', 'File not found', 404)
```

---

### D. File Upload & Storage Security

#### 🔴 D1 — No File Type Allowlist (MIME Type / Extension Validation)
**File:** `src/routes/file.routes.ts` lines 32-84, `src/services/file.service.ts`

**Current state:** Multer accepts any file type. The upload pipeline stores whatever MIME type Multer detected from the HTTP Content-Type header. No validation against an allowlist is performed.

**Risk (Critical for ISRO):**
- An attacker uploads a `.php` or `.js` executable file. If Nginx is configured with `try_files` pointing into the storage mount, the file could be served and executed.
- A `.html` file upload + social engineering can deliver XSS via direct download URLs.
- `.exe`, `.bat`, `.sh` files could be weaponized if downloaded and executed by internal users.

**Fix:** Validate both MIME type and extension against an allowlist in `fileService.uploadFile`:
```ts
const ALLOWED_EXTENSIONS = new Set([
  'pdf', 'docx', 'doc', 'xlsx', 'xls', 'pptx', 'ppt',
  'csv', 'txt', 'md', 'json', 'xml',
  'png', 'jpg', 'jpeg', 'gif', 'webp', 'tiff',
  'mp4', 'mov', 'avi', 'mkv',
  'zip', 'tar', 'gz', '7z',
  'dat', 'bin', 'fits', 'hdf5', 'nc',  // telemetry/scientific formats
])
const ALLOWED_MIME_PREFIXES = ['image/', 'video/', 'audio/', 'text/', 'application/pdf', ...]

const ext = path.extname(params.originalName).replace('.', '').toLowerCase()
if (!ALLOWED_EXTENSIONS.has(ext)) {
  throw new AppError('unsupported_file_type', `File type .${ext} is not allowed`, 415)
}
```

---

#### 🟠 D2 — No File Size Enforcement from SystemConfig
**File:** `src/routes/file.routes.ts` line 21

**Current state:** Multer limit is hardcoded to `50 * 1024 * 1024` (50MB) regardless of the `maxUploadSizeBytes` value in `SystemConfig`.

**Risk:** An admin sets `maxUploadSizeBytes = 10MB` in the settings panel but uploads still accept 50MB.

**Fix:** Read `SystemConfig.maxUploadSizeBytes` at request time and enforce it:
```ts
// In the route handler, before multer:
const config = await prisma.systemConfig.findUnique({ where: { configKey: 'maxUploadSizeBytes' } })
const maxBytes = config ? Number(JSON.parse(config.configValue)) : 50 * 1024 * 1024
if (req.headers['content-length'] && Number(req.headers['content-length']) > maxBytes) {
  throw new AppError('file_too_large', `File exceeds maximum allowed size of ${maxBytes} bytes`, 413)
}
```

---

#### 🟠 D3 — Chunk Temporary Directory Under HDD_MOUNT_PATH
**File:** `src/routes/file.routes.ts` line 165

**Current state:**
```ts
const chunksDir = path.join(env.HDD_MOUNT_PATH, '.chunks', `${departmentId}_${safeName}`)
```

**Risk:** The `.chunks` temp directory is inside the storage mount. If the HDD sync daemon runs while a chunked upload is in progress, it will discover partial chunk files and create `UNREGISTERED` file records for them (since `runHddSync` skips only dotfiles at the root level, not inside named subdirectories).

**Fix:** Use a true OS temp directory or a separate temp path outside the storage mount:
```ts
import * as os from 'node:os'
const chunksDir = path.join(os.tmpdir(), 'istrac-chunks', `${departmentId}_${safeName}`)
```

---

#### 🟡 D4 — No Virus Scan Integration (virusScanEnabled config exists but is not implemented)
**File:** `src/routes/admin.routes.ts` line 169

**Current state:** The `SystemConfig` blueprint includes `virusScanEnabled: false` as a key but no code path checks this flag or calls any AV scanner.

**Fix (ISRO security standard):** Integrate ClamAV (available on RHEL via EPEL):
```ts
// src/services/virusScan.service.ts
import { exec } from 'node:child_process'
export async function scanBuffer(buffer: Buffer): Promise<{ clean: boolean; threat?: string }> {
  // Write to temp file, run clamscan, parse result, delete temp file
}
// In fileService.uploadFile(), after step 3 (build path), before step 4 (write):
if (process.env.VIRUS_SCAN_ENABLED === 'true') {
  const { clean, threat } = await scanBuffer(params.fileBuffer)
  if (!clean) throw new AppError('virus_detected', `File rejected: ${threat}`, 422)
}
```

---

### E. Rate Limiting & Abuse Prevention

#### 🟠 E1 — No Global API Rate Limiter
**File:** `src/index.ts` (middleware chain)

**Current state:** Rate limiting only exists for `POST /auth/login` (10/15min) and `GET /files/:id/download` (100/hr). All other endpoints are unlimited.

**Risk:** An attacker can make thousands of `GET /search` or `GET /admin/users` requests per second, causing CPU/DB overload.

**Fix:** Add a global rate limiter early in the middleware chain:
```ts
// src/middleware/globalRateLimiter.middleware.ts
const GLOBAL_LIMIT = 200  // requests per minute per IP
const GLOBAL_WINDOW = 60

export async function globalRateLimiter(req, res, next) {
  const ip = req.ip || 'unknown'
  const key = `rate:global:${ip}`
  const count = await redis.incr(key)
  if (count === 1) await redis.expire(key, GLOBAL_WINDOW)
  if (count > GLOBAL_LIMIT) {
    res.setHeader('Retry-After', String(GLOBAL_WINDOW))
    return next(new AppError('rate_limit_exceeded', 'Too many requests', 429))
  }
  next()
}
// Register in index.ts before all routes
```

---

#### 🟡 E2 — No Rate Limit on `POST /auth/register`
**File:** `src/routes/auth.routes.ts` line 19

**Current state:** Registration uses `loginRateLimiter` (10 attempts/15min per IP — same as login). However, this is the wrong limiter to reuse — the key `rate:login:{ip}` is shared between registration and login attempts, so 5 registration attempts consume half the login budget.

**Fix:** Use a separate rate limiter for registration:
```ts
const REGISTER_MAX = 5    // 5 registrations per hour per IP
const REGISTER_WINDOW = 3600
export async function registerRateLimiter(req, res, next) {
  const key = `rate:register:${req.ip}`
  const count = await redis.incr(key)
  if (count === 1) await redis.expire(key, REGISTER_WINDOW)
  if (count > REGISTER_MAX) throw new AppError('rate_limit_exceeded', 'Too many registration attempts', 429)
  next()
}
```

---

#### 🟡 E3 — No Brute-Force Protection on `/auth/refresh`
**File:** `src/routes/auth.routes.ts` line 186

**Current state:** The refresh endpoint has no rate limiting. While the refresh token itself must be valid to proceed, repeated requests with invalid tokens (dictionary attack against the cookie value) incur DB query costs.

**Fix:** Add a light rate limit (distinct from login limiter):
```ts
router.post('/refresh', refreshRateLimiter, async (req, res, next) => { ... })
// 20 refresh attempts per hour per IP
```

---

### F. HTTP Security Headers

#### 🔴 F1 — No HTTP Security Headers Set
**File:** `src/index.ts`

**Current state:** Express sends no security-related HTTP response headers. Browser clients rely on defaults.

**Risk (OWASP A05 — Security Misconfiguration):**
- No `X-Frame-Options` → clickjacking attacks possible.
- No `X-Content-Type-Options` → MIME sniffing — browser may execute a `.dat` file with content `<script>` if opened directly.
- No `Strict-Transport-Security` → HTTPS downgrade attacks in production.
- No `Referrer-Policy` → API URLs and auth paths leaked in Referer headers to external resources.
- No `Content-Security-Policy` → If any route ever returns HTML, XSS is unrestricted.

**Fix:** Install and configure `helmet`:
```bash
npm install helmet
```
```ts
// src/index.ts
import helmet from 'helmet'

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'"],
      imgSrc: ["'self'", 'data:', 'https:'],
      connectSrc: ["'self'"],
      frameSrc: ["'none'"],
      objectSrc: ["'none'"],
    },
  },
  hsts: { maxAge: 63072000, includeSubDomains: true, preload: true }, // 2 years
  frameguard: { action: 'deny' },
  noSniff: true,              // X-Content-Type-Options: nosniff
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  crossOriginResourcePolicy: { policy: 'cross-origin' }, // needed for file streaming to Amplify
}))
```

---

#### 🟡 F2 — Missing `Cache-Control` Headers on Sensitive Endpoints
**File:** Routes returning user data, tokens, audit logs.

**Current state:** No `Cache-Control` header is set on API responses. Browsers and CDN caches (CloudFront) may cache responses containing user PII or file metadata.

**Fix:** Add `Cache-Control: no-store` on all authenticated API responses:
```ts
// As middleware applied to all routes after cors():
app.use((_req, res, next) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private')
  res.setHeader('Pragma', 'no-cache')
  next()
})
```
For file streaming downloads, override with:
```ts
res.setHeader('Cache-Control', 'private, max-age=3600') // allow browser-only caching of downloads
```

---

### G. Data Exposure & Information Leakage

#### 🟠 G1 — Stack Traces Logged with User-Facing Request IDs
**File:** `src/lib/errors.ts` line 76

**Current state:**
```ts
logger.error('APP_ERROR', `[Req: ${requestId}] ${err.code}: ${err.message}`, err.stack)
```
The request ID is included in error logs. This is good for internal tracing. However, the same `requestId` is returned to the client in the error response. If an attacker sends a specific request and sees the `requestId` in the response, they can search logs by that ID to find any internal details that were logged about their request.

**Risk:** This is a low-risk theoretical path but violates separation between external identifiers and internal log references for high-security environments.

**Fix:** Use separate correlation IDs: an internal `internalRequestId` (not exposed) for logs and an external `requestId` (truncated or different) for API responses.

---

#### 🟡 G2 — `passwordHash` Field Included in User Queries Without Explicit Exclusion
**File:** `src/routes/user.routes.ts` line 118+

**Current state:** Most user queries use `select: { ... }` (field allowlist — correct). However, the login route fetches the full user object:
```ts
const user = await prisma.user.findUnique({ where: { email, deletedAt: null } })
// user.passwordHash is now in memory, though not returned to client
```

**Risk:** If a logging middleware ever serializes `req.body` or a route accidentally returns the full `user` object, the `passwordHash` (bcrypt hash) is exposed. While bcrypt hashes are not plaintext passwords, exposing them enables offline dictionary attacks.

**Fix:** Always use `select` explicitly, even in internal handlers:
```ts
const user = await prisma.user.findUnique({
  where: { email, deletedAt: null },
  select: { id: true, name: true, email: true, role: true, status: true, passwordHash: true, tempPass: true, lastLogin: true },
})
```
And never log `req.body` contents without redacting sensitive fields.

---

#### 🟡 G3 — Email Address Returned in Audit Log Responses
**File:** `src/routes/admin.routes.ts` lines 136-148

**Current state:** The audit log response includes `l.user?.name` but the admin stats response includes `user.email`. The audit log viewer itself shows emails in the UI. While this is admin-only, audit logs should ideally use user IDs or display names, not email addresses, in exported CSV files.

**Fix:** For CSV export functionality, provide an option to mask email addresses: `"a***@istrac.gov.in"`.

---

### H. Logging & Monitoring Gaps

#### 🟠 H1 — Failed Login Attempts Not Individually Logged
**File:** `src/routes/auth.routes.ts` login handler

**Current state:** The `auditService.log()` is called only on successful login. Failed login attempts (wrong password, suspended account) throw `AppError` which is caught by the error handler — no audit record is created.

**Risk (NIST AU-2):** Security monitoring and intrusion detection requires logging of failed authentication attempts. Without this, a brute-force attack happening below the rate-limit threshold (e.g., 9 attempts/14 minutes) is completely invisible in audit logs.

**Fix:**
```ts
const user = await prisma.user.findUnique({ where: { email, deletedAt: null } })
// Log failed attempt BEFORE throwing (don't leak user existence)
if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
  auditService.log({
    action: 'AUTH:LOGIN_FAILED',
    resourceType: 'user',
    ipAddress: req.ip,
    userAgent: req.get('user-agent'),
    newValue: { email: email.toLowerCase(), reason: !user ? 'user_not_found' : 'bad_password' },
  })
  throw new AppError('invalid_credentials', 'Invalid email or password', 401)
}
```

---

#### 🟠 H2 — No Alert on Repeated 403/401 from Same IP
**File:** `src/lib/errors.ts`, `src/middleware/rateLimiter.middleware.ts`

**Current state:** The `httpLoggerMiddleware` logs all 4xx responses but there is no mechanism to detect patterns (e.g., 50 × 401 from the same IP in 1 minute = credential stuffing attack).

**Fix:** Add a security monitoring counter in the error handler:
```ts
// In globalErrorHandler, for AppError with statusCode === 401 or 403:
const ip = req.ip || 'unknown'
const secKey = `sec:failed-auth:${ip}`
const count = await redis.incr(secKey)
if (count === 1) await redis.expire(secKey, 300) // 5-minute window
if (count > 20) {
  logger.warn('SECURITY', `Suspicious: ${count} auth failures from IP ${ip} in 5 minutes`)
  // Optionally: emailService.sendAdminAlert('Possible attack', `IP: ${ip}`)
}
```

---

#### 🟡 H3 — HDD Health Service Uses `console.error` (Not Structured Logger)
**File:** `src/services/hddHealth.service.ts` lines 43, 64

**Current state:**
```ts
console.error('[HddHealthService] Storage probe check failed:', err.message)
console.error('[HddHealthService] Interval error:', err)
```
These bypass the structured logger, meaning they don't get the timestamp/level/tag format and cannot be filtered by `LOG_LEVEL`.

**Fix:** Replace with `logger.error('HDD-HEALTH', ...)`.

---

#### 🟡 H4 — `notificationService` and `auditService` Use `console.error`
**File:** `src/services/notification.service.ts` lines 45, 48, 71; `src/services/audit.service.ts` line 44

**Current state:** Catch blocks use `console.error(...)` directly.

**Fix:** Import and use `logger.error('NOTIFICATION', ...)` and `logger.error('AUDIT', ...)` consistently.

---

### I. Dependency & Supply-Chain Security

#### 🟠 I1 — No `npm audit` Step in CI/CD Pipeline
**Current state:** No `package-lock.json` audit step exists in any documented pipeline.

**Fix:** Add to deployment checklist and CI:
```bash
npm audit --audit-level=high
# Fails build if high/critical vulnerabilities found
```

#### 🟠 I2 — No Subresource Integrity or Lockfile Pinning Policy
**Current state:** `package.json` uses `^` semver ranges (e.g., `"express": "^5.0.0"`), meaning `npm install` on a fresh server could pull a newer minor version with breaking changes or a compromised version.

**Fix:** Commit `package-lock.json` to version control (already standard) and use `npm ci` instead of `npm install` in production deployments.

---

### J. Infrastructure & Deployment Hardening

#### 🟠 J1 — No Request Body Size Limit on Individual Endpoints
**File:** `src/index.ts` lines 48-49

**Current state:**
```ts
app.use(express.json({ limit: '50mb' }))
app.use(express.urlencoded({ extended: true, limit: '50mb' }))
```
All JSON endpoints (including `POST /auth/login`) accept up to 50MB JSON bodies. The 50MB limit is needed for the file upload endpoints but not for auth/user endpoints.

**Risk:** An attacker sends a 50MB `name` field to `POST /auth/register`, consuming bandwidth and memory.

**Fix:** Apply the 50MB limit only to file routes. Use a smaller limit globally:
```ts
app.use(express.json({ limit: '1mb' }))  // global default
// In file routes, override:
router.use('/files', express.json({ limit: '50mb' }))
```

#### 🟡 J2 — `MYSQL_ROOT_PASSWORD` Required but Root Access Not Needed at Runtime
**File:** `src/config/env.ts` line 31

**Current state:** `MYSQL_ROOT_PASSWORD` is a required environment variable loaded into the application process at runtime. The Prisma MariaDB adapter only uses `MYSQL_USER` / `MYSQL_PASSWORD` for connections — the root password is never used by the application code.

**Risk:** If the application process is compromised, the attacker has the MariaDB root password.

**Fix:** Remove `MYSQL_ROOT_PASSWORD` from the runtime `.env` file. It should only exist in the deployment/provisioning scripts (e.g., `setup-rhel.sh`) and never in the application's runtime environment.

---

## 3. Prioritized Fix Roadmap

### Phase 1 — Critical (Fix before next deployment)
| ID | Issue | File | Effort |
| :--- | :--- | :--- | :--- |
| C1 | Members can delete files — missing `adminMiddleware` on DELETE | `file.routes.ts:293` | 5 min |
| D1 | No file type allowlist — any extension accepted | `file.service.ts` | 2 hrs |
| F1 | No HTTP security headers (helmet) | `index.ts` | 1 hr |
| A3 | No server-side password strength enforcement | `auth.routes.ts` | 30 min |

### Phase 2 — High (Fix within 1 sprint)
| ID | Issue | File | Effort |
| :--- | :--- | :--- | :--- |
| C2 | File version history has no department access check | `file.routes.ts:348` | 30 min |
| C3 | Folder creation missing admin check | `file.routes.ts:380` | 10 min |
| B1 | Blacklist full JWT token instead of jti | `auth.routes.ts`, `sessionStore.ts` | 2 hrs |
| B3 | Password change doesn't revoke access token | `auth.routes.ts` | 1 hr |
| H1 | Failed logins not in audit log | `auth.routes.ts` | 30 min |
| E1 | No global API rate limiter | `index.ts` | 2 hrs |
| D3 | Temp chunk dir inside storage mount (HDD sync conflict) | `file.routes.ts:165` | 30 min |
| A5 | Chunk assembly loads all chunks into RAM | `file.routes.ts:202` | 3 hrs |

### Phase 3 — Medium (Fix within 1 month)
| ID | Issue | File | Effort |
| :--- | :--- | :--- | :--- |
| A1 | No Zod schema validation on request bodies | All routes | 1 week |
| A2 | Unvalidated status/role query params | `user.routes.ts` | 1 hr |
| A6 | No `totalChunks` upper bound | `file.routes.ts` | 15 min |
| D2 | Upload size not read from SystemConfig | `file.routes.ts` | 2 hrs |
| E2 | Registration and login share rate limit key | `rateLimiter.ts` | 1 hr |
| F2 | No `Cache-Control` on API responses | `index.ts` | 30 min |
| C4 | No allowlist for config keys in settings | `admin.routes.ts` | 30 min |
| C5 | Orphaned/unregistered files downloadable | `file.routes.ts:251` | 15 min |
| H3-H4 | `console.error` in hddHealth, notifications, audit | Multiple services | 30 min |
| J1 | Global 50MB JSON limit should be 1MB | `index.ts` | 10 min |

### Phase 4 — Low / Improvement (Next quarter)
| ID | Issue | Effort |
| :--- | :--- | :--- |
| B2 | Concurrent session limit (max 3) | 2 hrs |
| D4 | ClamAV virus scan integration | 1 day |
| H2 | Suspicious IP alert threshold | 2 hrs |
| I1 | `npm audit` in CI | 30 min |
| J2 | Remove `MYSQL_ROOT_PASSWORD` from runtime env | 30 min |

---

## 4. Code Implementation Guide for Each Fix

### Fix F1 — Helmet Security Headers (Complete Implementation)
```bash
cd backend && npm install helmet
```
```ts
// src/index.ts — add after imports, before other middleware
import helmet from 'helmet'

app.use(helmet({
  contentSecurityPolicy: false, // API-only server, CSP not relevant here
  hsts: env.NODE_ENV === 'production'
    ? { maxAge: 63072000, includeSubDomains: true, preload: true }
    : false,
  frameguard: { action: 'deny' },
  noSniff: true,
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  crossOriginResourcePolicy: { policy: 'cross-origin' }, // required for file streaming to Amplify/CloudFront
  permittedCrossDomainPolicies: false,
  dnsPrefetchControl: { allow: false },
  ieNoOpen: true,
}))
```

### Fix D1 — File Type Allowlist (Complete Implementation)
```ts
// src/services/file.service.ts — add at top of uploadFile()
import * as path from 'node:path'

const ALLOWED_EXTENSIONS = new Set([
  // Document formats
  'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'odt', 'ods', 'odp',
  // Text / data
  'txt', 'csv', 'json', 'xml', 'md', 'log', 'dat', 'tsv',
  // Images
  'png', 'jpg', 'jpeg', 'gif', 'webp', 'tiff', 'bmp', 'svg',
  // Video
  'mp4', 'mov', 'avi', 'mkv', 'webm',
  // Scientific / Telemetry formats
  'fits', 'fit', 'hdf', 'hdf5', 'h5', 'nc', 'cdf', 'sav', 'mat',
  // Archive
  'zip', 'tar', 'gz', 'bz2', '7z', 'rar',
])

const ext = path.extname(params.originalName).replace('.', '').toLowerCase()
if (ext && !ALLOWED_EXTENSIONS.has(ext)) {
  throw new AppError('unsupported_file_type', `File type .${ext} is not permitted. Contact your administrator to add support for this format.`, 415)
}
```

### Fix A1 — Zod Request Validation (Pattern to Apply to All Routes)
```bash
cd backend && npm install zod
```
```ts
// src/lib/validate.ts
import { ZodSchema, ZodError } from 'zod'
import type { Request, Response, NextFunction } from 'express'
import { AppError } from './errors.js'

export function validate(schema: ZodSchema, source: 'body' | 'query' | 'params' = 'body') {
  return (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse(req[source])
    if (!result.success) {
      const issues = result.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ')
      return next(new AppError('validation_error', issues, 400))
    }
    req[source] = result.data // replace with coerced/typed data
    next()
  }
}

// Usage in auth.routes.ts:
import { z } from 'zod'
import { validate } from '../lib/validate.js'

const RegisterSchema = z.object({
  name: z.string().min(2).max(100).trim(),
  email: z.string().email().toLowerCase().trim(),
  employeeId: z.string().max(30).optional(),
  designation: z.string().max(100).optional(),
  phone: z.string().max(20).regex(/^\+?[\d\s\-()]+$/).optional(),
  password: z.string().min(10).max(128)
    .regex(/[A-Z]/, 'Must contain uppercase')
    .regex(/[0-9]/, 'Must contain a number')
    .regex(/[^A-Za-z0-9]/, 'Must contain special character'),
  departmentPreference: z.string().max(200).optional(),
  reasonForAccess: z.string().max(1000).optional(),
})

router.post('/register', loginRateLimiter, validate(RegisterSchema), async (req, res, next) => {
  const { name, email, password, ... } = req.body // now fully typed and validated
```

---

## 5. Security Standards Checklist

Use this as a deployment gate. Each item must be verified before production release.

### Authentication (OWASP ASVS V2 / NIST SP 800-63B)
- [ ] Passwords minimum 10 chars, uppercase, number, special char (server-side)
- [ ] bcrypt with ≥10 cost factor (currently 12 ✅)
- [ ] Access tokens expire in ≤15 minutes ✅
- [ ] Refresh tokens expire in ≤7 days ✅
- [ ] Refresh token rotation on every use ✅
- [ ] httpOnly + SameSite + Secure cookie flags ✅
- [ ] Token blacklist checked on every request ✅
- [ ] Failed login attempts logged to audit log ❌ (H1)
- [ ] Max concurrent sessions enforced ❌ (B2)
- [ ] Password change revokes all sessions + access token ⚠️ (B3 — refresh ok, access token not)
- [ ] No user enumeration in forgot-password ✅

### Authorization (OWASP ASVS V4 / NIST AC-3)
- [ ] All admin routes gated by `adminMiddleware` server-side ⚠️ (C1, C3)
- [ ] Department access verified on all file operations ⚠️ (C2)
- [ ] No IDOR — resource ownership validated per request ⚠️ (C2, C5)
- [ ] Admin UI route guards are defense-in-depth only (server is authoritative) ✅

### Input Validation (OWASP ASVS V5 / CWE-20)
- [ ] All request bodies validated by schema ❌ (A1)
- [ ] File extensions validated against allowlist ❌ (D1)
- [ ] Email format validated server-side ❌ (A4)
- [ ] Password strength validated server-side ❌ (A3)
- [ ] Numeric params have bounds checks ❌ (A6)

### Transport Security (OWASP ASVS V9)
- [ ] All security headers set (helmet) ❌ (F1)
- [ ] HSTS enabled in production ❌ (F1)
- [ ] No sensitive data in Cache-Control ❌ (F2)
- [ ] CORS configured with explicit allowlist ✅

### Data Protection (OWASP ASVS V6 / NIST SC-28)
- [ ] Passwords hashed with bcrypt (never stored plaintext) ✅
- [ ] Refresh tokens stored as SHA-256 hash (not raw) ✅
- [ ] Password reset tokens stored as SHA-256 hash ✅
- [ ] `passwordHash` never returned in API responses ✅ (via select)
- [ ] File SHA-256 checksums stored and verifiable ✅

### Audit & Monitoring (NIST AU-2, AU-9, AU-12)
- [ ] All authenticated mutations logged ✅
- [ ] All login events logged (success + failure) ⚠️ (H1 — failure missing)
- [ ] Audit log is append-only (no UPDATE/DELETE) ✅
- [ ] Structured logger used everywhere (no raw console.log in prod) ⚠️ (H3, H4)
- [ ] Suspicious authentication patterns alerted ❌ (H2)

### Storage Security (NIST SC-28, CWE-22)
- [ ] Path traversal guard on all file I/O ✅
- [ ] Atomic file writes (temp + rename) ✅
- [ ] SHA-256 integrity check on every upload ✅
- [ ] File type allowlist enforced ❌ (D1)
- [ ] Virus scan capability ❌ (D4)
- [ ] Storage mount access logged ✅ (audit)

### Rate Limiting & Availability (NIST SC-5 / OWASP A04)
- [ ] Login: 10 attempts / 15 min per IP ✅
- [ ] Register: separate rate limit per IP ❌ (E2)
- [ ] Global API rate limit ❌ (E1)
- [ ] Download: 100/hour per user ✅
- [ ] HDD availability circuit breaker ✅
