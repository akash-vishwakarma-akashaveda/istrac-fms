# 🛰️ ISTRAC-SIMS — Troubleshooting & Resolutions Manual

This manual provides diagnostic steps, root causes, and verified copy-paste commands for all operational and deployment issues.

---

## 1. Issue Index

| ID | Issue Symptom | Severity | Primary Component |
|---|---|---|---|
| **ISS-01** | `Uncaught Error: VITE_API_URL must be set for production builds` | Critical | Frontend SPA Build |
| **ISS-02** | `CORS: Blocked unauthorized origin` / API 403 in Browser Console | High | Backend CORS Configuration |
| **ISS-03** | Unable to Access Application from Windows Host Browser (`10.0.2.15`) | High | VirtualBox NAT Networking |
| **ISS-04** | `cat .env: No such file or directory` in Terminal | Low | File Location & Hidden Dotfile |
| **ISS-05** | Health Check Reports `status: degraded, redis: error` | Medium | Redis / In-Memory Fallback |
| **ISS-06** | Prisma Offline Migration Errors / npm Registry Failures | Critical | Prisma 7 ORM Engine |
| **ISS-07** | Database Data or Sessions Reset After Re-running Installer | Critical | Idempotent Seed & Env Protection |
| **ISS-08** | Apache Reverse Proxy 404 on API Calls (`/api` Trailing Slash) | High | Apache `httpd.conf` |
| **ISS-09** | File Upload Fails with `503 Storage Unavailable` | High | Storage Mount & Disk Permissions |
| **ISS-10** | SELinux Blocks Apache from Proxying to Node.js Backend | High | RHEL SELinux Booleans |
| **ISS-11** | Port Conflicts: Port 80, 3000, or 3306 Already Bound | Medium | System Ports / Zombie Services |
| **ISS-12** | Browser Displays Blank White Screen After Deployment | Medium | Browser Cache Invalidation |

---

## 2. Detailed Issues & Resolutions

### ISS-01: `Uncaught Error: VITE_API_URL must be set for production builds`
- **Symptom:** Opening the website displays a blank screen. Browser Developer Console shows:
  `Uncaught Error: VITE_API_URL must be set for production builds at index-sAqa6k-J.js:11`.
- **Root Cause:** A strict compile-time assertion in `src/api/client.ts` was inlined into the JavaScript bundle during `npm run build` when no explicit `VITE_API_URL` was provided.
- **Resolution:**
  1. In `src/api/client.ts`, configure relative path resolution:
     ```typescript
     const apiUrl = import.meta.env.VITE_API_URL || "/api"
     export const apiClient = axios.create({ baseURL: apiUrl, withCredentials: true })
     ```
  2. Copy the freshly built files into production:
     ```bash
     sudo cp -rf /media/sf_Rhel_Shared_Folder/istrac-fms-offline-bundle-20260915/frontend/dist/* /opt/istrac-fms/frontend/dist/
     sudo chmod -R 755 /opt/istrac-fms/frontend/dist
     ```
  3. Force-refresh the browser with **`Ctrl + Shift + R`**.

---

### ISS-02: `CORS: Blocked unauthorized origin`
- **Symptom:** Browser console reports `Access to XMLHttpRequest at 'http://10.0.2.15/api/...' has been blocked by CORS policy: No 'Access-Control-Allow-Origin' header is present`.
- **Root Cause:** In production mode (`NODE_ENV=production`), `backend/src/config/cors.ts` strictly validated against exact string matches in `ALLOWED_ORIGINS` (which only contained `http://localhost`). Accessing via VM IP `10.0.2.15` or port-forwarded `localhost:8080` was rejected.
- **Resolution:**
  In `backend/src/config/cors.ts`, dynamically permit all loopback ports and private RFC 1918 intranet IPs:
  ```typescript
  const isLocalhost = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(normalizedOrigin)
  if (isLocalhost) return callback(null, true)

  const isPrivateIp = /^https?:\/\/(10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3})(:\d+)?$/i.test(normalizedOrigin)
  if (isPrivateIp) return callback(null, true)
  ```
  Restart backend service:
  ```bash
  sudo systemctl restart istrac-backend
  ```

---

### ISS-03: Accessing the Application from Windows Host (VirtualBox NAT)
- **Symptom:** `http://10.0.2.15` fails to load in Windows Chrome/Edge with `ERR_CONNECTION_TIMED_OUT`.
- **Root Cause:** VirtualBox default network adapter uses NAT with private subnet `10.0.2.0/24`, which is not routable directly from the Windows host OS.
- **Resolution:**
  Set up Port Forwarding in VirtualBox:
  1. Open **VirtualBox Manager** -> Click your RHEL VM -> **Settings**.
  2. Navigate to **Network** -> **Adapter 1** -> Click **Advanced** -> Click **Port Forwarding**.
  3. Add Rule:
     - Name: `HTTP_Portal`
     - Protocol: `TCP`
     - Host Port: `8080`
     - Guest Port: `80`
  4. Click **OK**.
  5. Open Windows browser and navigate to:
     ```
     http://localhost:8080/
     ```

---

### ISS-04: `cat .env: No such file or directory`
- **Symptom:** Running `cat .env` returns `cat: .env: No such file or directory`.
- **Root Cause:**
  1. User ran the command inside `/media/sf_Rhel_Shared_Folder/...` (the installation media), but the live production file is installed at `/opt/istrac-fms/backend/.env`.
  2. Linux files starting with a dot (`.`) are hidden from standard `ls`.
  3. `.env` has restricted permissions (`chmod 600`) owned by `istrac:istrac`.
- **Resolution:**
  Inspect the live production environment file with root permissions:
  ```bash
  sudo cat /opt/istrac-fms/backend/.env
  ```

---

### ISS-05: Health Check Reports `status: degraded, redis: error`
- **Symptom:** `curl http://localhost/api/health` returns `{"status":"degraded","db":"ok","redis":"error","hdd":"ok"}`.
- **Root Cause:** Redis service is either stopped or not installed on the system.
- **Resolution:**
  1. If Redis / Valkey is installed, start and enable it:
     ```bash
     sudo systemctl enable --now redis || sudo systemctl enable --now valkey
     ```
  2. **Note on In-Memory Fallback:** If Redis is not installed, **the system will continue to operate normally**. Both the backend API and background workers are architected to automatically fall back to native in-memory caching and scheduling.

---

### ISS-06: Prisma Offline Migration Errors
- **Symptom:** Running `npx prisma migrate deploy` fails in air-gapped environments with network timeout or registry errors.
- **Root Cause:** `npx` attempts to resolve online npm repositories when executed.
- **Resolution:**
  Bypass `npx` and execute the local pre-bundled Prisma query engine directly with Node:
  ```bash
  cd /opt/istrac-fms/backend
  DATABASE_URL="$(grep '^DATABASE_URL=' .env | cut -d '=' -f2- | tr -d '"')" node ./node_modules/prisma/build/index.js migrate deploy
  ```

---

### ISS-07: Preserving Data When Re-running Setup Script
- **Symptom:** Running `./setup-rhel-offline.sh` a second time resets user passwords or purges tables.
- **Root Cause:** Development seed scripts frequently use `deleteMany()` to establish a clean slate.
- **Resolution:**
  The production installer and `prisma/seed.ts` have been made **fully idempotent**:
  1. `seed.ts` checks `await prisma.user.count()`. If records exist, it skips destructive purges.
  2. The installer inspects `/opt/istrac-fms/backend/.env` and reuses existing `JWT_SECRET`, `JWT_REFRESH_SECRET`, and database credentials so active user sessions are never terminated.

---

### ISS-08: Apache Reverse Proxy 404 on API Calls
- **Symptom:** Calling `/api/health` returns a 404 from Apache.
- **Root Cause:** Trailing slash mismatch in Apache configuration (`ProxyPass /api/` requires requests to have a trailing slash).
- **Resolution:**
  Configure `ProxyPass` without a trailing slash in `/etc/httpd/conf.d/istrac-fms.conf`:
  ```apache
  ProxyPass        /api http://127.0.0.1:3000/api retry=0 timeout=120
  ProxyPassReverse /api http://127.0.0.1:3000/api
  ```
  Reload Apache:
  ```bash
  sudo systemctl reload httpd
  ```

---

### ISS-09: Storage Volume / Upload Failures (`503 Storage Unavailable`)
- **Symptom:** Uploading telemetry or documents fails with `503 Storage Unavailable` or permission denied.
- **Root Cause:** `/mnt/istrac_storage` is unmounted, read-only, or the `istrac` user lacks write permissions.
- **Resolution:**
  ```bash
  # Check mount status and remaining disk space
  df -h /mnt/istrac_storage

  # Fix permissions
  sudo chown -R istrac:istrac /mnt/istrac_storage
  sudo chmod -R 770 /mnt/istrac_storage

  # Restart backend
  sudo systemctl restart istrac-backend
  ```

---

### ISS-10: SELinux Blocking Apache Proxy Connections
- **Symptom:** Apache returns `503 Service Unavailable` with `/var/log/httpd/error_log` stating `Permission denied: AH00957: HTTP: attempt to connect to 127.0.0.1:3000 failed`.
- **Root Cause:** RHEL SELinux enforces `httpd_can_network_connect = off` by default.
- **Resolution:**
  ```bash
  # Enable Apache network proxying in SELinux permanently
  sudo setsebool -P httpd_can_network_connect 1
  ```

---

### ISS-11: Port Conflicts (Port 80, 3000, 3306)
- **Symptom:** `httpd`, `istrac-backend`, or `mariadb` fails to start.
- **Root Cause:** Another process (e.g. Nginx, a previous Node process) is occupying the port.
- **Resolution:**
  ```bash
  # Find which process holds the port
  sudo ss -tulpn | grep -E ':(80|443|3000|3306)'

  # Disable conflicting Nginx service if present
  sudo systemctl stop nginx 2>/dev/null || true
  sudo systemctl disable nginx 2>/dev/null || true

  # Restart required services
  sudo /opt/istrac-fms/manage-services-rhel.sh restart
  ```

---

### ISS-12: Stale Browser Cache / Blank Screen
- **Symptom:** Browser continues to load an old JavaScript bundle filename after deploying an update.
- **Root Cause:** Aggressive client-side caching of static assets.
- **Resolution:**
  1. Perform a hard refresh: **`Ctrl + Shift + R`** (or **`Ctrl + F5`**).
  2. Or open an **Incognito / Private Window** to test with an empty cache.
