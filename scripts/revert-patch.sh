#!/usr/bin/env bash
# ==============================================================================
# 🛰️ ISTRAC-SIMS — Manual One-Click Rollback Script
# Usage: sudo bash revert-patch.sh [/custom/installation/path]
# ==============================================================================

set -euo pipefail

CYAN='\033[0;36m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BOLD='\033[1m'
NC='\033[0m'

echo -e "${BOLD}${CYAN}==============================================================================${NC}"
echo -e "${BOLD}${CYAN} 🛰️  ISTRAC-SIMS MANUAL ROLLBACK UTILITY${NC}"
echo -e "${BOLD}${CYAN}==============================================================================${NC}"

if [[ $EUID -ne 0 ]]; then
    echo -e "${RED}❌ Error: This script must be run as root: sudo bash revert-patch.sh${NC}"
    exit 1
fi

DEFAULT_INSTALL_DIR="/opt/istrac-sims"
if [[ -n "${1:-}" ]]; then
    DEFAULT_INSTALL_DIR="$1"
elif [[ ! -d "/opt/istrac-sims" && -d "/opt/istrac-fms" ]]; then
    DEFAULT_INSTALL_DIR="/opt/istrac-fms"
fi

if [[ -t 0 ]]; then
    read -r -p "Target installation path for rollback [${DEFAULT_INSTALL_DIR}]: " USER_INPUT
    USER_INPUT=$(echo "${USER_INPUT}" | xargs)
    if [[ -z "${USER_INPUT}" ]]; then
        INSTALL_DIR="${DEFAULT_INSTALL_DIR}"
    else
        INSTALL_DIR="${USER_INPUT}"
    fi
else
    INSTALL_DIR="${DEFAULT_INSTALL_DIR}"
fi

if [[ ! -d "${INSTALL_DIR}" ]]; then
    echo -e "${RED}❌ Error: Installation directory '${INSTALL_DIR}' does not exist.${NC}"
    exit 1
fi

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

# Find latest frontend backup
LATEST_FE=$(ls -td "${INSTALL_DIR}/frontend/dist.bak_"* 2>/dev/null | head -n 1 || echo "")
# Find latest backend backup
LATEST_BE=$(ls -td "${INSTALL_DIR}/backend/dist.bak_"* 2>/dev/null | head -n 1 || echo "")

if [[ -z "${LATEST_FE}" && -z "${LATEST_BE}" ]]; then
    echo -e "${RED}❌ Error: No pre-patch backup folders found under ${INSTALL_DIR}.${NC}"
    exit 1
fi

if [[ -n "${LATEST_FE}" ]]; then
    echo -e "${YELLOW}⏪ Restoring Frontend from: ${LATEST_FE}...${NC}"
    rm -rf "${INSTALL_DIR}/frontend/dist"
    cp -r "${LATEST_FE}" "${INSTALL_DIR}/frontend/dist"
    chown -R istrac:www-data "${INSTALL_DIR}/frontend/dist" 2>/dev/null || true
    chmod -R 755 "${INSTALL_DIR}/frontend/dist"
    echo -e "${GREEN}✅ Frontend restored.${NC}"
fi

if [[ -n "${LATEST_BE}" ]]; then
    echo -e "${YELLOW}⏪ Restoring Backend from: ${LATEST_BE}...${NC}"
    rm -rf "${INSTALL_DIR}/backend/dist"
    cp -r "${LATEST_BE}" "${INSTALL_DIR}/backend/dist"
    chown -R istrac:istrac "${INSTALL_DIR}/backend/dist" 2>/dev/null || true
    
    LATEST_SCHEMA=$(ls -t "${INSTALL_DIR}/backend/prisma/schema.prisma.bak_"* 2>/dev/null | head -n 1 || echo "")
    if [[ -n "${LATEST_SCHEMA}" ]]; then
        cp "${LATEST_SCHEMA}" "${INSTALL_DIR}/backend/prisma/schema.prisma"
    fi
    echo -e "${CYAN}🔄 Restarting backend daemons...${NC}"
    restart_backend_services
    echo -e "${GREEN}✅ Backend restored and restarted (${SERVICE_MANAGER}).${NC}"
fi

reload_web_server

echo -e "\n${BOLD}${GREEN}==============================================================================${NC}"
echo -e "${BOLD}${GREEN} ✅ SYSTEM ROLLED BACK TO PRE-PATCH STATE SUCCESSFULLY!${NC}"
echo -e "${BOLD}${GREEN} Restored installation: ${INSTALL_DIR}${NC}"
echo -e "${BOLD}${GREEN}==============================================================================${NC}"
