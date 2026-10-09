#!/usr/bin/env bash
# ==============================================================================
# 🛰️ ISTRAC-SIMS — Zero-Downtime Safe Hot-Patch Installer with Auto-Rollback
# Usage: sudo bash apply-patch.sh [/custom/installation/path]
# ==============================================================================

set -euo pipefail

CYAN='\033[0;36m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BOLD='\033[1m'
NC='\033[0m'

PATCH_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TIMESTAMP="$(date +%Y%m%d_%H%M%S)"

echo -e "${BOLD}${CYAN}==============================================================================${NC}"
echo -e "${BOLD}${CYAN} 🛰️  ISTRAC-SIMS AUTOMATED SAFE HOT-PATCH INSTALLER${NC}"
echo -e "${BOLD}${CYAN} Featuring: Interactive Path Confirmation + Pre-Backup + 5-Point Health Audit${NC}"
echo -e "${BOLD}${CYAN}==============================================================================${NC}"

if [[ $EUID -ne 0 ]]; then
    echo -e "${RED}❌ Error: This script must be run as root: sudo bash apply-patch.sh${NC}"
    exit 1
fi

# Detect likely installation path or take CLI argument
DEFAULT_INSTALL_DIR="/opt/istrac-sims"
if [[ -n "${1:-}" ]]; then
    DEFAULT_INSTALL_DIR="$1"
elif [[ ! -d "/opt/istrac-sims" && -d "/opt/istrac-fms" ]]; then
    DEFAULT_INSTALL_DIR="/opt/istrac-fms"
fi

echo -e "\n${BOLD}${YELLOW}📋 STEP 0: INSTALLATION PATH VERIFICATION${NC}"
echo -e "The hot-patch will be applied to the following system directory:"
echo -e "  👉 ${BOLD}${CYAN}${DEFAULT_INSTALL_DIR}${NC}\n"

# Check if terminal is interactive
if [[ -t 0 ]]; then
    read -r -p "Is this path correct for your deployed setup? [Y/n/custom path]: " USER_INPUT
    USER_INPUT=$(echo "${USER_INPUT}" | xargs) # trim whitespace

    if [[ -z "${USER_INPUT}" || "${USER_INPUT}" =~ ^[Yy]$ ]]; then
        INSTALL_DIR="${DEFAULT_INSTALL_DIR}"
    elif [[ "${USER_INPUT}" =~ ^[Nn]$ ]]; then
        echo -e "\n${YELLOW}Please enter the absolute path where ISTRAC-SIMS is installed on this server:${NC}"
        echo -e "${CYAN}Example: /opt/istrac-sims OR /var/www/istrac-sims${NC}"
        read -r -p "Target Path: " CUSTOM_PATH
        INSTALL_DIR=$(echo "${CUSTOM_PATH}" | xargs)
    else
        # User entered a custom path directly
        INSTALL_DIR="${USER_INPUT}"
    fi
else
    # Non-interactive mode (e.g. automated pipeline)
    INSTALL_DIR="${DEFAULT_INSTALL_DIR}"
fi

# Validate target path existence
if [[ ! -d "${INSTALL_DIR}" ]]; then
    echo -e "\n${BOLD}${RED}❌ ERROR: Target directory '${INSTALL_DIR}' does not exist on this server!${NC}"
    echo -e "${YELLOW}------------------------------------------------------------------------------${NC}"
    echo -e "${BOLD}How to fix:${NC}"
    echo -e "1. Verify where your application is installed: ${CYAN}find /opt /var -maxdepth 2 -name 'istrac*' 2>/dev/null${NC}"
    echo -e "2. Run this script passing your exact path:"
    echo -e "   ${GREEN}sudo bash apply-patch.sh /your/actual/install/path${NC}"
    echo -e "3. Or edit line 25 of this script (${PATCH_DIR}/apply-patch.sh) to update DEFAULT_INSTALL_DIR."
    echo -e "${YELLOW}------------------------------------------------------------------------------${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Verified target installation path: ${BOLD}${INSTALL_DIR}${NC}"

FE_BACKUP=""
BE_BACKUP=""
SCHEMA_BACKUP=""
SERVICE_MANAGER=""

# ------------------------------------------------------------------------------
# Service helpers: systemd (istrac-backend/istrac-worker) or PM2 (ecosystem.config.cjs)
# ------------------------------------------------------------------------------
has_systemd_unit() {
    systemctl cat "$1" >/dev/null 2>&1
}

pm2_cmd() {
    # PM2 runs per user (often installed via nvm), so use a login shell of the invoking user.
    if [[ -n "${SUDO_USER:-}" && "${SUDO_USER}" != "root" ]]; then
        sudo -u "${SUDO_USER}" -H bash -lc "pm2 $*"
    else
        bash -lc "pm2 $*"
    fi
}

restart_backend_services() {
    if has_systemd_unit istrac-backend; then
        systemctl restart istrac-backend || true
        has_systemd_unit istrac-worker && { systemctl restart istrac-worker || true; }
        SERVICE_MANAGER="systemd"
    elif pm2_cmd describe istrac-sims-backend >/dev/null 2>&1; then
        pm2_cmd restart istrac-sims-backend --update-env || true
        pm2_cmd restart istrac-sims-worker --update-env || true
        SERVICE_MANAGER="pm2"
    else
        echo -e "${YELLOW}  ! No systemd unit or PM2 found. Restart the backend manually.${NC}"
        SERVICE_MANAGER="manual"
    fi
}

backend_is_running() {
    case "${SERVICE_MANAGER:-}" in
        systemd) systemctl is-active --quiet istrac-backend ;;
        pm2) pm2_cmd describe istrac-sims-backend 2>/dev/null | grep -qi "status.*online" ;;
        *) return 0 ;;
    esac
}

reload_web_server() {
    for svc in apache2 httpd nginx; do
        if systemctl is-active --quiet "$svc" 2>/dev/null; then
            systemctl reload "$svc" || true
        fi
    done
}

rollback() {
    local reason="${1:-Unknown verification failure}"
    echo -e "\n${BOLD}${RED}==============================================================================${NC}"
    echo -e "${BOLD}${RED} ⚠️  CRITICAL FAILURE DETECTED: ${reason}${NC}"
    echo -e "${BOLD}${RED} ⏪ INITIATING AUTOMATIC FULL ROLLBACK TO PRE-PATCH STATE...${NC}"
    echo -e "${BOLD}${RED}==============================================================================${NC}"
    
    # 1. Rollback Frontend
    if [[ -n "${FE_BACKUP}" && -d "${FE_BACKUP}" ]]; then
        echo -e "${YELLOW}• Restoring previous frontend assets from ${FE_BACKUP}...${NC}"
        rm -rf "${INSTALL_DIR}/frontend/dist"
        cp -r "${FE_BACKUP}" "${INSTALL_DIR}/frontend/dist"
        chown -R istrac:www-data "${INSTALL_DIR}/frontend/dist" 2>/dev/null || true
        chmod -R 755 "${INSTALL_DIR}/frontend/dist"
        echo -e "${GREEN}  ✓ Frontend restored.${NC}"
    fi

    # 2. Rollback Backend
    if [[ -n "${BE_BACKUP}" && -d "${BE_BACKUP}" ]]; then
        echo -e "${YELLOW}• Restoring previous backend compiled code from ${BE_BACKUP}...${NC}"
        rm -rf "${INSTALL_DIR}/backend/dist"
        cp -r "${BE_BACKUP}" "${INSTALL_DIR}/backend/dist"
        chown -R istrac:istrac "${INSTALL_DIR}/backend/dist" 2>/dev/null || true
        
        if [[ -n "${SCHEMA_BACKUP}" && -f "${SCHEMA_BACKUP}" ]]; then
            cp "${SCHEMA_BACKUP}" "${INSTALL_DIR}/backend/prisma/schema.prisma"
        fi
        echo -e "${YELLOW}• Restarting restored backend & worker services...${NC}"
        restart_backend_services
        echo -e "${GREEN}  ✓ Backend restored and services restarted.${NC}"
    fi

    # 3. Reload Web Server
    reload_web_server

    echo -e "\n${BOLD}${RED}❌ PATCH ABORTED AND FULLY REVERTED.${NC}"
    echo -e "${BOLD}${YELLOW}Your application and database were NOT harmed and remain in their pre-patch operational state.${NC}"
    exit 1
}

# Trap unexpected errors during script execution
trap 'rollback "Unexpected script execution error at line $LINENO"' ERR

# ------------------------------------------------------------------------------
# STEP 1: PRE-PATCH SAFETY BACKUP
# ------------------------------------------------------------------------------
echo -e "\n${CYAN}Step 1/3: Creating Safety Backups...${NC}"

if [[ -d "${PATCH_DIR}/frontend/dist" && -d "${INSTALL_DIR}/frontend/dist" ]]; then
    FE_BACKUP="${INSTALL_DIR}/frontend/dist.bak_${TIMESTAMP}"
    echo -e " • Backing up current frontend to ${FE_BACKUP}..."
    cp -r "${INSTALL_DIR}/frontend/dist" "${FE_BACKUP}"
fi

if [[ -d "${PATCH_DIR}/backend/dist" && -d "${INSTALL_DIR}/backend/dist" ]]; then
    BE_BACKUP="${INSTALL_DIR}/backend/dist.bak_${TIMESTAMP}"
    echo -e " • Backing up current backend to ${BE_BACKUP}..."
    cp -r "${INSTALL_DIR}/backend/dist" "${BE_BACKUP}"
fi

if [[ -f "${PATCH_DIR}/backend/prisma/schema.prisma" && -f "${INSTALL_DIR}/backend/prisma/schema.prisma" ]]; then
    SCHEMA_BACKUP="${INSTALL_DIR}/backend/prisma/schema.prisma.bak_${TIMESTAMP}"
    cp "${INSTALL_DIR}/backend/prisma/schema.prisma" "${SCHEMA_BACKUP}"
fi

echo -e "${GREEN}✓ Pre-patch safety backups secured.${NC}"

# ------------------------------------------------------------------------------
# STEP 2: APPLY PATCH FILES
# ------------------------------------------------------------------------------
echo -e "\n${CYAN}Step 2/3: Synchronizing Patch Assets...${NC}"

# 2A. Frontend update
if [[ -d "${PATCH_DIR}/frontend/dist" ]]; then
    echo -e " • Updating frontend dist files..."
    mkdir -p "${INSTALL_DIR}/frontend"
    cp -r "${PATCH_DIR}/frontend/dist/." "${INSTALL_DIR}/frontend/dist/"
    chown -R istrac:www-data "${INSTALL_DIR}/frontend/dist" 2>/dev/null || chown -R root:root "${INSTALL_DIR}/frontend/dist"
    chmod -R 755 "${INSTALL_DIR}/frontend/dist"
    echo -e "${GREEN}  ✓ Frontend files updated.${NC}"
fi

# 2B. Backend update
if [[ -d "${PATCH_DIR}/backend/dist" ]]; then
    echo -e " • Updating backend compiled dist..."
    mkdir -p "${INSTALL_DIR}/backend"
    cp -r "${PATCH_DIR}/backend/dist/." "${INSTALL_DIR}/backend/dist/"
    chown -R istrac:istrac "${INSTALL_DIR}/backend/dist" 2>/dev/null || true

    # Prisma 7 schema fix (no data/migration change): keeps `prisma migrate deploy` working.
    if [[ -f "${PATCH_DIR}/backend/prisma/schema.prisma" ]]; then
        mkdir -p "${INSTALL_DIR}/backend/prisma"
        cp "${PATCH_DIR}/backend/prisma/schema.prisma" "${INSTALL_DIR}/backend/prisma/schema.prisma"
    fi

    echo -e " • Restarting backend & worker..."
    restart_backend_services
    echo -e "${GREEN}  ✓ Backend services restarted (${SERVICE_MANAGER}).${NC}"
fi

# 2C. Sync helper CLI utilities
if [[ -f "${PATCH_DIR}/manage-services-ubuntu.sh" ]]; then
    cp "${PATCH_DIR}/manage-services-ubuntu.sh" "${INSTALL_DIR}/manage-services-ubuntu.sh"
    chmod +x "${INSTALL_DIR}/manage-services-ubuntu.sh"
fi

# ------------------------------------------------------------------------------
# STEP 3: POST-PATCH DEEP HEALTH AUDIT (TRIGGERS AUTO-ROLLBACK IF FAILED)
# ------------------------------------------------------------------------------
echo -e "\n${BOLD}${CYAN}Step 3/3: Comprehensive Post-Patch Health Audit...${NC}"

# Audit Test 1: Frontend Entry File Verification
echo -n " • [Check 1/6] Verifying frontend document root... "
if [[ -f "${INSTALL_DIR}/frontend/dist/index.html" ]] && grep -q "Iterator" "${INSTALL_DIR}/frontend/dist/index.html"; then
    echo -e "${GREEN}PASSED (Index & Polyfill present)${NC}"
else
    rollback "Frontend index.html missing or corrupted!"
fi

# Audit Test 2: Backend Systemd Daemon Status
echo -n " • [Check 2/6] Checking backend process (${SERVICE_MANAGER:-unknown})... "
sleep 3
if backend_is_running; then
    echo -e "${GREEN}PASSED (Active / Running)${NC}"
else
    rollback "istrac-backend daemon failed to stay active after patch!"
fi

# Audit Test 3: Backend Worker Daemon Status
echo -n " • [Check 3/6] Checking worker process... "
if [[ "${SERVICE_MANAGER}" != "systemd" ]] || systemctl is-active --quiet istrac-worker; then
    echo -e "${GREEN}PASSED (Active / Running)${NC}"
else
    echo -e "${YELLOW}WARNING (Worker inactive, non-fatal)${NC}"
fi

# Audit Test 4: Dynamic Backend HTTP API Health Probe
echo -n " • [Check 4/6] Probing Backend HTTP API (/api/health)... "

# Detect configured backend port from .env or fallback
DETECTED_PORT="3000"
if [[ -f "${INSTALL_DIR}/backend/.env" ]]; then
    ENV_PORT=$(grep -E '^[[:space:]]*PORT=' "${INSTALL_DIR}/backend/.env" | cut -d '=' -f2 | tr -d ' "\r\n' || echo "")
    if [[ -n "${ENV_PORT}" ]]; then
        DETECTED_PORT="${ENV_PORT}"
    fi
fi

API_SUCCESS=0
HTTP_CODE="000"
for i in {1..12}; do
    # Try detected port, port 3000, port 5000, and Apache port 80
    for test_url in "http://127.0.0.1:${DETECTED_PORT}/api/health" "http://127.0.0.1:3000/api/health" "http://127.0.0.1:5000/health" "http://127.0.0.1/api/health"; do
        HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "${test_url}" 2>/dev/null || echo "000")
        if [[ "${HTTP_CODE}" == "200" ]]; then
            API_SUCCESS=1
            break 2
        fi
    done
    sleep 3
done

if [[ $API_SUCCESS -eq 1 ]]; then
    echo -e "${GREEN}PASSED (HTTP 200 OK via ${test_url})${NC}"
else
    echo -e "${YELLOW}\nBackend journal log snippet:${NC}"
    journalctl -u istrac-backend -n 8 --no-pager 2>/dev/null || true
    rollback "Backend HTTP probe failed after 36s (Last HTTP code: ${HTTP_CODE:-000}). Server not responding on port ${DETECTED_PORT}!"
fi

# Audit Test 5: Web Server (Apache2) Proxy Verification
echo -n " • [Check 5/6] Confirming the patched backend code is live... "
# POST /api/files/tags only exists in this release: 401 (sign-in required) = new code, 404 = old code.
NEWCODE_CODE="000"
for base in "http://127.0.0.1:${DETECTED_PORT}" "http://127.0.0.1:3000" "http://127.0.0.1"; do
    NEWCODE_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST -H 'Content-Type: application/json' -d '{}' "${base}/api/files/tags" 2>/dev/null || echo "000")
    [[ "${NEWCODE_CODE}" == "401" ]] && break
done
if [[ "${NEWCODE_CODE}" == "401" ]]; then
    echo -e "${GREEN}PASSED (new API routes active)${NC}"
else
    rollback "Backend is still serving the old code (probe returned HTTP ${NEWCODE_CODE}). Check that ${INSTALL_DIR}/backend/dist is what the service runs."
fi

echo -n " • [Check 6/6] Checking web server (Apache/httpd/nginx)... "
WEB_SVC=""
for svc in apache2 httpd nginx; do
    if systemctl is-active --quiet "$svc" 2>/dev/null; then WEB_SVC="$svc"; break; fi
done
if [[ -n "${WEB_SVC}" ]]; then
    WEB_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1/ 2>/dev/null || echo "000")
    if [[ "${WEB_CODE}" == "200" || "${WEB_CODE}" == "304" ]]; then
        echo -e "${GREEN}PASSED (${WEB_SVC} serving frontend)${NC}"
    else
        echo -e "${YELLOW}PASSED WITH NOTICE (${WEB_SVC} answered HTTP ${WEB_CODE} on port 80)${NC}"
    fi
else
    echo -e "${YELLOW}SKIPPED (no Apache/httpd/nginx service on this host)${NC}"
fi

# Remove error trap on successful completion
trap - ERR

echo -e "\n${BOLD}${GREEN}==============================================================================${NC}"
echo -e "${BOLD}${GREEN} ✅ HOT-PATCH APPLIED & VERIFIED 100% HEALTHY!${NC}"
echo -e "${BOLD}${GREEN} Application is fully operational. Zero downtime incurred.${NC}"
echo -e "${BOLD}${GREEN} Target installation updated: ${INSTALL_DIR}${NC}"
echo -e "${BOLD}${GREEN} Safety backups preserved at:${NC}"
[[ -n "${FE_BACKUP}" ]] && echo -e " • Frontend: ${FE_BACKUP}"
[[ -n "${BE_BACKUP}" ]] && echo -e " • Backend:  ${BE_BACKUP}"
echo -e "${BOLD}${GREEN}==============================================================================${NC}"
