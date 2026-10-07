# 🛰️ ISTRAC-SIMS — Troubleshooting & Problem Resolution Manual (Ubuntu & Windows)

> **Document Identifier:** ISTRAC-SIMS-TSG-V3.0  
> **Classification:** ISRO / ISTRAC Restricted Technical Documentation  
> **Application:** Satellite Information Management System (Troubleshooting Catalog)  
> **Version:** 2.0.0 Production Baseline  
> **Scope:** 20 Verified Production & Deployment Failure Modes with Exact Resolutions on Ubuntu Linux & Windows  

---

## 📑 Master Problem Index

| ID | Symptom / Error Message | Severity | Target Platform | Root Component |
|:---|:---|:---:|:---:|:---|
| **ISS-01** | `Uncaught Error: VITE_API_URL must be set for production builds` | Critical | Ubuntu / Windows | Frontend SPA Client |
| **ISS-02** | `CORS: Blocked unauthorized origin` (Intranet IP / Host) | High | Ubuntu / Windows | Backend CORS Policy |
| **ISS-03** | `Error: Stream isn't writeable and enableOfflineQueue options is false` | High | Ubuntu / Windows | Redis Offline / Scheduler |
| **ISS-04** | Windows Port 80 Blocked by IIS (`w3svc` Conflict) | High | Windows | Windows Service Conflict |
| **ISS-05** | Health Check Reports `status: degraded, redis: error` | Medium | Ubuntu / Windows | Redis Service / In-Memory Fallback |
| **ISS-06** | `prisma migrate deploy` Times Out Querying npm Registry | Critical | Ubuntu / Windows | Air-Gapped Prisma 7 Engine |
| **ISS-07** | Re-Running Setup Wipes Users, Sessions, or Data | Critical | Ubuntu / Windows | Idempotent Seed & Config Guard |
| **ISS-08** | Apache Returns 404 on API Calls (`/api/health`) | High | Ubuntu / Windows | Apache ProxyPass Trailing Slash |
| **ISS-09** | File Upload Fails with `503 Storage Unavailable` | High | Ubuntu / Windows | Dedicated Storage Path & ACLs |
| **ISS-10** | Apache2 Error: `Invalid command 'ProxyPass'` or `Upgrade=websocket` | High | Ubuntu | Missing Apache2 Modules |
| **ISS-11** | PowerShell: `cannot be loaded because running scripts is disabled` | Medium | Windows | Windows ExecutionPolicy |
| **ISS-12** | Browser Displays Blank Page or Old Code After Update | Medium | Ubuntu / Windows | Client Browser Cache |
| **ISS-13** | Backend Crash Loops on Startup (`Missing required env var`) | High | Ubuntu / Windows | Missing `.env` or Bad Variables |
| **ISS-14** | MariaDB Connection Error: `ECONNREFUSED localhost:3306` | High | Ubuntu / Windows | Socket vs TCP Loopback Binding |
| **ISS-15** | Real-Time WebSocket Disconnects Immediately (`/ws`) | Medium | Ubuntu / Windows | WebSocket Tunneling Rule |
| **ISS-16** | All Users Logged Out and Cannot Reconnect After Server Reboot | Medium | Ubuntu / Windows | JWT Secret Regeneration |
| **ISS-17** | Prisma Error: Table or Column Does Not Exist (`P2021`) | High | Ubuntu / Windows | Pending Migrations |
| **ISS-18** | Administrator Forgotten Password Locked Out in Air-Gap | Critical | Ubuntu / Windows | Offline Terminal OTP Broadcast |
| **ISS-19** | `TypeError: Do not know how to serialize a BigInt` in API Response | Critical | Ubuntu / Windows | V8 JSON Engine Serialization |
| **ISS-20** | `node: command not found` in Ubuntu Systemd / Bash | Critical | Ubuntu | Missing `/usr/bin/node` Symlink |

---

## 🛠️ Detailed Problem Resolutions

### ISS-01: `Uncaught Error: VITE_API_URL must be set for production builds`
- **Symptom:** Browser shows a blank white page. Console logs: `Uncaught Error: VITE_API_URL must be set for production builds`.
- **Root Cause:** A hardcoded build guard in `src/api/client.ts` was compiled into the bundle when `npm run build` ran without `VITE_API_URL`.
- **Verified Resolution:**
  1. In `frontend/src/api/client.ts`, configure relative fallback:
     ```typescript
     const apiUrl = import.meta.env.VITE_API_URL || "/api"
     export const apiClient = axios.create({ baseURL: apiUrl, withCredentials: true })
     ```
  2. Rebuild frontend: `npm run build`.
  3. Deploy updated `dist` to web server DocumentRoot.
  4. Perform hard browser refresh: **`Ctrl + Shift + R`**.

---

### ISS-02: `CORS: Blocked unauthorized origin`
- **Symptom:** API requests from intranet consoles fail. Console shows: `Blocked unauthorized origin: http://10.20.1.50` or `http://localhost:8080`.
- **Root Cause:** Strict origin checking blocked intranet IP addresses and tunnel ports.
- **Verified Resolution:**
  `backend/src/config/cors.ts` now uses dynamic regex matchers accepting all loopback ports and RFC 1918 private IP subnets:
  ```typescript
  const isLocalhost = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(normalizedOrigin)
  if (isLocalhost) return callback(null, true)

  const isPrivateIp = /^https?:\/\/(10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3})(:\d+)?$/i.test(normalizedOrigin)
  if (isPrivateIp) return callback(null, true)
  ```
  Restart backend service to apply.

---

### ISS-03: `Error: Stream isn't writeable and enableOfflineQueue options is false`
- **Symptom:** Admin dashboard or system status displays an unhandled error when querying `/api/admin/scheduler/mission-events`.
- **Root Cause:** `ioredis` was invoked directly in `scheduler.routes.ts` while Redis was offline without an in-memory fallback.
- **Verified Resolution:**
  Updated `scheduler.routes.ts` with `inMemoryInterval` fallback and guarded Redis calls with `if (redis.status === 'ready')`.
  Recompile backend (`npm run build`) and copy updated `backend/dist` to production.

---

### ISS-04: Windows Port 80 Blocked by IIS (`w3svc` Conflict)
- **Symptom:** Apache for Windows or Nginx fails to bind to port 80: `(OS 10048)Only one usage of each socket address is normally permitted`.
- **Root Cause:** Windows World Wide Web Publishing Service (IIS) or HTTP.sys is running and holding port 80.
- **Diagnostic Command (PowerShell as Administrator):**
  ```powershell
  Get-NetTCPConnection -LocalPort 80 | Format-List
  ```
- **Verified Resolution:**
  Stop and disable IIS / World Wide Web Publishing Service:
  ```powershell
  Stop-Service W3SVC -ErrorAction SilentlyContinue
  Set-Service W3SVC -StartupType Disabled -ErrorAction SilentlyContinue
  Stop-Service WAS -ErrorAction SilentlyContinue
  Set-Service WAS -StartupType Disabled -ErrorAction SilentlyContinue
  ```
  Restart your Apache or Nginx service.

---

### ISS-05: Health Check Reports `status: degraded, redis: error`
- **Symptom:** `/api/health` returns `{"status":"degraded","redis":"error"}`.
- **Root Cause:** The Redis daemon is not running.
- **Verified Resolution:**
  - **On Ubuntu:** Start Redis: `sudo systemctl enable --now redis-server`
  - **On Windows:** If Redis/Memurai is installed: `Start-Service redis`
  - **Note:** If Redis is intentionally omitted, **the application continues operating normally** via in-memory caching and scheduling.

---

### ISS-06: `prisma migrate deploy` Times Out in Air-Gap
- **Symptom:** Running `npx prisma migrate deploy` fails trying to contact `registry.npmjs.org`.
- **Root Cause:** `npx` attempts to resolve online packages if executed directly in an air-gapped terminal.
- **Verified Resolution:**
  Execute the pre-bundled local Prisma query engine directly using Node:
  - **Ubuntu:**
    ```bash
    cd /opt/istrac-fms/backend
    node ./node_modules/prisma/build/index.js migrate deploy
    ```
  - **Windows (PowerShell):**
    ```powershell
    cd D:\istrac-fms\backend
    node .\node_modules\prisma\build\index.js migrate deploy
    ```

---

### ISS-07: Re-Running Setup Wipes Users, Sessions, or Data
- **Symptom:** Running an installer a second time resets user passwords or deletes records.
- **Root Cause:** Blank seed purges (`deleteMany()`) and regenerating JWT secrets.
- **Verified Resolution:**
  1. In `prisma/seed.ts`, the seed checks `prisma.user.count() > 0` before any operation.
  2. Setup scripts preserve existing `JWT_SECRET` from `.env`.

---

### ISS-08: Apache Returns 404 on API Calls (`/api/health`)
- **Symptom:** Apache returns HTTP 404 on API calls.
- **Root Cause:** `ProxyPass /api/` had a trailing slash mismatch.
- **Verified Resolution:**
  Ensure `/api` (no trailing slash) is configured:
  ```apache
  ProxyPass        /api http://127.0.0.1:3000/api retry=0 timeout=120
  ProxyPassReverse /api http://127.0.0.1:3000/api
  ```

---

### ISS-09: File Upload Fails with `503 Storage Unavailable`
- **Symptom:** File uploads fail immediately with HTTP 503.
- **Root Cause:** `HDD_MOUNT_PATH` is missing or not writable.
- **Verified Resolution:**
  - **Ubuntu:**
    ```bash
    sudo mkdir -p /mnt/istrac_storage
    sudo chown -R istrac:istrac /mnt/istrac_storage
    sudo chmod -R 770 /mnt/istrac_storage
    ```
  - **Windows (PowerShell):**
    ```powershell
    New-Item -ItemType Directory -Path "D:\istrac_storage" -Force
    ```

---

### ISS-10: Apache2 Error: `Invalid command 'ProxyPass'` or `Upgrade=websocket`
- **Symptom:** `systemctl status apache2` reports syntax error in `istrac-fms.conf`.
- **Root Cause:** Required Apache2 proxy and rewrite modules are disabled on Ubuntu.
- **Verified Resolution:**
  ```bash
  sudo a2enmod proxy proxy_http proxy_wstunnel rewrite headers
  sudo systemctl restart apache2
  ```

---

### ISS-11: PowerShell: `cannot be loaded because running scripts is disabled`
- **Symptom:** Running `manage-services-windows.ps1` returns `File cannot be loaded because running scripts is disabled on this system`.
- **Root Cause:** Windows default PowerShell ExecutionPolicy blocks unsigned scripts.
- **Verified Resolution:**
  ```powershell
  Set-ExecutionPolicy RemoteSigned -Scope CurrentUser -Force
  ```

---

### ISS-12: Stale Browser Cache Shows Old JavaScript Bundle
- **Symptom:** Browser console reports errors referencing old chunk filenames.
- **Root Cause:** Client-side browser caching of static `.js` bundles.
- **Verified Resolution:**
  Perform a hard refresh: **`Ctrl + Shift + R`** (or **`Ctrl + F5`**), or test in an Incognito window.

---

### ISS-13: Backend Crash Loops on Startup
- **Symptom:** Backend process halts immediately on launch.
- **Root Cause:** Missing or incomplete `.env` file.
- **Diagnostic Command:**
  - **Ubuntu:** `sudo journalctl -u istrac-backend -n 30 --no-pager`
  - **Windows:** `node dist/src/index.js` (inspect console output)
- **Verified Resolution:**
  Ensure `.env` contains all required parameters: `DATABASE_URL`, `REDIS_URL`, `JWT_SECRET`, `JWT_REFRESH_SECRET`, `HDD_MOUNT_PATH`.

---

### ISS-14: MariaDB Connection Error: `ECONNREFUSED localhost:3306`
- **Symptom:** Backend fails to connect to database.
- **Root Cause:** `localhost` attempts Unix domain socket resolution on Linux or IPv6 `::1` on Windows.
- **Verified Resolution:**
  Always specify `127.0.0.1` explicitly in `DATABASE_URL`:
  ```env
  DATABASE_URL="mysql://istrac_user:IstracSecurePass123!@127.0.0.1:3306/istrac_fms"
  ```

---

### ISS-15: Real-Time WebSocket Disconnects Immediately (`/ws`)
- **Symptom:** Live telemetry and broadcast alerts fail to arrive over WebSocket.
- **Root Cause:** Missing WebSocket proxy tunnel directives in Apache.
- **Verified Resolution:**
  Ensure rewrite rules exist in Apache configuration:
  ```apache
  RewriteEngine On
  RewriteCond %{HTTP:Upgrade} =websocket [NC]
  RewriteCond %{HTTP:Connection} upgrade [NC]
  RewriteRule ^/ws/(.*) ws://127.0.0.1:3000/ws/$1 [P,L]
  RewriteRule ^/ws/?$   ws://127.0.0.1:3000/ws [P,L]
  ```

---

### ISS-16: All Users Logged Out After Server Reboot
- **Symptom:** Operators are kicked out of sessions when the server restarts.
- **Root Cause:** `JWT_SECRET` was dynamically generated in memory or re-seeded in `.env`.
- **Verified Resolution:**
  Ensure static 256-bit secrets are preserved in `.env` across service restarts.

---

### ISS-17: Prisma Error: Table or Column Does Not Exist (`P2021`)
- **Symptom:** API routes fail with `Table 'istrac_fms.User' doesn't exist`.
- **Root Cause:** Prisma migrations have not been deployed against MariaDB.
- **Verified Resolution:**
  Run migration deploy command:
  ```bash
  node ./node_modules/prisma/build/index.js migrate deploy
  ```

---

### ISS-18: Administrator Forgotten Password Locked Out in Air-Gap
- **Symptom:** Super Admin is locked out with no external email connectivity.
- **Root Cause:** Offline intranet environment prevents SMTP dispatch.
- **Verified Resolution:**
  1. Open `/forgot-password` in browser and request code for `admin@istrac.local`.
  2. Inspect backend terminal or journal:
     - **Ubuntu:** `sudo journalctl -u istrac-backend -n 20 --no-pager`
     - **Windows:** Check PM2 logs or PowerShell window.
  3. Locate the ASCII OTP banner:
     ```text
     ============================================================
     🔐 [ADMIN PASSWORD RESET OTP BROADCAST]
        Account: admin@istrac.local
        OTP Code: 549120
     ============================================================
     ```
  4. Submit code on web portal to set a new password.

---

### ISS-19: `TypeError: Do not know how to serialize a BigInt`
- **Symptom:** File operations crash when serializing file byte sizes.
- **Root Cause:** MariaDB `BIGINT` columns are returned as native BigInts, which V8 `JSON.stringify` does not handle by default.
- **Verified Resolution:**
  Ensure BigInt patch is present in `src/index.ts`:
  ```typescript
  ;(BigInt.prototype as any).toJSON = function () {
    return this.toString()
  }
  ```

---

### ISS-20: `node: command not found` in Ubuntu Systemd / Bash
- **Symptom:** `systemctl status istrac-backend` reports `ExecStart=/usr/bin/node: No such file or directory`.
- **Root Cause:** Node was unpacked to a custom path without linking `/usr/bin/node`.
- **Verified Resolution:**
  ```bash
  sudo ln -sf /opt/node/bin/node /usr/bin/node
  sudo ln -sf /opt/node/bin/npm /usr/bin/npm
  ```
