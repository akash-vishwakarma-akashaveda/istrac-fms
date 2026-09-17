#!/usr/bin/env bash
# ==============================================================================
# 🛰️ ISTRAC-SIMS — Service Management CLI Utility (Ubuntu 24 & RHEL 8/9)
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

# Detect active services
detect_webserver() {
    if systemctl is-active --quiet apache2; then
        echo "apache2"
    elif systemctl is-active --quiet httpd; then
        echo "httpd"
    elif systemctl is-active --quiet nginx; then
        echo "nginx"
    elif systemctl list-unit-files | grep -q -E '^apache2\.service'; then
        echo "apache2"
    elif systemctl list-unit-files | grep -q -E '^httpd\.service'; then
        echo "httpd"
    else
        echo "none"
    fi
}

detect_database() {
    if systemctl is-active --quiet mysql; then
        echo "mysql"
    elif systemctl is-active --quiet mariadb; then
        echo "mariadb"
    elif systemctl is-active --quiet mysqld; then
        echo "mysqld"
    elif systemctl list-unit-files | grep -q -E '^mysql\.service'; then
        echo "mysql"
    elif systemctl list-unit-files | grep -q -E '^mariadb\.service'; then
        echo "mariadb"
    else
        echo "mysql"
    fi
}

detect_redis() {
    if systemctl is-active --quiet redis-server; then
        echo "redis-server"
    elif systemctl is-active --quiet redis; then
        echo "redis"
    elif systemctl list-unit-files | grep -q -E '^redis-server\.service'; then
        echo "redis-server"
    elif systemctl list-unit-files | grep -q -E '^redis\.service'; then
        echo "redis"
    else
        echo "none"
    fi
}

WEBSERVER=$(detect_webserver)
DATABASE=$(detect_database)
REDIS=$(detect_redis)

case "$ACTION" in
    status)
        echo -e "${BOLD}${CYAN}==============================================================================${NC}"
        echo -e "${BOLD}${CYAN} 🛰️  ISTRAC-SIMS — SYSTEM SERVICES STATUS OVERVIEW${NC}"
        echo -e "${BOLD}${CYAN}==============================================================================${NC}"
        
        # Web Server
        if systemctl is-active --quiet apache2; then
            echo -e "• Web Server (Apache apache2): ${GREEN}ACTIVE (Running on port 80/443)${NC}"
        elif systemctl is-active --quiet httpd; then
            echo -e "• Web Server (Apache httpd):   ${GREEN}ACTIVE (Running on port 80/443)${NC}"
        elif systemctl is-active --quiet nginx; then
            echo -e "• Web Server (Nginx):          ${GREEN}ACTIVE (Running on port 80/443)${NC}"
        else
            echo -e "• Web Server (Apache/Nginx):    ${RED}INACTIVE / FAILED${NC}"
        fi
        
        # Backend API
        if command -v pm2 >/dev/null 2>&1 && pm2 list | grep -q 'istrac-sims-backend'; then
            echo -e "• Backend API (PM2):            ${GREEN}ACTIVE (Running via PM2)${NC}"
        elif systemctl is-active --quiet istrac-backend; then
            echo -e "• Backend API (Systemd):        ${GREEN}ACTIVE (Running via systemd service)${NC}"
        else
            echo -e "• Backend API:                  ${RED}STOPPED${NC}"
        fi

        # Worker Daemon
        echo -n "• Worker Daemon (Systemd):      "
        systemctl is-active --quiet istrac-worker && echo -e "${GREEN}ACTIVE (Running via systemd)${NC}" || echo -e "${YELLOW}INACTIVE / STANDALONE${NC}"
        
        # Database
        echo -n "• Database (${DATABASE}):       "
        systemctl is-active --quiet "${DATABASE}" && echo -e "${GREEN}ACTIVE (Port 3306)${NC}" || echo -e "${RED}INACTIVE / FAILED${NC}"
        
        # Redis
        echo -n "• Redis Cache:                  "
        if [[ "$REDIS" != "none" ]] && systemctl is-active --quiet "${REDIS}"; then
            echo -e "${GREEN}ACTIVE (${REDIS} on Port 6379)${NC}"
        else
            echo -e "${YELLOW}NOT RUNNING (Using In-Memory Fallback)${NC}"
        fi
        
        # Storage
        echo -n "• Storage Volume:               "
        if [ -d "/mnt/istrac_storage" ]; then
            DISK_USAGE=$(df -h /mnt/istrac_storage | awk 'NR==2 {print $3 "/" $2 " (" $5 " used)"}')
            echo -e "${GREEN}MOUNTED at /mnt/istrac_storage [${DISK_USAGE}]${NC}"
        elif [ -d "/var/data/istrac_storage" ]; then
            DISK_USAGE=$(df -h /var/data/istrac_storage | awk 'NR==2 {print $3 "/" $2 " (" $5 " used)"}')
            echo -e "${GREEN}MOUNTED at /var/data/istrac_storage [${DISK_USAGE}]${NC}"
        else
            echo -e "${YELLOW}WARNING: Storage mount directory not found${NC}"
        fi
        
        echo ""
        echo -e "${BOLD}Health Probe Test:${NC}"
        curl -s "http://127.0.0.1:3000/health" || curl -s "http://127.0.0.1:5000/health" || echo -e "${RED}Backend health probe failed.${NC}"
        echo ""
        ;;

    start)
        echo -e "${CYAN}Starting all ISTRAC-SIMS services...${NC}"
        systemctl start "${DATABASE}" 2>/dev/null || true
        [[ "$REDIS" != "none" ]] && systemctl start "${REDIS}" 2>/dev/null || true
        if command -v pm2 >/dev/null 2>&1; then
            pm2 start "${CURRENT_DIR}/ecosystem.config.cjs" --env production || pm2 restart istrac-sims-backend
        elif systemctl list-unit-files | grep -q istrac-backend; then
            systemctl start istrac-backend
            systemctl start istrac-worker 2>/dev/null || true
        fi
        [[ "$WEBSERVER" != "none" ]] && systemctl start "${WEBSERVER}" 2>/dev/null || true
        echo -e "${GREEN}All services started successfully.${NC}"
        ;;

    stop)
        echo -e "${YELLOW}Stopping all ISTRAC-SIMS services...${NC}"
        command -v pm2 >/dev/null 2>&1 && pm2 stop istrac-sims-backend || true
        systemctl stop istrac-worker 2>/dev/null || true
        systemctl stop istrac-backend 2>/dev/null || true
        [[ "$WEBSERVER" != "none" ]] && systemctl stop "${WEBSERVER}" 2>/dev/null || true
        echo -e "${GREEN}Application processes stopped.${NC}"
        ;;

    restart)
        echo -e "${CYAN}Restarting all ISTRAC-SIMS services...${NC}"
        systemctl restart "${DATABASE}" 2>/dev/null || true
        [[ "$REDIS" != "none" ]] && systemctl restart "${REDIS}" 2>/dev/null || true
        if command -v pm2 >/dev/null 2>&1; then
            pm2 restart istrac-sims-backend || pm2 start "${CURRENT_DIR}/ecosystem.config.cjs" --env production
        elif systemctl list-unit-files | grep -q istrac-backend; then
            systemctl restart istrac-backend
            systemctl restart istrac-worker 2>/dev/null || true
        fi
        [[ "$WEBSERVER" != "none" ]] && systemctl restart "${WEBSERVER}" 2>/dev/null || true
        echo -e "${GREEN}All services restarted successfully.${NC}"
        ;;

    logs)
        if systemctl list-unit-files | grep -q istrac-backend; then
            echo -e "${CYAN}Streaming Systemd Backend Logs (Ctrl+C to exit)...${NC}"
            journalctl -u istrac-backend -f -n 50
        elif command -v pm2 >/dev/null 2>&1; then
            echo -e "${CYAN}Streaming PM2 Backend Logs (Ctrl+C to exit)...${NC}"
            pm2 logs istrac-sims-backend --lines 50
        else
            journalctl -u istrac-backend -f -n 50
        fi
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
        command -v pm2 >/dev/null 2>&1 && pm2 restart istrac-sims-backend || systemctl restart istrac-backend 2>/dev/null || true
        [[ "$WEBSERVER" != "none" ]] && systemctl reload "${WEBSERVER}" 2>/dev/null || true
        echo -e "${GREEN}Rebuild and reload complete!${NC}"
        ;;

    *)
        echo -e "Usage: $0 {status|start|stop|restart|logs|backup|rebuild}"
        exit 1
        ;;
esac
