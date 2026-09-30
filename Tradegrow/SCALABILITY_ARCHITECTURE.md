# SCALABILITY_ARCHITECTURE.md — Horizontal Scaling & Capacity Architecture

**Platform**: Trade Grow (Stocksharp Multi-User Brokerage & Paper Trading System)  
**Author**: Senior Principal FinTech & Distributed Systems Architect  
**Status**: Production Architecture Blueprint (Version 1.0)

---

## 1. Primary Objectives & Horizontal Scalability Strategy

The Trade Grow scalability architecture establishes a modular, stateless multi-tier model designed to handle:
* **Initial baseline**: 50–100 active concurrent users.
* **Target scale**: 1,000–5,000 concurrent active traders.
* **Throughput**: 10,000+ API requests per minute.
* **Market Data**: 5,000+ ticks/sec during volatile market opens and expiry days.
* **WebSocket Connections**: 5,000+ persistent bi-directional streams.
* **Zero Financial Drift**: 100% ACID consistency for ledger, orders, positions, and margins.

---

## 2. Tiered Scaling Topology

```
                                    INTERNET
                                       │
                                       ▼
                       [ Cloudflare / WAF / Edge DNS ]
                                       │
                                       ▼
                     [ NGINX High-Performance Load Balancer ]
                        ├── TLS Termination & HTTP/2
                        ├── Rate Limiting Zones (Auth, Orders, Public)
                        ├── Least-Connection Load Balancing
                        └── Health Check Failover
                                       │
        ┌──────────────────────────────┼──────────────────────────────┐
        ▼                              ▼                              ▼
  [ App Node 1 ]                [ App Node 2 ]                 [ App Node 3 ]
  (Port 5001 - Stateless)       (Port 5002 - Stateless)        (Port 5003 - Stateless)
  ├── REST APIs (Public/Auth)   ├── REST APIs (Public/Auth)    ├── REST APIs (Public/Auth)
  ├── Distributed Idempotency   ├── Distributed Idempotency    ├── Distributed Idempotency
  └── Fast Token Auth Cache     └── Fast Token Auth Cache      └── Fast Token Auth Cache
        │                              │                              │
        └──────────────────────────────┼──────────────────────────────┘
                                       │
        ┌──────────────────────────────┴──────────────────────────────┐
        ▼                                                             ▼
  [ Dedicated WS Cluster ]                                      [ Background & OMS Worker ]
  ├── WS Gateway 1 (Port 5101)                                  ├── Order Matching Loop (Leader)
  ├── WS Gateway 2 (Port 5102)                                  ├── Reconciliation Monitor (60s)
  └── Redis Pub/Sub Subscriptions                               ├── EOD Settlement & Token Refresh
        │                                                             │
        └──────────────────────────────┬──────────────────────────────┘
                                       │
                ┌──────────────────────┴──────────────────────┐
                ▼                                             ▼
       [ Redis 7 Cluster ]                            [ PgBouncer Pooler ]
       ├── Key Namespace Isolation                    ├── Transaction Pooling
       ├── Distributed Locks (`lock:order:*`)         ├── Max 100 client connections
       ├── Rate Limiting Counters                     └── Fail-fast query timeouts
       └── Pub/Sub (`market:ticks`, `admin:events`)           │
                                                              ▼
                                                     [ PostgreSQL 16 / TimescaleDB ]
                                                     ├── Primary: ACID Orders, Wallets, Ledger
                                                     └── Read Replica (Configured for Analytics)
```

---

## 3. Capacity & Resource Matrix

| Scaling Tier | Concurrent Users | App Nodes | WS Nodes | Workers | Redis Memory | PostgreSQL Config | PgBouncer Pool |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Tier 1 (Current)** | 50 – 100 | 1 Node (2GB) | Co-located | Co-located | 512 MB | 2 vCPU / 4GB RAM | Direct (max 20) |
| **Tier 2 (Recommended)** | 250 – 1,000 | 2 Nodes (4GB ea) | 2 Nodes (2GB ea) | 1 Worker (2GB) | 2 GB | 4 vCPU / 8GB RAM | PgBouncer (pool 50) |
| **Tier 3 (High-Load)** | 1,000 – 5,000 | 4 Nodes (8GB ea) | 4 Nodes (4GB ea) | 2 Workers (4GB) | 4 GB | 8 vCPU / 16GB RAM | PgBouncer (pool 100) + Read Replica |

---

## 4. Auto-Scaling & Metric Thresholds

Trading systems require multi-dimensional thresholds factoring in **queue depth, connection saturation, and matching latency**:

```
Normal Operational State:
  - CPU Utilization: < 60%
  - Memory Utilization: < 70%
  - API P95 Latency: < 150ms
  - DB Connection Pool: < 50% capacity
  - WS Delivery Latency: < 50ms

Warning State:
  - CPU Utilization: 60% – 75%
  - Memory Utilization: 70% – 80%
  - API P95 Latency: 150ms – 300ms
  - DB Pool Utilization: 50% – 75%
  - Action: Trigger scale-out alert; prepare next Node instance.

Scale-Out Trigger State:
  - CPU Utilization > 75% for 3 consecutive 1-minute windows
  - OR Active WebSocket Connections > 800 per gateway instance
  - OR DB Pool Active Connections > 80%
  - OR Order Matching Queue Lag > 500ms
  - Action: Automatically provision / spin up additional App/WS Node.

Critical State:
  - CPU Utilization > 90%
  - OR Redis Memory > 90%
  - OR DB Connection Exhaustion / Lock Timeout Spikes
  - Action: Activate Graceful Load Shedding (degrade non-essential analytics, prioritize OMS/RMS).
```

---

## 5. Stateless Application Server Design

To allow seamless horizontal scaling across `broker-api-1`, `broker-api-2`, ..., `broker-api-N`:
1. **No In-Process User Sessions**: All user sessions are authenticated via self-contained JWT tokens verified against the centralized `JWT_SECRET` and user status in database/Redis cache.
2. **Centralized Ephemeral State**: All market ticks, option Greeks, and active subscriptions are synchronized through Redis Pub/Sub.
3. **Distributed Order Deduplication**: Order idempotency is acquired in Redis before execution, preventing parallel submission races across nodes.
4. **Isolated Static Asset Serving**: Frontend bundles are served with HTTP immutable caching headers directly from Nginx or static CDN, avoiding Node.js static file I/O overhead.
