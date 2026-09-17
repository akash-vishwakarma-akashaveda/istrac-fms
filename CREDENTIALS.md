# 🛰️ ISTRAC-SIMS — Master Credentials Reference Sheet

> **System:** ISRO Telemetry, Tracking and Command Network — Satellite Information Management System (ISTRAC-SIMS)  
> **Classification:** Internal Testing & Access Handover Sheet  
> **Master Default Password:** `ChangeMe123!`

---

## 👤 Seeded Administrator Credentials

| # | Role Tier | Name / Designation | Email Address | Default Password | Department Scope |
| :---: | :--- | :--- | :--- | :--- | :--- |
| **1** | **Super Admin** | Super Admin (Director MOX) | `admin@istrac.local` | `ChangeMe123!` | **Global All** (Sole System Administrator — All divisions + `/admin` suite) |

> [!NOTE]
> **Single Seeded Account Policy:** The database seed provisions exclusively the Super Admin account (`admin@istrac.local`). No placeholder or mock operator accounts are seeded.
> 
> All operational personnel (division leads, flight operators, orbital analysts) register themselves via the web portal at `/register` and are approved and assigned departmental access by the Super Admin in the **Approval Queue** (`/admin/approvals`).

---

## 📋 Copy-Paste Admin Credentials Block

```text
=== SUPER ADMIN (SOLE SYSTEM ADMINISTRATOR) ===
Email:       admin@istrac.local
Password:    ChangeMe123!
Employee ID: ISRO-DIR-001
Role:        ADMIN (Strictly 1 Admin allowed in system)
Scope:       All Departments + Admin Suite (/admin)
```

---

## 🔐 Administrator Password Reset & Recovery Procedures

Because the system strictly enforces a **Single Administrator Architecture** and operates within an **air-gapped / intranet environment** without public email connectivity:

### Method 1: Terminal / Server CLI Command (Direct Recovery)
From the server terminal (or SSH session), execute the administrative password reset utility:
```bash
# In backend directory:
npm run admin:reset-password -- "YourNewSecurePassword123!"

# Or from project root:
npm run admin:reset-password -- "YourNewSecurePassword123!"
```
This utility:
- Hashes the new password using bcrypt (12 salt rounds).
- Updates `admin@istrac.local` directly in MariaDB.
- Revokes all active refresh tokens for the admin account to terminate rogue sessions.
- Writes an immutable entry into `AuditLog`.

### Method 2: High-Visibility Terminal Broadcast
1. Go to `/forgot-password` in the web portal.
2. Enter `admin@istrac.local` and click **Request Verification Code**.
3. Because external SMTP is disabled, the backend automatically logs the 6-digit OTP in an eye-catching ASCII banner directly to the server terminal (`stdout` / `journalctl -u istrac-backend -f`):
```text
============================================================
🔐 [ADMIN PASSWORD RESET OTP BROADCAST]
   Account: admin@istrac.local
   OTP Code: 549120
   Valid for: 15 minutes
============================================================
```
4. Enter the code on the web screen along with the new password to complete the reset.

---

## 📩 Operator / Member Password Reset Workflow (Air-Gapped Mode)

1. **User Request**: User navigates to `/forgot-password`, enters their registered email, and submits.
2. **OTP Generation**: A cryptographic 6-digit OTP is generated and securely stored in `PasswordResetToken` (expires in 15 minutes).
3. **Admin Dispatch Console**: Super Admin opens **OTP & Password Reset Management** (`/admin/password-resets`) from the navigation bar.
4. **Copy / Send**: Admin views the user's active OTP and clicks **"Copy Email Template"** (dynamically branded with CMS App Name and Title) or **"Open Mail Client (mailto:)"** to dispatch the code via the internal secure network or workstation email client.
5. **Completion**: The operator enters the 6-digit OTP and new password on `/forgot-password` to update credentials.

---

## 🗄️ Database & Infrastructure Credentials

| Service | Host / Binding | Port | User | Password / Auth | Database / Scope |
| :--- | :--- | :---: | :--- | :--- | :--- |
| **MariaDB (App User)** | `127.0.0.1` | `3306` | `istrac_app` | `ChangeThisDatabasePassword123!` | `istrac_sims` |
| **MariaDB (Root)** | `127.0.0.1` | `3306` | `root` | `ChangeThisDatabasePassword123!` | Full Server |
| **Redis Cache / PubSub**| `127.0.0.1` | `6379` | *None* | *None (Localhost Loopback)* | Databases 0-15 |
| **Node.js Backend** | `127.0.0.1` | `3000` | `istrac` | Internal Express API | `/api` and `/ws` |
| **Nginx Web Gateway** | `0.0.0.0` | `80, 443` | `nginx` | SSL / TLS Certificate | Frontend SPA + Reverse Proxy |

---

## 🔑 Environment Secrets & Tokens (Defaults)

```env
# Database Connection URL (TCP 127.0.0.1)
DATABASE_URL="mysql://istrac_app:ChangeThisDatabasePassword123!@127.0.0.1:3306/istrac_sims"

# Redis Cache URL
REDIS_URL="redis://127.0.0.1:6379"

# Storage Subsystem Mount
HDD_MOUNT_PATH=/mnt/istrac_data

# Cryptographic Token Secrets (Default Dev/Staging)
JWT_SECRET="c6b12a890efd432b1a87e59c03841029e8473210abef49c81203948576dbe123"
JWT_REFRESH_SECRET="e9812734bca098471239847abfe0912384712093847120938471209384712093"
```
