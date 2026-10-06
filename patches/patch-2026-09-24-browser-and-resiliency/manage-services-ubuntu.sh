#!/usr/bin/env bash
# ==============================================================================
# 🛰️ ISTRAC-SIMS — Service Management CLI Utility for Ubuntu Linux
# Usage: sudo ./manage-services-ubuntu.sh [status|start|stop|restart|logs|backup]
# ==============================================================================

set -euo pipefail

CYAN='\033[0;36m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BOLD='\033[1m'
NC='\033[0m'

ACTION="${1:-status}"
INSTALL_DIR="/opt/istrac-sims"

case "$ACTION" in
    status)
        echo -e "${BOLD}${CYAN}==============================================================================${NC}"
        echo -e "${BOLD}${CYAN} 🛰️  ISTRAC-SIMS — UBUNTU SERVICES STATUS OVERVIEW${NC}"
        echo -e "${BOLD}${CYAN}==============================================================================${NC}"
        
        # Web Server (Apache2)
        if systemctl is-active --quiet apache2; then
            echo -e "• Web Server (Apache2):       ${GREEN}ACTIVE (Port 80/443)${NC}"
        else
            echo -e "• Web Server (Apache2):       ${RED}INACTIVE / FAILED${NC}"
        fi
        
        # Backend API
        if systemctl is-active --quiet istrac-backend; then
            echo -e "• Backend API (Systemd):      ${GREEN}ACTIVE (Port 3000)${NC}"
        else
            echo -e "• Backend API (Systemd):      ${RED}STOPPED${NC}"
        fi

        # Worker Daemon
        if systemctl is-active --quiet istrac-worker; then
            echo -e "• Worker Daemon (Systemd):    ${GREEN}ACTIVE (Running)${NC}"
        else
            echo -e "• Worker Daemon (Systemd):    ${YELLOW}INACTIVE / STANDALONE${NC}"
        fi
        
        # SQL Database (MySQL)
        if systemctl is-active --quiet mysql; then
            echo -e "• MySQL Database:             ${GREEN}ACTIVE (Port 3306)${NC}"
        elif systemctl is-active --quiet mariadb; then
            echo -e "• SQL Database (MariaDB):    ${GREEN}ACTIVE (Port 3306)${NC}"
        else
            echo -e "• MySQL Database:             ${RED}INACTIVE / FAILED${NC}"
        fi
        
        # Redis
        if systemctl is-active --quiet redis-server || systemctl is-active --quiet redis; then
            echo -e "• Redis Service:              ${GREEN}ACTIVE (Port 6379)${NC}"
        else
            echo -e "• Redis Service:              ${YELLOW}NOT RUNNING (Using In-Memory Fallback)${NC}"
        fi
        
        # Storage
        if [ -d "/mnt/istrac_storage" ]; then
            DISK_USAGE=$(df -h /mnt/istrac_storage | awk 'NR==2 {print $3 "/" $2 " (" $5 " used)"}')
            echo -e "• Storage Volume:             ${GREEN}MOUNTED at /mnt/istrac_storage [${DISK_USAGE}]${NC}"
        else
            echo -e "• Storage Volume:             ${YELLOW}WARNING: /mnt/istrac_storage not found${NC}"
        fi
        
        echo ""
        echo -e "${BOLD}Health Probe Test:${NC}"
        curl -s "http://127.0.0.1:3000/api/health" || echo -e "${RED}Backend health probe failed.${NC}"
        echo ""
        ;;

    start)
        echo -e "${CYAN}Starting all ISTRAC-SIMS services in dependency order...${NC}"
        echo -e "  1/4 Starting MySQL Database..."
        systemctl start mysql 2>/dev/null || systemctl start mariadb 2>/dev/null || true
        systemctl start redis-server 2>/dev/null || systemctl start redis 2>/dev/null || true
        echo -e "  2/4 Starting Backend API..."
        systemctl start istrac-backend
        echo -e "  3/4 Starting Worker Daemon..."
        systemctl start istrac-worker 2>/dev/null || true
        echo -e "  4/4 Starting Apache Web Server..."
        systemctl start apache2
        echo -e "${GREEN}All services started successfully.${NC}"
        ;;

    stop)
        echo -e "${YELLOW}Stopping ISTRAC-SIMS application services (Apache2, Worker, Backend)...${NC}"
        systemctl stop apache2 2>/dev/null || true
        systemctl stop istrac-worker 2>/dev/null || true
        systemctl stop istrac-backend 2>/dev/null || true
        echo -e "${GREEN}Application services stopped.${NC}"
        echo -e "Note: MySQL is still running. To stop the whole stack including MySQL: ${CYAN}$0 stop-all${NC}"
        ;;

    stop-all)
        echo -e "${YELLOW}Stopping WHOLE server stack (Apache2, Worker, Backend, MySQL, Redis)...${NC}"
        systemctl stop apache2 2>/dev/null || true
        systemctl stop istrac-worker 2>/dev/null || true
        systemctl stop istrac-backend 2>/dev/null || true
        systemctl stop mysql 2>/dev/null || systemctl stop mariadb 2>/dev/null || true
        systemctl stop redis-server 2>/dev/null || systemctl stop redis 2>/dev/null || true
        echo -e "${GREEN}Entire server stack stopped completely.${NC}"
        ;;

    restart)
        echo -e "${CYAN}Restarting all ISTRAC-SIMS services in dependency order...${NC}"
        systemctl restart mysql 2>/dev/null || systemctl restart mariadb 2>/dev/null || true
        systemctl restart redis-server 2>/dev/null || systemctl restart redis 2>/dev/null || true
        systemctl restart istrac-backend
        systemctl restart istrac-worker 2>/dev/null || true
        systemctl restart apache2
        echo -e "${GREEN}All services restarted successfully.${NC}"
        ;;

    logs)
        echo -e "${CYAN}Streaming Ubuntu Backend Logs (Ctrl+C to exit)...${NC}"
        journalctl -u istrac-backend -f -n 50
        ;;

    backup)
        BACKUP_DIR="/var/backups/istrac-sims"
        mkdir -p "${BACKUP_DIR}"
        TIMESTAMP=$(date '+%Y%m%d_%H%M%S')
        BACKUP_FILE="${BACKUP_DIR}/istrac_sims_backup_${TIMESTAMP}.sql"
        
        echo -e "${CYAN}Creating database backup at ${BACKUP_FILE}...${NC}"
        DB_USER="istrac_user"
        DB_PASS="IstracSecurePass123!"
        DB_NAME="istrac_sims"
        if [ -f "${INSTALL_DIR}/backend/.env" ]; then
            DB_NAME=$(grep '^MYSQL_DATABASE=' "${INSTALL_DIR}/backend/.env" | cut -d '=' -f2 | tr -d '"\r')
            DB_USER=$(grep '^MYSQL_USER=' "${INSTALL_DIR}/backend/.env" | cut -d '=' -f2 | tr -d '"\r')
            DB_PASS=$(grep '^MYSQL_PASSWORD=' "${INSTALL_DIR}/backend/.env" | cut -d '=' -f2 | tr -d '"\r')
        fi
        mysqldump -u "${DB_USER}" -p"${DB_PASS}" -h 127.0.0.1 "${DB_NAME}" > "${BACKUP_FILE}"
        echo -e "${GREEN}Database backup complete: ${BACKUP_FILE} ($(du -sh "${BACKUP_FILE}" | cut -f1))${NC}"
        ;;

    *)
        echo -e "${BOLD}Usage:${NC} $0 {status|start|stop|stop-all|restart|logs|backup}"
        exit 1
        ;;
esac
