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
    
    echo -e "${CYAN}🔄 Restarting backend daemons...${NC}"
    systemctl restart istrac-backend || true
    systemctl restart istrac-worker || true
    echo -e "${GREEN}✅ Backend restored and restarted.${NC}"
fi

echo -e "\n${BOLD}${GREEN}==============================================================================${NC}"
echo -e "${BOLD}${GREEN} ✅ SYSTEM ROLLED BACK TO PRE-PATCH STATE SUCCESSFULLY!${NC}"
echo -e "${BOLD}${GREEN} Restored installation: ${INSTALL_DIR}${NC}"
echo -e "${BOLD}${GREEN}==============================================================================${NC}"
