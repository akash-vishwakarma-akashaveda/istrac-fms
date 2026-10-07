#!/usr/bin/env bash
# ==============================================================================
# 🛰️ ISTRAC-SIMS — Master Automated Setup Script for Ubuntu Linux (22.04 / 24.04 LTS)
# Target: Ubuntu Server / Desktop (Air-Gapped or Intranet Network)
# Usage: sudo ./setup-ubuntu.sh
# ==============================================================================

set -euo pipefail

CYAN='\033[0;36m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BOLD='\033[1m'
NC='\033[0m'

log_info() { echo -e "${CYAN}ℹ️  $1${NC}"; }
log_success() { echo -e "${GREEN}✅ $1${NC}"; }
log_warn() { echo -e "${YELLOW}⚠️  $1${NC}"; }
log_error() { echo -e "${RED}❌ $1${NC}"; exit 1; }

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [[ -d "${SCRIPT_DIR}/frontend" ]]; then
    BUNDLE_ROOT="${SCRIPT_DIR}"
elif [[ -d "${SCRIPT_DIR}/../frontend" ]]; then
    BUNDLE_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
else
    BUNDLE_ROOT="${SCRIPT_DIR}"
fi
INSTALL_DIR="/opt/istrac-sims"
STORAGE_DIR="/mnt/istrac_storage"
APP_USER="istrac"
APP_PORT=3000

echo -e "${BOLD}${CYAN}==============================================================================${NC}"
echo -e "${BOLD}${CYAN} 🛰️  ISTRAC-SIMS — AUTOMATED UBUNTU DEPLOYMENT INSTALLER${NC}"
echo -e "${BOLD}${CYAN} Target OS: Ubuntu 22.04 LTS / 24.04 LTS (x86_64)${NC}"
echo -e "${BOLD}${CYAN}==============================================================================${NC}"

if [[ $EUID -ne 0 ]]; then
    log_error "This script must be run as root: sudo ./setup-ubuntu.sh"
fi

# 1. CREATE DEDICATED SYSTEM USER & STORAGE
log_info "Step 1/8: Configuring system user '${APP_USER}' and storage volume..."
if ! id -u "${APP_USER}" >/dev/null 2>&1; then
    useradd -r -s /bin/false -d "${INSTALL_DIR}" "${APP_USER}"
    log_success "System user '${APP_USER}' created."
else
    log_info "System user '${APP_USER}' already exists."
fi

mkdir -p "${INSTALL_DIR}"
mkdir -p "${STORAGE_DIR}"
chown -R "${APP_USER}:${APP_USER}" "${STORAGE_DIR}"
chmod -R 770 "${STORAGE_DIR}"

# 2. VERIFY SYSTEM PREREQUISITES & INSTALL BUNDLED OFFLINE PACKAGES
log_info "Step 2/8: Checking system prerequisites (offline bundle check & verification)..."

# 2a. Check if any offline .deb packages are bundled in packages/ or packages/debs/
OFFLINE_DEBS=$(find "${BUNDLE_ROOT}/packages" "${BUNDLE_ROOT}/debs" -name "*.deb" 2>/dev/null || true)
if [[ -n "${OFFLINE_DEBS}" ]]; then
    DEB_COUNT=$(echo "${OFFLINE_DEBS}" | wc -l)
    log_info "Detected ${DEB_COUNT} bundled offline .deb package(s). Installing offline packages via dpkg..."
    for deb_file in ${OFFLINE_DEBS}; do
        log_info "Installing bundled package: $(basename "${deb_file}")"
        dpkg -i --force-depends "${deb_file}" 2>/dev/null || true
    done
fi

# 2b. Audit prerequisites on system
MISSING_PKGS=()

# Check Web Server
if ! command -v apache2 >/dev/null 2>&1; then
    # Try finding an apache2 deb specifically in bundle if not already installed
    LOCAL_APACHE_DEB=$(find "${BUNDLE_ROOT}/packages" "${BUNDLE_ROOT}/debs" -iname "*apache2*.deb" 2>/dev/null | head -n 1 || true)
    if [[ -n "${LOCAL_APACHE_DEB}" ]]; then
        log_info "Installing Apache2 from bundled package: $(basename "${LOCAL_APACHE_DEB}")..."
        dpkg -i "${LOCAL_APACHE_DEB}" 2>/dev/null || true
    fi
    if ! command -v apache2 >/dev/null 2>&1; then
        MISSING_PKGS+=("apache2")
    fi
fi

# Check Database Client CLI
if ! command -v mysql >/dev/null 2>&1; then
    LOCAL_MYSQL_DEB=$(find "${BUNDLE_ROOT}/packages" "${BUNDLE_ROOT}/debs" -iname "*mysql*client*.deb" -o -iname "*mariadb*client*.deb" 2>/dev/null | head -n 1 || true)
    if [[ -n "${LOCAL_MYSQL_DEB}" ]]; then
        log_info "Installing database client from bundled package: $(basename "${LOCAL_MYSQL_DEB}")..."
        dpkg -i "${LOCAL_MYSQL_DEB}" 2>/dev/null || true
    fi
    if ! command -v mysql >/dev/null 2>&1; then
        MISSING_PKGS+=("mysql-client (or mariadb-client)")
    fi
fi

# Check Database Server Service
if ! systemctl list-unit-files 2>/dev/null | grep -E -q "(^|/)(mariadb|mysql)\.service" && ! systemctl status mariadb >/dev/null 2>&1 && ! systemctl status mysql >/dev/null 2>&1; then
    LOCAL_SERVER_DEB=$(find "${BUNDLE_ROOT}/packages" "${BUNDLE_ROOT}/debs" -iname "*mysql*server*.deb" -o -iname "*mariadb*server*.deb" 2>/dev/null | head -n 1 || true)
    if [[ -n "${LOCAL_SERVER_DEB}" ]]; then
        log_info "Installing database server from bundled package: $(basename "${LOCAL_SERVER_DEB}")..."
        dpkg -i "${LOCAL_SERVER_DEB}" 2>/dev/null || true
    fi
    if ! systemctl list-unit-files 2>/dev/null | grep -E -q "(^|/)(mariadb|mysql)\.service" && ! systemctl status mariadb >/dev/null 2>&1 && ! systemctl status mysql >/dev/null 2>&1; then
        MISSING_PKGS+=("mysql-server (or mariadb-server)")
    fi
fi

# Check Essential Extraction Utilities
if ! command -v tar >/dev/null 2>&1; then
    MISSING_PKGS+=("tar")
fi

# Check Diagnostic Curl
if ! command -v curl >/dev/null 2>&1; then
    LOCAL_CURL_DEB=$(find "${BUNDLE_ROOT}/packages" "${BUNDLE_ROOT}/debs" -iname "*curl*.deb" 2>/dev/null | head -n 1 || true)
    if [[ -n "${LOCAL_CURL_DEB}" ]]; then
        log_info "Installing curl from bundled package: $(basename "${LOCAL_CURL_DEB}")..."
        dpkg -i "${LOCAL_CURL_DEB}" 2>/dev/null || true
    fi
    if ! command -v curl >/dev/null 2>&1; then
        MISSING_PKGS+=("curl")
    fi
fi

# 2c. Display clear warning if any package is missing from both system and bundle
if [[ ${#MISSING_PKGS[@]} -gt 0 ]]; then
    echo ""
    echo -e "${BOLD}${YELLOW}══════════════════════════════════════════════════════════════════════════════${NC}"
    echo -e "${BOLD}${YELLOW} ⚠️  MISSING PREREQUISITE PACKAGES DETECTED${NC}"
    echo -e "${BOLD}${YELLOW}══════════════════════════════════════════════════════════════════════════════${NC}"
    echo -e " The following required package(s) are neither installed on this system"
    echo -e " nor found in the offline 'packages/' bundle directory:"
    for pkg in "${MISSING_PKGS[@]}"; do
        echo -e "   • ${BOLD}${RED}${pkg}${NC}"
    done
    echo ""
    echo -e " ${BOLD}HOW TO PROVIDE THEM OFFLINE:${NC}"
    echo -e " 1. Download the required .deb packages on an internet-connected workstation:"
    echo -e "    ${CYAN}apt-get download ${MISSING_PKGS[*]}${NC}"
    echo -e " 2. Copy the downloaded .deb file(s) into the ${BOLD}packages/${NC} folder of this bundle."
    echo -e "    (Or install directly: ${CYAN}sudo dpkg -i /path/to/*.deb${NC})"
    echo -e " 3. Re-run the installer: ${CYAN}sudo ./install.sh${NC}"
    echo -e "${BOLD}${YELLOW}══════════════════════════════════════════════════════════════════════════════${NC}"
    echo ""
    if [[ -t 0 ]]; then
        read -r -p "Do you want to proceed anyway? [y/N]: " PROCEED_ANYWAY
        if [[ ! "${PROCEED_ANYWAY}" =~ ^[Yy]$ ]]; then
            log_error "Setup stopped to allow user to provide missing packages."
            exit 1
        fi
    fi
else
    log_success "All system prerequisites verified (Apache2, SQL Database, Tar, Curl)."
fi

# Install Node.js 24 if not present
if ! command -v node >/dev/null 2>&1 || [[ "$(node -v | cut -d'.' -f1)" != "v24" ]]; then
    NODE_TAR=$(find "${BUNDLE_ROOT}" -name "node-v24*.tar.xz" -o -name "node-v24*.tar.gz" 2>/dev/null | head -n 1)
    if [[ -n "${NODE_TAR}" && -f "${NODE_TAR}" ]]; then
        log_info "Extracting offline Node.js 24 tarball: ${NODE_TAR}..."
        mkdir -p /opt/node
        tar -xf "${NODE_TAR}" -C /opt/node --strip-components=1
        ln -sf /opt/node/bin/node /usr/bin/node
        ln -sf /opt/node/bin/npm /usr/bin/npm
        ln -sf /opt/node/bin/npx /usr/bin/npx
        log_success "Node.js $(node -v) installed."
    else
        log_info "Node.js 24 tarball not found in installer media; checking existing system node: $(node -v 2>/dev/null || echo 'none')"
    fi
fi

# 3. INITIALIZE MYSQL DATABASE SERVICE
log_info "Step 3/8: Initializing MySQL Database Service..."
DB_SERVICE="mysql"
if systemctl list-unit-files 2>/dev/null | grep -E -q "(^|/)mysql\.service" || systemctl status mysql >/dev/null 2>&1; then
    DB_SERVICE="mysql"
elif systemctl list-unit-files 2>/dev/null | grep -E -q "(^|/)mariadb\.service" || systemctl status mariadb >/dev/null 2>&1; then
    DB_SERVICE="mariadb"
fi

if systemctl is-active --quiet "${DB_SERVICE}"; then
    log_info "Database service '${DB_SERVICE}' is already running."
else
    systemctl enable --now "${DB_SERVICE}" 2>/dev/null || systemctl start "${DB_SERVICE}" 2>/dev/null || log_warn "Please ensure ${DB_SERVICE} service is running."
fi

DEFAULT_DB="istrac_sims"
if [[ -f "${INSTALL_DIR}/backend/.env" ]]; then
    EXISTING_DB=$(grep '^MYSQL_DATABASE=' "${INSTALL_DIR}/backend/.env" | head -n 1 | cut -d '=' -f2 | tr -d '"\r')
    if [[ -n "${EXISTING_DB}" ]]; then
        DEFAULT_DB="${EXISTING_DB}"
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

# Verify connection to MySQL/MariaDB; prompt for root credentials if required
MYSQL_CMD="mysql"
if ! mysql -e "SELECT 1;" >/dev/null 2>&1; then
    if [[ -n "${DB_ROOT_PASS:-}" ]] && mysql -u root -p"${DB_ROOT_PASS}" -e "SELECT 1;" >/dev/null 2>&1; then
        MYSQL_CMD="mysql -u root -p${DB_ROOT_PASS}"
    elif [[ -t 0 ]]; then
        log_info "MySQL root requires authentication."
        read -s -r -p "Enter MySQL root password (or press Enter if none): " INPUT_ROOT_PASS
        echo ""
        if [[ -n "${INPUT_ROOT_PASS}" ]]; then
            MYSQL_CMD="mysql -u root -p${INPUT_ROOT_PASS}"
        fi
    fi
fi

${MYSQL_CMD} <<EOF
CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS '${DB_USER}'@'localhost' IDENTIFIED BY '${DB_PASS}';
ALTER USER '${DB_USER}'@'localhost' IDENTIFIED BY '${DB_PASS}';
GRANT ALL PRIVILEGES ON \`${DB_NAME}\`.* TO '${DB_USER}'@'localhost';
CREATE USER IF NOT EXISTS '${DB_USER}'@'127.0.0.1' IDENTIFIED BY '${DB_PASS}';
ALTER USER '${DB_USER}'@'127.0.0.1' IDENTIFIED BY '${DB_PASS}';
GRANT ALL PRIVILEGES ON \`${DB_NAME}\`.* TO '${DB_USER}'@'127.0.0.1';
FLUSH PRIVILEGES;
EOF
log_success "Database '${DB_NAME}' and user '${DB_USER}' configured."

# 4. COPY APPLICATION FILES
log_info "Step 4/8: Copying application assets into ${INSTALL_DIR}..."
if [[ "${BUNDLE_ROOT}" != "${INSTALL_DIR}" ]]; then
    # Remove existing dist and prisma folders to prevent nested dist/dist
    rm -rf "${INSTALL_DIR}/frontend/dist" "${INSTALL_DIR}/backend/dist" "${INSTALL_DIR}/backend/prisma"
    mkdir -p "${INSTALL_DIR}/frontend/dist" "${INSTALL_DIR}/backend/dist" "${INSTALL_DIR}/backend/prisma"
    
    cp -rf "${BUNDLE_ROOT}/frontend/dist/." "${INSTALL_DIR}/frontend/dist/"
    cp -rf "${BUNDLE_ROOT}/backend/dist/." "${INSTALL_DIR}/backend/dist/"
    cp -rf "${BUNDLE_ROOT}/backend/prisma/." "${INSTALL_DIR}/backend/prisma/"
    cp -rf "${BUNDLE_ROOT}/backend/node_modules" "${INSTALL_DIR}/backend/"
    cp -f "${BUNDLE_ROOT}/backend/package.json" "${INSTALL_DIR}/backend/"
    cp -f "${BUNDLE_ROOT}/backend/prisma.config.ts" "${INSTALL_DIR}/backend/" 2>/dev/null || true
    
    # Safety recovery in case of nested directory
    if [[ -f "${INSTALL_DIR}/backend/dist/dist/src/index.js" && ! -f "${INSTALL_DIR}/backend/dist/src/index.js" ]]; then
        log_info "Correcting nested dist directory..."
        cp -rf "${INSTALL_DIR}/backend/dist/dist/." "${INSTALL_DIR}/backend/dist/"
        rm -rf "${INSTALL_DIR}/backend/dist/dist"
    fi
    
    if [[ -f "${INSTALL_DIR}/backend/dist/src/index.js" ]]; then
        log_success "Backend entrypoint verified: ${INSTALL_DIR}/backend/dist/src/index.js"
    else
        log_error "Warning: Entrypoint ${INSTALL_DIR}/backend/dist/src/index.js not found!"
    fi
else
    log_info "Installer media is directly in ${INSTALL_DIR}; files already in place."
fi

# 5. CONFIGURE ENVIRONMENT FILE
log_info "Step 5/8: Configuring backend .env..."
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
chown -R "${APP_USER}:${APP_USER}" "${INSTALL_DIR}"
log_success ".env configuration active."

# 6. RUN PRISMA MIGRATIONS & SEED
log_info "Step 6/8: Running offline Prisma database migrations..."
cd "${INSTALL_DIR}/backend"
export DATABASE_URL="mysql://${DB_USER}:${DB_PASS}@127.0.0.1:3306/${DB_NAME}"
export NODE_ENV=production
export PRISMA_ENGINES_CHECKSUM_IGNORE_MISSING=1

# Configure offline Linux Prisma schema engine binary
OFFLINE_ENGINE=""
for candidate in \
    "${INSTALL_DIR}/backend/node_modules/@prisma/engines/schema-engine-debian-openssl-3.0.x" \
    "${INSTALL_DIR}/backend/node_modules/prisma/schema-engine-debian-openssl-3.0.x" \
    "${BUNDLE_ROOT}/packages/schema-engine-debian-openssl-3.0.x" \
    "${BUNDLE_ROOT}/schema-engine-debian-openssl-3.0.x"; do
    if [[ -f "${candidate}" ]]; then
        OFFLINE_ENGINE="${candidate}"
        break
    fi
done

if [[ -n "${OFFLINE_ENGINE}" ]]; then
    chmod +x "${OFFLINE_ENGINE}"
    export PRISMA_SCHEMA_ENGINE_BINARY="${OFFLINE_ENGINE}"
    mkdir -p "${INSTALL_DIR}/backend/node_modules/@prisma/engines"
    mkdir -p "${INSTALL_DIR}/backend/node_modules/prisma"
    cp -f "${OFFLINE_ENGINE}" "${INSTALL_DIR}/backend/node_modules/@prisma/engines/schema-engine-debian-openssl-3.0.x" 2>/dev/null || true
    cp -f "${OFFLINE_ENGINE}" "${INSTALL_DIR}/backend/node_modules/prisma/schema-engine-debian-openssl-3.0.x" 2>/dev/null || true
    chmod +x "${INSTALL_DIR}/backend/node_modules/@prisma/engines/schema-engine-debian-openssl-3.0.x" 2>/dev/null || true
    chmod +x "${INSTALL_DIR}/backend/node_modules/prisma/schema-engine-debian-openssl-3.0.x" 2>/dev/null || true
    log_success "Offline Prisma schema engine loaded: ${OFFLINE_ENGINE}"
fi

MIGRATE_SUCCESS=0
if [[ -f "./node_modules/prisma/build/index.js" ]]; then
    node ./node_modules/prisma/build/index.js migrate deploy && MIGRATE_SUCCESS=1 || log_warn "Prisma migrate deploy notice."
elif [[ -f "./node_modules/.bin/prisma" ]]; then
    ./node_modules/.bin/prisma migrate deploy && MIGRATE_SUCCESS=1 || log_warn "Prisma migrate deploy notice."
fi

# Direct SQL Fallback if Prisma CLI encountered any difficulty
if [[ ${MIGRATE_SUCCESS} -eq 0 && -d "./prisma/migrations" ]]; then
    log_info "Applying SQL migrations directly to database '${DB_NAME}' via mysql..."
    for sql_file in $(find ./prisma/migrations -name "migration.sql" | sort); do
        log_info "Executing migration: $(basename $(dirname "${sql_file}"))"
        mysql -u "${DB_USER}" -p"${DB_PASS}" -h 127.0.0.1 -D "${DB_NAME}" < "${sql_file}" 2>/dev/null || true
    done
    log_success "Database schema migrations deployed."
fi

USER_COUNT=$(mysql -u "${DB_USER}" -p"${DB_PASS}" -h 127.0.0.1 -D "${DB_NAME}" -sNe "SELECT COUNT(*) FROM User;" 2>/dev/null || echo "0")
if [[ "${USER_COUNT}" -gt 0 ]]; then
    log_info "Database contains ${USER_COUNT} user(s). Preserving existing records (seed skipped)."
elif [[ -f "dist/prisma/seed.js" ]]; then
    log_info "Seeding initial admin account..."
    node dist/prisma/seed.js || log_warn "Seed notice."
fi

# 7. CONFIGURE SYSTEMD SERVICES
log_info "Step 7/8: Registering Ubuntu systemd services..."
cat <<EOF > /etc/systemd/system/istrac-backend.service
[Unit]
Description=ISTRAC SIMS Backend API Server
After=network.target mysql.service
Wants=mysql.service

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
Description=ISTRAC SIMS Background Telemetry Worker
After=network.target mysql.service istrac-backend.service
Wants=mysql.service

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
systemctl enable --now istrac-backend.service istrac-worker.service
systemctl restart istrac-backend.service istrac-worker.service

# 8. CONFIGURE APACHE2
log_info "Step 8/8: Configuring Apache2 reverse proxy on Ubuntu..."
a2enmod proxy proxy_http proxy_wstunnel rewrite headers >/dev/null 2>&1 || true

cat <<EOF > /etc/apache2/sites-available/istrac-sims.conf
<VirtualHost *:80>
    ServerName localhost
    DocumentRoot ${INSTALL_DIR}/frontend/dist

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

    <Directory "${INSTALL_DIR}/frontend/dist">
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

    ErrorLog \${APACHE_LOG_DIR}/istrac_error.log
    CustomLog \${APACHE_LOG_DIR}/istrac_access.log combined
</VirtualHost>
EOF

# Ensure Apache user (www-data) can access frontend assets
chmod 755 "${INSTALL_DIR}" "${INSTALL_DIR}/frontend" 2>/dev/null || true
chmod -R 755 "${INSTALL_DIR}/frontend/dist" 2>/dev/null || true
usermod -a -G "${APP_USER}" www-data 2>/dev/null || true

a2dissite 000-default.conf >/dev/null 2>&1 || true
a2ensite istrac-sims.conf >/dev/null 2>&1 || true
systemctl enable --now apache2 2>/dev/null || true
systemctl restart apache2

# Configure UFW
if command -v ufw >/dev/null 2>&1; then
    ufw allow 80/tcp >/dev/null 2>&1 || true
    ufw allow 443/tcp >/dev/null 2>&1 || true
fi

# Copy management CLI
if [[ -f "${BUNDLE_ROOT}/manage-services-ubuntu.sh" && "${BUNDLE_ROOT}" != "${INSTALL_DIR}" ]]; then
    cp -f "${BUNDLE_ROOT}/manage-services-ubuntu.sh" "${INSTALL_DIR}/manage-services-ubuntu.sh" 2>/dev/null || true
fi
chmod +x "${INSTALL_DIR}/manage-services-ubuntu.sh" 2>/dev/null || true

# 9. POST-INSTALL VERIFICATION & LIVE STATUS
log_info "Verifying service startup & health..."
sleep 2

# Wait up to 10 seconds for istrac-backend to start and listen
BACKEND_ACTIVE=0
for i in {1..10}; do
    if systemctl is-active --quiet istrac-backend; then
        HEALTH_CHECK=$(curl -s --max-time 2 http://127.0.0.1:3000/api/health 2>/dev/null || echo "")
        if [[ -n "${HEALTH_CHECK}" ]]; then
            BACKEND_ACTIVE=1
            break
        fi
    fi
    sleep 1
done

if [[ ${BACKEND_ACTIVE} -eq 1 ]]; then
    log_success "Backend API verified active and responding to health probe."
else
    log_warn "Backend API is starting or encountered an issue. Showing recent journal logs:"
    journalctl -u istrac-backend -n 25 --no-pager || true
fi

echo ""
# Automatically display the full service status banner
if [[ -x "${INSTALL_DIR}/manage-services-ubuntu.sh" ]]; then
    "${INSTALL_DIR}/manage-services-ubuntu.sh" status
fi

echo ""
echo -e "${BOLD}${GREEN}==============================================================================${NC}"
echo -e "${BOLD}${GREEN} 🎉 ISTRAC-SIMS DEPLOYMENT COMPLETE ON UBUNTU!${NC}"
echo -e "${BOLD}${GREEN}==============================================================================${NC}"
echo -e " Web Portal:     http://localhost/ or http://$(hostname -I | awk '{print $1}')/"
echo -e " Default Admin:  admin@istrac.local"
echo -e " Password:       ChangeMe123!"
echo -e " Services:       systemctl status istrac-backend apache2 mysql"
echo -e "=============================================================================="
