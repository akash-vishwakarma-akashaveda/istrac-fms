# 🛰️ ISTRAC-SIMS — Datewise Production Patch Log & Deployment Manual
## For Live/Installed Customer Servers (Ubuntu 22.04 / 24.04 LTS & Air-Gapped Environments)

> **Important**: This guide is designed for systems already installed in customer environments (typically under `/opt/istrac-sims` or `/opt/istrac-fms`).  
> **Do NOT re-run `install.sh` or wipe the database.** Follow the exact file targets and restart instructions below.

---

## 📅 Summary of Patches by Date

```
2026-09-17 ─── Deploy Scripts (Ubuntu 24.04 compatibility) + Custom Domain Script + CMS Fixes
2026-09-22 ─── Outdated Browser Fix (Vite Legacy plugin + Babel runtime polyfills)
2026-09-24 ─── Outdated Browser White-Screen Fix (Iterator Polyfill + Lazy PDF) + Backend Offline Resiliency
```

---

# 🔴 Patch Release: 2026-09-24 (Critical UI & Outdated Browser Hot-Fix)

### 1. Issue Description & Symptoms
* **Symptom**: On older customer client browsers (Chromium <120, older Chrome/Edge, or embedded webviews), the application shows a completely blank white screen.
* **Console Error**: `Uncaught ReferenceError: Iterator is not defined at index-*.js` or `PdfPreview-*.js`.
* **Root Cause**: `pdfjs-dist` v6+ attempts to hook into ES2024 `Iterator.prototype` on module load.
* **Secondary Enhancement**: Backend Redis-resiliency fixes (routes no longer fail if Redis server is stopped or running in in-memory mode), and interactive password complexity checks.

### 2. Files Modified in Development Workspace
| Source File (Development) | Purpose of Modification |
| :--- | :--- |
| `frontend/index.html` | Injected early global `Iterator` polyfill before any script runs |
| `frontend/src/main.tsx` | Fallback `Iterator` polyfill before React/module imports |
| `frontend/src/components/FilePreviewModal.tsx` | Converted `PdfPreview` to dynamic `React.lazy()` with `<Suspense>` |
| `frontend/src/components/UserProfileModal.tsx` | Added 10-char complexity checklist + old-vs-new password mismatch check |
| `frontend/src/layouts/Topbar.tsx` | Added direct routing to Security tab for password changes |
| `backend/src/routes/auth.routes.ts` | Guarded Redis blacklist calls (`redis.status === 'ready'`) + prevented same new/old password |
| `backend/src/routes/scheduler.routes.ts` | In-memory fallback for intervals if Redis is unavailable |
| `backend/src/routes/department.routes.ts` | Guarded cache invalidation calls |
| `backend/src/routes/health.routes.ts` | Guarded Redis degraded flag checks |

---

### 3. File Target Mapping on Customer Server

| What to Copy | Source Path (Dev/Patch Bundle) | Target Path on Live Server | Permissions | Service to Restart |
| :--- | :--- | :--- | :--- | :--- |
| **Compiled Frontend** | `frontend/dist/*` | `/opt/istrac-sims/frontend/dist/` | `chown -R istrac:www-data`<br>`chmod -R 755` | ❌ None (Instant on browser refresh) |
| **Compiled Backend** | `backend/dist/*` | `/opt/istrac-sims/backend/dist/` | `chown -R istrac:istrac`<br>`chmod -R 750` | `systemctl restart istrac-backend`<br>`systemctl restart istrac-worker` |

---

### 4. Step-by-Step Patch Application Instructions

#### Method A: Using Automated Patch Package (Fastest, ~10 seconds)
1. On your development PC:
   ```powershell
   powershell -ExecutionPolicy Bypass -File .\scripts\build-hot-patch.ps1
   ```
   This generates `dist-patch\istrac-sims-hotpatch-20260924_*.zip`.
2. Copy the zip file to the customer server via USB or SCP.
3. On the customer server:
   ```bash
   sudo unzip -o /path/to/istrac-sims-hotpatch-*.zip -d /tmp/patch/
   cd /tmp/patch/
   sudo bash apply-patch.sh
   ```
4. Ask users to press `Ctrl + F5` (hard refresh) on their browsers.

#### Method B: Manual File-by-File Copy (If applying manually)
1. **Apply Frontend Fix**:
   ```bash
   # Backup existing frontend dist
   sudo cp -r /opt/istrac-sims/frontend/dist /opt/istrac-sims/frontend/dist.bak_20260924

   # Copy new compiled files into Apache document root
   sudo cp -r /path/to/patch/frontend/dist/* /opt/istrac-sims/frontend/dist/
   sudo chown -R istrac:www-data /opt/istrac-sims/frontend/dist
   sudo chmod -R 755 /opt/istrac-sims/frontend/dist
   ```
2. **Apply Backend Fix**:
   ```bash
   # Backup existing backend dist
   sudo cp -r /opt/istrac-sims/backend/dist /opt/istrac-sims/backend/dist.bak_20260924

   # Copy compiled JavaScript into backend dist
   sudo cp -r /path/to/patch/backend/dist/* /opt/istrac-sims/backend/dist/
   sudo chown -R istrac:istrac /opt/istrac-sims/backend/dist

   # Restart backend daemons
   sudo systemctl restart istrac-backend
   sudo systemctl restart istrac-worker
   ```
3. **Verify Health**:
   ```bash
   curl -s http://127.0.0.1:3000/api/health
   ```

---

# 🟡 Patch Release: 2026-09-22 (Vite Legacy Browser Compatibility)

### 1. Issue Description
* Older browsers that do not support modern ES modules (`<script type="module">`) failed to execute the JavaScript bundles.

### 2. Files Modified in Development Workspace
| Source File | Purpose |
| :--- | :--- |
| `frontend/vite.config.ts` | Configured `@vitejs/plugin-legacy` targeting `['defaults', 'not IE 11']` |
| `frontend/package.json` | Added `@vitejs/plugin-legacy` and `terser` dev dependencies |

### 3. File Target Mapping on Customer Server
| Component | Source Path | Target Path on Live Server | Action |
| :--- | :--- | :--- | :--- |
| **Legacy Frontend Output** | `frontend/dist/assets/*legacy*` and updated `dist/index.html` | `/opt/istrac-sims/frontend/dist/` | Overwrite `/opt/istrac-sims/frontend/dist/` |

---

# 🟢 Patch Release: 2026-09-17 (Ubuntu 24.04 Compatibility & Domain Management)

### 1. Issue Description
* Original installation scripts only targeted RHEL/CentOS systems using `httpd`, `dnf`, and `firewalld`.
* Ubuntu 24.04 servers require `apache2`, `apt`, `ufw`, and specific systemd paths.

### 2. Files Added/Modified in Development Workspace
| Source File | Purpose |
| :--- | :--- |
| `deploy/setup-ubuntu.sh` | Full installer for Ubuntu 22.04 / 24.04 LTS |
| `manage-services-ubuntu.sh` | Ubuntu service management CLI (`status`, `restart`, `logs`, `backup`) |
| `deploy/setup-domain.sh` | Automated script to attach custom domains and generate SSL certificates |
| `deploy/verify.sh` | Ubuntu health verification checking port 3000 and `/api/health` |
| `deploy/istrac-backend.service` | Target path updated to `/opt/istrac-sims/backend` |
| `deploy/istrac-worker.service` | Target path updated to `/opt/istrac-sims/backend` |

### 3. Target Path on Customer Server
| File | Destination on Ubuntu Server | Commands to Apply |
| :--- | :--- | :--- |
| `manage-services-ubuntu.sh` | `/opt/istrac-sims/manage-services-ubuntu.sh` | `chmod +x /opt/istrac-sims/manage-services-ubuntu.sh` |
| `deploy/setup-domain.sh` | `/opt/istrac-sims/deploy/setup-domain.sh` | `chmod +x /opt/istrac-sims/deploy/setup-domain.sh` |
| `deploy/verify.sh` | `/opt/istrac-sims/deploy/verify.sh` | `chmod +x /opt/istrac-sims/deploy/verify.sh` |
| `deploy/istrac-backend.service` | `/etc/systemd/system/istrac-backend.service` | `systemctl daemon-reload`<br>`systemctl restart istrac-backend` |
| `deploy/istrac-worker.service` | `/etc/systemd/system/istrac-worker.service` | `systemctl daemon-reload`<br>`systemctl restart istrac-worker` |

---

## 🛠️ Complete Verification & Post-Patch Checklist

After applying any patch on a customer machine, run these quick checks:

```bash
# 1. Check all service states
sudo /opt/istrac-sims/manage-services-ubuntu.sh status

# 2. Check backend API HTTP response
curl -i http://127.0.0.1:3000/api/health

# 3. Check Apache proxy status
sudo apache2ctl configtest

# 4. Check real-time backend logs (if needed)
sudo journalctl -u istrac-backend -n 20 --no-pager
```

---

## ⚠️ Critical Rules for Customer Deployments
1. **Never delete `.env`**: The file `/opt/istrac-sims/backend/.env` holds the customer's `JWT_SECRET`, database passwords, and encryption keys.
2. **Never delete the storage folder**: `/mnt/istrac_storage` contains uploaded satellite files and media.
3. **No database wipe**: Never execute `prisma migrate reset` or `db:seed` on production unless performing an initial fresh installation.
