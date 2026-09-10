#!/usr/bin/env bash
# ==============================================================================
# 🛰️ ISTRAC-SIMS — Service Management CLI Utility for Red Hat Enterprise Linux
# Usage: ./manage-services-rhel.sh [status|start|stop|restart|logs|backup|rebuild]
# ==============================================================================

set -euo pipefail

CYAN='\033[0;36m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BOLD='\033[1m'
NC='\033[0m'

ACTION="${1:-status}"
CURRENT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

case "$ACTION" in
    status)
        echo -e "${BOLD}${CYAN}==============================================================================${NC}"
        echo -e "${BOLD}${CYAN} 🛰️  ISTRAC-SIMS — SYSTEM SERVICES STATUS OVERVIEW${NC}"
        echo -e "${BOLD}${CYAN}==============================================================================${NC}"
        
        echo -n "• Nginx Web Server:    "
        systemctl is-active --quiet nginx && echo -e "${GREEN}ACTIVE (Running on port 80/443)${NC}" || echo -e "${RED}INACTIVE / FAILED${NC}"
        
        echo -n "• Backend API (PM2):   "
        if pm2 list | grep -q 'istrac-sims-backend'; then
            echo -e "${GREEN}ACTIVE (Running on port 3000)${NC}"
        else
            echo -e "${RED}STOPPED${NC}"
        fi
        
        echo -n "• MariaDB Database:    "
        systemctl is-active --quiet mariadb && echo -e "${GREEN}ACTIVE (Port 3306)${NC}" || echo -e "${RED}INACTIVE / FAILED${NC}"
        
        echo -n "• Redis In-Memory:     "
        systemctl is-active --quiet redis && echo -e "${GREEN}ACTIVE (Port 6379)${NC}" || echo -e "${RED}INACTIVE / FAILED${NC}"
        
        echo -n "• Storage Volume:      "
        if [ -d "/mnt/istrac_storage" ]; then
            DISK_USAGE=$(df -h /mnt/istrac_storage | awk 'NR==2 {print $3 "/" $2 " (" $5 " used)"}')
            echo -e "${GREEN}MOUNTED at /mnt/istrac_storage [${DISK_USAGE}]${NC}"
        else
            echo -e "${YELLOW}WARNING: Directory /mnt/istrac_storage not found${NC}"
        fi
        
        echo ""
        echo -e "${BOLD}Health Probe Test:${NC}"
        curl -s "http://127.0.0.1:3000/health" || echo -e "${RED}Backend health probe failed.${NC}"
        echo ""
        ;;

    start)
        echo -e "${CYAN}Starting all ISTRAC-SIMS services...${NC}"
        systemctl start mariadb
        systemctl start redis
        pm2 start "${CURRENT_DIR}/ecosystem.config.cjs" --env production || pm2 restart istrac-sims-backend
        systemctl start nginx
        echo -e "${GREEN}All services started successfully.${NC}"
        ;;

    stop)
        echo -e "${YELLOW}Stopping all ISTRAC-SIMS services...${NC}"
        pm2 stop istrac-sims-backend || true
        systemctl stop nginx || true
        echo -e "${GREEN}Application processes stopped.${NC}"
        ;;

    restart)
        echo -e "${CYAN}Restarting all ISTRAC-SIMS services...${NC}"
        systemctl restart mariadb
        systemctl restart redis
        pm2 restart istrac-sims-backend || pm2 start "${CURRENT_DIR}/ecosystem.config.cjs" --env production
        systemctl restart nginx
        echo -e "${GREEN}All services restarted successfully.${NC}"
        ;;

    logs)
        echo -e "${CYAN}Streaming PM2 Backend Logs (Ctrl+C to exit)...${NC}"
        pm2 logs istrac-sims-backend --lines 50
        ;;

    backup)
        BACKUP_DIR="/var/backups/istrac-sims"
        mkdir -p "${BACKUP_DIR}"
        TIMESTAMP=$(date '+%Y%m%d_%H%M%S')
        BACKUP_FILE="${BACKUP_DIR}/istrac_fms_backup_${TIMESTAMP}.sql"
        
        echo -e "${CYAN}Creating database backup at ${BACKUP_FILE}...${NC}"
        mysqldump -u istrac_user -pIstracSecurePass123! istrac_fms > "${BACKUP_FILE}"
        gzip -f "${BACKUP_FILE}"
        echo -e "${GREEN}Backup complete: ${BACKUP_FILE}.gz ($(du -h "${BACKUP_FILE}.gz" | cut -f1))${NC}"
        ;;

    rebuild)
        echo -e "${CYAN}Rebuilding backend and frontend application bundles...${NC}"
        cd "${CURRENT_DIR}/backend"
        npx prisma generate
        npx prisma migrate deploy
        npm run build
        
        cd "${CURRENT_DIR}/frontend"
        npm run build
        
        cd "${CURRENT_DIR}"
        pm2 restart istrac-sims-backend
        systemctl reload nginx
        echo -e "${GREEN}Rebuild and reload complete!${NC}"
        ;;

    *)
        echo -e "Usage: $0 {status|start|stop|restart|logs|backup|rebuild}"
        exit 1
        ;;
esac
