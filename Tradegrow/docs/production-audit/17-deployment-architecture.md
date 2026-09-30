# 17 — Deployment Architecture

## Recommended Production Topology

```
                         INTERNET
                            │
                    ┌───────▼────────┐
                    │  Cloudflare /  │
                    │  CDN / DDoS    │
                    └───────┬────────┘
                            │ HTTPS :443
                    ┌───────▼────────┐
                    │  NGINX 1.27    │   ← Not yet configured
                    │  Reverse Proxy │
                    │  TLS Terminator│
                    └───────┬────────┘
                  ┌─────────┴──────────┐
                  │ /api/v1, /ws, /*   │
                  ▼                    ▼
        ┌─────────────────┐   ┌────────────────┐
        │ Node.js :5000   │   │ FastAPI :8000  │
        │ (brokerage-     │   │ (python-engine)│
        │  platform)      │   │                │
        └────────┬────────┘   └────────────────┘
                 │
        ┌────────┴───────────────────────────┐
        │                                    │
        ▼                                    ▼
┌──────────────────┐              ┌──────────────────┐
│ PostgreSQL 16    │              │  Redis 7         │
│ (TimescaleDB)    │              │  (Cache/PubSub)  │
└──────────────────┘              └──────────────────┘
```

## Docker Compose (Current Configuration)

```yaml
Services:
  postgres:     timescale/timescaledb:latest-pg16  port 5433:5432
  redis:        redis:7-alpine                     port 6379:6379
  python-engine: custom Dockerfile                 port 8000:8000
  brokerage-platform: custom Dockerfile            port 5000:5000

Network: trading-net (bridge)
Volumes: pg_data, redis_data
```

## VPS Requirements

| Resource | Minimum | Recommended |
|----------|---------|-------------|
| CPU | 2 vCPU | 4 vCPU |
| RAM | 4 GB | 8 GB |
| Storage | 40 GB SSD | 100 GB SSD |
| Network | 100 Mbps | 1 Gbps |
| OS | Ubuntu 22.04 LTS | Ubuntu 24.04 LTS |

**Estimated monthly cost:** $20–50/month (DigitalOcean/Hetzner/Linode)

## NGINX Configuration (Required — To Be Created)

```nginx
# /etc/nginx/sites-available/stocksharp
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name yourdomain.com www.yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;

    # API + WebSocket proxy
    location /api/ {
        proxy_pass http://localhost:5000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # WebSocket upgrade
    location /ws {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_read_timeout 86400;
    }

    # Frontend SPA (served by Node.js)
    location / {
        proxy_pass http://localhost:5000;
        proxy_set_header Host $host;
    }
}
```

## Startup Commands

### Development
```bash
npm run dev              # Concurrent: server + client + python
npm run dev:server       # Backend only (port 5000)
npm run dev:client       # Frontend only (port 5173)
npm run dev:python       # Python engine (port 8000)
```

### Production Build
```bash
npm run build            # Build server + client
npm run start            # Run production server
```

### Docker Production
```bash
docker compose up -d     # Start all services in background
docker compose logs -f   # Follow logs
docker compose down      # Stop all services
```

### Database
```bash
# Migrations run automatically on server startup
# Manual init:
npm run init-db

# PostgreSQL direct connection:
docker exec -it stocksharp_postgres psql -U stocksharp -d stocksharp
```

## Environment Variables for Production

**REQUIRED to set before deployment:**

```bash
# Security
NODE_ENV=production
JWT_SECRET=<generate: openssl rand -hex 64>
JWT_REFRESH_SECRET=<generate: openssl rand -hex 64>

# Database
PG_HOST=postgres
PG_PORT=5432
PG_DATABASE=stocksharp
PG_USER=stocksharp
PG_PASSWORD=<strong password>

# Redis
REDIS_URL=redis://redis:6379

# CORS
ALLOWED_ORIGINS=https://yourdomain.com

# Market Data (choose one)
PRIMARY_MARKET_DATA_PROVIDER=DHAN
DHAN_CLIENT_ID=<your client ID>
DHAN_ACCESS_TOKEN=<your access token>

# Safety (NEVER change to true)
REAL_MONEY_TRADING=false
```

## Health Checks

| Endpoint | Method | Expected Response |
|----------|--------|------------------|
| /api/v1/health/live | GET | 200 OK "OK" |
| /api/v1/health/ready | GET | 200 {ready: true} |
| /api/v1/health | GET | 200 {status: "UP"} |
| /api/v1/health/instruments | GET | 200 {isReady: true} |

## Log Management

| Log Type | Location | Rotation |
|----------|----------|----------|
| Application logs | pino to stdout | Docker logging driver |
| Access logs | pino-http | Docker logging driver |
| DB query logs | PostgreSQL pg_log | Configure in PG |
| Nginx access | /var/log/nginx/ | logrotate |

## Backup Strategy

| Data | Backup Method | Frequency |
|------|-------------|----------|
| PostgreSQL | pg_dump | Daily |
| Redis | RDB snapshot | Every 6h (AOF optional) |
| KYC Documents | Sync to S3 | Real-time |
| Code | Git repository | Per commit |
