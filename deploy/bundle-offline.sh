#!/usr/bin/env bash
# ==============================================================================
# ISTRAC-FMS Offline Bundle Packaging Script
# Target Architecture: x86_64
# Target Operating System: Red Hat Enterprise Linux (RHEL 8 / 9, Rocky Linux, AlmaLinux)
# Usage: Run on an INTERNET-CONNECTED Linux machine (or WSL / Docker) to produce
#        an air-gapped deployment tarball containing all binaries, RPMs & bundles.
# ==============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
BUNDLE_NAME="istrac-fms-offline-bundle-$(date +%Y%m%d)"
OUT_DIR="${ROOT_DIR}/dist-offline/${BUNDLE_NAME}"

echo "======================================================================"
echo "🛰️  PACKAGING ISTRAC-FMS AIR-GAPPED DEPLOYMENT BUNDLE FOR RHEL"
echo "======================================================================"
echo "Project Root: ${ROOT_DIR}"
echo "Output Directory: ${OUT_DIR}"

# 1. Clean previous build artifacts
rm -rf "${ROOT_DIR}/dist-offline"
mkdir -p "${OUT_DIR}/rpms"
mkdir -p "${OUT_DIR}/backend"
mkdir -p "${OUT_DIR}/frontend"
mkdir -p "${OUT_DIR}/deploy"

# 2. Check prerequisites on build machine
echo "🔍 Checking packaging tools..."
command -v node >/dev/null 2>&1 || { echo "❌ Node.js 20+ required on packaging machine."; exit 1; }
command -v npm >/dev/null 2>&1 || { echo "❌ npm required on packaging machine."; exit 1; }
command -v tar >/dev/null 2>&1 || { echo "❌ tar utility required."; exit 1; }

# 3. Build Frontend
echo "📦 Building Frontend (Vite Static SPA)..."
cd "${ROOT_DIR}/frontend"
npm ci
npm run build
cp -r "${ROOT_DIR}/frontend/dist" "${OUT_DIR}/frontend/dist"

# 4. Build Backend & Prisma Engines
echo "📦 Building Backend & Generating Linux Prisma Binary Engines..."
cd "${ROOT_DIR}/backend"
npm ci
npx prisma generate
npm run build

# Copy pre-compiled backend code & Prisma migrations
cp -r "${ROOT_DIR}/backend/dist" "${OUT_DIR}/backend/dist"
cp -r "${ROOT_DIR}/backend/prisma" "${OUT_DIR}/backend/prisma"
cp "${ROOT_DIR}/backend/package.json" "${OUT_DIR}/backend/package.json"
cp "${ROOT_DIR}/backend/package-lock.json" "${OUT_DIR}/backend/package-lock.json"

# Package production-only node_modules with pre-compiled native binaries
echo "📦 Packaging production node_modules for air-gapped runtime..."
cd "${ROOT_DIR}/backend"
npm prune --production
cp -r "${ROOT_DIR}/backend/node_modules" "${OUT_DIR}/backend/node_modules"

# Re-install full devDependencies on build machine so workspace remains intact
npm install --silent >/dev/null 2>&1 || true

# 5. Download RHEL RPMs (if running on a RHEL/CentOS/Rocky system)
if command -v dnf >/dev/null 2>&1; then
  echo "📥 Detected DNF package manager. Downloading RHEL RPM packages..."
  dnf download --resolve --alldeps --destdir="${OUT_DIR}/rpms" \
    nodejs \
    npm \
    redis \
    mariadb-server \
    mariadb \
    nginx \
    tar \
    gzip \
    rsync \
    policycoreutils-python-utils || {
      echo "⚠️ DNF download completed with warnings. Verify rpms/ folder."
    }
else
  echo "ℹ️ Note: Not running on a RHEL-based packaging host."
  echo "   RPM packages can be populated in '${OUT_DIR}/rpms/' manually or via container."
fi

# 6. Copy deployment scripts, configs, and systemd units
echo "📄 Copying deployment scripts and systemd unit definitions..."
cp -r "${ROOT_DIR}/deploy/"* "${OUT_DIR}/deploy/"
cp "${ROOT_DIR}/deploy/install.sh" "${OUT_DIR}/install.sh"
chmod +x "${OUT_DIR}/install.sh"
chmod +x "${OUT_DIR}/deploy/"*.sh 2>/dev/null || true

# 7. Create compressed archive
echo "🗜️  Compressing offline deployment bundle..."
cd "${ROOT_DIR}/dist-offline"
tar -czvf "${BUNDLE_NAME}.tar.gz" "${BUNDLE_NAME}"

echo "======================================================================"
echo "✅ OFFLINE BUNDLE READY!"
echo "Location: ${ROOT_DIR}/dist-offline/${BUNDLE_NAME}.tar.gz"
echo "Size: $(du -sh "${ROOT_DIR}/dist-offline/${BUNDLE_NAME}.tar.gz" | cut -f1)"
echo "======================================================================"
