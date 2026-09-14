# Dependency Inventory & Air-Gapped Handover Guide
## ISTRAC Satellite Information Management System (ISTRAC-SIMS)

> **Document Identifier:** ISTRAC-SIMS-DEP-HANDOVER-V1.0  
> **Standard Compliance:** IEEE Std 1063-2001 (R2007) / ISO/IEC/IEEE 26514:2018 (*Software Operational Documentation*)  
> **Security Classification:** Restricted — ISRO / ISTRAC Operational Ground Network  
> **Target Audience:** Client Technical Leads, Station System Administrators, Ground Network Operations, DevOps & Security Auditors  
> **Date:** September 2026  

---

## Executive Summary & Handover Protocol

This document establishes the official **Software Dependency Inventory and Air-Gapped Handover Reference** for the **ISTRAC Satellite Information Management System (ISTRAC-SIMS)**.

In mission-critical, air-gapped aerospace installations, operational servers operate under a strict **Zero-External-Internet Policy**. Ground station servers in Bengaluru MOX, SHAR, and IDSN Byalalu have no physical or logical access to public package registries (`registry.npmjs.org`, GitHub, Docker Hub).

This guide details:
1. **Every active package used** across Backend and Frontend with exact version numbers, architectural roles, and operational justifications.
2. **Every unused or superseded package** currently declared in `package.json`, explaining why it was superseded and safe pruning guidelines.
3. **The Air-Gapped Packaging & Offline Deployment Toolkit** that downloads and bundles all dependencies into an offline archive that deploys in an isolated private network with zero internet connectivity.

---

## 1. Complete Package Inventory: Backend Subsystem

The backend runs on **Node.js (v20+ LTS)** using ES Modules (`"type": "module"`).

### 1.1 Backend Active Production Dependencies (`dependencies`)

| Package Name | Installed Version | Architectural Role | Operational Justification & Usage in Codebase |
| :--- | :--- | :--- | :--- |
| **`@prisma/client`** | `^7.9.1` | Relational Data ORM | Type-safe database client interface for all metadata models (users, files, satellites, audit logs, CMS blocks, system configs). Used in `src/config/db.ts` and throughout all 13 backend services. |
| **`@prisma/adapter-mariadb`** | `^7.9.1` | Native MariaDB Driver | High-performance Prisma 7 driver adapter for MySQL 8.0+ and MariaDB 10.11+. Configured in `src/config/db.ts` with connection pooling and public key retrieval. |
| **`express`** | `^5.2.1` | Core HTTP Application Framework | Powers the REST API server, routing pipeline, error propagation, and middleware chain. Configured in `src/index.ts`. |
| **`helmet`** | `^8.3.0` | HTTP Security Headers | Security middleware enforcing military-grade perimeter policies: HSTS (63072000s in prod), anti-clickjacking (`deny`), MIME no-sniff, strict-origin referrer, and Cross-Origin Resource Policy. Configured in `src/index.ts`. |
| **`cors`** | `^2.8.6` | Ingress Origin Firewall | Restricts browser API access strictly to whitelisted ground station origins. Configured in `src/config/cors.ts`. |
| **`cookie-parser`** | `^1.4.7` | Secure Cookie Handler | Parses incoming HttpOnly secure cookies carrying JWT refresh tokens. Used in `src/index.ts` and `src/routes/auth.routes.ts`. |
| **`jsonwebtoken`** | `^9.0.3` | Cryptographic JWT Authority | Generates and verifies HMAC-SHA256 tokens: 15-minute access tokens and 7-day refresh tokens with unique UUID claims (`jti`). Configured in `src/lib/jwt.ts`. |
| **`bcrypt`** | `^6.0.0` | Password Cryptography | One-way Blowfish adaptive password hashing algorithm with salt rounds. Enforces zero plaintext storage in `src/lib/hash.ts`, `src/services/user.service.ts`, and `src/routes/auth.routes.ts`. |
| **`ioredis`** | `^5.11.1` | Redis In-Memory Client | Ultra-high-speed Redis client managing session tokens, instant blacklist revocation, rate limiter buckets, distributed execution mutex locks (`scheduler:mission-events:lock`), and Pub/Sub message channels. Configured in `src/config/redis.ts`. |
| **`ws`** | `^8.21.3` | RFC 6455 WebSocket Engine | Bi-directional real-time push socket server for telemetry feeds, file synchronization, dynamic CMS updates, and emergency audio/visual broadcasts. Configured in `src/ws/wsServer.ts`. |
| **`multer`** | `^2.2.0` | Multi-part Ingest Streamer | Handles multipart form-data binary file streams for single-shot and 50MB sequential chunked telemetry file uploads with in-memory buffering. Configured in `src/routes/file.routes.ts`. |
| **`nodemailer`** | `^9.0.5` | SMTP Mail Gateway Client | Dispatches automated transactional emails (user approval/rejection, account suspension, password reset, and hardware failure alerts). Configured in `src/services/email.service.ts`. |
| **`dotenv`** | `^17.4.2` | Configuration Bootstrapper | Reads server parameters and database credentials from `.env` on server startup. Configured in `src/config/env.ts`. |
| **`zod`** | `^4.4.3` | Runtime Schema Validator | Validates inbound API request bodies, query params, and JSON structures against strict schemas. Configured in `src/lib/validate.ts` and `src/lib/schema.ts`. |

---

### 1.2 Backend Active Development Dependencies (`devDependencies`)

| Package Name | Installed Version | Architectural Role | Operational Justification |
| :--- | :--- | :--- | :--- |
| **`typescript`** | `^5.0.0` | Compiler & Type Checker | Compiles TypeScript source files into optimized ES module JavaScript in `dist/`. |
| **`prisma`** | `^7.9.1` | Database Tooling CLI | Manages schema compilation, generates Linux engine binaries (`rhel-openssl-1.1.x`, `rhel-openssl-3.0.x`), and executes offline migrations (`prisma migrate deploy`). |
| **`tsx`** | `^4.0.0` | TS Execution & Seeder Engine | Executes the initial ground station provisioning seed script (`prisma/seed.ts`) and provides hot-reloading in local development. |
| **`@types/node`** | `^20.0.0` | Node.js Type Definitions | TypeScript interfaces for core Node.js APIs (Buffer, Crypto, Stream, OS, Path, FS). |
| **`@types/express`** | `^5.0.6` | Express Type Definitions | Strongly typed `Request`, `Response`, and `NextFunction` signatures. |
| **`@types/cors`** | `^2.8.19` | CORS Type Definitions | Type interfaces for CORS configuration options. |
| **`@types/dotenv`** | `^6.1.1` | Dotenv Type Definitions | Type interfaces for environment loader. |
| **`@types/bcrypt`** | `^6.0.0` | Bcrypt Type Definitions | Function signatures for `hash()`, `compare()`, `genSalt()`. |
| **`@types/jsonwebtoken`**| `^9.0.10` | JWT Type Definitions | Type definitions for `sign()`, `verify()`, `decode()`. |
| **`@types/cookie-parser`**| `^1.4.10` | Cookie-Parser Definitions | Type definitions for Express request cookie parsing. |
| **`@types/multer`** | `^2.2.0` | Multer Type Definitions | Type interfaces for `Express.Multer.File` buffers. |
| **`@types/nodemailer`** | `^8.0.1` | Nodemailer Type Definitions | Transport options and mail option type interfaces. |
| **`@types/ws`** | `^8.18.1` | WebSocket Type Definitions | Type definitions for `WebSocketServer` and `WebSocket` clients. |

---

## 2. Complete Package Inventory: Frontend Subsystem

The frontend is a pre-compiled **React 19 Single Page Application (SPA)** bundled via **Vite 8** and served as static HTML/JS/CSS assets by Nginx.

### 2.1 Frontend Active Production Dependencies (`dependencies`)

| Package Name | Installed Version | Architectural Role | Operational Justification & Usage in Codebase |
| :--- | :--- | :--- | :--- |
| **`react`** | `^19.2.7` | UI Component Framework | Core UI library powering all 29 mission control views, modals, and reactive components. |
| **`react-dom`** | `^19.2.7` | Web DOM Renderer | Mounts React components to the browser DOM in `src/main.tsx`. |
| **`react-router-dom`** | `^7.18.2` | Client-Side SPA Router | Manages client-side routing, route guardrails, protected route wrappers, and URL parameters across Public, Mission Portal, and Admin domains. Configured in `src/App.tsx`. |
| **`@tanstack/react-query`**| `^5.101.4` | Server-State Caching Engine | Coordinates asynchronous API caching, 30s staleness windows, optimistic UI updates, and query invalidation upon WebSocket push events. Configured in `src/lib/queryClient.ts`. |
| **`zustand`** | `^5.0.14` | Global State Store | Minimalist, high-performance in-memory state stores for operator auth credentials (`authStore.ts`), auto-dismissing alerts (`toastStore.ts`), and modal dialogs. |
| **`axios`** | `^1.19.0` | REST API HTTP Client | Handles all network communication with backend. Configured with a 30s timeout guard, credentials support, and a concurrency lock queue for transparent token rotation. Configured in `src/api/client.ts`. |
| **`lucide-react`** | `^1.31.0` | Icon Vector Library | Comprehensive aerospace and interface SVG vector icons bundled locally without external font/CDN requests. |
| **`tailwindcss`** | `^4.3.3` | Design System & Styling | Tailwind CSS v4 engine driving the high-contrast aerospace mission control palette (`#00E5FF` Cyan, `#00E676` Emerald, `#FF1744` Crimson). Configured in `src/index.css`. |
| **`@tailwindcss/vite`** | `^4.3.3` | Vite Tailwind Compiler | Direct integration compiling Tailwind styles into lean production CSS chunks. |
| **`react-hook-form`** | `^7.85.0` | Form Management Engine | High-performance uncontrolled form handling with minimal re-renders. Used in `AuthModal.tsx`, `CreateDeptModal.tsx`, and `ForcePasswordChange.tsx`. |
| **`@hookform/resolvers`**| `^5.7.1` | Form Validation Bridge | Connects `react-hook-form` with Zod validation schemas (`zodResolver`). |
| **`zod`** | `^4.4.3` | Validation Schema Engine | Client-side validation for login, registration, password rotation, and department creation. Configured in `schemas/authSchemas.ts`. |
| **`dompurify`** | `3.4.14` | XSS Security Sanitizer | Sanitizes CMS content blocks and HTML announcements before rendering into the DOM, preventing Cross-Site Scripting (XSS). Configured in `src/lib/sanitize.ts`. |
| **`pdfjs-dist`** | `^6.2.108` | In-Browser PDF Renderer | Renders PDF telemetry reports, orbital flight charts, and mission summaries directly inside the browser without external plugins or third-party cloud viewers. Configured in `src/components/preview/PdfPreview.tsx`. |

---

### 2.2 Frontend Active Development Dependencies (`devDependencies`)

| Package Name | Installed Version | Architectural Role | Operational Justification |
| :--- | :--- | :--- | :--- |
| **`vite`** | `^8.1.1` | Production Bundler & Dev Server | Ultra-fast build tool compiling TypeScript and JSX into minified, hash-versioned static chunks in `dist/`. |
| **`@vitejs/plugin-react`**| `^6.0.3` | React Compiler Plugin | Enables JSX transformation and React Fast Refresh. |
| **`typescript`** | `~6.0.2` | Frontend Type Checker | Enforces strict type verification across all frontend TSX components. |
| **`@tanstack/react-query-devtools`**| `^5.101.4` | Query Debugger | Development tools for inspecting query caches and network synchronization states. |
| **`@types/react`** | `^19.2.17` | React Type Definitions | Type definitions for React 19 components and hooks. |
| **`@types/react-dom`** | `^19.2.3` | React DOM Type Definitions | Type definitions for React DOM mounting. |
| **`@types/node`** | `^24.13.2` | Node.js Type Definitions | Type definitions for build scripts and environment variables. |
| **`@types/dompurify`** | `^3.0.5` | DOMPurify Type Definitions | Type signatures for DOMPurify sanitization. |
| **`eslint`** | `^10.6.0` | Code Linter | Code quality and syntax validation engine. |
| **`@eslint/js`** | `^10.0.1` | ESLint JavaScript Rules | Standard JavaScript linting ruleset. |
| **`typescript-eslint`** | `^8.62.0` | TypeScript Linting Rules | ESLint parser and rules tailored for TypeScript codebases. |
| **`eslint-plugin-react-hooks`**| `^7.1.1` | React Hooks Rules | Validates adherence to React Hooks rules (deps arrays, call order). |
| **`eslint-plugin-react-refresh`**| `^0.5.3` | Fast Refresh Lint Rules | Enforces component export patterns required for hot module reload. |
| **`globals`** | `^17.7.0` | Global Variable Definitions | Browser and Node.js global environment variable definitions for ESLint. |

---

## 3. Unused & Superseded Packages (Safe Pruning Audit)

During the codebase audit, several packages declared in `package.json` were identified as **inactive or superseded by native/alternative implementations**. 

The system operates 100% nominally without these packages. They can be safely pruned during handover to reduce package count and eliminate unused code surface.

### 3.1 Backend Unused Packages

| Package Name | Version | Declared In | Status | Technical Reason & Superseded Implementation |
| :--- | :--- | :--- | :--- | :--- |
| **`pg`** | `^8.22.0` | `dependencies` | ❌ **UNUSED** | **PostgreSQL driver.** The ISTRAC-SIMS project runs exclusively on MySQL 8.0+ / MariaDB 10.11+ via `@prisma/adapter-mariadb`. No code imports `pg`. |
| **`@types/pg`** | `^8.20.0` | `devDependencies` | ❌ **UNUSED** | **PostgreSQL type definitions.** Companion types for `pg`; not imported anywhere. |
| **`@prisma/adapter-pg`** | `^7.9.1` | `dependencies` | ❌ **UNUSED** | **Prisma PostgreSQL Adapter.** Legacy adapter from an early prototype before standardization on MariaDB. Superseded by `@prisma/adapter-mariadb`. |
| **`node-cron`** | `^4.6.0` | `dependencies` | ❌ **UNUSED** | **Cron scheduler library.** Superseded by the standalone background worker process (`backend/src/worker.ts`), which runs an autonomous loop with dynamic 10-second polling and atomic Redis distributed locks (`SET scheduler:mission-events:lock EX 60 NX`). |
| **`@types/node-cron`** | `^3.0.11` | `devDependencies` | ❌ **UNUSED** | **Cron type definitions.** Companion types for `node-cron`; not imported anywhere. |
| **`uuid`** | `^14.0.2` | `dependencies` | ❌ **UNUSED** | **UUID generation library.** Superseded by Node.js native standard library `crypto.randomUUID()` used across `errors.ts`, `jwt.ts`, and `requestId.ts`. |
| **`@types/uuid`** | `^10.0.0` | `devDependencies` | ❌ **UNUSED** | **UUID type definitions.** Companion types for `uuid`; not imported anywhere. |

### 3.2 Frontend Unused Packages

| Package Name | Version | Declared In | Status | Technical Reason & Superseded Implementation |
| :--- | :--- | :--- | :--- | :--- |
| **`terser`** | `^5.51.2` | `devDependencies` | ❌ **UNUSED** | **JS Minifier.** Vite 8 uses built-in esbuild / rolldown minification by default; `vite.config.ts` does not specify `minify: 'terser'`, leaving this package uninvoked. |

---

## 4. System & Host Runtime Dependencies (Air-Gapped Host)

For complete project handover, the client must ensure the destination Linux server (RHEL 8 / 9, Rocky Linux 9, or AlmaLinux 9) has the following system-level packages:

| Software | Version Required | Operational Purpose |
| :--- | :--- | :--- |
| **Node.js** | `v20.x` or `v22.x` LTS (x86_64) | JavaScript/TypeScript server execution runtime for API and background worker. |
| **MariaDB Server** | `10.11+` (or MySQL `8.0+`) | Relational database daemon storing metadata, credentials, and audit logs. |
| **Redis** | `7.0+` | In-memory cache, rate limiters, session blacklist, and real-time Pub/Sub broker. |
| **Nginx** | `1.24+` | Reverse proxy, static SPA asset server, SSL termination, and HTTP 206 streaming engine. |
| **tar / gzip / rsync** | Standard Linux utils | Archive extraction and offline file synchronization. |
| **policycoreutils-python-utils** | RHEL standard package | Provides `semanage` for configuring SELinux network port policies. |

---

## 5. Offline Packaging & Handover Toolkit

To enable seamless handover to a client in an isolated private network, the project provides two automated packaging mechanisms:

```
[ INTERNET-CONNECTED MACHINE ]
        │
        ├── 1. Run Offline Downloader (deploy/download-offline-packages.mjs)
        │      └── Downloads all .tgz tarballs into offline-packages/
        │
        ├── 2. Run Offline Bundler (deploy/bundle-offline.sh or deploy/bundle-offline.ps1)
        │      ├── Builds Frontend (dist/)
        │      ├── Builds Backend & Prisma Engines (dist/)
        │      ├── Gathers Production node_modules
        │      └── Packages into istrac-fms-offline-bundle-YYYYMMDD.tar.gz
        │
        ▼
[ USB DRIVE / AIR-GAPPED TRANSFER ]
        │
        ▼
[ ISOLATED PRIVATE NETWORK SERVER (ZERO INTERNET) ]
        │
        ├── Option A (Zero-Install Production): Run deploy/install.sh
        │   └── Installs RPMs, sets up systemd daemons, runs offline migrations
        │
        └── Option B (Full Package Reinstall): Run offline-packages/install-offline.sh
            └── Executes `npm install --offline` against local .tgz packages
```

### 5.1 Option A: The Production Self-Contained Bundle (Recommended)
This method is standard for government and aerospace deployments. **No `npm install` is ever run on the air-gapped server**:
1. Run `bash deploy/bundle-offline.sh` on an internet-connected build machine (or `deploy/bundle-offline.ps1` on Windows).
2. It compiles the React frontend to static assets, compiles the backend to JavaScript, bundles pre-compiled Linux Prisma engines (`rhel-openssl-1.1.x`, `rhel-openssl-3.0.x`), and packages production-only `node_modules`.
3. The resulting `.tar.gz` bundle is transferred to the air-gapped server.
4. Running `sudo bash install.sh` copies files, initializes MariaDB/Redis, and starts the systemd services in under 2 minutes.

### 5.2 Option B: The Offline Package Cache (`offline-packages/`)
If the client's engineering team requests raw npm package archives (`.tgz` files) to perform isolated offline installations or security audits:
1. Run the downloader script on an internet-connected machine:
   ```bash
   node deploy/download-offline-packages.mjs
   ```
2. The script creates an `offline-packages/` directory containing:
   - `offline-packages/backend/`: Every backend dependency packaged as a `.tgz` tarball.
   - `offline-packages/frontend/`: Every frontend dependency packaged as a `.tgz` tarball.
   - `offline-packages/install-offline.sh` and `install-offline.bat`: Automated offline installer scripts that execute `npm install --offline --prefer-offline` directly from local tarballs without contacting any external network.
3. Transfer the `offline-packages/` folder to the air-gapped environment.

---

## 6. Official Handover Verification Checklist

Before handing over the software to the client operations team, verify each item:

- [x] **Zero External CDN Dependencies:** Verified that all Lucide SVG icons, Google fonts, and 3D WebGL renderers are bundled locally.
- [x] **Prisma Offline Engines Included:** Verified that `schema.prisma` contains binary targets for RHEL OpenSSL 1.1.x and 3.0.x.
- [x] **Database Dialect Verified:** Verified that `@prisma/adapter-mariadb` is actively bound and unused `pg` dependencies are cataloged.
- [x] **Production Build Clean:** Verified that `npm run build` succeeds cleanly in both `backend` and `frontend` with exit code 0.
- [x] **SELinux Compatibility:** Verified that Nginx and systemd unit files conform to RHEL 8/9 security policies.
- [x] **Handover Documentation Prepared:** Verified that both the IEEE Operational Handbook and this Dependency Handover Guide are placed in the `documents/` folder.
