# 🛰️ ISTRAC-SIMS / ISTRAC-FMS — Air-Gapped RHEL Production Setup Guide

This guide details the complete, from-scratch setup of the **Satellite Information Management System (ISTRAC-SIMS)** on an **offline intranet server running Red Hat Enterprise Linux (RHEL 8 / 9)**.

---

## 1. System Architecture

In this deployment:
* **Apache HTTP Server (`httpd`)** is the primary edge web server and reverse proxy on Port 80 / 443.
* **Native Systemd Daemons** manage and supervise the Node.js backend API and mission event background worker. (Alternatively, **PM2** can be used if preferred).
* **MariaDB** provides ACID-compliant relational data storage.
* **Redis** provides low-latency caching and real-time WebSocket pub/sub distribution.
* **Storage Mount** (`/mnt/istrac_storage`) provides physical storage for telemetry datasets, mission documents, and media uploads.

```mermaid
flowchart TD
    Client["Intranet Users / Operators (Web Browser)"]
    Firewall["firewalld (Ports 80 & 443)"]
    Apache["Apache HTTP Server (httpd)\n/etc/httpd/conf.d/istrac-sims.conf"]
    Frontend["Static React 19 SPA\n/opt/istrac-fms/frontend/dist"]
    Backend["Node.js Express API (Port 3000)\nistrac-backend.service / PM2"]
    Worker["Mission Scheduler & Sync Worker\nistrac-worker.service / PM2"]
    MariaDB[("MariaDB Server\nPort 3306 (istrac_fms)")]
    Redis[("Redis In-Memory Cache\nPort 6379")]
    Storage["Physical Storage Mount\n/mnt/istrac_storage"]

    Client --> Firewall
    Firewall --> Apache
    Apache -->|"GET / (Static assets)"| Frontend
    Apache -->|"Proxy /api/*"| Backend
    Apache -->|"Proxy /ws (WebSocket)"| Backend
    Apache -->|"Proxy /media/*"| Backend
    Backend --> MariaDB
    Backend --> Redis
    Backend --> Storage
    Worker --> MariaDB
    Worker --> Redis
```

---

## 2. Inventory of Every Package & Service Used

### A. Operating System Level Packages (RHEL)
| Package | Description | Source in Air-Gapped Setup |
| :--- | :--- | :--- |
| **`httpd`** | Apache HTTP Server 2.4 | RHEL Installation DVD ISO (`AppStream`) |
| **`mod_ssl`** | SSL/TLS cryptography module for Apache | RHEL Installation DVD ISO (`AppStream`) |
| **`mariadb-server` & `mariadb`** | MariaDB 10.5+ Relational Database | RHEL Installation DVD ISO (`AppStream`) |
| **`redis`** | In-memory key-value cache & pub/sub broker | RHEL Installation DVD ISO (`AppStream`) |
| **`nodejs` & `npm`** | Node.js v20 LTS JavaScript runtime engine | RHEL 9 AppStream or pre-downloaded Node.js RPM |
| **`policycoreutils-python-utils`** | SELinux policy management tools (`semanage`) | RHEL Installation DVD ISO (`BaseOS`) |
| **`firewalld`** | Dynamic stateful host firewall daemon | Built-in to RHEL |
| **`tar`, `gzip`, `openssl`** | Archive extraction and cryptographic tokens | Built-in to RHEL |

### B. Application Runtime Packages & Libraries
* **Backend (`backend/package.json`)**:
  * `express`: REST API web framework.
  * `@prisma/client` & `prisma`: Database ORM with native Linux query engines (`rhel-openssl-1.1.x`, `rhel-openssl-3.0.x`).
  * `ioredis`: Low-latency Redis client with pub/sub clustering.
  * `ws`: WebSocket server for real-time telemetry streaming (`/ws`).
  * `jsonwebtoken`: Secure JWT authentication tokens.
  * `bcrypt`: Password hashing.
  * `multer`: File upload multipart stream handling.
  * `node-cron`: Scheduled telemetry check jobs.
  * `zod`: Request payload schema validation.
  * `helmet`, `cors`, `cookie-parser`: Security headers, CORS, and cookie management.
* **Frontend (`frontend/package.json`)**:
  * Pre-compiled via Vite into pure static HTML, JavaScript chunks, CSS, and SVG files in `frontend/dist/`.
  * **Requires 0 npm dependencies at runtime on RHEL** (served directly by Apache).

### C. Daemons & Services Running on the RHEL Server
1. **`httpd.service`**: Apache HTTP Server (Port 80 / 443).
2. **`mariadb.service`**: MariaDB Database Server (Port 3306).
3. **`redis.service`**: Redis In-Memory Cache (Port 6379).
4. **`istrac-backend.service`**: Node.js Express API Server (Port 3000, managed by Systemd or PM2).
5. **`istrac-worker.service`**: Background mission event worker (managed by Systemd or PM2).
6. **`firewalld.service`**: Firewall rules for HTTP/HTTPS.

---

## 3. In-Built vs. Manual Installation Matrix

| Component | In-Built in RHEL? | Present on RHEL ISO? | Needs Manual Setup? |
| :--- | :---: | :---: | :---: |
| **`systemd` (PID 1 supervisor)** | ✅ Yes | Built-in | Just enable service units |
| **`firewalld` (Firewall)** | ✅ Yes | Built-in | Open port 80 / 443 |
| **`SELinux`** | ✅ Yes | Built-in | Set proxy boolean & file contexts |
| **Apache (`httpd`)** | ❌ No (Not running) | ✅ Yes (AppStream) | Install from ISO & copy virtualhost |
| **MariaDB Server** | ❌ No (Not running) | ✅ Yes (AppStream) | Install from ISO, init DB & user |
| **Redis Server** | ❌ No (Not running) | ✅ Yes (AppStream) | Install from ISO & start service |
| **Node.js 20 LTS** | ❌ No (Not in minimal) | ✅ Yes (RHEL 9 AppStream) | Install from ISO or RPM |
| **Application Artifacts** | ❌ No | ❌ No | Bundle on connected PC & copy via USB |
| **Storage Directory** | ❌ No | Built-in tools | Create `/mnt/istrac_storage` & set permissions |

---

## 4. Complete Step-by-Step Installation From Scratch

### Step 1: Prepare the Offline Bundle on an Internet-Connected Machine

Before heading into the air-gapped facility, package the application:

#### On Linux / Mac / WSL:
```bash
cd /path/to/istrac-fms
chmod +x deploy/bundle-offline.sh
./deploy/bundle-offline.sh
```

#### On Windows (PowerShell):
```powershell
cd D:\istrac-fms
.\deploy\bundle-offline.ps1
```

This creates:
`dist-offline/istrac-fms-offline-bundle-YYYYMMDD.tar.gz` (or `.zip`) containing:
- Pre-compiled frontend static bundle (`frontend/dist/`)
- Pre-compiled backend JavaScript (`backend/dist/`)
- Pre-generated Prisma client with RHEL engines (`backend/prisma/`)
- Production `node_modules/`
- Automated deployment scripts and Apache VirtualHost configurations

Copy this bundle along with the **RHEL Installation DVD ISO** (`rhel-9.x-x86_64-dvd.iso`) to an authorized USB drive or media.

---

### Step 2: Transfer and Extract on the Air-Gapped RHEL Server

Log into your RHEL server as `root` (or with `sudo` privileges):

```bash
# 1. Create target installation directory
mkdir -p /opt/istrac-fms

# 2. Extract offline deployment bundle
tar -xzvf /path/to/usb/istrac-fms-offline-bundle-*.tar.gz -C /opt/istrac-fms
cd /opt/istrac-fms
```

---

### Step 3: Configure Local RHEL ISO Repository (Zero Internet)

Mount the RHEL DVD ISO to install system packages without internet:

```bash
# 1. Mount the RHEL Installation ISO
mkdir -p /mnt/rhel-iso
mount -o loop /path/to/rhel-9.x-x86_64-dvd.iso /mnt/rhel-iso

# 2. Create local repository configuration file
cat <<EOF > /etc/yum.repos.d/rhel-local.repo
[rhel-local-baseos]
name=RHEL Local BaseOS
baseurl=file:///mnt/rhel-iso/BaseOS
enabled=1
gpgcheck=0

[rhel-local-appstream]
name=RHEL Local AppStream
baseurl=file:///mnt/rhel-iso/AppStream
enabled=1
gpgcheck=0
EOF

# 3. Clean and verify local repository
dnf clean all
dnf repolist
```

---

### Step 4: Install Required System Packages

```bash
# Install Apache, MariaDB, Redis, Node.js, and SELinux utilities
dnf --disablerepo="*" --enablerepo="rhel-local*" install -y \
    httpd \
    mod_ssl \
    mariadb-server \
    mariadb \
    redis \
    nodejs \
    npm \
    policycoreutils-python-utils \
    firewalld \
    tar \
    gzip
```

---

### Step 5: Automated One-Command Installation

Run the automated offline installer script:

```bash
sudo bash /opt/istrac-fms/deploy/install-apache-offline.sh
```

*(Or run `sudo bash /opt/istrac-fms/setup-rhel-offline.sh`)*

#### What the script automatically completes:
1. **Creates system service user `istrac`** (no-login daemon user).
2. **Initializes MariaDB**: Starts service, creates database `istrac_fms`, user `istrac_user`, sets privileges.
3. **Starts Redis**: Enables and launches the Redis daemon on port 6379.
4. **Configures Backend Environment**: Generates `.env` with dynamic cryptographic secrets, MariaDB credentials, and Redis URL.
5. **Runs Offline Migrations & Seed**: Applies Prisma database migrations and seeds initial admin accounts and satellite stations.
6. **Configures Native Systemd Services**: Installs `istrac-backend.service` (Port 3000) and `istrac-worker.service`.
7. **Configures Apache (`httpd`)**: Installs VirtualHost, configures SPA fallback, reverse proxies `/api/`, `/ws`, and `/media/`.
8. **Hardens SELinux & Firewalld**: Enables `httpd_can_network_connect`, applies file contexts, opens HTTP (80) and HTTPS (443).
9. **Performs Health Check**: Probes the backend API and prints the status table.

---

### Step 6: Manual Step-by-Step Configuration (If Installing Manually)

If you prefer to perform each step manually instead of running the script:

#### A. Initialize MariaDB
```bash
systemctl enable --now mariadb

mysql -u root <<EOF
CREATE DATABASE IF NOT EXISTS istrac_fms CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS 'istrac_user'@'localhost' IDENTIFIED BY 'IstracSecurePass123!';
GRANT ALL PRIVILEGES ON istrac_fms.* TO 'istrac_user'@'localhost';
CREATE USER IF NOT EXISTS 'istrac_user'@'127.0.0.1' IDENTIFIED BY 'IstracSecurePass123!';
GRANT ALL PRIVILEGES ON istrac_fms.* TO 'istrac_user'@'127.0.0.1';
FLUSH PRIVILEGES;
EOF
```

#### B. Initialize Redis
```bash
systemctl enable --now redis
```

#### C. Setup Storage Directory
```bash
mkdir -p /mnt/istrac_storage
chmod 775 /mnt/istrac_storage
chown -R istrac:istrac /mnt/istrac_storage
```

#### D. Setup Backend `.env` & Run Migrations
```bash
cd /opt/istrac-fms/backend

cat <<EOF > .env
NODE_ENV=production
PORT=3000
DATABASE_URL="mysql://istrac_user:IstracSecurePass123!@127.0.0.1:3306/istrac_fms"
REDIS_URL="redis://127.0.0.1:6379"
HDD_MOUNT_PATH="/mnt/istrac_storage"
JWT_SECRET="$(openssl rand -hex 32)"
JWT_REFRESH_SECRET="$(openssl rand -hex 32)"
EOF

# Run Prisma migrations & seed offline
npx prisma migrate deploy
node dist/prisma/seed.js
```

#### E. Install Systemd Service Units
```bash
cp /opt/istrac-fms/deploy/istrac-backend.service /etc/systemd/system/
cp /opt/istrac-fms/deploy/istrac-worker.service /etc/systemd/system/

systemctl daemon-reload
systemctl enable --now istrac-backend
systemctl enable --now istrac-worker
```

*(Note: If using **PM2** instead of Systemd:)*
```bash
npm install -g pm2
pm2 start /opt/istrac-fms/ecosystem.config.cjs --env production
pm2 save
pm2 startup systemd -u root --hp /root
```

#### F. Configure Apache HTTP Server (`httpd`)
```bash
cp /opt/istrac-fms/deploy/httpd-istrac.conf /etc/httpd/conf.d/istrac-sims.conf

# 🛡️ Configure SELinux booleans & contexts
setsebool -P httpd_can_network_connect 1
semanage fcontext -a -t httpd_sys_content_t "/opt/istrac-fms/frontend/dist(/.*)?" 2>/dev/null || true
semanage fcontext -a -t httpd_sys_rw_content_t "/mnt/istrac_storage(/.*)?" 2>/dev/null || true
restorecon -Rv /opt/istrac-fms/frontend/dist
restorecon -Rv /mnt/istrac_storage

# 🔥 Open Firewalld ports
firewall-cmd --permanent --add-service=http
firewall-cmd --permanent --add-service=https
firewall-cmd --reload

# Start Apache
systemctl enable --now httpd
systemctl restart httpd
```

---

## 5. Daily Operations & Management Commands

Use the unified [manage-services-rhel.sh](file:///D:/istrac-fms/manage-services-rhel.sh) utility located in `/opt/istrac-fms`:

```bash
# 1. Check status of all services (Apache, Node.js, MariaDB, Redis, Storage Mount)
/opt/istrac-fms/manage-services-rhel.sh status

# 2. Restart all services in correct dependency order
/opt/istrac-fms/manage-services-rhel.sh restart

# 3. Stop all services
/opt/istrac-fms/manage-services-rhel.sh stop

# 4. Start all services
/opt/istrac-fms/manage-services-rhel.sh start

# 5. Create a gzip-compressed MariaDB backup
/opt/istrac-fms/manage-services-rhel.sh backup
```

### Viewing Real-Time Logs
* **Apache Access / Error Logs**:
  ```bash
  tail -f /var/log/httpd/istrac-sims-error.log
  tail -f /var/log/httpd/istrac-sims-access.log
  ```
* **Backend API Logs (Systemd)**:
  ```bash
  journalctl -u istrac-backend -f
  ```
* **Worker Scheduler Logs (Systemd)**:
  ```bash
  journalctl -u istrac-worker -f
  ```
* **If using PM2**:
  ```bash
  pm2 logs
  ```

---

## 6. Default Admin Login Credentials

Once deployment completes, open `http://<SERVER_IP>/` in an intranet browser:

| Account | Email | Default Password | Role & Access Level |
| :--- | :--- | :--- | :--- |
| **Super Admin** | `admin@istrac.local` | `ChangeMe123!` | `ADMIN` — Sole System Administrator (Full Authority) |

> [!IMPORTANT]
> **Single Administrator & Clean Seed Policy**:
> - Only `admin@istrac.local` is seeded. All subsequent operators submit clearance requests via the `/register` web form.
> - The system strictly enforces that only ONE administrator account can exist. Secondary administrator creation or promotion is blocked at both database seed and API levels.
> - Promptly rotate the default password upon initial server provisioning.

---

## 7. Administrator Password Reset & Terminal Recovery

Because the system operates in an air-gapped intranet environment without outbound SMTP, the sole administrator can reset or recover credentials via two built-in mechanisms:

### Method 1: Server CLI Password Reset Tool (Direct Recovery)
Execute the administrative password reset utility directly on the RHEL server terminal:
```bash
cd /opt/istrac-fms/backend
npm run admin:reset-password -- "YourNewSecurePassword123!"
```
*This command cryptographically hashes the new password with bcrypt (12 rounds), updates MariaDB, terminates active administrator refresh tokens, and writes an audit log.*

### Method 2: Terminal Broadcast via Web Portal
1. On the web portal, navigate to `/forgot-password`.
2. Enter `admin@istrac.local` and click **Request Verification Code**.
3. The backend outputs the 6-digit OTP in a high-visibility ASCII banner directly to the service journal:
   ```bash
   journalctl -u istrac-backend -n 20 --no-pager
   ```
4. Enter the 6-digit code on the `/forgot-password` page along with the new password to complete the reset.

---

## 8. Air-Gapped Operator OTP Management (`/admin/password-resets`)

For operators and members:
1. Operator requests password reset at `/forgot-password`.
2. A 6-digit cryptographic OTP is generated and saved in `PasswordResetToken` (15-minute validity).
3. The Super Admin opens **OTP & Password Reset Management** (`/admin/password-resets`) from the navigation bar.
4. Admin clicks **Copy Email Template** (dynamically formatted with CMS branding) or **Open Mail Client (mailto:)** to transmit the OTP to the operator over local secure channels.
5. The operator enters the verification code and new password on the portal to finalize the reset.
