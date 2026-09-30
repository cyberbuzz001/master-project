# System Integration Architecture Map

## 1. High-Level Data Flow Topology

```mermaid
flowchart TD
    ClientUI["React Frontend (Client & Admin)"] -->|HTTPS / JSON REST API| ExpressGateway["Express API Gateway (:5000)"]
    ClientUI -->|WSS / JSON Messages| WSGateway["WebSocket Gateway (/ws)"]

    ExpressGateway --> AuthMiddleware["Auth & RBAC Middleware (Argon2id + JWT)"]
    AuthMiddleware --> RateLimiter["Zod Validation & Rate Limiter"]

    RateLimiter --> OMS["OMS (Order Management System)"]
    RateLimiter --> RMS["RMS (Risk Management System)"]
    RateLimiter --> WalletLedger["Virtual Wallet Ledger"]

    OMS -->|SELECT FOR UPDATE| PostgreSQL[("PostgreSQL 16 Database")]
    RMS --> PostgreSQL
    WalletLedger --> PostgreSQL

    MarketDataEngine["Market Data Engine"] -->|Fetch Quotes & Candles| AlphaVantage["Alpha Vantage API"]
    MarketDataEngine -->|Cache Ticks & PubSub| Redis[("Redis 7 Cache / PubSub")]
    Redis --> WSGateway
```

---

## 2. Order Execution Architecture

```text
Client Order Ticket / Strategy Builder
    ↓
POST /api/v1/orders (Idempotency-Key)
    ↓
Authentication & Role Verification (JWT)
    ↓
RMS Validation (Margin Check, Limits, Short Sale Rules)
    ↓
Virtual Wallet Ledger (Atomic SELECT FOR UPDATE Margin Lock)
    ↓
PostgreSQL orders Table (Status: ACCEPTED)
    ↓
ExecutionEngine Loop (500ms Matching Cycle)
    ↓
Fill Execution (Status: FILLED)
    ↓
PortfolioService (Positions & Holdings Update)
    ↓
WebSocket Broadcast (ORDER_UPDATE & TRADE_EXECUTION to Client)
```

---

## 3. Live Market Data Architecture

```text
Alpha Vantage Market Provider (1 req/sec throttled)
    ↓
MarketDataEngine Normalizer
    ↓
Redis Key Cache (tick:<token>) & Pub/Sub Channel (market:ticks)
    ↓
WebSocket Gateway Broadcast (/ws)
    ↓
Client Trading Terminal & Option Chain Matrix (Live Update)
```
