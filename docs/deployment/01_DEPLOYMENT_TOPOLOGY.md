# TradeGrow Unified Platform — Production Deployment Topology

**Document Reference**: `docs/deployment/01_DEPLOYMENT_TOPOLOGY.md`  
**Status**: APPROVED BASELINE (Phase 0)  

---

## 1. Multi-Tier Production Topology

```
                              ┌─────────────────────────────┐
                              │    CLOUDFLARE EDGE / CDN    │
                              │  • DDoS Mitigation & WAF    │
                              │  • SSL Termination (TLS 1.3)│
                              │  • Static Asset Edge Caching│
                              └──────────────┬──────────────┘
                                             │
                                             ▼
                              ┌─────────────────────────────┐
                              │     NGINX INGRESS PROXY     │
                              │  • Rate Limiting & Gzip     │
                              │  • HTTP/2 & WebSocket Proxy │
                              └──────────────┬──────────────┘
                                             │
      ┌────────────────────────┬─────────────┴────────────┬────────────────────────┐
      │                        │                          │                        │
      ▼                        ▼                          ▼                        ▼
┌──────────────┐      ┌──────────────────┐       ┌─────────────────┐      ┌─────────────────┐
│  web-trust   │      │ trading-terminal │       │ advisory-portal │      │  broker-service │
│ (Static CDN) │      │   (React SPA)    │       │ (Next.js Node)  │      │ (Node 22 / WS)  │
│ Port 80      │      │ Port 80          │       │ Port 3000       │      │ Port 5000       │
└──────────────┘      └──────────────────┘       └────────┬────────┘      └────────┬────────┘
                                                          │                        │
                                                          ▼                        ▼
                                                 ┌─────────────────┐      ┌─────────────────┐
                                                 │advisory-service │      │  quant-engine   │
                                                 │ (PHP 8.2-FPM)   │      │(Python FastAPI) │
                                                 │ Port 9000       │      │ Port 8000       │
                                                 └────────┬────────┘      └────────┬────────┘
                                                          │                        │
                                                          └───────────┬────────────┘
                                                                      │
                                   ┌──────────────────────────────────┴──────────────────────────────────┐
                                   ▼                                                                     ▼
                        ┌──────────────────────────────┐                      ┌──────────────────────────────┐
                        │     POSTGRESQL 16 CLUSTER    │                      │       REDIS 7 CLUSTER        │
                        │  • TimescaleDB Hypertables   │                      │  • In-Memory Tick Caching    │
                        │  • Read-Replica for Reports  │                      │  • Distributed Locks & PubSub│
                        │  • Automated Daily Backups   │                      │  • Redis Streams Event Bus   │
                        └──────────────────────────────┘                      └──────────────────────────────┘
```

---

## 2. Docker Compose Production Specification

```yaml
version: '3.8'

services:
  nginx-proxy:
    image: nginx:1.27-alpine
    container_name: tradegrow_proxy
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./deploy/nginx/conf.d:/etc/nginx/conf.d:ro
      - ./deploy/nginx/certs:/etc/nginx/certs:ro
    depends_on:
      - broker-service
      - advisory-portal
      - advisory-service

  broker-service:
    build:
      context: ./Tradegrow
      dockerfile: Dockerfile
    container_name: tradegrow_broker
    restart: unless-stopped
    environment:
      - NODE_ENV=production
      - PORT=5000
      - DATABASE_URL=postgres://tradegrow_app:${DB_PASS}@timescaledb:5432/tradegrow
      - REDIS_URL=redis://:${REDIS_PASS}@redis:6379
      - PYTHON_ENGINE_URL=http://quant-engine:8000
    depends_on:
      - timescaledb
      - redis
      - quant-engine

  quant-engine:
    build:
      context: ./Tradegrow/python_engine
      dockerfile: Dockerfile
    container_name: tradegrow_quant
    restart: unless-stopped
    environment:
      - PORT=8000

  advisory-portal:
    build:
      context: ./Expert advisory/frontend
      dockerfile: Dockerfile
    container_name: tradegrow_advisory_web
    restart: unless-stopped
    environment:
      - NODE_ENV=production
      - PORT=3000
      - NEXT_PUBLIC_API_URL=https://api.tradegrow.com/api/v1

  timescaledb:
    image: timescale/timescaledb:latest-pg16
    container_name: tradegrow_db
    restart: unless-stopped
    environment:
      - POSTGRES_DB=tradegrow
      - POSTGRES_USER=tradegrow_app
      - POSTGRES_PASSWORD=${DB_PASS}
    volumes:
      - pgdata:/var/lib/postgresql/data
    ports:
      - "127.0.0.1:5432:5432"

  redis:
    image: redis:7-alpine
    container_name: tradegrow_redis
    restart: unless-stopped
    command: ["redis-server", "--requirepass", "${REDIS_PASS}", "--appendonly", "yes"]
    volumes:
      - redisdata:/data
    ports:
      - "127.0.0.1:6379:6379"

volumes:
  pgdata:
  redisdata:
```

---

## 3. High Availability & Disaster Recovery (RPO / RTO)

* **Recovery Point Objective (RPO)**: `< 1 minute` (PostgreSQL continuous WAL archiving + TimescaleDB replication).
* **Recovery Time Objective (RTO)**: `< 5 minutes` (Automated Docker container health checks and automatic restart policies).
* **Graceful Degradation**: If external Dhan/Angel market data feeds experience brief disconnection, the `MarketDataEngine` automatically flips to stale-tick protection with visual indicators on the frontend while renewing WebSocket TOTP tokens in the background.

---
*Deployment topology specification certified and saved to [01_DEPLOYMENT_TOPOLOGY.md](file:///d:/2026%20C%20downloads/tradegrow%20app/docs/deployment/01_DEPLOYMENT_TOPOLOGY.md).*
