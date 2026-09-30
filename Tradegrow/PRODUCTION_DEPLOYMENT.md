# PRODUCTION_DEPLOYMENT.md — Production Deployment Runbook & Infrastructure

**Platform**: Trade Grow (Stocksharp Multi-User Brokerage & Paper Trading System)  
**Author**: Senior Principal DevOps & SRE Engineer  
**Status**: Production Specification (Version 1.0)

---

## 1. Hosting Options & Hardware Sizing

### Option A: Single Strong Dedicated VPS (50 – 250 Users) — *Current Optimal Budget*
* **Specs**: 4 vCPU, 8 GB RAM, 160 GB NVMe SSD, 1 Gbps Network.
* **Services**: NGINX + Docker Compose (`tradegrow_app`, `tradegrow_postgres`, `tradegrow_redis`, `tradegrow_python_engine`).
* **Estimated Cost**: ~$20 – $40/month.

### Option B: Dual Node + Standalone DB (250 – 1,500 Users) — *Recommended Growth*
* **App Node**: 2x VPS (2 vCPU, 4GB RAM ea) running App & WS containers behind NGINX load balancer.
* **Database Node**: 1x VPS (4 vCPU, 8GB RAM, NVMe) running PostgreSQL 16 + PgBouncer + Redis.
* **Estimated Cost**: ~$80 – $120/month.

### Option C: Multi-Server Cluster + Managed Replica (1,500 – 10,000 Users) — *Enterprise Scale*
* **Load Balancer**: HAProxy / NGINX cluster with Cloudflare Enterprise WAF.
* **App Cluster**: 4x Stateless Node.js API servers.
* **WebSocket Cluster**: 2x Dedicated WebSocket Gateway servers.
* **Database**: Managed TimescaleDB Primary + Read Replica.
* **Cache**: Redis Sentinel / Cluster.

---

## 2. Step-by-Step Production Deployment Runbook

### Step 1: Server Provisioning & Firewall Configuration
```bash
# Update system & install Docker
sudo apt update && sudo apt upgrade -y
sudo apt install -y docker.io docker-compose-plugin nginx certbot python3-certbot-nginx

# Configure UFW firewall
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 80/tcp    # HTTP
sudo ufw allow 443/tcp   # HTTPS
sudo ufw enable
```

### Step 2: Clone Codebase & Configure Environment
```bash
git clone <repository_url> /opt/tradegrow
cd /opt/tradegrow
cp .env.production.example .env.production
nano .env.production # Fill in secrets: JWT_SECRET, DHAN_ACCESS_TOKEN, PG_PASSWORD, etc.
```

### Step 3: Launch Production Containers
```bash
docker compose -f docker-compose.production.yml up -d --build
```

### Step 4: Configure NGINX Reverse Proxy & SSL
```bash
sudo cp scripts/nginx.production.conf /etc/nginx/sites-available/tradegrow
sudo ln -sf /etc/nginx/sites-available/tradegrow /etc/nginx/sites-enabled/tradegrow
sudo rm -f /etc/nginx/sites-enabled/default
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com
sudo nginx -t && sudo systemctl reload nginx
```

### Step 5: Verify Deployment Health
```bash
curl -I https://yourdomain.com/api/v1/health/live
curl https://yourdomain.com/api/v1/health/dependencies
```
