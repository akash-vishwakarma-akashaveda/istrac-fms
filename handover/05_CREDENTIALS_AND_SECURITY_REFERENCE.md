# 🛰️ ISTRAC-SIMS — Credentials & Security Architecture Reference

> **Document Identifier:** ISTRAC-SIMS-SEC-V2.0  
> **Classification:** ISRO / ISTRAC Operational Security & Access Policy  
> **Application:** Satellite Information Management System (Security Reference)  
> **Version:** 1.1.0 Production Baseline  

---

## 📑 Table of Contents

1. [Master Default Credentials Table](#1-master-default-credentials-table)
2. [Single-Administrator Security Policy](#2-single-administrator-security-policy)
3. [Cryptographic Password Policies & Hashing](#3-cryptographic-password-policies--hashing)
4. [Dual-Token JWT Architecture (Access vs Refresh)](#4-dual-token-jwt-architecture-access-vs-refresh)
5. [Three Methods to Change / Rotate Administrator Credentials](#5-three-methods-to-change--rotate-administrator-credentials)
6. [Emergency Air-Gapped Administrator Lockout Recovery](#6-emergency-air-gapped-administrator-lockout-recovery)
7. [Operator Clearance & Approval Queue Lifecycle](#7-operator-clearance--approval-queue-lifecycle)
8. [Cryptographic Secret Rotation Runbook](#8-cryptographic-secret-rotation-runbook)
9. [Environment Configuration (`.env`) Hardening Standards](#9-environment-configuration-env-hardening-standards)
10. [Network Security & Port Isolation Matrix](#10-network-security--port-isolation-matrix)
11. [Session Revocation & Token Blacklisting](#11-session-revocation--token-blacklisting)
12. [Immutable Audit Log Architecture](#12-immutable-audit-log-architecture)
13. [Production Readiness Security Checklist](#13-production-readiness-security-checklist)

---

## 1. Master Default Credentials Table

> [!CAUTION]
> All default passwords MUST be rotated immediately upon initial system deployment.

| Service / Role | Identity / Username | Default Password | Network Scope | Purpose |
|:---|:---|:---|:---|:---|
| **Web Portal — Super Admin** | `admin@istrac.local` | `ChangeMe123!` | Ground Station Subnet | Master administrator console (`/admin`), user approvals, and system metrics. |
| **MariaDB (App User)** | `istrac_user` | `IstracSecurePass123!` | `127.0.0.1:3306` only | Dedicated service user for Node.js backend queries against `istrac_fms`. |
| **MariaDB (Root User)** | `root` | Socket Authenticated (None) | Localhost socket only | System administrator access via `sudo mysql -u root`. |
| **Redis / Valkey Cache** | None | None | `127.0.0.1:6379` only | Internal loopback in-memory cache and Pub/Sub event bus. |
| **System Service Account** | `istrac` (Linux User) | N/A (System Service) | Host OS only | Owner of `/opt/istrac-fms` and `/mnt/istrac_storage`. |

---

## 2. Single-Administrator Security Policy

The platform strictly enforces a **Single-Administrator Architecture**:
- Exactly **one** active account with `Role === 'ADMIN'` is permitted in the database (`admin@istrac.local`).
- All other ground personnel (mission flight directors, orbital telemetry analysts, payload operators) are assigned the `MEMBER` role with division-scoped permissions.
- Administrative privileges cannot be delegated, preventing privilege escalation attacks.

---

## 3. Cryptographic Password Policies & Hashing

- **Hashing Algorithm:** `bcrypt` with **12 salt rounds** (computationally expensive, protecting against GPU/ASIC rainbow table attacks).
- **Password Complexity Rules:**
  - Minimum 10 characters.
  - At least 1 uppercase letter (`A-Z`).
  - At least 1 lowercase letter (`a-z`).
  - At least 1 numeric digit (`0-9`).
  - At least 1 special character (`!@#$%^&*()_+-=[]{}|;:,.<>?`).

---

## 4. Dual-Token JWT Architecture (Access vs Refresh)

```
Client Browser
      │
      ├─► 1. Access Token: Sent in 'Authorization: Bearer <token>' header
      │      • Lifespan: 15 Minutes (Short-lived)
      │      • Claims: userId, email, role, departmentAccess
      │      • Stored: In-memory only (Never written to localStorage)
      │
      └─► 2. Refresh Token: Sent in 'httpOnly', 'SameSite=Lax' Cookie
             • Lifespan: 7 Days (Long-lived)
             • Cryptographic hash stored in MariaDB 'RefreshToken' table
             • One-time use: Rotated on every /api/auth/refresh call
```

---

## 5. Three Methods to Change / Rotate Administrator Credentials

### Method A: Via Web Portal (Standard User Flow)
1. Log into the portal at `http://<server-ip>/login` as `admin@istrac.local`.
2. Click the user profile icon in the top right navigation bar -> **Profile Settings**.
3. Enter the current password, the new secure password, and confirm.

### Method B: Via CLI Script (Direct Server Console)
From the RHEL server terminal:
```bash
cd /opt/istrac-fms/backend
npm run admin:reset-password -- "YourNewSecurePassword123!"
```
This utility:
- Generates a fresh 12-round bcrypt hash.
- Updates `admin@istrac.local` directly in MariaDB.
- Revokes all existing refresh tokens for the account.
- Logs an entry to `AuditLog`.

### Method C: Direct SQL Update (Emergency Fallback)
```bash
# Generate bcrypt hash using Node:
HASH=$(node -e "console.log(require('bcrypt').hashSync('YourNewPassword123!', 12))")

# Update MariaDB directly:
mysql -u istrac_user -p"IstracSecurePass123!" istrac_fms -e \
  "UPDATE User SET passwordHash='${HASH}' WHERE email='admin@istrac.local';"
```

---

## 6. Emergency Air-Gapped Administrator Lockout Recovery

If the Super Admin is locked out without an external email connection:

1. Navigate to `/forgot-password` in the browser.
2. Enter `admin@istrac.local` and click **Request Verification Code**.
3. Inspect the live systemd journal on the server:
   ```bash
   sudo journalctl -u istrac-backend -n 20 --no-pager
   ```
4. Read the ASCII broadcast banner:
   ```text
   ============================================================
   🔐 [ADMIN PASSWORD RESET OTP BROADCAST]
      Account: admin@istrac.local
      OTP Code: 549120
      Valid for: 15 minutes
   ============================================================
   ```
5. Enter the code in the browser and choose a new password.

---

## 7. Operator Clearance & Approval Queue Lifecycle

```
Operator Registration
       │
       ▼
1. Operator submits /register (Employee ID, Name, Division, Password)
       │
       ▼
2. Account created in MariaDB with status 'PENDING_APPROVAL' (Login blocked)
       │
       ▼
3. Super Admin visits /admin/approvals
       │
       ├─► REJECT: Account marked 'REJECTED'; operator cannot authenticate
       │
       └─► APPROVE: Account marked 'ACTIVE'; assigned to division ACLs
```

---

## 8. Cryptographic Secret Rotation Runbook

To rotate `JWT_SECRET` and `JWT_REFRESH_SECRET`:

```bash
# 1. Generate new 32-byte cryptographically secure random strings
NEW_JWT=$(head -c 32 /dev/urandom | base64 | tr -dc 'a-zA-Z0-9' | head -c 32)
NEW_REFRESH=$(head -c 32 /dev/urandom | base64 | tr -dc 'a-zA-Z0-9' | head -c 32)

# 2. Update /opt/istrac-fms/backend/.env
sudo sed -i "s/^JWT_SECRET=.*/JWT_SECRET=${NEW_JWT}/" /opt/istrac-fms/backend/.env
sudo sed -i "s/^JWT_REFRESH_SECRET=.*/JWT_REFRESH_SECRET=${NEW_REFRESH}/" /opt/istrac-fms/backend/.env

# 3. Restart backend service
sudo systemctl restart istrac-backend
```
*(Note: Rotating secrets will require all currently active operators to log in again).*

---

## 9. Environment Configuration (`.env`) Hardening Standards

The production environment file contains raw database credentials and cryptographic signing keys. It must adhere to strict filesystem permissions:

```bash
# Verify ownership and permissions:
ls -la /opt/istrac-fms/backend/.env
# Expected: -rw-------. 1 istrac istrac /opt/istrac-fms/backend/.env

# Enforce if incorrect:
sudo chown istrac:istrac /opt/istrac-fms/backend/.env
sudo chmod 600 /opt/istrac-fms/backend/.env
```

---

## 10. Network Security & Port Isolation Matrix

| Port | Service | Bound Interface | Accessibility |
|:---:|:---|:---|:---|
| **80** | Apache `httpd` | `0.0.0.0` (All Interfaces) | Ground Station Intranet |
| **443** | Apache `httpd` | `0.0.0.0` (All Interfaces) | Ground Station Intranet |
| **22** | SSH Daemon | Administrative Subnet Only | Station Sysadmins Only |
| **3000** | Express API | `127.0.0.1` (**Loopback Only**) | Blocked from External Access |
| **3306** | MariaDB | `127.0.0.1` (**Loopback Only**) | Blocked from External Access |
| **6379** | Redis Cache | `127.0.0.1` (**Loopback Only**) | Blocked from External Access |

---

## 11. Session Revocation & Token Blacklisting

When an operator logs out or an administrator terminates a session:
1. The refresh token record in the `RefreshToken` database table is deleted.
2. The access token's remaining TTL is added to the Redis (or in-memory) blacklist.
3. Subsequent requests presenting the blacklisted access token are immediately rejected with `401 Token Revoked`.

---

## 12. Immutable Audit Log Architecture

Every mutating operational request generates a non-repudiation record in the `AuditLog` table:

| Field | Description | Example |
|:---|:---|:---|
| `id` | Unique UUID v4 | `550e8400-e29b-41d4-a716-446655440000` |
| `userId` | ID of the authenticated user | `usr_operator_01` |
| `action` | Operational verb | `FILE_DOWNLOAD`, `USER_APPROVED`, `PASS_MODIFIED` |
| `resource` | Target entity | `Telemetry_CH3_Pass_4412.raw` |
| `ipAddress`| Client console IP | `10.20.1.45` |
| `userAgent`| Browser identifier | `Mozilla/5.0 ...` |
| `createdAt`| High-precision timestamp | `2026-09-17T06:12:44.120Z` |

---

## 13. Production Readiness Security Checklist

- [ ] **Default Admin Password Changed:** Admin password rotated from `ChangeMe123!`.
- [ ] **`.env` Protected:** Permissions strictly `600`, owned by `istrac:istrac`.
- [ ] **SELinux Enforcing:** Verified with `getenforce` (must be `Enforcing`).
- [ ] **Firewalld Active:** Only ports `80`, `443`, and `22` are open.
- [ ] **Loopback Bindings:** Verified ports `3000`, `3306`, `6379` are bound to `127.0.0.1`.
- [ ] **Storage Hardening:** `/mnt/istrac_storage` permissions verified `770` (`istrac:istrac`).
