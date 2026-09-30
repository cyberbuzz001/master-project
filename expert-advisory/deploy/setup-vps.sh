#!/usr/bin/env bash
# ==============================================================================
# Expert Stocks Consultancy — Production Server Provisioning Script
# Target OS: Ubuntu 24.04 LTS (x86_64)
# Run as root: sudo bash deploy/setup-vps.sh
# ==============================================================================

set -euo pipefail

APP_USER="expertstocks"
APP_DIR="/srv/expertstocks"
PHP_VERSION="8.3"
NODE_VERSION="22"

echo "=========================================================="
echo " Starting Expert Stocks Production Server Setup"
echo " Time: $(date -u '+%Y-%m-%d %H:%M:%S UTC')"
echo "=========================================================="

# 1. System Updates & Core Tools
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get upgrade -y
apt-get install -y --no-install-recommends \
    curl wget git unzip zip ca-certificates gnupg lsb-release \
    software-properties-common ufw fail2ban supervisor htop \
    acl zstd age restic jq

# 2. Add PHP Ondřej Surý PPA
if ! grep -q "ondrej/php" /etc/apt/sources.list /etc/apt/sources.list.d/* 2>/dev/null; then
    add-apt-repository -y ppa:ondrej/php
    apt-get update -y
fi

# 3. Install PHP 8.3 and Required Extensions
apt-get install -y --no-install-recommends \
    php${PHP_VERSION}-fpm \
    php${PHP_VERSION}-cli \
    php${PHP_VERSION}-common \
    php${PHP_VERSION}-mysql \
    php${PHP_VERSION}-sqlite3 \
    php${PHP_VERSION}-mbstring \
    php${PHP_VERSION}-xml \
    php${PHP_VERSION}-curl \
    php${PHP_VERSION}-zip \
    php${PHP_VERSION}-bcmath \
    php${PHP_VERSION}-intl \
    php${PHP_VERSION}-gd \
    php${PHP_VERSION}-opcache \
    php${PHP_VERSION}-readline \
    php${PHP_VERSION}-redis

# 4. Install Composer 2
if ! command -v composer &> /dev/null; then
    curl -sS https://getcomposer.org/installer | php -- --install-dir=/usr/local/bin --filename=composer
fi

# 5. Install Node.js 22 LTS
if ! command -v node &> /dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x | bash -
    apt-get install -y nodejs
fi

# 6. Install MySQL 8 & Redis 7
apt-get install -y mysql-server redis-server

# Configure Redis password & binding
sed -i 's/^bind .*/bind 127.0.0.1 ::1/' /etc/redis/redis.conf
systemctl enable --now redis-server

# 7. Install Nginx & Certbot
apt-get install -y nginx certbot python3-certbot-nginx

# 8. Create Dedicated Deployment User & Directory Hierarchy
if ! id -u "$APP_USER" &>/dev/null; then
    useradd -m -s /bin/bash "$APP_USER"
    usermod -aG www-data "$APP_USER"
fi

mkdir -p "$APP_DIR"/{releases,shared,backups}
mkdir -p "$APP_DIR"/shared/backend/{storage,storage/app/private,storage/framework/{cache,sessions,views},storage/logs}
mkdir -p "$APP_DIR"/shared/frontend

chown -R "$APP_USER":"$APP_USER" "$APP_DIR"
chmod -R 775 "$APP_DIR"/shared/backend/storage
setfacl -R -m u:www-data:rwx "$APP_DIR"/shared/backend/storage || true
setfacl -R -d -m u:www-data:rwx "$APP_DIR"/shared/backend/storage || true

# 9. Configure PHP-FPM Pool
FPM_POOL="/etc/php/${PHP_VERSION}/fpm/pool.d/${APP_USER}.conf"
cat <<EOF > "$FPM_POOL"
[${APP_USER}]
user = ${APP_USER}
group = www-data
listen = /run/php/php${PHP_VERSION}-fpm-${APP_USER}.sock
listen.owner = www-data
listen.group = www-data
listen.mode = 0660

pm = dynamic
pm.max_children = 20
pm.start_servers = 4
pm.min_spare_servers = 2
pm.max_spare_servers = 8
pm.max_requests = 1000

php_admin_value[memory_limit] = 512M
php_admin_value[upload_max_filesize] = 20M
php_admin_value[post_max_size] = 25M
php_admin_value[max_execution_time] = 60
php_admin_value[expose_php] = Off
php_admin_flag[opcache.enable] = on
EOF

systemctl restart php${PHP_VERSION}-fpm

# 10. Configure Cloudflare Real-IP Restoration snippet
mkdir -p /etc/nginx/snippets
curl -s https://www.cloudflare.com/ips-v4 | sed -e 's/^/set_real_ip_from /' -e 's/$/;/' > /etc/nginx/snippets/cloudflare-real-ip.conf
curl -s https://www.cloudflare.com/ips-v6 | sed -e 's/^/set_real_ip_from /' -e 's/$/;/' >> /etc/nginx/snippets/cloudflare-real-ip.conf
echo "real_ip_header CF-Connecting-IP;" >> /etc/nginx/snippets/cloudflare-real-ip.conf

# 11. Security Hardening: UFW Firewall & Fail2ban
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp comment 'SSH'
ufw allow 80/tcp comment 'HTTP'
ufw allow 443/tcp comment 'HTTPS'
ufw --force enable

systemctl enable --now fail2ban

echo "=========================================================="
echo " Server Provisioning Complete!"
echo " Directory: $APP_DIR"
echo " Deploy user: $APP_USER"
echo " Next step: Configure /srv/expertstocks/shared/backend/.env"
echo " and deploy via deploy/deploy.sh"
echo "=========================================================="
