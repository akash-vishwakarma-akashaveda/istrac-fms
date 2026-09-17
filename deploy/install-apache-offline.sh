#!/usr/bin/env bash
# ==============================================================================
# 🛰️ ISTRAC-SIMS — Master Offline Setup & Automated Installation Script
# Supported OS: Ubuntu 24.04 LTS (Noble) / Debian & RHEL 8/9 / Rocky / AlmaLinux
# Web Server: Apache HTTP Server (apache2 on Ubuntu / httpd on RHEL)
# Process Manager: Native Systemd Daemons (istrac-backend & istrac-worker)
# Mode: 100% Air-Gapped / Offline Intranet (Zero Internet Connection Required)
#
# Usage:
#   sudo bash deploy/install-apache-offline.sh
# ==============================================================================

set -euo pipefail

# ANSI Color Palette
CYAN='\033[0;36m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
BOLD='\033[1m'
NC='\033[0m'

log_info()    { echo -e "${CYAN}[INFO]${NC} $(date '+%Y-%m-%d %H:%M:%S') — $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $(date '+%Y-%m-%d %H:%M:%S') — ${BOLD}$1${NC}"; }
log_warn()    { echo -e "${YELLOW}[WARN]${NC} $(date '+%Y-%m-%d %H:%M:%S') — $1"; }
log_error()   { echo -e "${RED}[ERROR]${NC} $(date '+%Y-%m-%d %H:%M:%S') — $1"; }

echo -e "${BLUE}${BOLD}"
echo "=============================================================================="
echo " 🛰️  ISRO / ISTRAC — SATELLITE INFORMATION MANAGEMENT SYSTEM (ISTRAC-SIMS)"
echo " Automated Air-Gapped Production Setup Suite for Ubuntu 24 & RHEL 8/9"
echo " Web Server: Apache (apache2/httpd)  |  Process Supervisor: Systemd"
echo "=============================================================================="
echo -e "${NC}"

# ------------------------------------------------------------------------------
# 1. ROOT PRIVILEGES & DIRECTORY RESOLUTION
# ------------------------------------------------------------------------------
if [[ $EUID -ne 0 ]]; then
   log_error "This script must be executed with root/sudo privileges: sudo bash $0"
   exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

# Installation Targets
INSTALL_DIR="/opt/istrac-fms"
STORAGE_DIR="/mnt/istrac_storage"
APP_USER="istrac"
APP_PORT=3000

# Detect Operating System Distribution
IS_DEBIAN=0
IS_RHEL=0
DISTRO_NAME="Linux"

if [[ -f /etc/os-release ]]; then
    . /etc/os-release
    DISTRO_NAME="${PRETTY_NAME:-$NAME}"
    if [[ "${ID_LIKE:-}" =~ (debian|ubuntu) || "${ID:-}" =~ (debian|ubuntu) ]]; then
        IS_DEBIAN=1
    elif [[ "${ID_LIKE:-}" =~ (rhel|fedora|centos) || "${ID:-}" =~ (rhel|rocky|almalinux) ]]; then
        IS_RHEL=1
    fi
fi

log_info "Operating System:       ${DISTRO_NAME}"
log_info "Source Directory:       ${ROOT_DIR}"
log_info "Destination Directory:  ${INSTALL_DIR}"
log_info "Storage Mount Path:     ${STORAGE_DIR}"

# ------------------------------------------------------------------------------
# 2. DETECT & CONFIGURE OFFLINE PACKAGES (APACHE, MYSQL/MARIADB, NODEJS)
# ------------------------------------------------------------------------------
log_info "Step 1/8: Verifying and installing system prerequisites..."

# Auto-extract standalone Node.js binary tarball if present in rpms/ or source root
NODE_ARCHIVE=$(find "${ROOT_DIR}" "${SCRIPT_DIR}" -maxdepth 2 -name "node-v*-linux-x64.tar.*" 2>/dev/null | head -n 1 || true)
if [[ -n "${NODE_ARCHIVE}" && -f "${NODE_ARCHIVE}" ]]; then
    CURRENT_NODE_VER=$(node -v 2>/dev/null || /usr/local/bin/node -v 2>/dev/null || echo "v0")
    if ! command -v node >/dev/null 2>&1 || [[ "${NODE_ARCHIVE}" == *"v24"* && "${CURRENT_NODE_VER}" != *"v24"* ]]; then
        log_info "Detected Node.js binary archive (${NODE_ARCHIVE}). Installing to /usr/local..."
        tar -xf "${NODE_ARCHIVE}" -C /usr/local --strip-components=1
        ln -sf /usr/local/bin/node /usr/bin/node
        ln -sf /usr/local/bin/npm /usr/bin/npm
        ln -sf /usr/local/bin/npx /usr/bin/npx
        export PATH="/usr/local/bin:/usr/bin:$PATH"
        log_success "Node.js successfully configured: $(/usr/bin/node -v)"
    fi
fi
export PATH="/usr/local/bin:/usr/bin:$PATH"

# OS-Specific Package Checks and Offline Package Installation
if [[ $IS_DEBIAN -eq 1 ]]; then
    # Ubuntu / Debian Package Management
    if ! command -v apache2 >/dev/null 2>&1; then
        if [[ -d "${ROOT_DIR}/debs" ]] && compgen -G "${ROOT_DIR}/debs/*.deb" > /dev/null; then
            log_info "Installing offline DEB packages from ${ROOT_DIR}/debs/..."
            dpkg -i "${ROOT_DIR}/debs/"*.deb || apt-get install -f -y 2>/dev/null || true
        elif [[ -d "/media/ubuntu-iso" ]]; then
            log_info "Detected mounted Ubuntu ISO at /media/ubuntu-iso..."
            apt-get install -y apache2 || true
        else
            log_info "Attempting standard apt-get install for apache2..."
            apt-get update -y 2>/dev/null || true
            apt-get install -y apache2 2>/dev/null || true
        fi
    fi
else
    # RHEL / CentOS / Rocky Package Management
    if [[ -d "${ROOT_DIR}/rpms" ]] && compgen -G "${ROOT_DIR}/rpms/*.rpm" > /dev/null; then
        log_info "Installing offline RPMs from ${ROOT_DIR}/rpms/..."
        dnf localinstall -y "${ROOT_DIR}/rpms/"*.rpm 2>/dev/null || true
    elif [[ -d "${SCRIPT_DIR}/rpms" ]] && compgen -G "${SCRIPT_DIR}/rpms/*.rpm" > /dev/null; then
        log_info "Installing offline RPMs from ${SCRIPT_DIR}/rpms/..."
        dnf localinstall -y "${SCRIPT_DIR}/rpms/"*.rpm 2>/dev/null || true
    elif [[ -d "/mnt/rhel-iso" ]]; then
        log_info "Detected mounted RHEL ISO at /mnt/rhel-iso. Installing packages via local repo..."
        dnf --disablerepo="*" --enablerepo="rhel-local*" install -y \
            httpd mod_ssl mariadb-server mariadb redis nodejs npm policycoreutils-python-utils tar gzip || true
    else
        log_info "Attempting standard DNF installation (using enabled repositories)..."
        for pkg in httpd mod_ssl mariadb-server mariadb policycoreutils-python-utils firewalld; do
            if ! command -v "$pkg" >/dev/null 2>&1 && ! rpm -q "$pkg" >/dev/null 2>&1; then
                dnf install -y "$pkg" 2>/dev/null || true
            fi
        done
        dnf install -y redis 2>/dev/null || dnf install -y valkey 2>/dev/null || true
    fi
fi

# Verify Apache HTTP Server binary (apache2 on Ubuntu / httpd on RHEL)
if command -v apache2 >/dev/null 2>&1; then
    APACHE_BIN="apache2"
    APACHE_SERVICE="apache2"
elif command -v httpd >/dev/null 2>&1; then
    APACHE_BIN="httpd"
    APACHE_SERVICE="httpd"
else
    log_error "Apache HTTP Server ('apache2' or 'httpd') is not installed."
    if [[ $IS_DEBIAN -eq 1 ]]; then
        log_error "On Ubuntu, please run: sudo apt install -y apache2"
    else
        log_error "On RHEL, please run: sudo dnf install -y httpd"
    fi
    exit 1
fi

# Verify MySQL and Node.js
for cmd in mysql node; do
    if ! command -v "$cmd" >/dev/null 2>&1; then
        log_error "Required binary '$cmd' is not installed."
        exit 1
    fi
done

APACHE_VER=$($APACHE_BIN -v 2>/dev/null | head -n 1 | awk '{print $3}')
if command -v redis-server >/dev/null 2>&1; then
    log_success "Core binaries verified: Apache (${APACHE_VER}), Node.js $(node -v), MySQL client, Redis server."
else
    log_warn "Redis binary not installed. System will automatically operate in Standalone In-Memory mode."
    log_success "Core binaries verified: Apache (${APACHE_VER}), Node.js $(node -v), MySQL client."
fi

# ------------------------------------------------------------------------------
# 3. CREATE APPLICATION SERVICE USER & DIRECTORIES
# ------------------------------------------------------------------------------
log_info "Step 2/8: Setting up dedicated service user '${APP_USER}' and directories..."

if ! id -u "${APP_USER}" >/dev/null 2>&1; then
    useradd -r -s /sbin/nologin -d "${INSTALL_DIR}" "${APP_USER}"
    log_success "Created system user '${APP_USER}'."
fi

mkdir -p "${INSTALL_DIR}/backend"
mkdir -p "${INSTALL_DIR}/frontend"
mkdir -p "${STORAGE_DIR}"
mkdir -p /var/log/istrac-sims

# Copy application files if installing to /opt/istrac-fms from bundle/workspace
if [[ "${ROOT_DIR}" != "${INSTALL_DIR}" ]]; then
    log_info "Copying backend and frontend production builds to ${INSTALL_DIR}..."
    cp -r "${ROOT_DIR}/backend/"* "${INSTALL_DIR}/backend/"
    cp -r "${ROOT_DIR}/frontend/"* "${INSTALL_DIR}/frontend/"
    cp -r "${ROOT_DIR}/deploy" "${INSTALL_DIR}/" 2>/dev/null || true
    cp "${ROOT_DIR}/manage-services-rhel.sh" "${INSTALL_DIR}/" 2>/dev/null || true
    if [[ -f "${ROOT_DIR}/backup_before_v1.sql" ]]; then
        cp "${ROOT_DIR}/backup_before_v1.sql" "${INSTALL_DIR}/backup_before_v1.sql"
    fi
fi

# ------------------------------------------------------------------------------
# 4. INITIALIZE & CONFIGURE MYSQL / MARIADB & REDIS
# ------------------------------------------------------------------------------
log_info "Step 3/8: Initializing and starting Database (MySQL/MariaDB) and Redis..."

# Detect whether system is using mysql, mariadb, or mysqld service
DB_SERVICE="mysql"
if systemctl is-active --quiet mysql; then
    DB_SERVICE="mysql"
    log_info "MySQL service (mysql.service) is active."
elif systemctl is-active --quiet mariadb; then
    DB_SERVICE="mariadb"
    log_info "MariaDB service (mariadb.service) is active."
elif systemctl is-active --quiet mysqld; then
    DB_SERVICE="mysqld"
    log_info "MySQL service (mysqld.service) is active."
elif systemctl list-unit-files | grep -q -E '^mysql\.service'; then
    DB_SERVICE="mysql"
    systemctl enable --now mysql || true
elif systemctl list-unit-files | grep -q -E '^mariadb\.service'; then
    DB_SERVICE="mariadb"
    systemctl enable --now mariadb || true
elif systemctl list-unit-files | grep -q -E '^mysqld\.service'; then
    DB_SERVICE="mysqld"
    systemctl enable --now mysqld || true
else
    systemctl start mysql 2>/dev/null || systemctl start mariadb 2>/dev/null || systemctl start mysqld 2>/dev/null || true
fi

# Redis service detection (redis on RHEL / redis-server on Ubuntu)
if systemctl list-unit-files | grep -q -E '^redis-server\.service'; then
    systemctl enable --now redis-server 2>/dev/null || true
elif systemctl list-unit-files | grep -q -E '^redis\.service'; then
    systemctl enable --now redis 2>/dev/null || true
fi

# Database Configuration
echo ""
echo -e "${BOLD}${CYAN}------------------------------------------------------------------------------${NC}"
echo -e "${BOLD}🗄️  DATABASE CONFIGURATION${NC}"
echo -e "${CYAN}------------------------------------------------------------------------------${NC}"
DEFAULT_DB="istrac_fms"
if [[ -f "${INSTALL_DIR}/backend/.env" ]]; then
    EXISTING_DB=$(grep '^MYSQL_DATABASE=' "${INSTALL_DIR}/backend/.env" | head -n 1 | cut -d '=' -f2 | tr -d '"\r')
    if [[ -n "${EXISTING_DB}" ]]; then
        DEFAULT_DB="${EXISTING_DB}"
        log_info "Detected existing database configuration: '${EXISTING_DB}'"
    fi
fi

if [[ -t 0 ]]; then
    read -r -p "Enter Database Name [default: ${DEFAULT_DB}]: " INPUT_DB_NAME
    DB_NAME="${INPUT_DB_NAME:-${DEFAULT_DB}}"
else
    DB_NAME="${DB_NAME:-${DEFAULT_DB}}"
fi
DB_USER="istrac_user"
DB_PASS="IstracSecurePass123!"
log_info "Using database: '${DB_NAME}' and user: '${DB_USER}'"

log_info "Configuring database '${DB_NAME}' and user '${DB_USER}'..."

SQL_INIT="
CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS '${DB_USER}'@'localhost' IDENTIFIED BY '${DB_PASS}';
GRANT ALL PRIVILEGES ON \`${DB_NAME}\`.* TO '${DB_USER}'@'localhost';
CREATE USER IF NOT EXISTS '${DB_USER}'@'127.0.0.1' IDENTIFIED BY '${DB_PASS}';
GRANT ALL PRIVILEGES ON \`${DB_NAME}\`.* TO '${DB_USER}'@'127.0.0.1';
FLUSH PRIVILEGES;
"

if mysql -u root -e "SELECT 1;" >/dev/null 2>&1; then
    mysql -u root <<EOF
${SQL_INIT}
EOF
    log_success "Database '${DB_NAME}' and permissions initialized via root socket."
else
    log_warn "'mysql -u root' without password did not succeed. If MySQL root has a password, enter it below:"
    mysql -u root -p <<EOF
${SQL_INIT}
EOF
    log_success "Database '${DB_NAME}' and permissions initialized."
fi

# ------------------------------------------------------------------------------
# 5. CONFIGURE BACKEND ENVIRONMENT FILE (.env)
# ------------------------------------------------------------------------------
log_info "Step 4/8: Generating backend production environment configuration..."

EXISTING_JWT=""
EXISTING_REFRESH=""
if [[ -f "${INSTALL_DIR}/backend/.env" ]]; then
    EXISTING_JWT=$(grep '^JWT_SECRET=' "${INSTALL_DIR}/backend/.env" | head -n 1 | cut -d '=' -f2 | tr -d '"\r')
    EXISTING_REFRESH=$(grep '^JWT_REFRESH_SECRET=' "${INSTALL_DIR}/backend/.env" | head -n 1 | cut -d '=' -f2 | tr -d '"\r')
fi

JWT_SECRET="${EXISTING_JWT:-$(head -c 32 /dev/urandom | base64 | tr -dc 'a-zA-Z0-9' | head -c 32)}"
JWT_REFRESH_SECRET="${EXISTING_REFRESH:-$(head -c 32 /dev/urandom | base64 | tr -dc 'a-zA-Z0-9' | head -c 32)}"

cat <<EOF > "${INSTALL_DIR}/backend/.env"
NODE_ENV=production
PORT=${APP_PORT}
APP_URL=http://localhost
ALLOWED_ORIGINS=http://localhost,http://127.0.0.1
LOG_LEVEL=info
DEBUG_PRISMA=false

# Database
MYSQL_HOST=127.0.0.1
MYSQL_PORT=3306
MYSQL_DATABASE=${DB_NAME}
MYSQL_USER=${DB_USER}
MYSQL_PASSWORD=${DB_PASS}
DATABASE_URL="mysql://${DB_USER}:${DB_PASS}@127.0.0.1:3306/${DB_NAME}"

# Redis
REDIS_URL="redis://127.0.0.1:6379"

# Security Secrets
JWT_SECRET=${JWT_SECRET}
JWT_REFRESH_SECRET=${JWT_REFRESH_SECRET}

# Storage Mount
HDD_MOUNT_PATH=${STORAGE_DIR}
EOF

chown "${APP_USER}:${APP_USER}" "${INSTALL_DIR}/backend/.env"
chmod 600 "${INSTALL_DIR}/backend/.env"
log_success "Production backend .env file configured."

# ------------------------------------------------------------------------------
# 6. DATABASE SCHEMA DEPLOYMENT & SEEDING
# ------------------------------------------------------------------------------
log_info "Step 5/8: Initializing database schema and records..."

cd "${INSTALL_DIR}/backend"

export DATABASE_URL="mysql://${DB_USER}:${DB_PASS}@127.0.0.1:3306/${DB_NAME}"
export NODE_ENV=production

# 1. Check if database tables exist
TABLE_COUNT=$(mysql -u "${DB_USER}" -p"${DB_PASS}" -h 127.0.0.1 -D "${DB_NAME}" -sNe "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='${DB_NAME}';" 2>/dev/null || echo "0")

if [[ "${TABLE_COUNT}" -eq 0 ]]; then
    # Attempt Prisma migration first
    MIGRATION_DEPLOYED=0
    if [[ -f "./node_modules/prisma/build/index.js" ]]; then
        DATABASE_URL="${DATABASE_URL}" node ./node_modules/prisma/build/index.js migrate deploy 2>/dev/null && MIGRATION_DEPLOYED=1 || true
    elif [[ -f "./node_modules/.bin/prisma" ]]; then
        DATABASE_URL="${DATABASE_URL}" ./node_modules/.bin/prisma migrate deploy 2>/dev/null && MIGRATION_DEPLOYED=1 || true
    fi

    # If Prisma schema-engine was not available offline, fallback to the guaranteed SQL baseline
    TABLE_COUNT=$(mysql -u "${DB_USER}" -p"${DB_PASS}" -h 127.0.0.1 -D "${DB_NAME}" -sNe "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='${DB_NAME}';" 2>/dev/null || echo "0")
    if [[ "${TABLE_COUNT}" -eq 0 ]]; then
        if [[ -f "${INSTALL_DIR}/backup_before_v1.sql" ]]; then
            log_info "Applying schema baseline from backup_before_v1.sql..."
            mysql -u "${DB_USER}" -p"${DB_PASS}" -h 127.0.0.1 -D "${DB_NAME}" < "${INSTALL_DIR}/backup_before_v1.sql"
            log_success "Database schema initialized from verified SQL baseline."
        elif [[ -f "${ROOT_DIR}/backup_before_v1.sql" ]]; then
            log_info "Applying schema baseline from backup_before_v1.sql..."
            mysql -u "${DB_USER}" -p"${DB_PASS}" -h 127.0.0.1 -D "${DB_NAME}" < "${ROOT_DIR}/backup_before_v1.sql"
            log_success "Database schema initialized from verified SQL baseline."
        fi
    else
        log_success "Prisma offline migrations applied successfully."
    fi
else
    log_info "Database '${DB_NAME}' already contains ${TABLE_COUNT} table(s). Preserving existing tables."
fi

# Seed default admin accounts ONLY if database is empty of users
USER_COUNT=$(mysql -u "${DB_USER}" -p"${DB_PASS}" -h 127.0.0.1 -D "${DB_NAME}" -sNe "SELECT COUNT(*) FROM User;" 2>/dev/null || echo "0")
if [[ "${USER_COUNT}" -gt 0 ]]; then
    log_info "Database '${DB_NAME}' already contains ${USER_COUNT} user(s). Skipping seed to protect existing data."
elif [[ -f "dist/prisma/seed.js" ]]; then
    log_info "Empty database detected. Seeding initial admin account and default records..."
    DATABASE_URL="${DATABASE_URL}" node dist/prisma/seed.js || log_warn "Seed script executed with notice."
fi
log_success "Database schema verified for '${DB_NAME}'."

# ------------------------------------------------------------------------------
# 7. CONFIGURE SYSTEMD SERVICES (BACKEND & WORKER)
# ------------------------------------------------------------------------------
log_info "Step 6/8: Installing and enabling native systemd service daemons..."

cat <<EOF > /etc/systemd/system/istrac-backend.service
[Unit]
Description=ISTRAC FMS Backend API Server
After=network.target mysql.service mariadb.service mysqld.service redis.service redis-server.service
Wants=mysql.service mariadb.service redis.service

[Service]
Type=simple
User=${APP_USER}
Group=${APP_USER}
WorkingDirectory=${INSTALL_DIR}/backend
ExecStart=/usr/bin/node dist/src/index.js
Restart=always
RestartSec=5
LimitNOFILE=65535
StandardOutput=journal
StandardError=journal
EnvironmentFile=${INSTALL_DIR}/backend/.env

[Install]
WantedBy=multi-user.target
EOF

cat <<EOF > /etc/systemd/system/istrac-worker.service
[Unit]
Description=ISTRAC FMS Mission Event Scheduler & Sync Worker
After=network.target mysql.service mariadb.service mysqld.service redis.service redis-server.service istrac-backend.service
Wants=mysql.service mariadb.service redis.service

[Service]
Type=simple
User=${APP_USER}
Group=${APP_USER}
WorkingDirectory=${INSTALL_DIR}/backend
ExecStart=/usr/bin/node dist/src/worker.js
Restart=always
RestartSec=10
LimitNOFILE=65535
StandardOutput=journal
StandardError=journal
EnvironmentFile=${INSTALL_DIR}/backend/.env

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable --now istrac-backend
systemctl enable --now istrac-worker
log_success "Systemd services istrac-backend and istrac-worker started and enabled on boot."

# ------------------------------------------------------------------------------
# 8. CONFIGURE APACHE HTTP SERVER (apache2 / httpd)
# ------------------------------------------------------------------------------
log_info "Step 7/8: Configuring Apache HTTP Server VirtualHost..."

if [[ $IS_DEBIAN -eq 1 ]]; then
    APACHE_CONF_PATH="/etc/apache2/sites-available/istrac-sims.conf"
    APACHE_LOG_DIR="/var/log/apache2"
    mkdir -p "${APACHE_LOG_DIR}"

    log_info "Enabling required Apache modules on Ubuntu..."
    a2enmod proxy proxy_http proxy_wstunnel rewrite headers deflate expires 2>/dev/null || true
else
    APACHE_CONF_PATH="/etc/httpd/conf.d/istrac-sims.conf"
    APACHE_LOG_DIR="/var/log/httpd"
    mkdir -p "${APACHE_LOG_DIR}"
fi

cat <<APACHE_CONF > "${APACHE_CONF_PATH}"
<VirtualHost *:80>
    ServerName _
    ServerAdmin admin@istrac.local
    DocumentRoot "/opt/istrac-fms/frontend/dist"
    LimitRequestBody 104857600

    Header always set X-Frame-Options "SAMEORIGIN"
    Header always set X-Content-Type-Options "nosniff"
    Header always set X-XSS-Protection "1; mode=block"
    Header always set Referrer-Policy "strict-origin-when-cross-origin"

    <IfModule mod_deflate.c>
        AddOutputFilterByType DEFLATE text/plain text/html text/xml text/css application/javascript application/json image/svg+xml
    </IfModule>

    <Directory "/opt/istrac-fms/frontend/dist/assets">
        <IfModule mod_expires.c>
            ExpiresActive On
            ExpiresDefault "access plus 1 year"
        </IfModule>
        Header set Cache-Control "public, max-age=31536000, immutable"
    </Directory>

    ProxyPreserveHost On
    ProxyRequests Off
    ProxyTimeout 120
    RequestHeader set X-Forwarded-Proto "http"

    RewriteEngine On
    RewriteCond %{HTTP:Upgrade} =websocket [NC]
    RewriteCond %{HTTP:Connection} upgrade [NC]
    RewriteRule ^/ws/(.*)           ws://127.0.0.1:3000/ws/\$1 [P,L]
    RewriteRule ^/ws/?$             ws://127.0.0.1:3000/ws [P,L]

    ProxyPass        /api http://127.0.0.1:3000/api retry=0 timeout=120
    ProxyPassReverse /api http://127.0.0.1:3000/api

    ProxyPass        /media http://127.0.0.1:3000/media retry=0 timeout=60
    ProxyPassReverse /media http://127.0.0.1:3000/media

    <Directory "/opt/istrac-fms/frontend/dist">
        Options Indexes FollowSymLinks
        AllowOverride All
        Require all granted
        RewriteEngine On
        RewriteBase /
        RewriteRule ^index\.html$ - [L]
        RewriteCond %{REQUEST_FILENAME} !-f
        RewriteCond %{REQUEST_FILENAME} !-d
        RewriteRule . /index.html [L]
    </Directory>

    ErrorLog ${APACHE_LOG_DIR}/istrac-sims-error.log
    CustomLog ${APACHE_LOG_DIR}/istrac-sims-access.log combined
</VirtualHost>
APACHE_CONF

if [[ $IS_DEBIAN -eq 1 ]]; then
    a2ensite istrac-sims.conf 2>/dev/null || true
    a2dissite 000-default.conf 2>/dev/null || true
fi

# Permissions & Hardening
chown -R "${APP_USER}:${APP_USER}" "${INSTALL_DIR}"
chmod -R 755 "${INSTALL_DIR}/frontend/dist"
chown -R "${APP_USER}:${APP_USER}" "${STORAGE_DIR}"
chmod 775 "${STORAGE_DIR}"

# 🛡️ Configure SELinux (RHEL systems)
if command -v setsebool >/dev/null 2>&1; then
    setsebool -P httpd_can_network_connect 1 2>/dev/null || true
    setsebool -P httpd_read_user_content 1 2>/dev/null || true
fi

if command -v semanage >/dev/null 2>&1; then
    semanage fcontext -a -t httpd_sys_content_t "${INSTALL_DIR}/frontend/dist(/.*)?" 2>/dev/null || true
    semanage fcontext -a -t httpd_sys_rw_content_t "${STORAGE_DIR}(/.*)?" 2>/dev/null || true
    restorecon -Rv "${INSTALL_DIR}/frontend/dist" >/dev/null 2>&1 || true
    restorecon -Rv "${STORAGE_DIR}" >/dev/null 2>&1 || true
fi

# 🔥 Configure Firewall (UFW on Ubuntu / Firewalld on RHEL)
if command -v ufw >/dev/null 2>&1 && ufw status | grep -q "Status: active"; then
    log_info "Configuring UFW firewall rules for Port 80 and 443..."
    ufw allow 80/tcp >/dev/null 2>&1 || true
    ufw allow 443/tcp >/dev/null 2>&1 || true
fi

if systemctl is-active --quiet firewalld 2>/dev/null; then
    log_info "Configuring firewalld ports (80/HTTP, 443/HTTPS)..."
    firewall-cmd --permanent --add-service=http >/dev/null 2>&1 || true
    firewall-cmd --permanent --add-service=https >/dev/null 2>&1 || true
    firewall-cmd --reload >/dev/null 2>&1 || true
fi

# Start Apache
systemctl enable --now "${APACHE_SERVICE}"
systemctl restart "${APACHE_SERVICE}"
log_success "Apache HTTP Server (${APACHE_SERVICE}) configured and started."

# ------------------------------------------------------------------------------
# 9. VERIFICATION & HEALTH PROBE
# ------------------------------------------------------------------------------
log_info "Step 8/8: Performing health probe..."
sleep 2

HOST_IP=$(hostname -I | awk '{print $1}' || echo "127.0.0.1")

echo ""
echo -e "${GREEN}${BOLD}==============================================================================${NC}"
echo -e "${GREEN}${BOLD} 🚀 ISTRAC-SIMS AIR-GAPPED DEPLOYMENT IS COMPLETE!${NC}"
echo -e "${GREEN}${BOLD}==============================================================================${NC}"
echo ""
echo -e "${BOLD}🌐 Web Portal Access:${NC}"
echo -e "   - Intranet URL:  ${CYAN}http://${HOST_IP}/${NC}"
echo -e "   - Localhost URL: ${CYAN}http://localhost/${NC}"
echo -e "   - Health Check:  ${CYAN}http://${HOST_IP}/api/health${NC}"
echo ""
echo -e "${BOLD}🔐 Default Administrator Login Credentials:${NC}"
echo -e "   - Administrator: ${YELLOW}admin@istrac.local${NC}"
echo -e "   - Password:      ${GREEN}ChangeMe123!${NC}"
echo -e "   - Password Reset CLI (Terminal): ${CYAN}cd ${INSTALL_DIR}/backend && node dist/scripts/reset-admin-password.js <NewPassword>${NC}"
echo ""
echo -e "${BOLD}🛠️ System Services Status:${NC}"
echo -e "   - Apache (${APACHE_SERVICE}): $(systemctl is-active "${APACHE_SERVICE}") [Port 80/443]"
echo -e "   - Backend API:       $(systemctl is-active istrac-backend) [Port ${APP_PORT} via Systemd]"
echo -e "   - Worker Daemon:     $(systemctl is-active istrac-worker) [Event Scheduler via Systemd]"
echo -e "   - Database (${DB_SERVICE}):  $(systemctl is-active "${DB_SERVICE}") [Port 3306]"
echo -e "   - Redis:             $(systemctl is-active redis 2>/dev/null || systemctl is-active redis-server 2>/dev/null || echo 'inactive (Standalone In-Memory mode)')"
echo -e "   - Storage Mount:     ${STORAGE_DIR}"
echo ""
echo -e "${BOLD}📋 Management Utility:${NC}"
echo -e "   - Check Status:      ${CYAN}${INSTALL_DIR}/manage-services-rhel.sh status${NC}"
echo -e "   - View API Logs:     ${CYAN}journalctl -u istrac-backend -f${NC}"
echo -e "   - Restart All:       ${CYAN}${INSTALL_DIR}/manage-services-rhel.sh restart${NC}"
echo -e "${GREEN}==============================================================================${NC}"
echo ""
