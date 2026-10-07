# 🛰️ ISTRAC-SIMS — Ubuntu Linux Air-Gapped Quick Setup Guide
## Indian Space Research Organisation — ISTRAC Satellite Information Management System

> **Target Platform:** Ubuntu Linux 22.04 LTS / 24.04 LTS (x86_64)  
> **Environment:** Air-Gapped Intranet Server (Strictly Zero Public Internet)  
> **Web Server:** Apache2 (`proxy_http`, `proxy_wstunnel`, `rewrite`, `headers`)  
> **Database:** MySQL Server 8.x / MariaDB (Port 3306)  
> **Process Manager:** Native Ubuntu Systemd Daemons (`istrac-backend` & `istrac-worker`)  

---

### 📋 Prerequisites on Ubuntu 24.04 LTS:
The host should have standard base server tools installed (e.g. from Ubuntu 24 installation media):
- **Web Server:** `apache2`
- **SQL Database:** `mysql-server` and `mysql-client`
- **System Utilities:** `tar`, `curl`

> [!NOTE]
> All application dependencies, **Node.js 24 runtime**, **Prisma Linux engine**, **React frontend**, and **Express backend** are bundled **100% offline** inside this archive. The installer never attempts any online repository updates.

---

### Step 1: Copy & Extract Archive into `/opt/istrac-sims`
Insert your USB pen drive on the Ubuntu server and copy this bundle to `/opt/istrac-sims`:
```bash
sudo mkdir -p /opt/istrac-sims
sudo cp -r /path/to/usb/bundle/* /opt/istrac-sims/
cd /opt/istrac-sims
```

---

### Step 2: Run the 1-Click Automated Setup
```bash
chmod +x install.sh deploy/setup-ubuntu.sh manage-services-ubuntu.sh
sudo ./install.sh
```

#### What the Setup Script Executes Automatically:
1. **Offline Pre-flight Check**: Verifies all required prerequisites (Apache2, MySQL, Tar, Curl) without any internet connection.
2. **System User & Storage**: Creates `istrac` system user and `/mnt/istrac_storage` volume (`chmod 770`).
3. **Node.js 24 Runtime**: Auto-extracts standalone Node.js v24.21.0 binary to `/opt/node` and links to `/usr/bin/node`.
4. **Database Initialization**: Auto-detects and connects to `mysql.service`, provisions database `istrac_sims`, and configures `istrac_user`.
5. **Prisma Migrations**: Deploys all 5 versioned migrations using the bundled Linux Prisma schema engine (with automatic direct SQL fallback).
6. **Admin Account**: Provisions the initial Super Administrator (`admin@istrac.local`).
7. **Systemd Services**: Registers, enables, and launches:
   - `istrac-backend.service` (Node.js API on port 3000)
   - `istrac-worker.service` (Background telemetry and pass scheduler)
8. **Apache2 Web Server**: Configures `/etc/apache2/sites-available/istrac-sims.conf`, enables proxy modules, grants `www-data` access, and reloads Apache2.
9. **UFW Firewall**: Configures rules for ports 80 and 443.
10. **Liveness Verification & Auto Status**: Verifies backend HTTP health probe and automatically outputs the live service status banner.

---

### Step 3: Post-Deployment Health & Verification Checklist

Right after running `sudo ./install.sh`, execute these quick checks to verify everything is operating properly:

1. **Check Live Service Status Banner**:
   ```bash
   sudo ./manage-services-ubuntu.sh status
   ```
   *Verify that Web Server (Apache2), MySQL Database, Backend API, and Storage Volume all display **ACTIVE**.*

2. **Run Deep System Health Probe**:
   ```bash
   sudo bash deploy/verify.sh
   ```
   *Verifies port listeners (80, 3000, 3306), systemd units, and HTTP response.*

3. **Verify API HTTP Response**:
   ```bash
   curl -s http://127.0.0.1/api/health
   # Expected output: {"status":"ok", ...}
   ```

4. **Access in Intranet Web Browser**:
   Open from any workstation browser on the ground station network:
   ```
   http://<UBUNTU_SERVER_IP>/   or   http://localhost/
   ```

5. **Test First Login**:
   - Login with default Super Admin credentials: `admin@istrac.local` / `ChangeMe123!`.
   - Confirm Satellite fleet telemetry renders on the Dashboard.
   - Navigate to `/files` and upload a sample test document.

---

### 📦 Optional: Redis Offline Installation
By default, ISTRAC-SIMS includes a high-performance **in-memory fallback** for caching, rate limiting, and sessions. Redis is **not required** for normal operation.

If your ground station policy requires a dedicated Redis service:
1. On an internet-connected Ubuntu machine, download the `.deb` packages:
   ```bash
   apt-get download redis-server redis-tools libjemalloc2
   ```
2. Copy the downloaded `.deb` files into the `packages/` (or `packages/debs/`) folder of this bundle.
3. Re-run `sudo ./install.sh`. The installer will auto-detect and install the `.deb` files offline and enable `redis-server`.

---

## 👤 Default Credentials & First Login

> [!CAUTION]
> Change the default administrator password immediately after initial login.

| Parameter | Default Value |
|:---|:---|
| **Web Portal URL** | `http://<UBUNTU_SERVER_IP>/` |
| **Super Admin Email** | `admin@istrac.local` |
| **Default Password** | `ChangeMe123!` |
| **User Role** | `ADMIN` (Sole System Administrator) |
| **Database Name** | `istrac_sims` |
| **Database User / Pass**| `istrac_user` / `IstracSecurePass123!` |

*All operational personnel register via `/register` and are approved by the Super Admin in the Approval Queue (`/admin/approvals`).*

---

## ⚙️ System Configuration & Customization Guide (Per-System Settings)

Every ground station node may have different requirements (custom passwords, existing MySQL setups, separate disk mounts, or custom domain names). Here is how to configure each:

### 1. Changing Super Administrator Email & Password

* **From the Web UI (Recommended)**:
  1. Log in at `http://<SERVER_IP>/`.
  2. Click your user avatar in the Topbar -> select **"Change Password & Security"**.
  3. Enter current password (`ChangeMe123!`), provide new password (minimum 10 characters, uppercase, number, symbol), and click **Save Password**.
  4. In the Profile tab, update your Name and Email address.

* **From the Terminal (Offline CLI Reset)**:
  If the administrator password is forgotten or needs to be set via CLI:
  ```bash
  cd /opt/istrac-sims/backend
  sudo -u istrac /opt/node/bin/node dist/scripts/reset-admin-password.js "YourNewPassword123!"
  ```

* **Updating Super Admin Email in Environment**:
  ```bash
  sudo sed -i 's/^ADMIN_EMAIL=.*/ADMIN_EMAIL=flight_ops@istrac.gov.in/' /opt/istrac-sims/backend/.env
  sudo systemctl restart istrac-backend
  ```

---

### 2. Changing MySQL Database Name, User, or Password

If your server has an existing MySQL instance with custom credentials or you wish to use a different database name:

1. **Update `/opt/istrac-sims/backend/.env`**:
   ```ini
   # Edit with: sudo nano /opt/istrac-sims/backend/.env
   MYSQL_HOST=127.0.0.1
   MYSQL_PORT=3306
   MYSQL_DATABASE=my_mission_db
   MYSQL_USER=my_db_user
   MYSQL_PASSWORD=MySecretPassword123!
   DATABASE_URL="mysql://my_db_user:MySecretPassword123!@127.0.0.1:3306/my_mission_db"
   ```

2. **Grant Permissions in MySQL**:
   ```bash
   sudo mysql <<EOF
   CREATE DATABASE IF NOT EXISTS \`my_mission_db\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
   CREATE USER IF NOT EXISTS 'my_db_user'@'localhost' IDENTIFIED BY 'MySecretPassword123!';
   ALTER USER 'my_db_user'@'localhost' IDENTIFIED BY 'MySecretPassword123!';
   GRANT ALL PRIVILEGES ON \`my_mission_db\`.* TO 'my_db_user'@'localhost';
   CREATE USER IF NOT EXISTS 'my_db_user'@'127.0.0.1' IDENTIFIED BY 'MySecretPassword123!';
   ALTER USER 'my_db_user'@'127.0.0.1' IDENTIFIED BY 'MySecretPassword123!';
   GRANT ALL PRIVILEGES ON \`my_mission_db\`.* TO 'my_db_user'@'127.0.0.1';
   FLUSH PRIVILEGES;
   EOF
   ```

3. **Deploy Schema & Restart Services**:
   ```bash
   cd /opt/istrac-sims/backend
   export PRISMA_SCHEMA_ENGINE_BINARY="/opt/istrac-sims/backend/node_modules/@prisma/engines/schema-engine-debian-openssl-3.0.x"
   export DATABASE_URL="mysql://my_db_user:MySecretPassword123!@127.0.0.1:3306/my_mission_db"
   node ./node_modules/prisma/build/index.js migrate deploy
   sudo systemctl restart istrac-backend istrac-worker
   ```

---

### 3. Changing Storage Volume Mount Path (`HDD_MOUNT_PATH`)

If your server stores mission telemetry on a dedicated SAN / NAS / RAID partition (e.g. `/data/storage` instead of `/mnt/istrac_storage`):

1. **Update `.env`**:
   ```bash
   sudo sed -i 's|^HDD_MOUNT_PATH=.*|HDD_MOUNT_PATH=/data/storage|' /opt/istrac-sims/backend/.env
   ```
2. **Apply Permissions**:
   ```bash
   sudo mkdir -p /data/storage
   sudo chown -R istrac:istrac /data/storage
   sudo chmod -R 770 /data/storage
   ```
3. **Restart Daemons**:
   ```bash
   sudo systemctl restart istrac-backend istrac-worker
   ```

---

### 4. Changing Port Numbers (Resolving Port Conflicts)

* **If Backend Port 3000 is occupied**:
  1. In `/opt/istrac-sims/backend/.env`, set `PORT=3005`.
  2. In `/etc/apache2/sites-available/istrac-sims.conf`, update proxy targets:
     Change `http://127.0.0.1:3000` to `http://127.0.0.1:3005`.
  3. Reload: `sudo systemctl restart istrac-backend apache2`.

* **If Apache Web Port 80 is occupied**:
  1. In `/etc/apache2/ports.conf`, change `Listen 80` to `Listen 8080`.
  2. In `/etc/apache2/sites-available/istrac-sims.conf`, change `<VirtualHost *:80>` to `<VirtualHost *:8080>`.
  3. Reload: `sudo systemctl restart apache2`.
  4. Access via `http://<SERVER_IP>:8080/`.

---

### 5. Configuring Intranet Domain / FQDN & SSL

To attach a domain name (e.g. `sims.istrac.local` or `portal.groundstation.in`):
```bash
sudo bash deploy/setup-domain.sh sims.istrac.local none
# Or with local self-signed HTTPS (Port 443):
sudo bash deploy/setup-domain.sh sims.istrac.local selfsigned
```

---

### 6. Intranet SMTP Email Relay

To enable email notifications for approvals and file shares on your local ground station mail server:
```ini
# Edit /opt/istrac-sims/backend/.env
SMTP_HOST=mailrelay.istrac.local
SMTP_PORT=25
SMTP_USER=
SMTP_PASS=
```
Then restart: `sudo systemctl restart istrac-backend`.

---

## 🛠️ How to Stop & Start the Whole Server Stack

You can manage the server stack either using the **1-Click Management CLI** or using **Native Ubuntu Systemd Commands**:

### Method 1: Using the 1-Click Management Utility (`manage-services-ubuntu.sh`)

An interactive utility is installed at `/opt/istrac-sims/manage-services-ubuntu.sh`:

```bash
# 1. STOP application services (Apache, Backend, Worker):
sudo ./manage-services-ubuntu.sh stop

# 2. STOP the WHOLE server stack (including MySQL database & Redis):
sudo ./manage-services-ubuntu.sh stop-all

# 3. START the whole server stack in correct dependency order (MySQL -> Backend -> Worker -> Apache):
sudo ./manage-services-ubuntu.sh start

# 4. RESTART all services cleanly:
sudo ./manage-services-ubuntu.sh restart

# 5. CHECK live status across all daemons, ports, and storage mount:
sudo ./manage-services-ubuntu.sh status

# 6. STREAM live backend API logs in real-time:
sudo ./manage-services-ubuntu.sh logs

# 7. CREATE a timestamped database SQL backup:
sudo ./manage-services-ubuntu.sh backup
```

---

### Method 2: Using Native Ubuntu `systemctl` Commands (Manual Control)

If you need granular manual control over individual services:

#### 🛑 How to STOP the Whole Server Stack Cleanly:
*(Always stop web and background workers first so in-flight requests finish before shutting down the database)*:
```bash
# 1. Stop external web traffic
sudo systemctl stop apache2

# 2. Stop telemetry worker & pass scheduler
sudo systemctl stop istrac-worker

# 3. Stop backend API server
sudo systemctl stop istrac-backend

# 4. Stop MySQL database
sudo systemctl stop mysql

# 5. Stop Redis (if installed)
sudo systemctl stop redis-server 2>/dev/null || true
```

#### 🚀 How to START the Whole Server Stack in Dependency Order:
*(Always start the database first so the backend can establish its connection pool upon booting)*:
```bash
# 1. Start MySQL database
sudo systemctl start mysql

# 2. Start Redis cache (if installed)
sudo systemctl start redis-server 2>/dev/null || true

# 3. Start Backend API server (Port 3000)
sudo systemctl start istrac-backend

# 4. Start Telemetry Worker daemon
sudo systemctl start istrac-worker

# 5. Start Apache2 Reverse Proxy (Port 80/443)
sudo systemctl start apache2
```

#### 🔄 How to Enable or Disable Auto-Start on System Boot:
```bash
# Ensure all services auto-start whenever the Ubuntu machine powers on / reboots:
sudo systemctl enable mysql apache2 istrac-backend istrac-worker

# Disable auto-start on boot (for offline system maintenance):
sudo systemctl disable istrac-backend istrac-worker apache2
```

---

## 🔐 Offline Administrator Password Reset

If the Super Admin is locked out without an external email connection:

1. Navigate to `/forgot-password` on the web portal.
2. Enter `admin@istrac.local` and click **Request Verification Code**.
3. Inspect the live systemd journal on the Ubuntu server:
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
5. Enter the OTP code on the web portal to set a new secure password.

---

## 🆘 Quick Troubleshooting & Diagnostic Runbook

### 1. Backend API Shows `STOPPED` or Health Probe Failed

If `./manage-services-ubuntu.sh status` reports `Backend API (Systemd): STOPPED`:

#### Step A: Check Systemd Unit Status & Exit Reason
```bash
sudo systemctl status istrac-backend
```
*Look at the `Active:` line and the exit code (e.g. `code=exited, status=1/FAILURE`).*

#### Step B: Read the Recent Backend Logs
```bash
sudo journalctl -u istrac-backend -n 30 --no-pager
# OR stream live logs:
sudo ./manage-services-ubuntu.sh logs
```

#### Step C: Attempt Service Restart
```bash
sudo ./manage-services-ubuntu.sh start
# or
sudo systemctl restart istrac-backend istrac-worker
```

#### Step D: Interactive Console Execution (Direct Debugging)
If systemd fails to start the backend, run the Node.js entrypoint directly from the console to see the exact error and stack trace:
```bash
cd /opt/istrac-sims/backend
sudo -u istrac /usr/bin/node dist/src/index.js
```
*(Press `Ctrl + C` to stop once you have verified the error or confirmed it starts successfully).*

---

### 2. SQL Database Issues (`mysql` / `mariadb`)

* **Unit file mariadb.service does not exist**:  
  On systems running Oracle MySQL, the service is `mysql.service`:
  ```bash
  sudo systemctl status mysql
  sudo systemctl enable --now mysql
  ```
* **Verify Database Connection Directly**:
  ```bash
  mysql -u istrac_user -pIstracSecurePass123! -h 127.0.0.1 -D istrac_sims -e "SELECT COUNT(*) FROM User;"
  ```
* **Reset Database User Privileges if Authentication Fails**:
  ```bash
  sudo mysql -e "ALTER USER 'istrac_user'@'localhost' IDENTIFIED BY 'IstracSecurePass123!'; ALTER USER 'istrac_user'@'127.0.0.1' IDENTIFIED BY 'IstracSecurePass123!'; FLUSH PRIVILEGES;"
  ```

---

### 3. Apache Web Server Issues

* **Apache Returns `403 Forbidden`**:  
  Apache (`www-data`) needs read and directory traverse permissions:
  ```bash
  sudo chmod 755 /opt /opt/istrac-sims /opt/istrac-sims/frontend
  sudo chmod -R 755 /opt/istrac-sims/frontend/dist
  sudo usermod -a -G istrac www-data
  sudo systemctl restart apache2
  ```
* **Apache Returns `503 Service Unavailable` or Proxy Error**:  
  Apache is running, but the Backend API on port 3000 is stopped:
  ```bash
  sudo systemctl restart istrac-backend
  sudo journalctl -u istrac-backend -n 25 --no-pager
  ```

---

### 4. Storage Volume & Permissions

* **Storage Upload Fails / Returns 503**:
  ```bash
  sudo mkdir -p /mnt/istrac_storage
  sudo chown -R istrac:istrac /mnt/istrac_storage
  sudo chmod -R 770 /mnt/istrac_storage
  ```

---

### 5. Quick Diagnostic Reference Table

| Symptom | Primary Cause | Quick Command Fix |
|:---|:---|:---|
| **Backend API: `STOPPED`** | Service not started or startup exception | Run `sudo systemctl status istrac-backend` & `sudo journalctl -u istrac-backend -n 30`. |
| **Blank White Screen in Browser** | Stale browser cache | Press **`Ctrl + Shift + R`** (or open in Incognito window). |
| **Apache 403 Forbidden** | Apache user cannot read `dist/` | Run `sudo chmod 755 /opt/istrac-sims && sudo chmod -R 755 /opt/istrac-sims/frontend/dist`. |
| **Health Check `redis: error`** | Redis not installed / inactive | **Normal:** System uses in-memory fallback. Optional: `sudo systemctl enable --now redis-server`. |
| **Port 80 Inaccessible on Network** | UFW firewall blocking | Run `sudo ufw allow 80/tcp && sudo ufw reload`. |
| **Storage Warning on Status** | Missing `/mnt/istrac_storage` mount | Run `sudo mkdir -p /mnt/istrac_storage && sudo chown -R istrac:istrac /mnt/istrac_storage`. |
