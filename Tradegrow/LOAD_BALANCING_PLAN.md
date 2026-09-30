# LOAD_BALANCING_PLAN.md — Reverse Proxy, Traffic Routing & Load Balancing

**Platform**: Trade Grow (Stocksharp Multi-User Brokerage & Paper Trading System)  
**Author**: Senior Principal FinTech & Distributed Systems Architect  
**Status**: Production Specification (Version 1.0)

---

## 1. Load Balancing Strategy

Trade Grow deploys **NGINX** as the primary Layer 7 reverse proxy and load balancer. NGINX manages TLS termination, gzip compression, request sanitization, tiered rate limiting, WebSocket upgrade tunneling, and upstream server distribution using the `least_conn` (least connections) algorithm.

```
                                  INCOMING TRAFFIC
                             (HTTPS :443 / WSS :443)
                                        │
                                        ▼
                   ┌─────────────────────────────────────────┐
                   │          NGINX LOAD BALANCER            │
                   │  ├── SSL/TLS 1.2 & 1.3 Termination      │
                   │  ├── Security Headers & WAF filtering   │
                   │  ├── Zone Rate Limiters                 │
                   │  └── Gzip Compression                   │
                   └────────────────────┬────────────────────┘
                                        │
        ┌───────────────────────────────┴───────────────────────────────┐
        ▼                                                               ▼
[ /api/v1/auth & /api/v1/orders ]                               [ /ws WebSocket Path ]
  - Least-Connection Routing                                      - Persistent WS Upstream Pool
  - Upstream: tradegrow_app_cluster                               - Upstream: tradegrow_ws_cluster
  - Fast failover (1s timeout)                                    - 3600s proxy read timeout
```

---

## 2. Upstream Clusters & Routing Configuration

### 2.1 Upstream Cluster Definitions
```nginx
# Stateless REST API Cluster
upstream tradegrow_api_cluster {
    least_conn;
    server 127.0.0.1:5001 max_fails=3 fail_timeout=10s;
    server 127.0.0.1:5002 max_fails=3 fail_timeout=10s;
    server 127.0.0.1:5003 max_fails=3 fail_timeout=10s backup;
    keepalive 32;
}

# Dedicated Real-Time WebSocket Cluster
upstream tradegrow_ws_cluster {
    least_conn;
    server 127.0.0.1:5101 max_fails=2 fail_timeout=5s;
    server 127.0.0.1:5102 max_fails=2 fail_timeout=5s;
    keepalive 64;
}
```

---

## 3. Tiered Rate Limiting Zones

To protect trading infrastructure during high market volatility while preventing abuse:

| Zone | Path | Rate Limit | Burst | Action on Breach |
| :--- | :--- | :--- | :--- | :--- |
| **`auth_limit`** | `/api/v1/auth/login`, `/api/v1/auth/register` | 5 req/min | 10 | HTTP 429 (`Too Many Requests`) |
| **`order_limit`** | `/api/v1/orders`, `/api/v1/orders/place` | 30 req/min | 10 | HTTP 429 (`Order Rate Limit Exceeded`) |
| **`api_general_limit`**| `/api/v1/*` (Read/Watchlists) | 120 req/min | 60 | HTTP 429 (`API Rate Limit Exceeded`) |
| **`ws_connect_limit`**| `/ws` (Initial handshakes) | 10 conn/min | 5 | Connection refused |

---

## 4. Zero-Downtime Rolling Deployment & Connection Draining

When deploying a new application build to production:

```
Step 1: Mark App Node 1 as draining in NGINX upstream (disable new traffic).
Step 2: Wait 15 seconds for active HTTP requests on Node 1 to finish.
Step 3: Deploy updated container/code to Node 1.
Step 4: Execute /health/ready probe until HTTP 200 OK is returned.
Step 5: Re-enable Node 1 in NGINX upstream.
Step 6: Repeat Steps 1–5 for Node 2, Node 3, and WS gateways sequentially.
```

---

## 5. Health Probes & Automated Upstream Failover

NGINX continuously validates backend nodes using passive health checks (`max_fails=3 fail_timeout=10s`) and active background health monitoring via Docker/Systemd probes:

* **Liveness Probe** (`/api/v1/health/live`): Fast 200 OK check ensuring event loop is unblocked.
* **Readiness Probe** (`/api/v1/health/ready`): Validates PostgreSQL connection and Redis availability.
* **Diagnostics Probe** (`/api/v1/health/dependencies`): Returns JSON health matrix of all database, cache, market data, and Python engine connections.
