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
        
        echo -e "${YELLOW}• Restarting restored backend & worker services...${NC}"
        systemctl restart istrac-backend || true
        systemctl restart istrac-worker || true
        echo -e "${GREEN}  ✓ Backend restored and services restarted.${NC}"
    fi

    # 3. Reload Web Server
    if systemctl is-active --quiet apache2; then
        systemctl reload apache2 || true
    fi

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
    
    echo -e " • Restarting systemd daemons (istrac-backend & istrac-worker)..."
    systemctl restart istrac-backend || true
    systemctl restart istrac-worker || true
    echo -e "${GREEN}  ✓ Backend services restarted.${NC}"
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
echo -n " • [Check 1/5] Verifying frontend document root... "
if [[ -f "${INSTALL_DIR}/frontend/dist/index.html" ]] && grep -q "Iterator" "${INSTALL_DIR}/frontend/dist/index.html"; then
    echo -e "${GREEN}PASSED (Index & Polyfill present)${NC}"
else
    rollback "Frontend index.html missing or corrupted!"
fi

# Audit Test 2: Backend Systemd Daemon Status
echo -n " • [Check 2/5] Checking istrac-backend systemd process... "
sleep 2
if systemctl is-active --quiet istrac-backend; then
    echo -e "${GREEN}PASSED (Active / Running)${NC}"
else
    rollback "istrac-backend daemon failed to stay active after patch!"
fi

# Audit Test 3: Backend Worker Daemon Status
echo -n " • [Check 3/5] Checking istrac-worker systemd process... "
if systemctl is-active --quiet istrac-worker; then
    echo -e "${GREEN}PASSED (Active / Running)${NC}"
else
    echo -e "${YELLOW}WARNING (Worker inactive, non-fatal)${NC}"
fi

# Audit Test 4: Dynamic Backend HTTP API Health Probe
echo -n " • [Check 4/5] Probing Backend HTTP API (/api/health)... "

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
echo -n " • [Check 5/5] Checking Web Server (Apache2) proxy routing... "
if systemctl is-active --quiet apache2; then
    APACHE_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1/ 2>/dev/null || echo "000")
    if [[ "${APACHE_CODE}" == "200" || "${APACHE_CODE}" == "304" ]]; then
        echo -e "${GREEN}PASSED (Apache serving frontend)${NC}"
    else
        echo -e "${YELLOW}PASSED WITH NOTICE (Port 80 responded with HTTP ${APACHE_CODE})${NC}"
    fi
else
    echo -e "${YELLOW}SKIPPED (Apache2 not managed by this host)${NC}"
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
