# 08 — Redis Inventory

## Redis Configuration

| Setting | Value |
|---------|-------|
| REDIS_URL | redis://localhost:6379 |
| Docker image | redis:7-alpine |
| Max memory | 256mb |
| Eviction policy | allkeys-lru |
| Client library | ioredis 6.0 |

## Redis Usage Patterns

### 1. Market Tick Cache

| Key Pattern | TTL | Data | Purpose |
|-------------|-----|------|---------|
| `tick:{instrumentToken}` | 3600s | MarketTick JSON | Last known price for any subscribed instrument |

Examples:
- `tick:NSE_NIFTY50`
- `tick:NSE_BANKNIFTY`
- `tick:BSE_SENSEX`
- `tick:NFO_NIFTY_24500_CE`

### 2. Pub/Sub Channels

| Channel | Publisher | Subscriber | Purpose |
|---------|-----------|------------|---------|
| `market:ticks` | MarketDataEngine (on every tick) | MarketDataEngine constructor (horizontal scaling) | Real-time tick fan-out between processes |

### 3. In-Memory Fallback

When Redis is unavailable, the system automatically degrades to in-memory Map cache:
```typescript
private inMemoryCache = new Map<string, { value: string; expiresAt: number }>();
private localSubscribers = new Map<string, Set<(message: string) => void>>();
```

This means the application RUNS WITHOUT REDIS but loses:
- Cross-process tick sharing (only relevant for multi-instance deployment)
- Persistent tick cache (in-memory is lost on restart)

## Redis Operational Notes

### Connection Strategy
- maxRetriesPerRequest: 1 (fast fail)
- connectTimeout: 3000ms
- Retry backoff: min(attempts * 500ms, 2000ms), max 3 retries then give up

### Pub/Sub Architecture
Redis is used for pub/sub to support horizontal scaling (multiple Node.js instances):
```
Market Data Provider → MarketDataEngine.tickCallback
    ↓ redis.publish("market:ticks", tick)
    ↓ redis.subscribe("market:ticks", ...)  ← each process
    ↓ globalCallbacks → WebSocket broadcast
```

In single-instance deployment (current), pub/sub goes through local in-memory subscribers, making Redis optional for basic operation but required for horizontal scaling.

## Stale Keys / Cleanup

| Key Pattern | Risk | Action |
|-------------|------|--------|
| `tick:*` — 3600s TTL | Stale off-market prices | Acceptable — Mock engine overwrites |
| `dump.rdb` in repo | Stale dev dump | REMOVE — Never commit to production |

## Redis Data Volume Estimate

- ~20 default tokens tracked = 20 keys × ~500 bytes = 10KB
- Option chain subscriptions (up to 50 strikes × 2): ~100 additional keys = 50KB
- Total estimated: <1MB normally

## Redis NOT Used For

| Feature | Alternative Used |
|---------|-----------------|
| Sessions | JWT tokens (stateless) |
| Rate limiting | express-rate-limit (in-memory) |
| Order queuing | In-memory ExecutionEngine queue |
| User cache | DB lookup on every auth (by design for security) |

## Recommended Redis Keys to Add (Production Improvements)

| Key | Purpose | TTL |
|-----|---------|-----|
| `session:{userId}` | JWT token revocation list | 24h |
| `rate:auth:{ip}` | Distributed rate limiting | 15min |
| `chain:{symbol}:{expiry}` | Option chain cache | 1s |
| `nse:summary:{symbol}` | NSE PCR/MaxPain cache | 60s |
