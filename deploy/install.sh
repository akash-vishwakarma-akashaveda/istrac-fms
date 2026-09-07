#!/usr/bin/env bash
# ==============================================================================
# ISTRAC-FMS Air-Gapped Installation & Initialization Script
# Target OS: Red Hat Enterprise Linux 8 / 9
# Run with root/sudo privileges: sudo bash install.sh
# ==============================================================================

set -euo pipefail

INSTALL_DIR="/opt/istrac-fms"
DATA_STORAGE="/var/data/istrac_storage"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "======================================================================"
echo "🛰️  ISTRAC-FMS AIR-GAPPED INSTALLATION — RED HAT ENTERPRISE LINUX"
echo "======================================================================"

# 1. Root verification
if [[ $EUID -ne 0 ]]; then
   echo "❌ This script must be executed as root (or via sudo)."
   exit 1
fi

# 2. Install Offline RPM Packages
echo "📦 1/7: Installing offline RPM packages..."
if [[ -d "${SCRIPT_DIR}/rpms" ]] && compgen -G "${SCRIPT_DIR}/rpms/*.rpm" > /dev/null; then
  dnf localinstall -y "${SCRIPT_DIR}/rpms/"*.rpm
  echo "✅ RPM packages installed successfully."
else
  echo "ℹ️ No RPM files found in ${SCRIPT_DIR}/rpms/. Assuming nodejs, redis, mariadb, nginx are already installed."
fi

# 3. Create Application & Storage Directories
echo "📁 2/7: Creating application directories and physical mount..."
mkdir -p "${INSTALL_DIR}/backend"
mkdir -p "${INSTALL_DIR}/frontend"
mkdir -p "${DATA_STORAGE}"

# Copy application artifacts
echo "📂 Copying backend and frontend production builds to ${INSTALL_DIR}..."
cp -r "${SCRIPT_DIR}/backend/"* "${INSTALL_DIR}/backend/"
cp -r "${SCRIPT_DIR}/frontend/"* "${INSTALL_DIR}/frontend/"

# 4. Service Users & Permission Hardening
echo "🔒 3/7: Setting permissions and service ownership..."
id -u istrac &>/dev/null || useradd -r -s /sbin/nologin -d "${INSTALL_DIR}" istrac
chown -R istrac:istrac "${INSTALL_DIR}"
chown -R istrac:istrac "${DATA_STORAGE}"
chmod 750 "${DATA_STORAGE}"

# 5. Initialize MariaDB & Redis Services
echo "🗄️  4/7: Starting Redis and Database services..."
systemctl enable --now redis
systemctl enable --now mariadb

echo "⚙️ Initializing MySQL database and users..."
DB_NAME="istrac_fms"
DB_USER="istrac_user"
DB_PASS="ISRO_SecureFMS_2026!#"

mysql -u root <<EOF
CREATE DATABASE IF NOT EXISTS ${DB_NAME} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS '${DB_USER}'@'localhost' IDENTIFIED BY '${DB_PASS}';
GRANT ALL PRIVILEGES ON ${DB_NAME}.* TO '${DB_USER}'@'localhost';
FLUSH PRIVILEGES;
EOF

# 6. Configure Production Environment File
echo "⚙️  5/7: Configuring production environment file..."
JWT_SECRET=$(head -c 32 /dev/urandom | base64 | tr -dc 'a-zA-Z0-9' | head -c 32)
JWT_REFRESH_SECRET=$(head -c 32 /dev/urandom | base64 | tr -dc 'a-zA-Z0-9' | head -c 32)

cat > "${INSTALL_DIR}/backend/.env" <<EOF
NODE_ENV=production
PORT=5000
DATABASE_URL="mysql://${DB_USER}:${DB_PASS}@localhost:3306/${DB_NAME}"
REDIS_URL="redis://localhost:6379"
HDD_MOUNT_PATH="${DATA_STORAGE}"
JWT_SECRET="${JWT_SECRET}"
JWT_REFRESH_SECRET="${JWT_REFRESH_SECRET}"
EOF

chown istrac:istrac "${INSTALL_DIR}/backend/.env"
chmod 600 "${INSTALL_DIR}/backend/.env"

# Run Prisma Database Migrations & Seed offline
echo "🌱 Running offline schema migration and seed..."
cd "${INSTALL_DIR}/backend"
npx prisma migrate deploy
if [[ -f "dist/prisma/seed.js" ]]; then
  node dist/prisma/seed.js || echo "⚠️ Seed completed with notice."
fi

# 7. Setup Systemd Services & Nginx
echo "🚀 6/7: Configuring systemd services..."
cp "${SCRIPT_DIR}/deploy/istrac-backend.service" /etc/systemd/system/
cp "${SCRIPT_DIR}/deploy/istrac-worker.service" /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now istrac-backend
systemctl enable --now istrac-worker

echo "🌐 7/7: Configuring Nginx reverse proxy and firewall..."
cp "${SCRIPT_DIR}/deploy/nginx-istrac.conf" /etc/nginx/conf.d/istrac.conf

# SELinux adjustments for RHEL
if command -v setsebool &>/dev/null; then
  echo "🛡️ Configuring SELinux boolean permissions..."
  setsebool -P httpd_can_network_connect 1 || true
  setsebool -P httpd_read_user_content 1 || true
fi

systemctl enable --now nginx
systemctl reload nginx

# Firewall configuration
if command -v firewall-cmd &>/dev/null; then
  echo "🔥 Opening HTTP/HTTPS ports in firewall..."
  firewall-cmd --permanent --add-service=http || true
  firewall-cmd --permanent --add-port=80/tcp || true
  firewall-cmd --reload || true
fi

echo "======================================================================"
echo "🎉 ISTRAC-FMS SUCCESSFULLY INSTALLED ON RHEL (AIR-GAPPED)!"
echo "Web Portal URL: http://$(hostname -I | awk '{print $1}')"
echo "Backend API:    http://127.0.0.1:5000"
echo "Storage Path:   ${DATA_STORAGE}"
echo "Status Commands:"
echo "  sudo systemctl status istrac-backend"
echo "  sudo systemctl status istrac-worker"
echo "  sudo systemctl status nginx"
echo "======================================================================"
