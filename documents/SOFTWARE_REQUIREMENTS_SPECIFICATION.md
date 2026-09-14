# Software Requirements Specification (SRS)
## ISRO Telemetry, Tracking & Command Network (ISTRAC)
### Satellite Information Management System (ISTRAC-SIMS)

> **Document Version:** 1.0.0 (Production Baseline)  
> **Standard:** IEEE Std 830-1998 / ISO/IEC/IEEE 29148:2018 Compliant  
> **Classification:** Restricted — ISRO Internal Operations  
> **Date:** 2026-08-27  
> **Target Platform:** RHEL 9 / Rocky Linux 9 · Air-Gapped Mission Intranet  

---

## 📑 Table of Contents

1. [Introduction](#1-introduction)
   - [1.1 Purpose](#11-purpose)
   - [1.2 Scope of the System](#12-scope-of-the-system)
   - [1.3 Definitions, Acronyms & Abbreviations](#13-definitions-acronyms--abbreviations)
   - [1.4 References & Standards Compliance](#14-references--standards-compliance)
   - [1.5 Document Overview](#15-document-overview)
2. [Overall Description](#2-overall-description)
   - [2.1 Product Perspective & Context](#21-product-perspective--context)
   - [2.2 Product Functions (High-Level Summary)](#22-product-functions-high-level-summary)
   - [2.3 User Classes & Operational Personas](#23-user-classes--operational-personas)
   - [2.4 Operating Environment](#24-operating-environment)
   - [2.5 Design & Implementation Constraints](#25-design--implementation-constraints)
   - [2.6 Assumptions & Dependencies](#26-assumptions--dependencies)
3. [External Interface Requirements](#3-external-interface-requirements)
   - [3.1 User Interfaces (UI/UX Specification)](#31-user-interfaces-uiux-specification)
   - [3.2 Hardware Interfaces (Storage & Server Architecture)](#32-hardware-interfaces-storage--server-architecture)
   - [3.3 Software Interfaces (Database, Cache & Protocols)](#33-software-interfaces-database-cache--protocols)
   - [3.4 Communications Interfaces](#34-communications-interfaces)
4. [System Features & Functional Requirements](#4-system-features--functional-requirements)
   - [4.1 Module 1: User Identity, Authentication & Access Lifecycle](#41-module-1-user-identity-authentication--access-lifecycle)
   - [4.2 Module 2: Department Isolation & Granular ACL](#42-module-2-department-isolation--granular-acl)
   - [4.3 Module 3: File Repository, Telemetry & Ingestion Engine](#43-module-3-file-repository-telemetry--ingestion-engine)
   - [4.4 Module 4: Storage Mount Reconciliation & Health Daemon](#44-module-4-storage-mount-reconciliation--health-daemon)
   - [4.5 Module 5: Real-Time Event Dispatch & WebSocket Bridge](#45-module-5-real-time-event-dispatch--websocket-bridge)
   - [4.6 Module 6: Mission Calendar & Event Scheduling](#46-module-6-mission-calendar--event-scheduling)
   - [4.7 Module 7: Dynamic Content Management System (CMS)](#47-module-7-dynamic-content-management-system-cms)
   - [4.8 Module 8: Unified Full-Text Search & Cataloging](#48-module-8-unified-full-text-search--cataloging)
   - [4.9 Module 9: Immutable Audit Logging & System Diagnostics](#49-module-9-immutable-audit-logging--system-diagnostics)
5. [Non-Functional Requirements (NFRs)](#5-non-functional-requirements-nfrs)
   - [5.1 Performance & Scalability Requirements](#51-performance--scalability-requirements)
   - [5.2 Reliability & Fault Tolerance Requirements](#52-reliability--fault-tolerance-requirements)
   - [5.3 Security & Information Assurance Requirements](#53-security--information-assurance-requirements)
   - [5.4 Maintainability & Extensibility Requirements](#54-maintainability--extensibility-requirements)
   - [5.5 Air-Gap & Self-Containment Standards](#55-air-gap--self-containment-standards)
6. [Data Model & Database Schema](#6-data-model--database-schema)
   - [6.1 Entity-Relationship Model](#61-entity-relationship-model)
   - [6.2 Data Dictionary](#62-data-dictionary)
7. [Verification & Acceptance Criteria](#7-verification--acceptance-criteria)

---

## 1. Introduction

### 1.1 Purpose
This Software Requirements Specification (SRS) defines the complete software requirements for the **Satellite Information Management System (ISTRAC-SIMS)**. It establishes an authoritative technical baseline for system architects, developers, security auditors, quality assurance engineers, and operational mission directors at the ISRO Telemetry, Tracking and Command Network (ISTRAC), Bengaluru.

### 1.2 Scope of the System
**ISTRAC-SIMS** is an enterprise-grade aerospace ground station portal and repository system designed to ingest, catalogue, isolate, secure, and distribute mission-critical satellite telemetry data, flight dynamics state vectors, mission control shift logs, space situational awareness conjunction screenings, and multi-facility tracking reports.

**Core Capabilities:**
- Multi-division departmental isolation across 5 operational units: Telemetry, Tracking & Command (**TTC**), Flight Dynamics Division (**FDD**), Mission Operations Complex (**MOX**), IS4OM / **NETRA**, and Ground Station Operations (**GSO**).
- High-throughput file ingestion supporting single-shot transfers (≤50MB) and sequential chunked uploads (≤500MB) with client-side and server-side SHA-256 integrity verification.
- Real-time event propagation via dedicated WebSocket connections and a Redis Pub/Sub multi-channel bridge.
- Bi-directional physical storage synchronization reconciling database records with Network Attached Storage (NAS) / Direct Attached Storage (DAS) disk arrays.
- Complete regulatory audit trail recording all authenticated data modifications.

### 1.3 Definitions, Acronyms & Abbreviations
| Acronym / Term | Definition |
| :--- | :--- |
| **ISTRAC** | ISRO Telemetry, Tracking and Command Network. |
| **SIMS** | Satellite Information Management System. |
| **AOS / LOS** | Acquisition of Signal / Loss of Signal (ground station pass tracking window). |
| **TTC** | Telemetry, Tracking and Command Division. |
| **FDD** | Flight Dynamics Division (orbit determination, maneuvers, ephemeris). |
| **MOX** | Mission Operations Complex (24/7 flight control consoles and operations gallery). |
| **NETRA / IS4OM**| Network for Space Object Tracking & Analysis / ISRO System for Safe & Sustainable Space Operations. |
| **GSO** | Ground Station Operations (antenna control units, RF front-ends, downrange relays). |
| **IDSN** | Indian Deep Space Network (Byalalu 18m and 32m deep-space tracking antenna dishes). |
| **ACL** | Access Control List (Department-level user authorization matrix). |
| **DAS / NAS / SAN**| Direct Attached Storage / Network Attached Storage / Storage Area Network. |
| **SHA-256** | Secure Hash Algorithm 256-bit (cryptographic data integrity checksum). |
| **JWT** | JSON Web Token (RFC 7519). |
| **Air-Gap** | Isolated physical computer network with zero public internet connectivity. |

### 1.4 References & Standards Compliance
- **IEEE Std 830-1998:** IEEE Recommended Practice for Software Requirements Specifications.
- **ISO/IEC/IEEE 29148:2018:** Systems and software engineering — Life cycle processes — Requirements engineering.
- **OWASP ASVS v4.0.3:** Application Security Verification Standard (Level 2 Baseline).
- **NIST SP 800-53 Rev. 5:** Security and Privacy Controls for Information Systems.
- **RFC 7519:** JSON Web Token (JWT) Standard.
- **RFC 4180:** Common Format and MIME Type for Comma-Separated Values (CSV) Files.

### 1.5 Document Overview
Section 2 provides the architectural perspective, user persona definitions, and operational constraints. Section 3 details UI, hardware, software, and communication interfaces. Section 4 specifies detailed functional requirements per subsystem. Section 5 sets non-functional constraints (security, performance, air-gap). Section 6 documents the complete database schema.

---

## 2. Overall Description

### 2.1 Product Perspective & Context
ISTRAC-SIMS operates within the secure, air-gapped ISRO Intranet. It connects multi-mission flight engineers, ground station operators, and division heads to centralized multi-terabyte storage arrays.

```
┌────────────────────────────────────────────────────────────────────────┐
│                         ISRO AIR-GAPPED INTRANET                       │
│                                                                        │
│  ┌───────────────────────┐             ┌─────────────────────────────┐ │
│  │   Frontend Clients    │             │   External Ground Relays    │ │
│  │ (Browsers / Consoles) │             │ (Port Blair, Mauritius,etc) │ │
│  └───────────┬───────────┘             └──────────────┬──────────────┘ │
│              │ HTTPS / WSS (Port 443)                 │                │
│              ▼                                        ▼                │
│  ┌───────────────────────────────────────────────────────────────────┐ │
│  │                Nginx Reverse Proxy & Static Host                  │ │
│  └───────────────────────────────────┬───────────────────────────────┘ │
│                                      │ Internal Reverse Proxy          │
│                                      ▼                                 │
│  ┌───────────────────────────────────────────────────────────────────┐ │
│  │                  Node.js / Express 5 API Server                   │ │
│  │               (TypeScript 5 · ESM · WebSocket /ws)                │ │
│  └───────────┬───────────────────────┬───────────────────────┬───────┘ │
│              │                       │                       │         │
│              ▼                       ▼                       ▼         │
│  ┌───────────────────────┐ ┌───────────────────┐ ┌───────────────────┐ │
│  │     MariaDB 10.11     │ │      Redis 7      │ │ Storage Mount     │ │
│  │   (Relational DB)     │ │ (Cache & PubSub)  │ │ (/mnt/istrac_data)│ │
│  └───────────────────────┘ └───────────────────┘ └───────────────────┘ │
└────────────────────────────────────────────────────────────────────────┘
```

### 2.2 Product Functions (High-Level Summary)
1. **User Access Lifecycle:** Self-service registration, administrator review queue, approval/rejection, account suspension, password reset, and first-login forced password rotation.
2. **Strict Role Segregation:** Two global roles (`ADMIN`, `MEMBER`). All data mutations (file uploads, deletions, restoration, user approvals, CMS updates, event publishing) are restricted to `ADMIN`. Members operate in read-only capacity scoped by department ACL.
3. **Department Data Repositories:** Isolated workspaces for 5 primary divisions, with recursive folder hierarchies and deep metadata tracking (spacecraft, category, classification level).
4. **Dual Ingestion Engine:** Direct single-shot upload for standard files (≤50MB) and sequential multi-chunk upload (5MB chunks, ≤500MB) with atomic disk writes and SHA-256 checksum verification.
5. **Physical Storage Reconciliation Daemon:** Autonomous background process reconciling filesystem files with database records every 15 minutes.
6. **Active Storage Health Probe:** 60-second read/write probe with circuit-breaker protection on hardware degradation.
7. **Real-time Event Dispatch:** Sub-second notification and broadcast propagation over persistent WebSocket connections.
8. **Mission Operations Calendar:** Dual-month scheduling interface for orbital maneuvers, satellite passes, station maintenance, and technical reviews.
9. **Dynamic CMS:** Customization engine for home announcements, facility overviews, hero carousels, and featured datasets without server redeployment.
10. **Immutable Regulatory Audit Logging:** Non-blocking, append-only transaction logging with BigInt sequencing.

### 2.3 User Classes & Operational Personas

```
┌─────────────────┬───────────┬────────────────────────────────────────────────────────┐
│ Persona         │ Role      │ Access Scope & Key Responsibilities                    │
├─────────────────┼───────────┼────────────────────────────────────────────────────────┤
│ Super Admin     │ ADMIN     │ Full system authority. Manages users, grants ACLs,     │
│                 │           │ updates CMS, uploads repository files, triggers sync. │
├─────────────────┼───────────┼────────────────────────────────────────────────────────┤
│ Division Lead   │ MEMBER /  │ Manages operational division documents. Uploads and    │
│                 │ ADMIN     │ reviews mission reports for assigned spacecraft.       │
├─────────────────┼───────────┼────────────────────────────────────────────────────────┤
│ Flight Operator │ MEMBER    │ Read-only operational console access. Downloads pass   │
│                 │           │ plans, state vectors, and tracks calendar milestones.  │
├─────────────────┼───────────┼────────────────────────────────────────────────────────┤
│ Guest / Visitor │ None      │ Public landing page access, active banner alerts,     │
│                 │           │ public division overviews, and access request portal.  │
└─────────────────┴───────────┴────────────────────────────────────────────────────────┘
```

### 2.4 Operating Environment
- **Server Operating System:** Red Hat Enterprise Linux (RHEL) 9.x / Rocky Linux 9.x (x86_64).
- **Web Server / Proxy:** Nginx 1.24+ with HTTP/2 and WebSocket upgrade support.
- **Application Runtime:** Node.js 20.x LTS with TypeScript 5 (ECMAScript Modules).
- **Database Engine:** MariaDB 10.11+ LTS (InnoDB storage engine, `utf8mb4_unicode_ci`).
- **In-Memory Cache & Message Broker:** Redis 7.x (Standalone or Cluster).
- **Storage Subsystem:** Local NVMe arrays, SAN LUNs, or NFS v4.1 mount points mapped to `HDD_MOUNT_PATH`.
- **Target Client Browsers:** Google Chrome 120+, Mozilla Firefox 120+, Microsoft Edge 120+ (1920×1080 console resolution optimized).

### 2.5 Design & Implementation Constraints
1. **Air-Gap Constraint:** The entire frontend and backend must function with zero external internet dependencies. No CDN-hosted fonts, scripts, or stylesheets are permitted.
2. **BigInt Compatibility:** Storage sizes exceed standard 32-bit limits. All byte sizes and audit log IDs must be stored as 64-bit BigInt in database and serialized as strings across JSON APIs.
3. **Session Security Constraint:** Access tokens must expire within 15 minutes. Refresh tokens must be rotated atomically on every invocation. Refresh tokens must be transmitted via `httpOnly`, `SameSite=Strict`, `Secure` cookies.
4. **Storage Isolation Constraint:** File writes must be strictly contained within `HDD_MOUNT_PATH`. Path traversal attempts (`../`, null bytes) must be detected and rejected at the service layer.

---

## 3. External Interface Requirements

### 3.1 User Interfaces (UI/UX Specification)
- **Visual Design Paradigm:** Aerospace Mission Control console aesthetic. Deep space charcoal canvas (`#04070e`, `#080d17`, `#0c121e`), 1px hairline borders (`#223049`), and high-contrast typography (`#f1f5f9`).
- **Telemetry Indicators:** Color-coded status signals: Nominal Green (`#10b981`), Warning Amber (`#f59e0b`), Critical Red (`#ef4444`), Special Purple (`#a855f7`), and ISRO Cyan (`#00f0ff`).
- **Form Standards:** All form inputs must feature optical inset backgrounds (`#09101f`). Password fields must include a **single, integrated visibility toggle** built into the component at `right-3`.
- **Dual-Month Calendar:** Side-by-side rendering of adjacent months with categorical pass and maneuver markers.
- **Multi-Format Preview Modal:** Instant browser-based previewing of PDF documents (via local PDF.js worker), MP4/WebM telemetry videos (supporting HTTP Range seeking), PNG/JPG/WebP imagery, and raw text/hex logs.

### 3.2 Hardware Interfaces (Storage & Server Architecture)
- **Primary Data Mount:** Direct filesystem interface via Node.js `node:fs/promises` accessing `HDD_MOUNT_PATH`.
- **Storage Drive Detection:** System diagnostics via Linux `lsblk` and `df -h` parsing to detect disk mount points, partition health, total capacity, and available storage bytes.
- **Circuit Breaker:** Autonomous detection of hardware storage failure via write-read-delete probe file (`.health_probe`).

### 3.3 Software Interfaces (Database, Cache & Protocols)
- **MariaDB Interface:** Prisma ORM 6 utilizing `@prisma/adapter-mariadb` over native TCP port 3306.
- **Redis Interface:** Tri-instance `ioredis` architecture separating general cache operations, message publishing, and dedicated subscription listening over TCP port 6379.
- **Mail Server Interface:** SMTP connection via Nodemailer supporting anonymous intranet relays or STARTTLS authenticated mail dispatch on ports 25 / 587.

### 3.4 Communications Interfaces
- **RESTful API:** HTTP/1.1 & HTTP/2 JSON APIs using standard response envelope:
  ```json
  {
    "data": { ... },
    "requestId": "550e8400-e29b-41d4-a716-446655440000"
  }
  ```
- **Real-Time WebSocket Protocol:** WSS protocol at `/ws` using JSON-framed payloads with 30-second heartbeat ping/pong keep-alives and code `4401` authentication rejection handling.
- **CSV Data Export:** Standardized tabular export complying with RFC 4180 with quote escaping and formula injection sanitization.

---

## 4. System Features & Functional Requirements

```
┌────────────────────────────────────────────────────────────────────────┐
│                        CORE FUNCTIONAL MODULES                         │
├───────────────────┬───────────────────┬────────────────────────────────┤
│ 1. Auth & Access  │ 2. Department ACL │ 3. File Repository Engine      │
│ 4. Storage Daemon │ 5. Real-Time WS   │ 6. Mission Calendar & Events   │
│ 7. Dynamic CMS    │ 8. Unified Search │ 9. Audit Logs & Diagnostics   │
└───────────────────┴───────────────────┴────────────────────────────────┘
```

---

### 4.1 Module 1: User Identity, Authentication & Access Lifecycle

#### 4.1.1 Registration & Access Request
- **ID:** `FR-AUTH-001`
- **Description:** Prospective users must submit an access request specifying full name, official email, employee badge ID, designation, phone number, operational department preference, password, and justification for access.
- **Validation:** 
  - Password must be hashed using `bcrypt` with a minimum cost factor of 12.
  - New accounts are initialized with `status: PENDING` and `role: MEMBER`.
- **Outputs:** System logs audit entry, returns success envelope, and queues application in the Administrator Approval Queue.

#### 4.1.2 Administrator Review & Approval Queue
- **ID:** `FR-AUTH-002`
- **Description:** Administrators can review pending registrations, approve accounts, reject applications with an optional reason, suspend active accounts, or restore suspended accounts.
- **Outputs:** Database status update (`ACTIVE`, `REJECTED`, `SUSPENDED`), automated email notification dispatched via `emailService`, and real-time WebSocket alert.

#### 4.1.3 Multi-Factor Session Authentication & Token Rotation
- **ID:** `FR-AUTH-003`
- **Description:** Authenticates users via email and password with rate-limiting protection.
- **Processing Logic:**
  1. Rate limiter enforces maximum 10 attempts per 15-minute window per IP.
  2. Verify bcrypt password hash against database record.
  3. Verify account `status === 'ACTIVE'` and `deletedAt === null`.
  4. Generate 15-minute Access Token (JWT signed with `JWT_SECRET`).
  5. Generate 7-day Refresh Token (JWT signed with `JWT_REFRESH_SECRET`).
  6. Store SHA-256 hash of refresh token in database (`RefreshToken` table).
  7. Set `refreshToken` in `httpOnly`, `SameSite=Strict`, `Secure` cookie.
  8. Return access token and sanitized user profile in response body.

#### 4.1.4 Token Refresh & Stampede Prevention
- **ID:** `FR-AUTH-004`
- **Description:** Automatically rotates credentials upon access token expiration.
- **Processing Logic:** Client interceptor traps HTTP 401, locks concurrent requests in `refreshQueue`, posts to `/auth/refresh`, revokes old refresh token in database, generates new token pair, updates cookie, and replays queued requests.

#### 4.1.5 First-Login Forced Password Change
- **ID:** `FR-AUTH-005`
- **Description:** Users created with temporary passwords (`tempPass: true`) must be forced to set a permanent password before accessing any protected route.
- **Enforcement:** Frontend `ForcePasswordGuard` intercepts navigation and redirects to `/force-password-change`. Password update clears `tempPass` flag and invalidates all prior sessions.

---

### 4.2 Module 2: Department Isolation & Granular ACL

#### 4.2.1 Operational Division Workspaces
- **ID:** `FR-DEPT-001`
- **Description:** The system must segregate mission data into five operational divisions:
  1. `TTC` — Telemetry, Tracking & Command
  2. `FDD` — Flight Dynamics Division
  3. `MOX` — Mission Operations Complex
  4. `NETRA` — Space Situational Awareness & Debris Tracking
  5. `GSO` — Ground Station Operations

#### 4.2.2 Access Control Matrix & Caching
- **ID:** `FR-DEPT-002`
- **Description:** Access to department files is validated via `deptAccessMiddleware`.
- **Processing Logic:**
  - `ADMIN` role bypasses department checks (`READ_WRITE` granted automatically).
  - `MEMBER` access is queried against `UserDepartmentAccess` table.
  - Results (`READ_ONLY`, `READ_WRITE`, or `none`) are cached in Redis under `dept-access:{userId}:{deptId}` with a 300-second (5-minute) TTL.
  - Access violations immediately throw HTTP 403 `dept_access_denied`.

#### 4.2.3 Public Department Landing Pages
- **ID:** `FR-DEPT-003`
- **Description:** Departments with `isPageEnabled: true` provide public overviews accessible to unauthenticated visitors, showcasing division objectives, lead officers, contact points, banner imagery, and featured public reports.

---

### 4.3 Module 3: File Repository, Telemetry & Ingestion Engine

#### 4.3.1 Single-Shot Upload Pipeline (≤50MB)
- **ID:** `FR-FILE-001`
- **Preconditions:** Authenticated as `ADMIN`, active department access, storage mount available.
- **Processing Logic:**
  1. Multer receives file payload into memory buffer.
  2. Sanitize filename (strip non-alphanumeric characters, retain valid extension).
  3. Construct destination path: `{HDD_MOUNT_PATH}/{DEPT}/{SPACECRAFT}/{PARENT_FOLDER}/{FILENAME}`.
  4. Path traversal guard validates resolved path starts with `HDD_MOUNT_PATH`.
  5. Check for existing file: if present, increment `versionCount` and write to versioned filename.
  6. Write file atomically via temporary `.tmp` file and rename.
  7. Stream compute SHA-256 cryptographic checksum.
  8. Execute Prisma database transaction: insert `File` / `FileVersion` / `Report` records.
  9. On database error: execute compensation hard-delete of physical file from disk.
  10. Publish `file.upload.{deptId}` event to Redis Pub/Sub.

#### 4.3.2 Sequential Multi-Chunk Upload Pipeline (≤500MB)
- **ID:** `FR-FILE-002`
- **Processing Logic:**
  1. Frontend splits files >10MB into sequential 5MB chunks via Web Crypto API.
  2. Each chunk is transmitted to `POST /files/upload/chunk` with `chunkIndex` and `totalChunks`.
  3. Server persists chunks into temporary directory: `{HDD_MOUNT_PATH}/.chunks/{deptId}_{fileName}/`.
  4. Upon final chunk transmission, client triggers `POST /files/upload/complete`.
  5. Server concatenates chunk streams in sequential order, validates total byte length, moves assembled file to final storage hierarchy, computes final SHA-256 hash, inserts database metadata, and cleans up temporary chunk directory.

#### 4.3.3 File Streaming & Resumable Downloads
- **ID:** `FR-FILE-003`
- **Description:** Supports high-speed downloads and inline media streaming.
- **Features:**
  - Rate-limited to 100 downloads per hour per user via `downloadRateLimiter`.
  - Sends `Content-Disposition: attachment; filename="{encodedName}"` for downloads.
  - Supports HTTP `Range` headers (HTTP 206 Partial Content) for seeking video and large binary files.

#### 4.3.4 Version History & File Restoration
- **ID:** `FR-FILE-004`
- **Description:** When an updated file is uploaded to an existing path, the system maintains an immutable audit chain in `FileVersion`. Files deleted by administrators are soft-deleted (`deletedAt` timestamp set). Administrators can inspect version history or restore soft-deleted files.

---

### 4.4 Module 4: Storage Mount Reconciliation & Health Daemon

#### 4.4.1 Storage Reconciliation Daemon (`hddSyncService`)
- **ID:** `FR-SYNC-001`
- **Execution:** Runs at boot and every 15 minutes via background interval timer.
- **Three-Phase Reconciliation:**
  - **Phase 1 (Disk → DB Discovery):** Recursively crawls `HDD_MOUNT_PATH`. Any file found on disk that does not exist in the database is registered as `status: 'UNREGISTERED'`, mapped to the nearest department folder, and assigned to the system administrator.
  - **Phase 2 (Size & Timestamp Update):** Existing records on disk have their `sizeBytes` and `lastSynced` timestamps updated.
  - **Phase 3 (DB → Disk Orphan Detection):** Queries all `ACTIVE` files in database. If a record's physical `hddPath` no longer exists on disk, the database status is changed to `ORPHANED`.
- **Output:** Publishes completion statistics `{ registered, orphaned, updated }` to Redis channel `hdd.sync`.

#### 4.4.2 Active Storage Health Probe (`hddHealthService`)
- **ID:** `FR-SYNC-002`
- **Execution:** Runs every 60 seconds.
- **Mechanism:** Executes write-read-delete cycle on `{HDD_MOUNT_PATH}/.health_probe`.
- **Degradation Handling:** If the probe fails, sets Redis key `hdd:degraded` (TTL: 120s), dispatches critical alert email to `ADMIN_EMAIL`, and activates 503 circuit-breaker on file upload/download endpoints via `hddAvailabilityMiddleware`.

---

### 4.5 Module 5: Real-Time Event Dispatch & WebSocket Bridge

#### 4.5.1 WebSocket Connection Lifecycle
- **ID:** `FR-WS-001`
- **Endpoint:** `ws://<host>/ws?token=<accessToken>`
- **Processing Logic:**
  1. On connection handshake, extract and verify JWT access token.
  2. Fetch user's active department memberships from database.
  3. Register client connection in memory `Map<userId, ConnectedClient[]>`.
  4. Initiate 30-second ping heartbeat timer.
  5. If client fails 3 consecutive pings (90 seconds of silence), terminate socket.
  6. On invalid token: terminate with WebSocket close code `4401`.

#### 4.5.2 Multi-Channel Redis Pub/Sub Relaying
- **ID:** `FR-WS-002`
- **Message Routing Table:**
  | Redis Channel / Pattern | Target Audience | WS Event Name |
  | :--- | :--- | :--- |
  | `cms.update` | All connected clients | `CMS_UPDATE` |
  | `notification.broadcast` | All connected clients | `NOTIFICATION` |
  | `notification.{userId}` | Specific user session(s) | `NOTIFICATION` |
  | `file.upload.{deptId}` | Department members + Admins | `FILE_UPLOAD` |
  | `file.deleted.{deptId}` | Department members + Admins | `FILE_DELETED` |
  | `hdd.sync` | Admin clients only | `SYNC_COMPLETE` |

---

### 4.6 Module 6: Mission Calendar & Event Scheduling

#### 4.6.1 Mission Events Engine
- **ID:** `FR-EVT-001`
- **Categories Supported:**
  1. `MISSION_PASS` — Satellite tracking pass window (AOS to LOS).
  2. `ORBIT_MANEUVER` — Trajectory correction burn, stationkeeping.
  3. `LAUNCH` — Launch vehicle tracking & deployment pass.
  4. `MAINTENANCE` — Antenna receiver calibration, cryo-service.
  5. `SEMINAR` / `REVIEW` — Technical review meeting, shift handover.
  6. `ANOMALY` — Spacecraft telemetry anomaly investigation.
- **Attributes:** Title, description, satellite association, department association, start date/time, end date/time, location, urgency (`NORMAL`, `IMPORTANT`, `CRITICAL`), and `showOnBanner` flag.

#### 4.6.2 Public Active Banner Broadcast
- **ID:** `FR-EVT-002`
- **Description:** Events flagged with `showOnBanner: true` are exposed via unauthenticated endpoint `GET /events/active-banner` and rendered in the top notification marquee across all portal pages.

---

### 4.7 Module 7: Dynamic Content Management System (CMS)

#### 4.7.1 Key-Value CMS Block Repository
- **ID:** `FR-CMS-001`
- **Description:** Provides editable landing page content stored in the `CmsBlock` table.
- **Core Blocks:**
  - `hero` — Headline, subtitle, action buttons, image carousel.
  - `announcements` — Real-time operational news marquee.
  - `access_panel` — Facility network overview.
  - `calendar_events` — Scheduled milestone highlights.
  - `featured_reports` — Curated telemetry datasets.
  - `divisions` — Mission control division cards.
- **Live Updating:** Administrator edits to `PUT /cms/blocks/:key` persist JSON to database and trigger instant Redis publish to `cms.update` → WebSocket push `CMS_UPDATE` to all connected browser clients.

---

### 4.8 Module 8: Unified Full-Text Search & Cataloging

#### 4.8.1 Role-Scoped Multi-Field Search
- **ID:** `FR-SRCH-001`
- **Endpoint:** `GET /search?q={term}&departmentId={id}&page={page}`
- **Search Target Fields:** File name, description, extension, physical path, report title, spacecraft name, department name, department code.
- **Access Gating:** Non-admin search results are automatically filtered to include only files belonging to departments for which the user holds active ACL permissions.

---

### 4.9 Module 9: Immutable Audit Logging & System Diagnostics

#### 4.9.1 Non-Blocking Audit Middleware
- **ID:** `FR-AUD-001`
- **Description:** Global Express middleware hooking `res.on('finish')`.
- **Recording Rule:** Every successful (`statusCode < 400`) mutating HTTP call (`POST`, `PUT`, `PATCH`, `DELETE`) by an authenticated user is asynchronously inserted into the `AuditLog` table with user ID, action string, resource type, resource ID, IP address, and user-agent string.

#### 4.9.2 Cursor-Paginated Audit Log Viewer
- **ID:** `FR-AUD-002`
- **Description:** Administrator UI for querying audit records using BigInt cursor pagination, supporting filters by action type, user ID, start date, and end date.

---

## 5. Non-Functional Requirements (NFRs)

### 5.1 Performance & Scalability Requirements
- **NFR-PERF-001 (API Latency):** Standard database read/write queries must respond in ≤100ms under 95th percentile load.
- **NFR-PERF-002 (Throughput):** System must support a minimum of 200 concurrent active WebSocket client connections per backend instance.
- **NFR-PERF-003 (Upload Performance):** Ingestion throughput must sustain a minimum of 50 MB/s sequential write performance on local storage mounts.
- **NFR-PERF-004 (Caching):** Department ACL checks and storage availability checks must resolve from Redis in ≤5ms.

### 5.2 Reliability & Fault Tolerance Requirements
- **NFR-REL-001 (Availability):** Target system availability of 99.95% during operational mission support windows.
- **NFR-REL-002 (Compensation on Failure):** If a file upload transaction fails during database insertion, the temporary physical file must be purged immediately to prevent disk space leakage.
- **NFR-REL-003 (Graceful Degradation):** If Redis service becomes unreachable, rate-limiters, pub/sub, and session checks must automatically degrade to in-memory fallback mode without crashing the Node.js process.

### 5.3 Security & Information Assurance Requirements
- **NFR-SEC-001 (Authentication):** Passwords must be hashed using bcrypt (12 rounds). Plaintext passwords must never be logged or stored.
- **NFR-SEC-002 (Token Segregation):** Access tokens (15-min TTL) and refresh tokens (7-day TTL) must use cryptographically independent secrets (`JWT_SECRET` vs `JWT_REFRESH_SECRET`).
- **NFR-SEC-003 (Cookie Security):** Refresh cookies must strictly enforce `httpOnly: true`, `SameSite: Strict`, and `secure: true` in production environments.
- **NFR-SEC-004 (Path Traversal Protection):** All filesystem operations must resolve absolute paths and verify that the target path begins with `HDD_MOUNT_PATH`.
- **NFR-SEC-005 (Audit Trail Immutability):** The `AuditLog` database table must be append-only. No application API or interface shall support updating or deleting audit records.

### 5.4 Maintainability & Extensibility Requirements
- **NFR-MAINT-001 (Modularity):** Clean architectural separation across `/config`, `/lib`, `/middleware`, `/routes`, `/services`, and `/ws`.
- **NFR-MAINT-002 (Type Safety):** 100% strict TypeScript typing across both frontend and backend codebases.
- **NFR-MAINT-003 (Database Migrations):** All schema modifications must be tracked via version-controlled Prisma SQL migration scripts.

### 5.5 Air-Gap & Self-Containment Standards
- **NFR-AIRGAP-001 (Zero External Assets):** Zero runtime requests to external networks. All fonts, icons (`lucide-react`), UI scripts, and workers (`pdf.worker.min.mjs`) must be bundled locally into static build assets.

---

## 6. Data Model & Database Schema

### 6.1 Entity-Relationship Model

```
┌──────────────┐       1:N       ┌────────────────────────┐
│  Satellite   ├─────────────────┤       Department       │
└──────┬───────┘                 └───────────┬────────────┘
       │                                     │
       │ 1:N                                 │ 1:N
       ▼                                     ▼
┌──────────────┐                 ┌────────────────────────┐       1:N       ┌──────────────┐
│ MissionEvent │                 │          File          ├─────────────────┤ FileVersion  │
└──────────────┘                 └───────────┬────────────┘                 └──────────────┘
                                             │
                                             │ 1:1 (Optional)
                                             ▼
                                 ┌────────────────────────┐
                                 │         Report         │
                                 └────────────────────────┘

┌──────────────┐       1:N       ┌────────────────────────┐       N:1       ┌──────────────┐
│     User     ├─────────────────┤  UserDepartmentAccess  ├─────────────────┤  Department  │
└──────┬───────┘                 └────────────────────────┘                 └──────────────┘
       │
       │ 1:N
       ├─────────────────────────┬────────────────────────┬─────────────────┐
       ▼                         ▼                        ▼                 ▼
┌──────────────┐          ┌──────────────┐         ┌──────────────┐  ┌──────────────┐
│ RefreshToken │          │ Notification │         │   AuditLog   │  │ PasswordReset│
└──────────────┘          └──────────────┘         └──────────────┘  └──────────────┘
```

### 6.2 Data Dictionary

#### 6.2.1 `User` Table
| Column | Data Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `VARCHAR(191)` | Primary Key, UUID | Unique user identifier. |
| `name` | `VARCHAR(191)` | Not Null | Full legal/display name. |
| `designation` | `VARCHAR(191)` | Nullable | Official post / title (e.g. Sci/Eng-SE). |
| `email` | `VARCHAR(191)` | Unique, Not Null | Official ISRO email address. |
| `employeeId` | `VARCHAR(191)` | Unique, Nullable | ISRO badge / employee ID number. |
| `phone` | `VARCHAR(191)` | Nullable | Primary contact telephone number. |
| `passwordHash` | `VARCHAR(191)` | Not Null | bcrypt hash (12 rounds). |
| `role` | `ENUM('ADMIN','MEMBER')`| Default: `'MEMBER'` | System authority tier. |
| `status` | `ENUM('PENDING','ACTIVE','SUSPENDED','REJECTED')` | Default: `'PENDING'` | Lifecycle state. |
| `tempPass` | `BOOLEAN` | Default: `false` | First-login forced password change flag. |
| `lastLogin` | `DATETIME(3)` | Nullable | Timestamp of most recent login. |
| `createdAt` | `DATETIME(3)` | Default: `now()` | Registration submission timestamp. |
| `deletedAt` | `DATETIME(3)` | Nullable | Soft-delete timestamp. |

#### 6.2.2 `Department` Table
| Column | Data Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `VARCHAR(191)` | Primary Key, UUID | Unique department identifier. |
| `name` | `VARCHAR(191)` | Not Null | Full division title. |
| `code` | `VARCHAR(191)` | Unique, Not Null | Short identifier (`TTC`, `FDD`, `MOX`, etc). |
| `description`| `TEXT` | Nullable | Operational mandate overview. |
| `hddPath` | `VARCHAR(191)` | Not Null | Physical storage directory path. |
| `satelliteId`| `VARCHAR(191)` | Nullable, FK → Satellite | Primary spacecraft association. |
| `isActive` | `BOOLEAN` | Default: `true` | Operational status flag. |
| `isPageEnabled`| `BOOLEAN` | Default: `true` | Public landing page visibility flag. |

#### 6.2.3 `File` Table
| Column | Data Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `VARCHAR(191)` | Primary Key, UUID | Unique file node identifier. |
| `name` | `VARCHAR(191)` | Not Null | Physical filename on disk. |
| `nodeType` | `ENUM('FILE','FOLDER')` | Default: `'FILE'` | Filesystem entity type. |
| `hddPath` | `VARCHAR(500)` | Unique, Not Null | Absolute path on storage array. |
| `sizeBytes` | `BIGINT` | Default: `0` | File size in bytes (64-bit). |
| `mimeType` | `VARCHAR(191)` | Nullable | MIME classification string. |
| `extension` | `VARCHAR(191)` | Nullable | File extension without dot (`PDF`, `DAT`). |
| `sha256` | `VARCHAR(191)` | Nullable | Cryptographic checksum string. |
| `status` | `ENUM('ACTIVE','UNREGISTERED','ORPHANED','DELETED')` | Default: `'ACTIVE'` | Storage lifecycle status. |
| `versionCount`| `INT` | Default: `1` | Total version count. |
| `departmentId`| `VARCHAR(191)`| FK → Department | Parent operational division. |
| `parentId` | `VARCHAR(191)` | Nullable, FK → File | Parent folder hierarchy node. |
| `uploaderId` | `VARCHAR(191)` | FK → User | Author / ingesting administrator. |
| `lastSynced` | `DATETIME(3)` | Nullable | Timestamp of last storage reconciliation. |

#### 6.2.4 `AuditLog` Table
| Column | Data Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `BIGINT` | Primary Key, Auto-Inc | Monotonically increasing sequence ID. |
| `userId` | `VARCHAR(191)` | Nullable, FK → User | Actor user ID (null for system). |
| `action` | `VARCHAR(191)` | Not Null | Operation tag (`POST:/files/upload`, etc). |
| `resourceType`| `VARCHAR(191)`| Not Null | Entity category (`file`, `user`, `config`). |
| `resourceId` | `VARCHAR(191)` | Nullable | Target entity identifier. |
| `oldValue` | `LONGTEXT` | Nullable, JSON | State before modification. |
| `newValue` | `LONGTEXT` | Nullable, JSON | State after modification. |
| `ipAddress` | `VARCHAR(191)` | Nullable | Client network IP address. |
| `userAgent` | `VARCHAR(191)` | Nullable | Client browser / console user-agent string. |
| `createdAt` | `DATETIME(3)` | Default: `now()` | Immutable event timestamp. |

---

## 7. Verification & Acceptance Criteria

### 7.1 Traceability Matrix
| Requirement ID | Module | Verification Method | Pass Criteria |
| :--- | :--- | :--- | :--- |
| `FR-AUTH-001` | Auth | Automated API Test | Registration creates PENDING user; password stored as bcrypt hash ≥12 cost. |
| `FR-AUTH-003` | Auth | Security Penetration | Rate limiter triggers HTTP 429 upon 11th failed attempt; refresh cookie set as httpOnly. |
| `FR-DEPT-002` | Dept ACL | Access Control Test | Non-member user receives HTTP 403 when accessing restricted department file tree. |
| `FR-FILE-001` | Ingestion | Integrity Test | Uploaded file SHA-256 computed on disk matches client Web Crypto checksum exactly. |
| `FR-FILE-002` | Chunking | Boundary Test | 100MB file successfully splits, transmits in 5MB parts, reassembles atomically without byte corruption. |
| `FR-SYNC-001` | Daemon | Storage Sync Test | File dropped onto disk via CLI is discovered and marked `UNREGISTERED` within 15 minutes. |
| `FR-SYNC-002` | Health | Fault Injection | Simulated storage unmount triggers `hdd:degraded` in Redis and emails admin within 60s. |
| `FR-WS-001` | WebSocket | Heartbeat Test | Disconnected client automatically purged from connection registry after 90s silence. |
| `FR-AUD-001` | Audit | Audit Verification | Mutating API calls generate corresponding immutable record in `AuditLog` table. |

### 7.2 System Acceptance Sign-Off
This Software Requirements Specification represents the complete operational and technical baseline for ISTRAC-SIMS. Formal acceptance and deployment to the ISRO Ground Station Network is contingent upon 100% verification across all acceptance criteria outlined in Section 7.1.
