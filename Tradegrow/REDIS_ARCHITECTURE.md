# REDIS_ARCHITECTURE.md — In-Memory State, Caching & Pub/Sub

**Platform**: Trade Grow (Stocksharp Multi-User Brokerage & Paper Trading System)  
**Author**: Senior Principal FinTech & Distributed Systems Architect  
**Status**: Production Specification (Version 1.0)

---

## 1. Redis Role in FinTech Architecture

Redis is strictly utilized as a **high-throughput ephemeral cache, distributed lock coordinator, rate-limiting store, and pub/sub message bus**.

> [!IMPORTANT]
> **Financial Consistency Invariant**: Redis is NEVER the authoritative source of financial truth. All user balances, wallets, executions, orders, and ledger entries MUST be committed to PostgreSQL inside ACID transactions.

---

## 2. Standard Key Namespaces & TTL Policy

| Key Namespace | Structure | Purpose | TTL | Eviction Policy |
| :--- | :--- | :--- | :--- | :--- |
| **`tick:{instrumentToken}`** | String (JSON) | Latest LTP, Bid, Ask, Volume for token | 3600s (1h) | volatile-lru |
| **`depth:{instrumentToken}`**| String (JSON) | 5-level market depth matrix | 300s (5m) | volatile-lru |
| **`chain:{underlying}:{exp}`**| String (JSON) | Aggregated Option Chain Greek matrix | 60s (1m) | volatile-lru |
| **`lock:order:{idempotencyKey}`**| String (userId)| Distributed atomic lock for order submission | 10s | noevict (Critical) |
| **`ratelimit:{userId}:{endpoint}`**| Integer | Sliding window request counter | Window Ms | volatile-lru |
| **`user:cache:{userId}`** | Hash | User profile & role cache for fast auth | 300s (5m) | volatile-lru |
| **`scrip:token:{alias}`** | String | Scrip master token alias lookup | 86400s (24h) | volatile-lru |

---

## 3. Redis Pub/Sub vs Redis Streams vs Kafka Decision Matrix

```
┌─────────────────┬───────────────────────────────┬───────────────────────────────┐
│ Technology      │ Best Fit In Trade Grow        │ Architectural Rationale       │
├─────────────────┼───────────────────────────────┼───────────────────────────────┤
│ **Redis Pub/Sub**│ - Real-time market tick feed  │ Extremely low latency (<1ms), │
│                 │ - Admin UI live event pushes  │ zero disk overhead, fire-and- │
│                 │ - Dynamic ticker alerts       │ forget fan-out across WS nodes│
├─────────────────┼───────────────────────────────┼───────────────────────────────┤
│ **Redis Streams**│ - Lightweight audit events    │ Replayable consumer groups,   │
│                 │ - Async background job queue  │ persistence without Kafka     │
│                 │ - KYC document status events  │ operational complexity        │
├─────────────────┼───────────────────────────────┼───────────────────────────────┤
│ **Kafka**       │ - Multi-broker EOD pipelines  │ Overkill for 50-100 users;    │
│                 │ - Exchange-scale OMS logging  │ Recommended at >10,000 users  │
│                 │ - Multi-region data pipelines │ or multi-datacenter clusters  │
└─────────────────┴───────────────────────────────┴───────────────────────────────┘
```

**Decision for Trade Grow (50–5,000 users)**:  
Deploy **Redis Pub/Sub** for live market tick fan-out and **Redis Streams** for async background jobs. Kafka is deferred until multi-datacenter scale (see `KAFKA_ARCHITECTURE.md`).

---

## 4. Distributed Locking & Atomic Idempotency

To prevent race conditions during concurrent order placements:

```typescript
// Acquire distributed lock before pre-trade RMS or margin check
const lockKey = `lock:order:${idempotencyKey}`;
const acquired = await redis.set(lockKey, userId, 'NX', 'EX', 10);

if (!acquired) {
  // Concurrent duplicate request in-flight — query DB for existing order or return 409
  const existingOrder = await queryOne('SELECT order_id FROM orders WHERE idempotency_key = $1', [idempotencyKey]);
  return existingOrder ? { success: true, orderId: existingOrder.order_id } : { success: false, error: 'CONCURRENT_REQUEST_IN_FLIGHT' };
}
```

---

## 5. Memory Configuration & Monitoring

* **Max Memory**: `maxmemory 1024mb` (1 GB).
* **Eviction Policy**: `maxmemory-policy volatile-lru` (evicts expired keys first; protects critical locks).
* **Persistence**: Append-Only File (AOF) with `appendfsync everysec` for disaster recovery.
