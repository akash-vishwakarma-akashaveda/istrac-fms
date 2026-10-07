#!/usr/bin/env bash
# ==============================================================================
# 🛰️ ISTRAC-SIMS — System Health Check & Verification Script (Ubuntu Linux)
# Target OS: Ubuntu 22.04 LTS / 24.04 LTS
# Usage: sudo bash deploy/verify.sh
# ==============================================================================

set -euo pipefail

CYAN='\033[0;36m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BOLD='\033[1m'
NC='\033[0m'

echo -e "${BOLD}${CYAN}======================================================================${NC}"
echo -e "${BOLD}${CYAN} 🛰️  ISTRAC-SIMS UBUNTU HEALTH VERIFICATION${NC}"
echo -e "${BOLD}${CYAN}======================================================================${NC}"

check_service() {
  local service_name="$1"
  if systemctl is-active --quiet "${service_name}"; then
    echo -e "  ${GREEN}[OK]${NC} ${service_name} is RUNNING"
  else
    echo -e "  ${RED}[FAIL]${NC} ${service_name} is NOT running"
  fi
}

echo -e "\n${BOLD}1. Systemd Daemons:${NC}"
check_service "apache2"
if systemctl is-active --quiet mysql; then
  echo -e "  ${GREEN}[OK]${NC} mysql is RUNNING"
elif systemctl is-active --quiet mariadb; then
  echo -e "  ${GREEN}[OK]${NC} mariadb is RUNNING"
else
  echo -e "  ${RED}[FAIL]${NC} mysql database is NOT running"
fi
check_service "istrac-backend"
check_service "istrac-worker"
if systemctl is-active --quiet redis-server || systemctl is-active --quiet redis; then
  echo -e "  ${GREEN}[OK]${NC} redis-server is RUNNING"
else
  echo -e "  ${YELLOW}[INFO]${NC} redis-server not running (Backend uses memory fallback)"
fi

echo -e "\n${BOLD}2. Port Listeners:${NC}"
for port in 80 3000 3306; do
  if ss -tuln | grep -q ":${port} "; then
    echo -e "  ${GREEN}[OK]${NC} Port ${port} is active"
  else
    echo -e "  ${RED}[FAIL]${NC} Port ${port} is NOT listening"
  fi
done

echo -e "\n${BOLD}3. Backend API Connectivity Check:${NC}"
HEALTH_RES=$(curl -s http://127.0.0.1:3000/api/health 2>/dev/null || echo "")
if [[ -n "${HEALTH_RES}" ]] && echo "${HEALTH_RES}" | grep -qi "ok"; then
  echo -e "  ${GREEN}[OK]${NC} Backend HTTP API responded (200 OK): ${HEALTH_RES}"
else
  echo -e "  ${YELLOW}[WARN]${NC} Backend /api/health endpoint returned: ${HEALTH_RES:-No response}"
fi

echo -e "\n${BOLD}4. Physical Storage Mount:${NC}"
if [[ -d "/mnt/istrac_storage" ]]; then
  echo -e "  ${GREEN}[OK]${NC} Storage mount /mnt/istrac_storage is accessible"
  ls -ld /mnt/istrac_storage
else
  echo -e "  ${RED}[FAIL]${NC} Storage directory /mnt/istrac_storage not found!"
fi

echo -e "\n${BOLD}${CYAN}======================================================================${NC}"
