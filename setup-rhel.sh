#!/usr/bin/env bash
# ==============================================================================
# 🛰️ ISTRAC-SIMS — Master Setup & Automated Installation Script for Red Hat Enterprise Linux
# Compatible with: RHEL 8 / RHEL 9 / Rocky Linux 8 & 9 / AlmaLinux 8 & 9 / CentOS Stream
# ==============================================================================

set -euo pipefail

# ANSI Color Palette
CYAN='\033[0;36m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
BOLD='\033[1m'
NC='\033[0m' # No Color

# Logging Helpers
log_info() {
    echo -e "${CYAN}[INFO]${NC} $(date '+%Y-%m-%d %H:%M:%S') — $1"
}
log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $(date '+%Y-%m-%d %H:%M:%S') — ${BOLD}$1${NC}"
}
log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $(date '+%Y-%m-%d %H:%M:%S') — $1"
}
log_error() {
    echo -e "${RED}[ERROR]${NC} $(date '+%Y-%m-%d %H:%M:%S') — $1"
}

# ------------------------------------------------------------------------------
# 1. ROOT PRIVILEGES & OS DETECTION
# ------------------------------------------------------------------------------
echo -e "${BLUE}${BOLD}"
echo "=============================================================================="
echo " 🛰️  ISRO / ISTRAC — SATELLITE INFORMATION MANAGEMENT SYSTEM (ISTRAC-SIMS)"
echo " Automated Production Host Provisioning Suite for Red Hat Enterprise Linux"
echo "=============================================================================="
echo -e "${NC}"

if [[ $EUID -ne 0 ]]; then
   log_error "This script must be run as root or with sudo privileges: sudo ./setup-rhel.sh"
   exit 1
fi

CURRENT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TARGET_DIR="${CURRENT_DIR}"

log_info "Target installation directory: ${TARGET_DIR}"

# Detect RHEL / Fedora / CentOS / Rocky / AlmaLinux version
if [ -f /etc/os-release ]; then
    . /etc/os-release
    OS_NAME=$NAME
    OS_VERSION=$VERSION_ID
    log_info "Detected Operating System: ${OS_NAME} ${OS_VERSION}"
else
    log_warn "Could not verify /etc/os-release. Assuming standard RHEL compatible environment."
fi

# ------------------------------------------------------------------------------
# 2. INSTALL SYSTEM PACKAGES & REPOSITORIES
# ------------------------------------------------------------------------------
log_info "Step 1/8: Updating package metadata and installing system prerequisites..."

# Install EPEL repository if not present
if ! dnf repolist | grep -qi "epel"; then
    log_info "Enabling EPEL (Extra Packages for Enterprise Linux)..."
    dnf install -y epel-release || dnf install -y "https://dl.fedoraproject.org/pub/epel/epel-release-latest-$(echo ${OS_VERSION%%.*}).noarch.rpm" || true
fi

# Core toolchain & SELinux management tools
dnf install -y curl wget git tar gcc-c++ make openssl policycoreutils-python-utils firewalld

# ------------------------------------------------------------------------------
# 3. NODE.JS 20 LTS INSTALLATION
# ------------------------------------------------------------------------------
log_info "Step 2/8: Checking and installing Node.js 20 LTS..."

NODE_INSTALLED=false
if command -v node >/dev/null 2>&1; then
    NODE_V=$(node -v | cut -d'.' -f1 | tr -d 'v')
    if [[ "$NODE_V" -ge 20 ]]; then
        log_success "Node.js $(node -v) is already installed."
        NODE_INSTALLED=true
    fi
fi

if [ "$NODE_INSTALLED" = false ]; then
    log_info "Installing Node.js 20.x repository from NodeSource..."
    curl -fsSL https://rpm.nodesource.com/setup_20.x | bash -
    dnf install -y nodejs
    log_success "Installed Node.js $(node -v) and npm $(npm -v)"
fi

# ------------------------------------------------------------------------------
# 4. MARIADB / MYSQL DATABASE INSTALLATION & CONFIGURATION
# ------------------------------------------------------------------------------
log_info "Step 3/8: Setting up MariaDB Server..."

dnf install -y mariadb-server mariadb

systemctl enable mariadb
systemctl start mariadb

# Database Credentials
DB_NAME="istrac_fms"
DB_USER="istrac_user"
DB_PASS="IstracSecurePass123!"
DB_ROOT_PASS="RootIstracSecure123!"

log_info "Configuring MariaDB database '${DB_NAME}' and user '${DB_USER}'..."

mysql -e "CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
mysql -e "CREATE USER IF NOT EXISTS '${DB_USER}'@'localhost' IDENTIFIED BY '${DB_PASS}';"
mysql -e "GRANT ALL PRIVILEGES ON \`${DB_NAME}\`.* TO '${DB_USER}'@'localhost';"
mysql -e "CREATE USER IF NOT EXISTS '${DB_USER}'@'127.0.0.1' IDENTIFIED BY '${DB_PASS}';"
mysql -e "GRANT ALL PRIVILEGES ON \`${DB_NAME}\`.* TO '${DB_USER}'@'127.0.0.1';"
mysql -e "FLUSH PRIVILEGES;"

log_success "MariaDB configured successfully."

# ------------------------------------------------------------------------------
# 5. REDIS IN-MEMORY CACHE & PUB/SUB INSTALLATION
# ------------------------------------------------------------------------------
log_info "Step 4/8: Installing and starting Redis service..."

dnf install -y redis

systemctl enable redis
systemctl start redis

if systemctl is-active --quiet redis; then
    log_success "Redis is running and enabled on boot."
else
    log_error "Failed to start Redis service."
    exit 1
fi

# ------------------------------------------------------------------------------
# 6. PHYSICAL STORAGE VOLUME SETUP & SELINUX PERMISSIONS
# ------------------------------------------------------------------------------
log_info "Step 5/8: Configuring physical storage mount at /mnt/istrac_storage..."

STORAGE_DIR="/mnt/istrac_storage"
mkdir -p "${STORAGE_DIR}"
chmod 775 "${STORAGE_DIR}"

# Apply SELinux context for web/node read-write access
if command -v semanage >/dev/null 2>&1; then
    log_info "Applying SELinux security context to ${STORAGE_DIR}..."
    semanage fcontext -a -t httpd_sys_rw_content_t "${STORAGE_DIR}(/.*)?" 2>/dev/null || true
    restorecon -Rv "${STORAGE_DIR}" >/dev/null 2>&1 || true
fi

log_success "Storage mount configured at ${STORAGE_DIR}"

# ------------------------------------------------------------------------------
# 7. BACKEND APPLICATION BUILD & MIGRATIONS
# ------------------------------------------------------------------------------
log_info "Step 6/8: Setting up Backend (Prisma, Migrations, Seed & TypeScript Build)..."

cd "${TARGET_DIR}/backend"

# Generate JWT secrets
JWT_SECRET=$(openssl rand -hex 32)
JWT_REFRESH_SECRET=$(openssl rand -hex 32)

# Create backend .env file
cat <<EOF > .env
NODE_ENV=production
PORT=3000
APP_URL=http://localhost
ALLOWED_ORIGINS=http://localhost,http://127.0.0.1,http://localhost:5173
LOG_LEVEL=info
DEBUG_PRISMA=false

# Database
MYSQL_HOST=127.0.0.1
MYSQL_PORT=3306
MYSQL_DATABASE=${DB_NAME}
MYSQL_USER=${DB_USER}
MYSQL_PASSWORD=${DB_PASS}
MYSQL_ROOT_PASSWORD=${DB_ROOT_PASS}
DATABASE_URL=mysql://${DB_USER}:${DB_PASS}@127.0.0.1:3306/${DB_NAME}

# Redis
REDIS_URL=redis://127.0.0.1:6379

# Security Tokens
JWT_SECRET=${JWT_SECRET}
JWT_REFRESH_SECRET=${JWT_REFRESH_SECRET}

# Storage Mount
HDD_MOUNT_PATH=${STORAGE_DIR}
EOF

log_info "Installing backend node modules..."
npm install

log_info "Generating Prisma Client and applying migrations..."
npx prisma generate
npx prisma migrate deploy

log_info "Seeding initial satellite facilities and admin accounts..."
npm run seed

log_info "Compiling TypeScript backend..."
npm run build

log_success "Backend build and database setup complete."

# ------------------------------------------------------------------------------
# 8. FRONTEND APPLICATION BUILD
# ------------------------------------------------------------------------------
log_info "Step 7/8: Building Frontend Web Portal..."

cd "${TARGET_DIR}/frontend"

# Configure frontend production .env
cat <<EOF > .env
VITE_API_URL=/api
VITE_WS_URL=/ws
EOF

log_info "Installing frontend node modules..."
npm install

log_info "Compiling production frontend bundle with Vite..."
npm run build

# Ensure Nginx can read the compiled frontend
chmod -R 755 "${TARGET_DIR}/frontend/dist"
chmod 755 "${TARGET_DIR}" "${TARGET_DIR}/frontend" || true

log_success "Frontend compilation complete."

# ------------------------------------------------------------------------------
# 9. PM2 PROCESS MANAGER & NGINX REVERSE PROXY SETUP
# ------------------------------------------------------------------------------
log_info "Step 8/8: Configuring PM2 and Nginx Reverse Proxy..."

cd "${TARGET_DIR}"

# Install PM2 globally
npm install -g pm2

# Create PM2 log directory
mkdir -p /var/log/istrac-sims
chmod 755 /var/log/istrac-sims

# Start backend using PM2 ecosystem configuration
pm2 delete istrac-sims-backend >/dev/null 2>&1 || true
pm2 start ecosystem.config.cjs --env production
pm2 save

# Setup PM2 systemd startup
pm2 startup systemd -u root --hp /root >/dev/null 2>&1 || true

# Install and configure Nginx
dnf install -y nginx

# Generate Nginx configuration
cat <<EOF > /etc/nginx/conf.d/istrac-sims.conf
upstream istrac_backend {
    server 127.0.0.1:3000 max_fails=3 fail_timeout=10s;
    keepalive 32;
}

server {
    listen 80 default_server;
    listen [::]:80 default_server;
    server_name _;

    client_max_body_size 100M;
    root ${TARGET_DIR}/frontend/dist;
    index index.html;

    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_proxied expired no-cache no-store private auth;
    gzip_types text/plain text/css text/xml text/javascript application/x-javascript application/xml application/javascript application/json image/svg+xml;

    add_header X-Content-Type-Options "nosniff" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-XSS-Protection "1; mode=block" always;

    # Static Assets with 1y Cache
    location /assets/ {
        expires 1y;
        add_header Cache-Control "public, no-transform, immutable";
        access_log off;
        try_files \$uri =404;
    }

    # API Proxy
    location /api/ {
        rewrite ^/api/(.*) /\$1 break;
        proxy_pass http://istrac_backend;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_connect_timeout 60s;
        proxy_send_timeout 120s;
        proxy_read_timeout 120s;
        proxy_buffering off;
        proxy_request_buffering off;
    }

    # WebSocket Proxy
    location /ws {
        proxy_pass http://istrac_backend/ws;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "Upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_read_timeout 86400s;
        proxy_send_timeout 86400s;
    }

    # SPA Fallback Route
    location / {
        try_files \$uri \$uri/ /index.html;
        add_header Cache-Control "no-cache, no-store, must-revalidate";
    }
}
EOF

# Enable SELinux booleans for Nginx reverse proxy
log_info "Configuring SELinux booleans for Nginx network proxying..."
setsebool -P httpd_can_network_connect 1 2>/dev/null || true
setsebool -P httpd_read_user_content 1 2>/dev/null || true

systemctl enable nginx
systemctl restart nginx

# ------------------------------------------------------------------------------
# 10. FIREWALL CONFIGURATION (FIREWALLD)
# ------------------------------------------------------------------------------
if systemctl is-active --quiet firewalld; then
    log_info "Configuring firewalld rules for HTTP (80) and HTTPS (443)..."
    firewall-cmd --permanent --add-service=http >/dev/null 2>&1 || true
    firewall-cmd --permanent --add-service=https >/dev/null 2>&1 || true
    firewall-cmd --reload >/dev/null 2>&1 || true
    log_success "Firewall rules updated."
fi

# ------------------------------------------------------------------------------
# 11. VERIFICATION & HEALTH PROBE
# ------------------------------------------------------------------------------
log_info "Performing system verification and health probe..."

sleep 3

HOST_IP=$(hostname -I | awk '{print $1}' || echo "127.0.0.1")
HEALTH_STATUS=$(curl -s "http://127.0.0.1:3000/health" || echo '{"status":"error"}')

# ------------------------------------------------------------------------------
# 12. COMPLETION SUMMARY & CREDENTIALS
# ------------------------------------------------------------------------------
echo ""
echo -e "${GREEN}${BOLD}==============================================================================${NC}"
echo -e "${GREEN}${BOLD} 🚀 ISTRAC-SIMS DEPLOYMENT ON RED HAT ENTERPRISE LINUX IS COMPLETE!${NC}"
echo -e "${GREEN}${BOLD}==============================================================================${NC}"
echo ""
echo -e "${BOLD}🌐 Web Portal Access:${NC}"
echo -e "   - Local URL:    ${CYAN}http://localhost/${NC}"
echo -e "   - Network URL:  ${CYAN}http://${HOST_IP}/${NC}"
echo -e "   - Health Check: ${CYAN}http://${HOST_IP}/api/health${NC}"
echo ""
echo -e "${BOLD}🔐 Default Admin Login Credentials:${NC}"
echo -e "   - Super Admin:  ${YELLOW}admin@istrac.local${NC}   (Password: ${GREEN}ChangeMe123!${NC})"
echo -e "   - Dept Admin:   ${YELLOW}ttcadmin@istrac.local${NC}(Password: ${GREEN}ChangeMe123!${NC})"
echo -e "   - Operator:     ${YELLOW}operator@istrac.local${NC}(Password: ${GREEN}ChangeMe123!${NC})"
echo ""
echo -e "${BOLD}🛠️ System Services Status:${NC}"
echo -e "   - Nginx:        $(systemctl is-active nginx) [Port 80]"
echo -e "   - Backend API:  $(pm2 list | grep -q 'istrac-sims-backend' && echo 'online' || echo 'stopped') [Port 3000 via PM2]"
echo -e "   - MariaDB:      $(systemctl is-active mariadb) [Port 3306]"
echo -e "   - Redis Cache:  $(systemctl is-active redis) [Port 6379]"
echo -e "   - Storage Mount:${STORAGE_DIR}"
echo ""
echo -e "${BOLD}📋 Management Commands:${NC}"
echo -e "   - Check Status: ${CYAN}./manage-services-rhel.sh status${NC}"
echo -e "   - View API Logs:${CYAN}pm2 logs istrac-sims-backend${NC}"
echo -e "   - Restart All:  ${CYAN}./manage-services-rhel.sh restart${NC}"
echo -e "${GREEN}==============================================================================${NC}"
echo ""
