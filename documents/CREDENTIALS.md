# 🛰️ ISTRAC-SIMS — Master Credentials Reference Sheet

> **System:** ISRO Telemetry, Tracking and Command Network — Satellite Information Management System (ISTRAC-SIMS)  
> **Classification:** Internal Testing & Access Handover Sheet  
> **Master Default Password:** `ChangeMe123!`

---

## 👤 Application User Accounts

| # | Role Tier | Name / Designation | Email Address | Password | Department Scope |
| :---: | :--- | :--- | :--- | :--- | :--- |
| **1** | **Super Admin** | Super Admin (Director MOX) | `admin@istrac.local` | `ChangeMe123!` | **Global All** (All 5 divisions + `/admin` suite) |
| **2** | **Dept Admin** | Dr. Vikram Sharma (Head TTC) | `ttcadmin@istrac.local` | `ChangeMe123!` | **TTC Directorate** + Admin Console |
| **3** | **Flight Lead** | Dr. Ananya Ray (Orbital Mechanics Lead) | `fddlead@istrac.local` | `ChangeMe123!` | **Flight Dynamics (FDD)** Repositories |
| **4** | **Operator** | Ayan Sharma (Telemetry Flight Operator) | `operator@istrac.local` | `ChangeMe123!` | **MOX** (Full) + **TTC** (Read-Only) |
| **5** | **Analyst** | Rohan Deshmukh (Conjunction Analyst) | `netra@istrac.local` | `ChangeMe123!` | **NETRA / IS4OM** SSA Center |
| **6** | **Applicant** | Priya Nair (Junior Orbit Analyst) | `applicant@istrac.local` | `ChangeMe123!` | ⛔ *Locked* (`status: PENDING` in Approval Queue) |

---

## 📋 Copy-Paste User Credentials Block

```text
=== SUPER ADMIN (FULL SYSTEM ACCESS) ===
Email:       admin@istrac.local
Password:    ChangeMe123!
Employee ID: ISRO-DIR-001
Role:        ADMIN
Scope:       All Departments + Admin Suite (/admin)

=== TTC DEPARTMENT ADMIN ===
Email:       ttcadmin@istrac.local
Password:    ChangeMe123!
Employee ID: ISRO-TTC-042
Role:        ADMIN
Scope:       Telemetry, Tracking & Command (TTC)

=== FLIGHT DYNAMICS LEAD (FDD) ===
Email:       fddlead@istrac.local
Password:    ChangeMe123!
Employee ID: ISRO-FDD-089
Role:        MEMBER
Scope:       Flight Dynamics Division (FDD)

=== FLIGHT TELEMETRY OPERATOR (MOX) ===
Email:       operator@istrac.local
Password:    ChangeMe123!
Employee ID: ISRO-OPS-108
Role:        MEMBER
Scope:       Mission Operations Complex (MOX) + TTC (Read-Only)

=== SPACE SITUATIONAL AWARENESS (NETRA) ===
Email:       netra@istrac.local
Password:    ChangeMe123!
Employee ID: ISRO-SSA-015
Role:        MEMBER
Scope:       IS4OM / NETRA Space Debris Center

=== PENDING APPLICANT (TESTING APPROVAL QUEUE) ===
Email:       applicant@istrac.local
Password:    ChangeMe123!
Employee ID: ISRO-REQ-2026
Role:        MEMBER (PENDING)
Scope:       Locked until approved by Admin in /admin/approvals
```

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
