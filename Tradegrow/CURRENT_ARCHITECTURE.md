# CURRENT_ARCHITECTURE.md — Comprehensive System Audit & Baseline Architecture

**Platform**: Trade Grow (Stocksharp Multi-User Brokerage & Paper Trading System)  
**Author**: Senior Principal FinTech & Distributed Systems Architect  
**Audit Date**: August 2026  
**Status**: Production Baseline Audit (Version 1.0)

---

## 1. Executive Summary & Current Architecture Overview

Trade Grow is a multi-user stock brokerage simulation and paper trading platform built on a TypeScript/Node.js backend with Express, a React 19 Single Page Application (SPA), a Python 3.11+ FastAPI Options Math Engine (`py_vollib`), PostgreSQL 16 (with TimescaleDB extension), and Redis 7 (caching and pub/sub).

The platform simulates exchange order execution (NSE, BSE, NFO, BFO, MCX) against live real-time market data feeds (Dhan API v2, Angel One SmartAPI, TrueData, and synthetic fallbacks) with strict pre-trade risk management (RMS), virtual capital ledger accounting, SPAN margin calculations, and real-time position/P&L calculations.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           CLIENT LAYER (React 19 SPA)                       │
│  - Groww-style Terminal & Charts (Lightweight Charts 4.2)                   │
│  - REST API Client (Native fetch) | Real-time WebSocket Client (/ws)        │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                     APPLICATION GATEWAY (Single Node.js 22 Process)         │
│  - Express 4.21 REST Server (Port 5000)                                     │
│  - WebSocket Server Gateway (/ws) (ws 8.18)                                 │
│  - Security: Helmet.js, CORS, express-rate-limit, JWT + Argon2id            │
└───────┬──────────────────────────────┼──────────────────────────────┬───────┘
        │                              │                              │
        ▼                              ▼                              ▼
┌──────────────────────┐    ┌──────────────────────┐    ┌──────────────────────┐
│  MARKET DATA ENGINE  │    │    TRADING ENGINE    │    │  OPTIONS MATH ENGINE │
│ - DhanAdapter (WS)   │    │ - OMS (Order Mgmt)   │    │ - Python FastAPI     │
│ - AngelOneAdapter    │    │ - RMS (Risk Mgmt)    │    │ - Port 8000          │
│ - TrueData / Mock    │    │ - ExecutionEngine    │    │ - py_vollib Greeks   │
│ - Token Normalizer   │    │ - PortfolioService   │    │ - Black-Scholes Calc │
│ - In-Memory Cache    │    │ - VirtualWallet      │    └──────────────────────┘
└───────┬──────────────┘    └──────────┬───────────┘
        │                              │
        ▼                              ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                            PERSISTENCE & SHARED STATE                       │
│  - PostgreSQL 16 (TimescaleDB) — pg Pool (max 20 connections)               │
│  - Redis 7 (Alpine) — `ioredis` (maxmemory 512MB, LRU eviction)             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Current Data Flow

### 2.1 Market Data Flow
1. External exchange provider (e.g. Dhan WebSocket or Angel One SmartAPI) receives market ticks from exchange servers.
2. Market data provider emits `MarketTick` into `MarketDataEngine`.
3. `MarketDataEngine` updates local memory Map (`tickCache`) and asynchronously calls `redis.set('tick:' + token, json, 3600)` and `redis.publish('market:ticks', json)`.
4. `MarketDataEngine.onTick` callback notifies `setupWebSocketServer`.
5. `setupWebSocketServer` iterates through all open client connections on the server instance (`wss.clients.forEach`), checks client subscription Set, checks backpressure (`bufferedAmount > 1MB`), and sends JSON payload via `client.send()`.
6. React frontend receives WebSocket tick, accumulates ticks in `pendingTicksRef`, and flushes to state on browser animation frame (~16ms) via `requestAnimationFrame`.

### 2.2 Order Lifecycle & Financial Settlement Flow
1. User clicks **Buy/Sell** in the UI.
2. Frontend sends `POST /api/v1/orders` with JWT token and `Idempotency-Key` header.
3. Express router validates body with Zod `SubmitOrderSchema` and verifies user KYC status.
4. `OMS.submitOrder` executes:
   - Queries DB for existing order with identical `idempotency_key` and `user_id`.
   - Calls `RMS.validateOrder`: checks contract expiration, user buying power, instrument activity, and max quantity limits.
   - `VirtualWalletLedger.blockMargin`: executes `SELECT ... FOR UPDATE` on `virtual_wallets`, verifies `buying_power >= required_margin`, updates `used_margin`, and appends a `MARGIN_BLOCK` entry to `wallet_ledger`.
   - Inserts order row into `orders` table with status `ACCEPTED`.
   - Appends order transition event to `order_events`.
5. `ExecutionEngine` runs on a 500ms `setInterval` matching loop:
   - Queries `SELECT * FROM orders WHERE status IN ('ACCEPTED', 'PENDING') LIMIT 50`.
   - Checks live cached tick from `MarketDataEngine`.
   - Checks limit/stop-loss condition against tick LTP/bid/ask.
   - If condition is met, updates status to `EXECUTING` (claim guard), creates `executions` trade fill record, updates `orders` status to `FILLED`, calls `PortfolioService.recordExecutionInTransaction`, and settles P&L/capital in `VirtualWalletLedger.settleTradeExecutionInTransaction` within a single ACID transaction.

---

## 3. Current Server Dependencies

| Service / Process | Runtime / Image | Port | Description |
| :--- | :--- | :--- | :--- |
| **tradegrow_app** | Node.js 22 Alpine | 5000 | Express HTTP Server, WebSocket Gateway, Trading Engine, Market Data Engine, Frontend Static Server |
| **tradegrow_python_engine** | Python 3.11+ / FastAPI | 8000 | Black-Scholes Greeks, Implied Volatility (IV), Options pricing engine |
| **tradegrow_postgres** | timescale/timescaledb:latest-pg16 | 5432 | Primary ACID database storing users, orders, trades, positions, wallets, ledger |
| **tradegrow_redis** | redis:7-alpine | 6379 | In-memory key-value cache, pub/sub messaging, rate limiting |
| **Nginx Reverse Proxy** | Nginx 1.24+ | 80/443 | TLS termination, gzip, rate limiting, request forwarding to port 5000 |

---

## 4. Current Database Dependencies

* **Driver**: Node `pg` (version 8.22.0) with custom `createPool()` wrapper in `server/src/db/pool.ts`.
* **Connection Pool Config**:
  - Max pool size: 20 connections (`PG_POOL_MAX` default: 20).
  - Idle timeout: 30,000 ms.
  - Connection timeout: 10,000 ms.
  - Keep-Alive initial delay: 10,000 ms.
* **Schema & Migrations**: 18 sequential SQL migration files (`001_initial_schema.sql` to `017_*.sql`) managed by custom schema runner with idempotent checks.
* **Key Tables**:
  - `users`: Core identity, roles, statuses, Argon2id password hashes.
  - `virtual_wallets`: User balances (`cash_balance`, `used_margin`, `realized_pnl`, `unrealized_pnl`).
  - `wallet_ledger`: Immutable append-only financial journal.
  - `orders`: Order state records with unique `idempotency_key` and state check constraints.
  - `executions`: Trade fills with tick provenance metadata.
  - `positions`: Aggregated user position book (net quantities and average prices).
  - `holdings`: CNC delivery investment holdings.
  - `instruments`: Master contract repository (scrip master).
  - `closed_trades`: Completed trade history with realized gross and net P&L.
  - `login_sessions`, `order_events`, `kyc_applications`, `support_tickets`.

---

## 5. Current WebSocket Architecture

* **Server Implementation**: `ws` package (version 8.18.0) running on HTTP upgrade at path `/ws`.
* **Authentication**: Query parameter token (`/ws?token=<jwt>`). Unauthenticated connections are allowed for public market tick data.
* **Subscription Management**: Per-connection `Set<string>` of instrument tokens. Default tokens automatically subscribed (`NSE_NIFTY50`, `NSE_BANKNIFTY`, `NSE_RELIANCE`, etc.). Max 1,000 tokens per client.
* **Broadcasting Mechanism**: Direct in-memory event listener `MarketDataEngine.getInstance().onTick()`. When a tick arrives, it loops through `wss.clients`, checks if the client is subscribed to the token or its aliases, and calls `ws.send(payload)`.
* **Backpressure**: Checks `client.bufferedAmount > 1024 * 1024` (1MB). If exceeded, the frame is dropped.
* **Heartbeat**: 30-second ping/pong sweep terminating unresponsive sockets (`isAlive === false`).

---

## 6. Current Market-Data Architecture

* **Engine Core**: `MarketDataEngine` singleton managing multiple provider adapters.
* **Configured Active Provider**: Dhan API v2 (Primary) with Angel One SmartAPI, TrueData, AlphaVantage, and MockMarketDataProvider fallback.
* **Market Hours Guard**: `MarketDataEngine.isMarketHours()` evaluates 9:15 AM - 3:30 PM IST (Mon-Fri) with `ALLOW_OFF_MARKET_LIVE_DATA` override.
* **Dual-Feed Spot Guard**: `NseOptionChainService` queries NSE live indices every 30s to verify spot prices against broker ticks.
* **Reconciliation Monitor**: `ReconciliationMonitorService` checks cached tick values against live reference quotes every 60s.

---

## 7. Current Order Flow

```
User Action: Submit Order
  │
  ▼
[ Express Router /api/v1/orders ]
  │  ├── Rate Limiter (30 orders/min per user)
  │  ├── Zod Schema Validation
  │  └── KYC Completion Check
  │
  ▼
[ OMS.submitOrder ]
  │  ├── Idempotency Check (SELECT FROM orders WHERE idempotency_key = $1)
  │  │
  │  ├── RMS.validateOrder
  │  │     ├── Contract Expiry Check (Instrument non-expired)
  │  │     ├── Quantity & Max Order Value Limit Check
  │  │     ├── Position Reduction / Square-off Check
  │  │     └── SPAN / Exposure Margin Calculation (MarginEngineService)
  │  │
  │  ├── VirtualWalletLedger.blockMargin
  │  │     └── SELECT * FROM virtual_wallets WHERE user_id = $1 FOR UPDATE
  │  │         ├── Check buyingPower >= requiredMargin
  │  │         ├── UPDATE virtual_wallets SET used_margin = used_margin + $1
  │  │         └── INSERT INTO wallet_ledger (MARGIN_BLOCK)
  │  │
  │  ├── INSERT INTO orders (status = 'ACCEPTED')
  │  └── INSERT INTO order_events (to_status = 'ACCEPTED')
  │
  ▼
[ ExecutionEngine Matching Loop (Every 500ms) ]
     ├── SELECT * FROM orders WHERE status IN ('ACCEPTED', 'PENDING')
     ├── Compare Target Price with Live Tick LTP / Bid / Ask
     ├── UPDATE orders SET status = 'EXECUTING' (Atomic Claim Guard)
     │
     └── withTransaction(async (client) => {
           ├── INSERT INTO executions (Trade fill record with provenance)
           ├── UPDATE orders SET status = 'FILLED', average_price = $1
           ├── INSERT INTO order_events (to_status = 'FILLED')
           ├── PortfolioService.recordExecutionInTransaction (Update net_qty, average_price)
           ├── INSERT INTO closed_trades (if position closed/reduced)
           └── VirtualWalletLedger.settleTradeExecutionInTransaction (Release margin, settle P&L)
         })
```

---

## 8. Current Position & P&L Flow

* **Positions**: Maintained in `positions` table with unique constraint on `(user_id, symbol, product_type)`.
* **Execution Updates**: Handled atomically in `PortfolioService.recordExecutionInTransaction`:
  - Adding to position calculates weighted average entry price.
  - Partial exit or full exit calculates realized P&L delta and inserts into `closed_trades`.
  - Flipping position (Long to Short or Short to Long) splits closed volume and re-anchors remaining quantity at execution price.
* **Unrealized P&L Calculation**: Calculated dynamically when querying positions via `PortfolioService.getUserPositions` by comparing entry `average_price` against current live `ltp` from `MarketDataEngine`.

---

## 9. Current Redis Usage

* **Configuration**: Standalone Redis 7 container with 512MB max memory and `allkeys-lru` eviction policy.
* **Keys Used**:
  - `tick:{instrumentToken}`: JSON serialized tick object, TTL 3600s.
* **Pub/Sub Channels**:
  - `market:ticks`: Published on every new tick from market data adapters.
* **Fallback**: In-memory `Map<string, { value: string; expiresAt: number }>` if Redis connection is lost or unavailable.

---

## 10. Current API Bottlenecks

1. **Monolithic API & WebSocket Coupling**: A single Node.js process handles compute-heavy REST APIs (such as Admin Executive Dashboard with 20 parallel queries), JSON serialization, and high-frequency WebSocket tick fan-out.
2. **Synchronous Disk I/O in Angel One Adapter**: `AngelOneAdapter` relies on child processes writing JSON files to disk and polling `fs.promises.readFile` every 500ms.
3. **No Connection-Level Query Cache for Static Scrip Master**: Instrument lookup queries run on every order submission rather than relying on memory token maps.

---

## 11. Current Database Bottlenecks

1. **ExecutionEngine Matching Contention**: The matching loop runs every 500ms polling the `orders` table. Under horizontal scaling (multiple instances), each instance runs the poll loop, multiplying DB queries.
2. **Admin Dashboard Query Multiplicity**: `/api/v1/admin/dashboard/executive` runs 20 separate `queryOne` calls concurrently against the transactional database.
3. **Unbounded Connection Count under Horizontal Scaling**: Without a connection proxy (PgBouncer), adding Node.js instances increases DB connection count linearly (`N * 20`), risking PostgreSQL connection limits.

---

## 12. Current Memory & CPU Bottlenecks

1. **Unindexed WebSocket Fan-Out**: Broadcasting ticks by iterating over all open client connections (`wss.clients.forEach`) creates $O(N \times M)$ CPU overhead during high-frequency tick bursts.
2. **Option Chain Greeks Calculation**: Calculating Greeks on every Option Chain request consumes CPU cycles if not cached for the same spot/underlying tick.

---

## 13. Current Connection-Pool Risks

* Direct `pg.Pool` without PgBouncer means 4 app nodes + 2 worker nodes = 120 client connections.
* A spike in slow analytical queries could hold connections in the pool, blocking time-sensitive OMS/RMS order transactions.

---

## 14. Current Single Points of Failure (SPOF)

1. **Single Node Application Container**: If `tradegrow_app` crashes (e.g., uncaught exception or memory limit), both REST and WebSocket traffic immediately fail.
2. **Single Redis Container**: If Redis fails, multi-node pub/sub falls back to isolated in-memory instances.
3. **Single PostgreSQL Container**: Database downtime halts all trading, order execution, and wallet operations.

---

## 15. Current Race-Condition Risks

1. **Idempotency Window**: If two duplicate order requests with the same `idempotency_key` arrive simultaneously at different server nodes, both can pass the initial `SELECT` before the first `INSERT` completes, causing one to throw a database constraint violation instead of gracefully returning the existing order.
2. **Parallel Order Matching**: If multiple instances run the matching loop without a designated leader, multiple workers might attempt to match the same pending order simultaneously.

---

## 16. Current Scalability Limitations

* Vertical ceiling of ~150 concurrent WebSocket users on a single container before Node.js event-loop latency starts degrading tick delivery.
* Inability to run true stateless horizontal replicas without centralized WebSocket fan-out and worker leader election.

---

## 17. Recommended Migration Architecture

To scale from 50–100 to thousands of users without rewriting working financial logic:

```
                          Internet (HTTPS / WSS)
                                    │
                                    ▼
                         [ NGINX Load Balancer ]
                        ├── TLS Termination & HTTP/2
                        ├── Rate Limiting Zones (Auth, Orders, Public)
                        ├── Least-Connection Load Balancing
                        └── Dedicated /ws Proxy Routing
                                    │
            ┌───────────────────────┼───────────────────────┐
            ▼                       ▼                       ▼
    [ App Server 1 ]        [ App Server 2 ]        [ App Server 3 ]
    (Port 5001 - Stateless) (Port 5002 - Stateless) (Port 5003 - Stateless)
            │                       │                       │
            └───────────────────────┼───────────────────────┘
                                    │
            ┌───────────────────────┴───────────────────────┐
            ▼                                               ▼
   [ WebSocket Gateway Cluster ]                   [ OMS Matching Worker ]
   ├── WS Node 1 (Port 5101)                       ├── Dedicated Match Loop (Leader)
   └── WS Node 2 (Port 5102)                       └── Reconciliation & Token Crons
            │                                               │
            └───────────────────────┬───────────────────────┘
                                    │
                     ┌──────────────┴──────────────┐
                     ▼                             ▼
            [ Redis 7 Cluster ]            [ PgBouncer Pooler ]
            ├── Atomic Locks (Idempotency) ├── Max 100 Clients
            ├── Key Namespaces             └── Transaction Pooling
            └── Pub/Sub Fan-Out                            │
                                                           ▼
                                            [ PostgreSQL 16 TimescaleDB ]
                                            ├── Primary (ACID Writes)
                                            └── Read Replica (Analytics)
```
