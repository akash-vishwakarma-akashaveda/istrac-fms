# ISTRAC-SIMS — Seeded Test Accounts & Credentials Reference

> **System:** ISRO Telemetry, Tracking & Command Network (ISTRAC) — Satellite Information Management System (ISTRAC-SIMS)  
> **Classification:** Internal Testing & Quality Assurance Reference  
> **Environment:** Staging / Air-Gapped Intranet Lab  
> **Document Version:** 1.0.0  
> **Location:** `documents/TEST_CREDENTIALS_AND_ACCOUNTS.md`

---

## 📑 Table of Contents

1. [Important Security Notice](#1-important-security-notice)
2. [Master Test Credentials Matrix (Quick Reference)](#2-master-test-credentials-matrix-quick-reference)
3. [Persona Profiles & Role Responsibilities](#3-persona-profiles--role-responsibilities)
   - [3.1 Super Admin (Director MOX)](#31-super-admin-director-mox)
   - [3.2 Department Admin (Head TTC)](#32-department-admin-head-ttc)
   - [3.3 Astrodynamics Lead (FDD Lead)](#33-astrodynamics-lead-fdd-lead)
   - [3.4 Flight Telemetry Console Operator (MOX Operator)](#34-flight-telemetry-console-operator-mox-operator)
   - [3.5 Space Situational Awareness Analyst (NETRA SSA)](#35-space-situational-awareness-analyst-netra-ssa)
   - [3.6 Pending Registration Applicant (Approval Queue Test)](#36-pending-registration-applicant-approval-queue-test)
4. [Department Access Control Matrix (ACL)](#4-department-access-control-matrix-acl)
5. [End-to-End Testing Scenarios & Walkthroughs](#5-end-to-end-testing-scenarios--walkthroughs)
   - [Scenario A: Administrator User Approval & Department Provisioning](#scenario-a-administrator-user-approval--department-provisioning)
   - [Scenario B: Department Isolation & RBAC Boundary Testing](#scenario-b-department-isolation--rbac-boundary-testing)
   - [Scenario C: Telemetry File Ingestion, Versioning & Download](#scenario-c-telemetry-file-ingestion-versioning--download)
   - [Scenario D: Real-Time WebSocket Notification & Broadcast](#scenario-d-real-time-websocket-notification--broadcast)
   - [Scenario E: Password Reset & First-Login Security Rotation](#scenario-e-password-reset--first-login-security-rotation)
6. [API Testing Snippets (cURL & Postman)](#6-api-testing-snippets-curl--postman)

---

## 1. Important Security Notice

> [!WARNING]
> **DEFAULT PASSWORD POLICY FOR PRODUCTION:**
> All seeded accounts in development/staging environments share the baseline testing password: `ChangeMe123!`.
> When deploying to live mission operations on the ISRO Intranet, all default credentials **must be rotated immediately** using the administrator user management console or database update script.

---

## 2. Master Test Credentials Matrix (Quick Reference)

| Email | Password | Role | Designation | Status | Accessible Workspace |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `admin@istrac.local` | `ChangeMe123!` | **ADMIN** | Director, Mission Operations & Ground Segment | `ACTIVE` | **Global All** (TTC, FDD, MOX, NETRA, GSO, Admin Suite) |
| `ttcadmin@istrac.local` | `ChangeMe123!` | **ADMIN** | Head, Telemetry Tracking & Command Network | `ACTIVE` | **TTC Directorate** + Admin Console |
| `fddlead@istrac.local` | `ChangeMe123!` | **MEMBER** | Lead Astrodynamics Specialist | `ACTIVE` | **Flight Dynamics (FDD)** Repositories |
| `operator@istrac.local` | `ChangeMe123!` | **MEMBER** | Flight Telemetry Console Operator | `ACTIVE` | **MOX** (Full) + **TTC** (Read-Only) |
| `netra@istrac.local` | `ChangeMe123!` | **MEMBER** | Space Situational Awareness Analyst | `ACTIVE` | **NETRA / IS4OM** SSA Center |
| `applicant@istrac.local`| `ChangeMe123!` | **MEMBER** | Junior Orbit Analyst | `PENDING` | *None* (Locked — in Approval Queue) |

---

## 3. Persona Profiles & Role Responsibilities

### 3.1 Super Admin (Director MOX)
- **Account:** `admin@istrac.local`
- **Password:** `ChangeMe123!`
- **Employee ID:** `ISRO-DIR-001`
- **Phone:** `+91-80-2838-4001`
- **Role Tier:** Global `ADMIN`
- **Primary Use Cases:**
  - Full access to the `/admin` navigation suite.
  - Reviewing and approving pending access requests in the **Approval Queue** (`/admin/approvals`).
  - Managing user roles, status suspensions, and password resets (`/admin/users`).
  - Managing CMS dynamic blocks, landing page hero text, and announcements (`/admin/cms`).
  - Publishing system-wide broadcast banners and notifications (`/admin/broadcast`).
  - Inspecting cursor-paginated regulatory audit logs (`/admin/audit`).
  - Triggering storage reconciliation sync daemon (`/admin/sync`).

---

### 3.2 Department Admin (Head TTC)
- **Account:** `ttcadmin@istrac.local`
- **Password:** `ChangeMe123!`
- **Employee ID:** `ISRO-TTC-042`
- **Phone:** `+91-80-2838-4042`
- **Role Tier:** Department `ADMIN`
- **Primary Use Cases:**
  - Managing Telemetry, Tracking & Command (TTC) division folders and datasets.
  - Uploading single-shot and chunked satellite pass recordings (`.bin`, `.dat`, `.fits`).
  - Updating TTC public department landing page metadata (`/departments/public/ttc`).
  - Granting and revoking operator memberships within the TTC department.

---

### 3.3 Astrodynamics Lead (FDD Lead)
- **Account:** `fddlead@istrac.local`
- **Password:** `ChangeMe123!`
- **Employee ID:** `ISRO-FDD-089`
- **Phone:** `+91-80-2838-4089`
- **Role Tier:** Operational `MEMBER`
- **Primary Use Cases:**
  - Inspecting high-precision orbit determination state vectors and trajectory models.
  - Viewing orbital maintenance maneuver campaigns on the **Mission Calendar**.
  - Downloading ephemeris datasets, orbit state vectors, and halo orbit reports.
  - Read-only navigation across the user dashboard (`/dashboard`).

---

### 3.4 Flight Telemetry Console Operator (MOX Operator)
- **Account:** `operator@istrac.local`
- **Password:** `ChangeMe123!`
- **Employee ID:** `ISRO-OPS-108`
- **Phone:** `+91-80-2838-4108`
- **Role Tier:** Operational `MEMBER`
- **Primary Use Cases:**
  - 24/7 Mission Control console operations monitoring.
  - Accessing Mission Operations Complex (**MOX**) flight shift logs and telemetry decommutation files.
  - Read-only inspection of **TTC** tracking pass downlink files.
  - Tracking live mission events and active notification broadcasts.

---

### 3.5 Space Situational Awareness Analyst (NETRA SSA)
- **Account:** `netra@istrac.local`
- **Password:** `ChangeMe123!`
- **Employee ID:** `ISRO-SSA-015`
- **Phone:** `+91-80-2838-4015`
- **Role Tier:** Operational `MEMBER`
- **Primary Use Cases:**
  - Reviewing space debris close approach conjunction assessments and collision screening reports.
  - Accessing IS4OM / NETRA operational repository files.
  - Monitoring conjunction screening alerts on the top marquee banner.

---

### 3.6 Pending Registration Applicant (Approval Queue Test)
- **Account:** `applicant@istrac.local`
- **Password:** `ChangeMe123!`
- **Employee ID:** `ISRO-REQ-2026`
- **Phone:** `+91-80-2838-4226`
- **Status:** `PENDING`
- **Primary Use Cases:**
  - **Login Test:** Attempting login with this account should fail with HTTP 403 `account_pending` ("Your account is pending administrator approval").
  - **Admin Workflow Test:** Appears inside the **Approval Queue** (`/admin/approvals`) on the Super Admin console, enabling testers to practice:
    1. Approving the applicant and granting them access to FDD / TTC.
    2. Rejecting the applicant with an optional rejection reason.

---

## 4. Department Access Control Matrix (ACL)

The matrix below illustrates the seeded departmental boundary and permissions for each test user:

| User Account | TTC Division | FDD Division | MOX Complex | NETRA / IS4OM | GSO Network | Admin Suite (`/admin`) |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| **`admin@istrac.local`** | `READ_WRITE` | `READ_WRITE` | `READ_WRITE` | `READ_WRITE` | `READ_WRITE` | ✅ **Full Authority** |
| **`ttcadmin@istrac.local`** | `READ_WRITE` | `READ_ONLY` | `READ_ONLY` | `READ_ONLY` | `READ_ONLY` | ✅ **Admin Access** |
| **`fddlead@istrac.local`** | ⛔ *No Access* | `READ_WRITE` | ⛔ *No Access* | ⛔ *No Access* | ⛔ *No Access* | ❌ *Restricted* |
| **`operator@istrac.local`**| `READ_ONLY` | ⛔ *No Access* | `READ_WRITE` | ⛔ *No Access* | ⛔ *No Access* | ❌ *Restricted* |
| **`netra@istrac.local`** | ⛔ *No Access* | ⛔ *No Access* | ⛔ *No Access* | `READ_WRITE` | ⛔ *No Access* | ❌ *Restricted* |
| **`applicant@istrac.local`**| ⛔ *Locked* | ⛔ *Locked* | ⛔ *Locked* | ⛔ *Locked* | ⛔ *Locked* | ⛔ *Locked* |

*Note: In ISTRAC-SIMS, `MEMBER` users with `READ_WRITE` access operate within the user dashboard to view and download repository files. File mutations (uploading new files, deleting, restoring) require the global `ADMIN` role.*

---

## 5. End-to-End Testing Scenarios & Walkthroughs

### Scenario A: Administrator User Approval & Department Provisioning
1. **Attempt Applicant Login:**
   - Navigate to `/login`.
   - Enter `applicant@istrac.local` / `ChangeMe123!`.
   - **Expected Result:** Login is blocked. Banner displays `"Your account is pending administrator approval"`.
2. **Log in as Super Admin:**
   - Sign in with `admin@istrac.local` / `ChangeMe123!`.
   - System redirects to the Admin Dashboard (`/admin`).
3. **Approve Application:**
   - Click **Approval Queue** in the sidebar navigation (`/admin/approvals`).
   - Locate `Priya Nair (Junior Orbit Analyst)`.
   - Select target department (`Flight Dynamics Division (FDD)`), choose Access Level (`READ_WRITE`), and click **Approve Application**.
4. **Verify Approved Login:**
   - Log out, then log in as `applicant@istrac.local`.
   - **Expected Result:** Login succeeds. User lands on `/dashboard` and sees the FDD department repository card.

---

### Scenario B: Department Isolation & RBAC Boundary Testing
1. **Log in as FDD Lead:**
   - Sign in with `fddlead@istrac.local` / `ChangeMe123!`.
2. **Verify Accessible Repositories:**
   - Dashboard displays access to **Flight Dynamics Division (FDD)**.
   - Navigate to `/departments/fdd/files` — file list loads successfully.
3. **Attempt Unauthorized Department Access:**
   - Manually navigate to `/departments/netra/files` or `/departments/mox/files`.
   - **Expected Result:** System enforces boundary check. UI displays Access Denied toast / error dialog, and backend API returns HTTP 403 `dept_access_denied`.
4. **Attempt Unauthorized Admin Suite Access:**
   - Manually navigate to `/admin` or `/admin/users`.
   - **Expected Result:** `AdminRoute` guard intercepts navigation and immediately redirects back to `/dashboard`.

---

### Scenario C: Telemetry File Ingestion, Versioning & Download
1. **Log in as Super Admin (`admin@istrac.local`)**:
   - Navigate to **Department Repositories** → Select **TTC**.
2. **Execute Single-Shot File Upload (≤50MB):**
   - Click **Upload File**.
   - Select a sample telemetry `.dat` or `.pdf` file (e.g. `ADITYA_L1_SOLAR_WIND_20260827.dat`).
   - Assign Spacecraft (`Aditya-L1`), Category (`SPECIAL_OPERATIONS`), Classification (`RESTRICTED`).
   - Click **Upload File**.
   - **Expected Result:** File progress completes, SHA-256 checksum is computed and validated, file appears in the repository list.
3. **Execute Version Update:**
   - Upload another file with the exact same name to the same department folder.
   - **Expected Result:** Version count increments to `v2`.
4. **Inspect Version History Drawer:**
   - Click the **History** (clock) icon on the file row.
   - Right-side `VersionHistoryPanel` opens, displaying `v2` (current) and `v1` with timestamps, author names, and distinct SHA-256 hashes.
5. **Download & Stream:**
   - Click **Download** — file streams with `Content-Disposition` header.
   - Click **Preview** (`Eye` icon) — multi-format preview modal opens displaying contents.

---

### Scenario D: Real-Time WebSocket Notification & Broadcast
1. **Open Dual Browser Windows:**
   - Window 1: Logged in as `admin@istrac.local` (Super Admin).
   - Window 2: Logged in as `operator@istrac.local` (Flight Operator).
2. **Dispatch System Broadcast from Window 1:**
   - Navigate to `/admin/broadcast` (or **Broadcast Notifications**).
   - Enter Message: `"CRITICAL: Chandrayaan-3 Deep Space Pass Scheduled for 14:00 UTC"`.
   - Select Category: `MISSION` · Urgency: `CRITICAL`.
   - Click **Send System Broadcast**.
3. **Observe Window 2 (Operator Console):**
   - **Expected Result (Sub-Second):** Toast notification pops up in bottom-right corner without page refresh, and unread notification badge increments in top navigation bar.

---

### Scenario E: Password Reset & First-Login Security Rotation
1. **Admin Triggers Temporary Password Reset:**
   - As Super Admin, navigate to **User Management** (`/admin/users`).
   - Locate `fddlead@istrac.local` and click **Reset Password**.
   - System generates temporary password and flags `tempPass: true`.
2. **User Signs In with Temporary Password:**
   - Log in as `fddlead@istrac.local` using the temporary password.
   - **Expected Result:** `ForcePasswordGuard` intercepts access and immediately redirects to `/force-password-change`.
3. **Set Permanent Password:**
   - Enter new password (testing `PasswordStrengthMeter` dynamically verifying 10+ chars, uppercase, number, symbol).
   - Submit new password.
   - **Expected Result:** Password updates in database, `tempPass` flag is cleared, prior sessions are revoked, and user is redirected to `/dashboard`.

---

## 6. API Testing Snippets (cURL & Postman)

Use these cURL snippets to verify backend endpoints directly from terminal:

### 6.1 Authentication (Login)
```bash
curl -X POST http://127.0.0.1:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@istrac.local",
    "password": "ChangeMe123!"
  }'
```
*Saves the returned `accessToken` in variable `TOKEN` for subsequent requests.*

---

### 6.2 Health & Liveness Probe
```bash
curl -i http://127.0.0.1:3000/health
```

---

### 6.3 Query Department Files (Authenticated)
```bash
curl -X GET "http://127.0.0.1:3000/departments/TTC/files" \
  -H "Authorization: Bearer <YOUR_ACCESS_TOKEN>"
```

---

### 6.4 Query Admin Statistics Dashboard
```bash
curl -X GET http://127.0.0.1:3000/admin/stats \
  -H "Authorization: Bearer <YOUR_ACCESS_TOKEN>"
```

---

### 6.5 Query Cursor-Paginated Regulatory Audit Logs
```bash
curl -X GET "http://127.0.0.1:3000/admin/audit-logs?pageSize=10" \
  -H "Authorization: Bearer <YOUR_ACCESS_TOKEN>"
```
