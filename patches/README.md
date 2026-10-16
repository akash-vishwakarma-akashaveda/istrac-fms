# 🛰️ ISTRAC-SIMS — Patches Directory & Release Index

This directory stores self-contained, date-stamped hot-patch packages for deployed customer servers.
Each patch includes all compiled code, installation scripts (`.sh`), service management tools, and step-by-step manuals.

---

## 📦 Available Patch Releases

### Latest: `patch-2026-10-16-brand-ui-security.zip` (Size: ~2.6 MB)
* **Date**: 2026-10-16
* **Contents**:
  * Security: public notification leak closed, system categories protected again, department access isolation, immediate session revocation.
  * Data correctness: no invented placeholder values.
  * New ISRO-brand theme (light + dark), landing page redesign, restyled dashboards.
  * Team updates: scoped notifications, satellite hard-delete, reworked admin pages.
* **Cumulative**: includes everything in 2026-10-09 and earlier, so it can be applied directly.
* **No database migration, no dependency or environment changes.** Installer check 5 probes `GET /api/admin/files/extensions`. Automatic rollback is unchanged.
* **Instructions**: [`patch-2026-10-16-brand-ui-security/README.md`](patch-2026-10-16-brand-ui-security/README.md) · full change list in `CHANGES.md`.

### Previous: `patch-2026-10-09-bugfix-security-ui.zip` (Size: ~2.6 MB)
* **Date**: 2026-10-09
* **Contents**: BUG-01…17 fixes, security hardening (rate limits, login lockout, OTP cap), light/dark theme, UI consistency, Prisma 7 schema fix, `/api/health` no longer fails without Redis.
* **Includes the earlier 2026-09-24 patches** (built from current source), so it can be applied directly on top of either.
* **No database migration, no dependency changes.** Installer supports systemd or PM2 and Apache/httpd/nginx, with automatic rollback.
* **Instructions**: [`patch-2026-10-09-bugfix-security-ui/README.md`](patch-2026-10-09-bugfix-security-ui/README.md) · full change list in `CHANGES.md`.

### 1. `patch-2026-09-24-browser-and-resiliency.zip` (Size: ~2.4 MB)
* **Date**: 2026-09-24
* **Target Audience**: Systems with older customer browsers experiencing white screens, or servers running without active Redis.
* **Archive Path**: [`patches/patch-2026-09-24-browser-and-resiliency.zip`](file:///D:/istrac-fms/patches/patch-2026-09-24-browser-and-resiliency.zip)
* **Uncompressed Directory**: [`patches/patch-2026-09-24-browser-and-resiliency/`](file:///D:/istrac-fms/patches/patch-2026-09-24-browser-and-resiliency/)

#### Files Contained in this Patch:
| File / Directory | Description | Destination on Live Server |
| :--- | :--- | :--- |
| `apply-patch.sh` | Automated patch installer (takes backup & applies files) | Execute with `sudo bash apply-patch.sh` |
| `frontend/dist/` | Compiled frontend with `Iterator` polyfill + Vite legacy chunks + lazy PDF | `/opt/istrac-sims/frontend/dist/` |
| `backend/dist/` | Compiled backend JavaScript with Redis fallback & password checks | `/opt/istrac-sims/backend/dist/` |
| `manage-services-ubuntu.sh` | CLI management tool (`status`, `restart`, `logs`, `backup`) | `/opt/istrac-sims/manage-services-ubuntu.sh` |
| `scripts/setup-domain.sh` | Automated domain attaching & SSL setup script | `/opt/istrac-sims/deploy/setup-domain.sh` |
| `scripts/verify.sh` | System health check script | `/opt/istrac-sims/deploy/verify.sh` |
| `README.md` | Quick instructions for this specific patch | Reference |
| `HOT_PATCHING_GUIDE.md` | Zero-downtime hot-patching documentation | Reference |
| `PRODUCTION_PATCH_LOG_AND_MANUAL.md` | Datewise changelog and detailed target mapping | Reference |

---

## 🚀 How to Apply Any Patch on Customer Setup

1. Copy the desired patch `.zip` to the customer server via USB or SCP.
2. Unzip into a temporary folder:
   ```bash
   sudo unzip -o patch-2026-09-24-browser-and-resiliency.zip -d /tmp/istrac-patch/
   cd /tmp/istrac-patch/
   ```
3. Execute the patch installer:
   ```bash
   sudo bash apply-patch.sh
   ```
4. Ask users to press `Ctrl + F5` on their web browsers.

---

## 🛠️ How to Generate Future Patches
Whenever you make future fixes in the repository, simply execute:
```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\build-hot-patch.ps1
```
The script will compile both frontend and backend, attach the required shell scripts and guides, and generate a new `.zip` package.
