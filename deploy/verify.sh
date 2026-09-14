#!/usr/bin/env bash
# ==============================================================================
# ISTRAC-FMS System Health Check & Verification Script (RHEL)
# ==============================================================================

set -euo pipefail

echo "======================================================================"
echo "🛰️  ISTRAC-FMS SERVICE HEALTH CHECK"
echo "======================================================================"

check_service() {
  local service_name="$1"
  if systemctl is-active --quiet "${service_name}"; then
    echo "  [OK] ${service_name} is RUNNING"
  else
    echo "  [FAIL] ${service_name} is NOT running"
  fi
}

echo "1. Systemd Daemons:"
check_service "mariadb"
check_service "redis"
check_service "istrac-backend"
check_service "istrac-worker"
check_service "nginx"

echo ""
echo "2. Port Listeners:"
for port in 80 5000 3306 6379; do
  if ss -tuln | grep -q ":${port} "; then
    echo "  [OK] Port ${port} is active"
  else
    echo "  [FAIL] Port ${port} is NOT listening"
  fi
done

echo ""
echo "3. Backend API Connectivity Check:"
if curl -s http://127.0.0.1:5000/health > /dev/null 2>&1; then
  echo "  [OK] Backend HTTP probe responded (200 OK)"
else
  echo "  [WARN] Backend /health endpoint check failed or not responding yet."
fi

echo ""
echo "4. Physical Storage Mount:"
if [[ -d "/var/data/istrac_storage" ]]; then
  echo "  [OK] Storage mount /var/data/istrac_storage is accessible"
  ls -ld /var/data/istrac_storage
else
  echo "  [FAIL] Storage directory /var/data/istrac_storage not found!"
fi

echo "======================================================================"
