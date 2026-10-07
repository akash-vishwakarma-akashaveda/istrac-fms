# 🛠️ ISTRAC-SIMS — Zero-Downtime Patch & Hot-Fix Guide
## For Deployed & Customer Production Setups (Air-Gapped Ubuntu 22.04 / 24.04 LTS)

When ISTRAC-SIMS is already deployed and operational in a customer or production environment, **you do NOT need to re-run the full installer (`install.sh`), wipe databases, re-install packages, or rebuild from source on the server**.

This document outlines how to safely apply **Frontend Hot-Fixes**, **Backend Code Updates**, and **Emergency Patch Bundles** in under 60 seconds with minimal service interruption.

---

## 📌 Summary: What Needs to be Restarted for Changes

| Component Changed | Action on Target Server | Service Restart Required? | Downtime |
| :--- | :--- | :--- | :--- |
| **Frontend UI / Outdated Browser Fix** (`dist/`) | Copy files to `/opt/istrac-sims/frontend/dist` | ❌ None (Instant on browser refresh) | **0 seconds** |
| **Backend Code / API Route** (`dist/src/`) | Copy files to `/opt/istrac-sims/backend/dist/src` | ✅ `systemctl restart istrac-backend` | **~1-2 seconds** |
| **Background Worker** (`dist/src/worker.js`) | Copy files to `/opt/istrac-sims/backend/dist/src` | ✅ `systemctl restart istrac-worker` | **~1-2 seconds** |
| **Apache Configuration** (`.conf`) | Replace conf in `/etc/apache2/sites-available/` | ✅ `systemctl reload apache2` (graceful) | **0 seconds** |
| **Database Schema** (new columns/tables) | Execute `.sql` migration script | ❌ None (`mysql -u... < patch.sql`) | **0 seconds** |

---

## Part 1: Applying Frontend & Outdated Browser Patches (Zero Downtime)

### Why this happens
In air-gapped enterprise environments, client machines often run older Chromium / Chrome or Edge versions that lack newer ECMAScript features (such as ES2024 `Iterator` or modern module syntax), causing a blank screen.

The fix includes:
1. **Global Polyfill**: Added to `index.html` and `main.tsx` (`typeof globalThis.Iterator === 'undefined'`).
2. **Vite Legacy Plugin**: Generates `polyfills-legacy-*.js` and `index-legacy-*.js` with fallback `<script nomodule>` execution for outdated browsers.
3. **Lazy-Loaded PDF Viewer**: `pdfjs-dist` is dynamically loaded so non-PDF pages load instantly.

### How to Patch the Live Server:
1. Build the frontend on your development machine:
   ```bash
   cd frontend
   npm run build
   ```
2. Archive the compiled `dist` directory:
   ```powershell
   Compress-Archive -Path frontend\dist\* -DestinationPath frontend-patch.zip
   ```
3. Copy `frontend-patch.zip` to the customer server via USB or SCP.
4. On the customer server, unpack directly into the web root:
   ```bash
   # Backup previous frontend (optional safety step)
   sudo cp -r /opt/istrac-sims/frontend/dist /opt/istrac-sims/frontend/dist.bak_$(date +%F)

   # Extract new frontend files
   sudo unzip -o /path/to/usb/frontend-patch.zip -d /opt/istrac-sims/frontend/dist/

   # Ensure proper ownership
   sudo chown -R istrac:www-data /opt/istrac-sims/frontend/dist
   sudo chmod -R 755 /opt/istrac-sims/frontend/dist
   ```
5. **Done!** Users can immediately hard-refresh their browsers (`Ctrl + F5` or `Shift + F5`). No service restart is required.

---

## Part 2: Applying Backend Hot-Fixes

If you modified backend business logic (e.g. `auth.routes.ts`, `scheduler.routes.ts`, `cors.ts`):

1. Compile TypeScript on your development machine:
   ```bash
   cd backend
   npm run build
   ```
2. The compiled JavaScript files will be in `backend/dist/`.
3. Package only the compiled `dist` folder:
   ```powershell
   Compress-Archive -Path backend\dist\* -DestinationPath backend-patch.zip
   ```
4. Transfer `backend-patch.zip` to the customer server.
5. On the customer server:
   ```bash
   # Backup existing dist
   sudo cp -r /opt/istrac-sims/backend/dist /opt/istrac-sims/backend/dist.bak_$(date +%F)

   # Apply compiled files
   sudo unzip -o /path/to/usb/backend-patch.zip -d /opt/istrac-sims/backend/dist/
   sudo chown -R istrac:istrac /opt/istrac-sims/backend/dist

   # Gracefully restart backend and worker daemons (takes ~1-2 seconds)
   sudo systemctl restart istrac-backend
   sudo systemctl restart istrac-worker
   ```
6. Verify status:
   ```bash
   sudo systemctl status istrac-backend --no-pager
   curl -s http://127.0.0.1:3000/api/health
   ```

---

## Part 3: Automated Single-Script Hot-Patch Generator

We provide an automated script to create and apply hot-patches cleanly.

### On Development Machine:
Run the patch builder:
```powershell
# From project root:
powershell -ExecutionPolicy Bypass -File .\scripts\build-hot-patch.ps1
```
This generates `dist-patch/hot-patch-YYYYMMDD.tar.gz` containing:
- Compiled `frontend/dist/`
- Compiled `backend/dist/`
- An automated patch installer script `apply-patch.sh`

### On the Customer's Deployed Server:
Copy `hot-patch-YYYYMMDD.tar.gz` and run:
```bash
sudo tar -xzf hot-patch-*.tar.gz -C /tmp/hot-patch/
cd /tmp/hot-patch/
sudo bash apply-patch.sh
```

The script will automatically:
1. Create a timestamped backup of the current installation.
2. Synchronize new frontend assets without touching database or `.env`.
3. Synchronize new backend dist files.
4. Restart only `istrac-backend` and `istrac-worker` cleanly.
5. Verify `/api/health`.

---

## Part 4: Database Schema Patches (If Applicable)

If a patch includes a new database column or index:
- **Do NOT** run `npx prisma migrate dev` in production.
- Use explicit SQL patch files:
  ```bash
  mysql -u root -p istrac_sims < patch_add_column.sql
  ```
- No database restart or downtime is required.
