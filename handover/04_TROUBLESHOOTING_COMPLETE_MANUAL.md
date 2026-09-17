# 🛰️ ISTRAC-SIMS — Troubleshooting & Problem Resolution Manual

> **Document Identifier:** ISTRAC-SIMS-TSG-V2.0  
> **Classification:** ISRO / ISTRAC Restricted Technical Documentation  
> **Application:** Satellite Information Management System (Troubleshooting Catalog)  
> **Version:** 1.1.0 Production Baseline  
> **Scope:** 20 Verified Production & Deployment Failure Modes with Exact Resolutions  

---

## 📑 Master Problem Index

| ID | Symptom / Error Message | Severity | Root Component |
|:---|:---|:---:|:---|
| **ISS-01** | `Uncaught Error: VITE_API_URL must be set for production builds` | Critical | Frontend SPA Client |
| **ISS-02** | `CORS: Blocked unauthorized origin: http://10.0.2.15` | High | Backend CORS Policy |
| **ISS-03** | Windows Host Cannot Connect to VM IP `10.0.2.15` | High | VirtualBox NAT Isolation |
| **ISS-04** | `cat .env: No such file or directory` | Low | Directory & Hidden Dotfile |
| **ISS-05** | Health Check Reports `status: degraded, redis: error` | Medium | Redis Service / Fallback |
| **ISS-06** | `prisma migrate deploy` Times Out Querying npm Registry | Critical | Air-Gapped Prisma 7 Engine |
| **ISS-07** | Re-Running Installer Wipes Users, Sessions, or Data | Critical | Idempotent Seed & Config Guard |
| **ISS-08** | Apache Returns 404 on API Calls (`/api/health`) | High | Apache ProxyPass Trailing Slash |
| **ISS-09** | File Upload Fails with `503 Storage Unavailable` | High | `/mnt/istrac_storage` Mount & Perms |
| **ISS-10** | Apache Error: `Permission denied: attempt to connect to 127.0.0.1:3000` | High | RHEL SELinux Boolean |
| **ISS-11** | Service Fails to Start: Port 80, 3000, or 3306 Already Bound | High | Port Conflict / Zombie Process |
| **ISS-12** | Browser Displays Blank Page or Old Code After Update | Medium | Client Browser Cache |
| **ISS-13** | `istrac-backend.service` Crash Loops on Startup | High | Missing `.env` or Bad Variables |
| **ISS-14** | MariaDB Connection Error: `ECONNREFUSED localhost:3306` | High | Linux Socket vs TCP Loopback |
| **ISS-15** | Real-Time WebSocket Disconnects Immediately (`/ws`) | Medium | WebSocket Upgrade Rule |
| **ISS-16** | All Users Logged Out and Cannot Reconnect After Server Restart | Medium | JWT Secret Regeneration |
| **ISS-17** | Prisma Error: Table or Column Does Not Exist | High | Pending Migrations |
| **ISS-18** | Administrator Forgotten Password Locked Out in Air-Gap | Critical | Password Recovery in Offline Mode |
| **ISS-19** | `TypeError: Do not know how to serialize a BigInt` in API Response | Critical | V8 JSON Engine Serialization |
| **ISS-20** | `node: command not found` in Systemd or Bash | Critical | Missing `/usr/bin/node` Symlink |

---

## 🛠️ Detailed Problem Resolutions

### ISS-01: `Uncaught Error: VITE_API_URL must be set for production builds`
- **Symptom:** Browser shows a blank white page. Console logs: `Uncaught Error: VITE_API_URL must be set for production builds at index-*.js:11`.
- **Root Cause:** A hardcoded build guard in `src/api/client.ts` was compiled into the bundle when `npm run build` ran without `VITE_API_URL`.
- **Diagnostic Command:**
  ```bash
  grep -r "must be set for production" /opt/istrac-fms/frontend/dist/
  ```
- **Verified Resolution:**
  1. Set relative fallback in `src/api/client.ts`:
     ```typescript
     const apiUrl = import.meta.env.VITE_API_URL || "/api"
     export const apiClient = axios.create({ baseURL: apiUrl, withCredentials: true })
     ```
  2. Copy the freshly built files:
     ```bash
     sudo cp -rf /media/sf_Rhel_Shared_Folder/istrac-fms-offline-bundle-20260915/frontend/dist/* /opt/istrac-fms/frontend/dist/
     sudo chmod -R 755 /opt/istrac-fms/frontend/dist
     ```
  3. Hard refresh browser: **`Ctrl + Shift + R`**.

---

### ISS-02: `CORS: Blocked unauthorized origin`
- **Symptom:** API requests from intranet consoles fail. Console shows: `Blocked unauthorized origin: http://10.0.2.15`.
- **Root Cause:** `src/config/cors.ts` previously checked for exact string matches in `ALLOWED_ORIGINS` when in production mode.
- **Diagnostic Command:**
  ```bash
  sudo journalctl -u istrac-backend -n 20 --no-pager | grep "CORS"
  ```
- **Verified Resolution:**
  Update `src/config/cors.ts` with regex matchers for all loopback ports and RFC 1918 private IP subnets:
  ```typescript
  const isLocalhost = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(normalizedOrigin)
  if (isLocalhost) return callback(null, true)

  const isPrivateIp = /^https?:\/\/(10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3})(:\d+)?$/i.test(normalizedOrigin)
  if (isPrivateIp) return callback(null, true)
  ```
  Restart service: `sudo systemctl restart istrac-backend`.

---

### ISS-03: Windows Host Cannot Connect to VM IP `10.0.2.15`
- **Symptom:** Chrome on Windows host times out connecting to `http://10.0.2.15/`.
- **Root Cause:** VirtualBox default NAT network isolates the virtual machine within a private subnet that is unreachable from the host OS without port forwarding.
- **Verified Resolution:**
  1. VirtualBox Manager -> Select VM -> **Settings** -> **Network** -> **Adapter 1** -> **Advanced** -> **Port Forwarding**.
  2. Add: Host Port `8080`, Guest Port `80`, Protocol `TCP`.
  3. Open `http://localhost:8080/` in Windows Chrome.

---

### ISS-04: `cat .env: No such file or directory`
- **Symptom:** Running `cat .env` returns `No such file or directory`.
- **Root Cause:** Running the command inside the staging media directory (`/media/sf_Rhel_Shared_Folder/...`) rather than the active production directory, combined with dotfiles being hidden by standard `ls`.
- **Verified Resolution:**
  ```bash
  sudo cat /opt/istrac-fms/backend/.env
  ```

---

### ISS-05: Health Check Reports `status: degraded, redis: error`
- **Symptom:** `curl http://localhost/api/health` returns `{"status":"degraded","redis":"error"}`.
- **Root Cause:** The Redis daemon is stopped or not installed.
- **Verified Resolution:**
  1. Start Redis or Valkey:
     ```bash
     sudo systemctl enable --now redis || sudo systemctl enable --now valkey
     ```
  2. **Note:** If Redis is intentionally omitted, **the application continues operating normally**. The backend automatically uses in-memory caching and scheduling when Redis is offline.

---

### ISS-06: `prisma migrate deploy` Times Out in Air-Gap
- **Symptom:** Running `npx prisma migrate deploy` fails trying to contact `registry.npmjs.org`.
- **Root Cause:** `npx` attempts to resolve online packages if executed directly.
- **Verified Resolution:**
  Bypass `npx` and execute the pre-bundled local Prisma query engine binary using Node directly:
  ```bash
  cd /opt/istrac-fms/backend
  DATABASE_URL="$(grep '^DATABASE_URL=' .env | cut -d '=' -f2- | tr -d '"')" node ./node_modules/prisma/build/index.js migrate deploy
  ```

---

### ISS-07: Re-Running Installer Wipes Users, Sessions, or Data
- **Symptom:** Running `setup-rhel-offline.sh` a second time resets user passwords or deletes tables.
- **Root Cause:** The database seed script had a blanket `deleteMany()` and the installer was regenerating new random JWT secrets.
- **Verified Resolution:**
  1. In `prisma/seed.ts`, guard against existing users:
     ```typescript
     const count = await prisma.user.count()
     if (count > 0) return console.log('Database contains users. Skipping seed.')
     ```
  2. In `deploy/install-apache-offline.sh`, reuse existing `JWT_SECRET` and `JWT_REFRESH_SECRET` from `/opt/istrac-fms/backend/.env`.

---

### ISS-08: Apache Returns 404 on API Calls (`/api/health`)
- **Symptom:** `curl http://localhost/api/health` returns a 404 from Apache.
- **Root Cause:** Apache `ProxyPass /api/` directive had a trailing slash, failing to match requests without a trailing slash.
- **Verified Resolution:**
  In `/etc/httpd/conf.d/istrac-fms.conf`, remove trailing slashes:
  ```apache
  ProxyPass        /api http://127.0.0.1:3000/api retry=0 timeout=120
  ProxyPassReverse /api http://127.0.0.1:3000/api
  ```
  Reload Apache: `sudo systemctl reload httpd`.

---

### ISS-09: File Upload Fails with `503 Storage Unavailable`
- **Symptom:** File uploads fail immediately with HTTP 503.
- **Root Cause:** `hddAvailability.middleware.ts` detects that `/mnt/istrac_storage` is unmounted or read-only.
- **Verified Resolution:**
  ```bash
  df -h /mnt/istrac_storage
  sudo chown -R istrac:istrac /mnt/istrac_storage
  sudo chmod -R 770 /mnt/istrac_storage
  sudo systemctl restart istrac-backend
  ```

---

### ISS-10: Apache Error: `Permission denied: attempt to connect to 127.0.0.1:3000`
- **Symptom:** Apache returns `503 Service Unavailable`. `/var/log/httpd/error_log` shows `AH00957: HTTP: attempt to connect to 127.0.0.1:3000 failed (Permission denied)`.
- **Root Cause:** RHEL SELinux prevents the web server from opening outbound TCP sockets to backend ports by default.
- **Verified Resolution:**
  ```bash
  sudo setsebool -P httpd_can_network_connect 1
  ```

---

### ISS-11: Port Conflicts (Port 80, 3000, 3306)
- **Symptom:** Services fail to bind to their designated TCP ports.
- **Root Cause:** A conflicting daemon (e.g. Nginx) or a hung background Node process is holding the port.
- **Verified Resolution:**
  ```bash
  sudo ss -tulpn | grep -E ':(80|3000|3306)'
  sudo systemctl stop nginx 2>/dev/null || true
  sudo systemctl disable nginx 2>/dev/null || true
  sudo /opt/istrac-fms/manage-services-rhel.sh restart
  ```

---

### ISS-12: Stale Browser Cache Shows Old JavaScript Bundle
- **Symptom:** Browser console still reports errors referencing an old chunk filename (e.g. `index-sAqa6k-J.js` instead of `index-DQKxLmuD.js`).
- **Root Cause:** Aggressive client-side browser caching of static `.js` files.
- **Verified Resolution:**
  1. In the browser, perform a hard refresh: **`Ctrl + Shift + R`** (or **`Ctrl + F5`**).
  2. Open in a Private / Incognito window to verify.

---

### ISS-13: `istrac-backend.service` Crash Loops on Startup
- **Symptom:** `systemctl status istrac-backend` shows `failed (Result: exit-code)` restarting every 5 seconds.
- **Root Cause:** Missing or corrupt `/opt/istrac-fms/backend/.env` file.
- **Verified Resolution:**
  ```bash
  sudo journalctl -u istrac-backend -n 30 --no-pager
  # Check for missing required env vars and re-create /opt/istrac-fms/backend/.env
  ```

---

### ISS-14: MariaDB Error: `ECONNREFUSED localhost:3306`
- **Symptom:** Backend fails to start with database connection errors.
- **Root Cause:** On Linux, `localhost` attempts to connect via the Unix socket file (`/var/run/mysqld/mysqld.sock`). Node.js database drivers require explicit TCP loopback.
- **Verified Resolution:**
  Ensure `DATABASE_URL` in `.env` uses `127.0.0.1` instead of `localhost`:
  ```env
  DATABASE_URL="mysql://istrac_user:IstracSecurePass123!@127.0.0.1:3306/istrac_fms"
  ```

---

### ISS-15: Real-Time WebSocket Disconnects Immediately (`/ws`)
- **Symptom:** WebSocket connection fails with HTTP 400 or immediate disconnection.
- **Root Cause:** Apache missing `mod_proxy_wstunnel` or incorrect rewrite rules.
- **Verified Resolution:**
  Verify the following rules exist in `/etc/httpd/conf.d/istrac-fms.conf`:
  ```apache
  RewriteEngine On
  RewriteCond %{HTTP:Upgrade} =websocket [NC]
  RewriteCond %{HTTP:Connection} upgrade [NC]
  RewriteRule ^/ws/(.*) ws://127.0.0.1:3000/ws/$1 [P,L]
  RewriteRule ^/ws/?$   ws://127.0.0.1:3000/ws [P,L]
  ```

---

### ISS-16: All Users Logged Out After Server Restart
- **Symptom:** Operators are kicked out of their sessions every time the server is rebooted.
- **Root Cause:** `JWT_SECRET` was being generated dynamically in memory or overwritten in `.env`.
- **Verified Resolution:**
  Ensure `JWT_SECRET` and `JWT_REFRESH_SECRET` are permanently stored in `/opt/istrac-fms/backend/.env` and are never regenerated during re-installations.

---

### ISS-17: Prisma Error: Table or Column Does Not Exist
- **Symptom:** API routes throw `PrismaClientKnownRequestError` with code `P2021`.
- **Root Cause:** New database migrations were written in development but not applied to production MariaDB.
- **Verified Resolution:**
  ```bash
  cd /opt/istrac-fms/backend
  node ./node_modules/prisma/build/index.js migrate deploy
  ```

---

### ISS-18: Administrator Password Forgotten in Air-Gap
- **Symptom:** The sole Super Administrator (`admin@istrac.local`) is locked out with no internet email connection for password reset.
- **Root Cause:** Air-gapped isolation blocks public SMTP relays.
- **Verified Resolution:**
  1. Open `/forgot-password` in the browser and request reset for `admin@istrac.local`.
  2. Inspect the live systemd journal:
     ```bash
     sudo journalctl -u istrac-backend -n 20 --no-pager
     ```
  3. Locate the ASCII OTP banner:
     ```text
     ============================================================
     🔐 [ADMIN PASSWORD RESET OTP BROADCAST]
        Account: admin@istrac.local
        OTP Code: 549120
     ============================================================
     ```
  4. Enter the code on the web portal to set a new password.

---

### ISS-19: `TypeError: Do not know how to serialize a BigInt`
- **Symptom:** File browsing routes crash when calculating directory sizes.
- **Root Cause:** MariaDB `BIGINT` columns are returned as native BigInts, which `JSON.stringify` does not serialize by default.
- **Verified Resolution:**
  Ensure the BigInt serialization patch is active at the very top of `backend/src/index.ts`:
  ```typescript
  ;(BigInt.prototype as any).toJSON = function () {
    return this.toString()
  }
  ```

---

### ISS-20: `node: command not found` in Systemd or Bash
- **Symptom:** `systemctl status istrac-backend` reports `ExecStart=/usr/bin/node: No such file or directory`.
- **Root Cause:** Node.js tarball was extracted to `/opt/node` but the symlink `/usr/bin/node` was not created.
- **Verified Resolution:**
  ```bash
  sudo ln -sf /opt/node/bin/node /usr/bin/node
  sudo ln -sf /opt/node/bin/npm /usr/bin/npm
  node -v  # Should output v24.21.0
  ```
