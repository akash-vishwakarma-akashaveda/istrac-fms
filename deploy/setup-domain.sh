#!/usr/bin/env bash
# ==============================================================================
# 🛰️ ISTRAC-SIMS — Custom Domain & SSL Setup Utility (Ubuntu 24 & RHEL 8/9)
# Usage:
#   sudo bash deploy/setup-domain.sh <your-domain.com> [letsencrypt|selfsigned|none]
# Example:
#   sudo bash deploy/setup-domain.sh sims.istrac.local none
#   sudo bash deploy/setup-domain.sh portal.mydomain.com letsencrypt
# ==============================================================================

set -euo pipefail

CYAN='\033[0;36m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BOLD='\033[1m'
NC='\033[0m'

if [[ $EUID -ne 0 ]]; then
   echo -e "${RED}[ERROR] This script must be executed with sudo privileges.${NC}"
   exit 1
fi

DOMAIN="${1:-}"
SSL_MODE="${2:-none}"
INSTALL_DIR="/opt/istrac-fms"

if [[ -z "${DOMAIN}" ]]; then
    echo -e "${BOLD}${CYAN}==============================================================================${NC}"
    echo -e "${BOLD}${CYAN} 🛰️  ISTRAC-SIMS — CUSTOM DOMAIN CONFIGURATION${NC}"
    echo -e "${BOLD}${CYAN}==============================================================================${NC}"
    read -r -p "Enter your custom domain or hostname (e.g. sims.example.com): " INPUT_DOMAIN
    DOMAIN="${INPUT_DOMAIN:-}"
    if [[ -z "${DOMAIN}" ]]; then
        echo -e "${RED}Error: Domain name cannot be empty.${NC}"
        exit 1
    fi
    echo ""
    echo "Select SSL/TLS Mode:"
    echo "  1) none        - HTTP only on Port 80 (Standard Intranet)"
    echo "  2) letsencrypt - Free automated HTTPS via Let's Encrypt (Requires public internet)"
    echo "  3) selfsigned  - Local HTTPS on Port 443 with self-signed certificate"
    read -r -p "Enter choice [1/2/3, default 1]: " SSL_CHOICE
    case "${SSL_CHOICE}" in
        2) SSL_MODE="letsencrypt" ;;
        3) SSL_MODE="selfsigned" ;;
        *) SSL_MODE="none" ;;
    esac
fi

echo -e "${CYAN}Configuring ISTRAC-SIMS for domain: ${BOLD}${DOMAIN}${NC} (SSL Mode: ${SSL_MODE})..."

# ------------------------------------------------------------------------------
# 1. DETECT WEB SERVER & OS
# ------------------------------------------------------------------------------
IS_DEBIAN=0
if [[ -f /etc/os-release ]]; then
    . /etc/os-release
    if [[ "${ID_LIKE:-}" =~ (debian|ubuntu) || "${ID:-}" =~ (debian|ubuntu) ]]; then
        IS_DEBIAN=1
    fi
fi

if [[ $IS_DEBIAN -eq 1 ]]; then
    APACHE_SERVICE="apache2"
    APACHE_CONF="/etc/apache2/sites-available/istrac-sims.conf"
    LOG_DIR="/var/log/apache2"
    MODULE_CMD="a2enmod"
else
    APACHE_SERVICE="httpd"
    APACHE_CONF="/etc/httpd/conf.d/istrac-sims.conf"
    LOG_DIR="/var/log/httpd"
    MODULE_CMD=""
fi

if [[ ! -f "${APACHE_CONF}" ]]; then
    echo -e "${YELLOW}Warning: ${APACHE_CONF} not found. Creating VirtualHost from scratch...${NC}"
fi

# ------------------------------------------------------------------------------
# 2. UPDATE APACHE VIRTUALHOST
# ------------------------------------------------------------------------------
PROTO="http"
[[ "${SSL_MODE}" != "none" ]] && PROTO="https"

cat <<APACHE_CONF_EOF > "${APACHE_CONF}"
<VirtualHost *:80>
    ServerName ${DOMAIN}
    ServerAlias www.${DOMAIN}
    ServerAdmin admin@${DOMAIN}
    DocumentRoot "/opt/istrac-fms/frontend/dist"
    LimitRequestBody 104857600

    Header always set X-Frame-Options "SAMEORIGIN"
    Header always set X-Content-Type-Options "nosniff"
    Header always set X-XSS-Protection "1; mode=block"
    Header always set Referrer-Policy "strict-origin-when-cross-origin"

    <IfModule mod_deflate.c>
        AddOutputFilterByType DEFLATE text/plain text/html text/xml text/css application/javascript application/json image/svg+xml
    </IfModule>

    <Directory "/opt/istrac-fms/frontend/dist/assets">
        <IfModule mod_expires.c>
            ExpiresActive On
            ExpiresDefault "access plus 1 year"
        </IfModule>
        Header set Cache-Control "public, max-age=31536000, immutable"
    </Directory>

    ProxyPreserveHost On
    ProxyRequests Off
    ProxyTimeout 120
    RequestHeader set X-Forwarded-Proto "${PROTO}"

    RewriteEngine On
    RewriteCond %{HTTP:Upgrade} =websocket [NC]
    RewriteCond %{HTTP:Connection} upgrade [NC]
    RewriteRule ^/ws/(.*)           ws://127.0.0.1:3000/ws/\$1 [P,L]
    RewriteRule ^/ws/?$             ws://127.0.0.1:3000/ws [P,L]

    ProxyPass        /api http://127.0.0.1:3000/api retry=0 timeout=120
    ProxyPassReverse /api http://127.0.0.1:3000/api

    ProxyPass        /media http://127.0.0.1:3000/media retry=0 timeout=60
    ProxyPassReverse /media http://127.0.0.1:3000/media

    <Directory "/opt/istrac-fms/frontend/dist">
        Options Indexes FollowSymLinks
        AllowOverride All
        Require all granted
        RewriteEngine On
        RewriteBase /
        RewriteRule ^index\.html$ - [L]
        RewriteCond %{REQUEST_FILENAME} !-f
        RewriteCond %{REQUEST_FILENAME} !-d
        RewriteRule . /index.html [L]
    </Directory>

    ErrorLog ${LOG_DIR}/istrac-sims-error.log
    CustomLog ${LOG_DIR}/istrac-sims-access.log combined
</VirtualHost>
APACHE_CONF_EOF

if [[ $IS_DEBIAN -eq 1 ]]; then
    a2enmod proxy proxy_http proxy_wstunnel rewrite headers deflate expires 2>/dev/null || true
    a2ensite istrac-sims.conf 2>/dev/null || true
fi

# ------------------------------------------------------------------------------
# 3. CONFIGURE SSL IF REQUESTED
# ------------------------------------------------------------------------------
if [[ "${SSL_MODE}" == "selfsigned" ]]; then
    echo -e "${CYAN}Generating 2048-bit self-signed SSL certificate for ${DOMAIN}...${NC}"
    mkdir -p /etc/ssl/certs /etc/ssl/private
    openssl req -x509 -nodes -days 3650 -newkey rsa:2048 \
        -keyout /etc/ssl/private/istrac-selfsigned.key \
        -out /etc/ssl/certs/istrac-selfsigned.crt \
        -subj "/C=IN/ST=Karnataka/L=Bengaluru/O=ISRO/OU=ISTRAC/CN=${DOMAIN}"

    if [[ $IS_DEBIAN -eq 1 ]]; then
        a2enmod ssl 2>/dev/null || true
    fi

    cat <<SSL_CONF_EOF >> "${APACHE_CONF}"

<VirtualHost *:443>
    ServerName ${DOMAIN}
    ServerAlias www.${DOMAIN}
    ServerAdmin admin@${DOMAIN}
    DocumentRoot "/opt/istrac-fms/frontend/dist"
    LimitRequestBody 104857600

    SSLEngine on
    SSLCertificateFile /etc/ssl/certs/istrac-selfsigned.crt
    SSLCertificateKeyFile /etc/ssl/private/istrac-selfsigned.key

    Header always set X-Frame-Options "SAMEORIGIN"
    Header always set X-Content-Type-Options "nosniff"
    Header always set X-XSS-Protection "1; mode=block"
    Header always set Referrer-Policy "strict-origin-when-cross-origin"

    ProxyPreserveHost On
    ProxyRequests Off
    ProxyTimeout 120
    RequestHeader set X-Forwarded-Proto "https"

    RewriteEngine On
    RewriteCond %{HTTP:Upgrade} =websocket [NC]
    RewriteCond %{HTTP:Connection} upgrade [NC]
    RewriteRule ^/ws/(.*)           ws://127.0.0.1:3000/ws/\$1 [P,L]
    RewriteRule ^/ws/?$             ws://127.0.0.1:3000/ws [P,L]

    ProxyPass        /api http://127.0.0.1:3000/api retry=0 timeout=120
    ProxyPassReverse /api http://127.0.0.1:3000/api

    ProxyPass        /media http://127.0.0.1:3000/media retry=0 timeout=60
    ProxyPassReverse /media http://127.0.0.1:3000/media

    <Directory "/opt/istrac-fms/frontend/dist">
        Options Indexes FollowSymLinks
        AllowOverride All
        Require all granted
        RewriteEngine On
        RewriteBase /
        RewriteRule ^index\.html$ - [L]
        RewriteCond %{REQUEST_FILENAME} !-f
        RewriteCond %{REQUEST_FILENAME} !-d
        RewriteRule . /index.html [L]
    </Directory>

    ErrorLog ${LOG_DIR}/istrac-sims-ssl-error.log
    CustomLog ${LOG_DIR}/istrac-sims-ssl-access.log combined
</VirtualHost>
SSL_CONF_EOF

elif [[ "${SSL_MODE}" == "letsencrypt" ]]; then
    echo -e "${CYAN}Installing Certbot and generating free Let's Encrypt certificate...${NC}"
    if [[ $IS_DEBIAN -eq 1 ]]; then
        apt-get update -y && apt-get install -y certbot python3-certbot-apache
    else
        dnf install -y certbot python3-certbot-apache || true
    fi
    certbot --apache -d "${DOMAIN}" --non-interactive --agree-tos --register-unsafely-without-email --redirect || {
        echo -e "${YELLOW}Notice: Certbot interactive configuration may be required if DNS is not yet propagated.${NC}"
        certbot --apache -d "${DOMAIN}" || true
    }
fi

# ------------------------------------------------------------------------------
# 4. UPDATE BACKEND .env CORS & APP_URL
# ------------------------------------------------------------------------------
ENV_FILE="${INSTALL_DIR}/backend/.env"
if [[ -f "${ENV_FILE}" ]]; then
    echo -e "${CYAN}Updating backend .env with allowed origin: ${PROTO}://${DOMAIN}...${NC}"
    
    # Update APP_URL
    if grep -q '^APP_URL=' "${ENV_FILE}"; then
        sed -i "s|^APP_URL=.*|APP_URL=${PROTO}://${DOMAIN}|g" "${ENV_FILE}"
    else
        echo "APP_URL=${PROTO}://${DOMAIN}" >> "${ENV_FILE}"
    fi

    # Update ALLOWED_ORIGINS to include new domain
    EXISTING_ORIGINS=$(grep '^ALLOWED_ORIGINS=' "${ENV_FILE}" | cut -d '=' -f2- || echo "")
    NEW_ORIGINS="${PROTO}://${DOMAIN},http://${DOMAIN},http://localhost,http://127.0.0.1"
    if [[ -n "${EXISTING_ORIGINS}" ]]; then
        # Merge without duplicate
        NEW_ORIGINS="${EXISTING_ORIGINS},${PROTO}://${DOMAIN},http://${DOMAIN}"
    fi
    sed -i "s|^ALLOWED_ORIGINS=.*|ALLOWED_ORIGINS=${NEW_ORIGINS}|g" "${ENV_FILE}"
fi

# ------------------------------------------------------------------------------
# 5. RESTART SERVICES
# ------------------------------------------------------------------------------
echo -e "${CYAN}Testing Apache syntax and restarting services...${NC}"
if [[ $IS_DEBIAN -eq 1 ]]; then
    apache2ctl configtest
else
    httpd -t
fi

systemctl restart "${APACHE_SERVICE}"
systemctl restart istrac-backend 2>/dev/null || true

echo ""
echo -e "${GREEN}${BOLD}==============================================================================${NC}"
echo -e "${GREEN}${BOLD} ✅ DOMAIN ROUTING SETUP COMPLETE!${NC}"
echo -e "${GREEN}${BOLD}==============================================================================${NC}"
echo -e " • Domain:       ${CYAN}${PROTO}://${DOMAIN}${NC}"
echo -e " • Web Server:   ${GREEN}${APACHE_SERVICE} active${NC}"
echo -e " • Backend API:  ${GREEN}istrac-backend active (Port 3000)${NC}"
echo -e " • CORS Origins: Allowed for ${CYAN}${PROTO}://${DOMAIN}${NC}"
echo ""
echo -e "${BOLD}Next Step (DNS):${NC}"
echo -e " Ensure an DNS A Record points '${DOMAIN}' to your server IP: $(hostname -I | awk '{print $1}')"
echo -e "${GREEN}==============================================================================${NC}"
