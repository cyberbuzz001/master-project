#!/bin/bash
# ============================================================
# Trade Grow — One-Time VPS Setup Script
# Run as root on a fresh Ubuntu 24.04 LTS server:
#   chmod +x setup-vps.sh && ./setup-vps.sh
# ============================================================

set -e

echo "============================================="
echo "  Trade Grow VPS Setup — Ubuntu 24.04 LTS"
echo "============================================="

# Update system
apt-get update -y && apt-get upgrade -y

# Install essentials
apt-get install -y \
  curl wget git ufw fail2ban \
  nginx certbot python3-certbot-nginx \
  htop unzip jq

# ============================================================
# Install Docker Engine
# ============================================================
echo "[1/6] Installing Docker..."
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh
systemctl enable docker
systemctl start docker

# Install Docker Compose plugin
apt-get install -y docker-compose-plugin
echo "Docker version: $(docker --version)"
echo "Docker Compose version: $(docker compose version)"

# ============================================================
# Configure UFW Firewall
# ============================================================
echo "[2/6] Configuring UFW Firewall..."
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp   # SSH
ufw allow 80/tcp   # HTTP (for certbot challenge + redirect)
ufw allow 443/tcp  # HTTPS
# NOTE: Ports 5000, 5432, 6379 are NOT opened — Docker handles them internally
echo "y" | ufw enable
ufw status

# ============================================================
# Configure Fail2ban (brute-force protection)
# ============================================================
echo "[3/6] Configuring Fail2ban..."
cat > /etc/fail2ban/jail.local << 'EOF'
[DEFAULT]
bantime  = 3600
findtime = 600
maxretry = 5

[sshd]
enabled = true
port    = ssh
logpath = %(sshd_log)s
EOF
systemctl enable fail2ban
systemctl restart fail2ban

# ============================================================
# Create App Directory
# ============================================================
echo "[4/6] Creating app directory..."
mkdir -p /opt/tradegrow
cd /opt/tradegrow

# ============================================================
# Configure Nginx (initial config — updated by certbot later)
# ============================================================
echo "[5/6] Configuring Nginx..."
cat > /etc/nginx/sites-available/tradegrow << 'NGINX_CONF'
server {
    listen 80;
    server_name YOUR_DOMAIN.com www.YOUR_DOMAIN.com;

    # Let's Encrypt verification
    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    # Redirect all HTTP to HTTPS
    location / {
        return 301 https://$host$request_uri;
    }
}
NGINX_CONF

ln -sf /etc/nginx/sites-available/tradegrow /etc/nginx/sites-enabled/tradegrow
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx

# ============================================================
# System Tuning for Production
# ============================================================
echo "[6/6] Applying system tuning..."
cat >> /etc/sysctl.conf << 'EOF'

# Trade Grow Production Tuning
net.core.somaxconn = 65535
net.ipv4.tcp_max_syn_backlog = 65535
net.ipv4.ip_local_port_range = 1024 65535
vm.swappiness = 10
EOF
sysctl -p

# Create swap space (2GB) for safety
if [ ! -f /swapfile ]; then
  fallocate -l 2G /swapfile
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

echo ""
echo "============================================="
echo "  ✅ VPS Setup Complete!"
echo "============================================="
echo ""
echo "NEXT STEPS:"
echo "  1. Upload your .env.production file:"
echo "     scp .env.production root@SERVER_IP:/opt/tradegrow/.env"
echo ""
echo "  2. Clone your GitHub repository:"
echo "     cd /opt/tradegrow"
echo "     git clone https://github.com/YOUR_USERNAME/tradegrow.git ."
echo ""
echo "  3. Update Nginx config with your domain:"
echo "     nano /etc/nginx/sites-available/tradegrow"
echo "     (replace YOUR_DOMAIN.com with your actual domain)"
echo ""
echo "  4. Start the application:"
echo "     docker compose up -d --build"
echo ""
echo "  5. Get SSL certificate:"
echo "     certbot --nginx -d YOUR_DOMAIN.com -d www.YOUR_DOMAIN.com"
echo ""
