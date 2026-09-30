# MARKET_DATA_ARCHITECTURE.md — Market Data Ingestion, Deduplication & Backpressure

**Platform**: Trade Grow (Stocksharp Multi-User Brokerage & Paper Trading System)  
**Author**: Senior Principal FinTech & Market Data Specialist  
**Status**: Production Specification (Version 1.0)

---

## 1. Single Centralized Market Data Gateway

Individual trading users **never** connect directly to the external exchange API (Dhan HQ / Angel One SmartAPI). 

Instead, a single centralized **Market Data Gateway** maintains persistent upstream exchange connections, deduplicates scrip subscriptions, normalizes symbol formats, and broadcasts updates via Redis Pub/Sub:

```
                            EXCHANGE FEED (Dhan HQ / Angel One)
                                            │
                                            ▼
                    ┌───────────────────────────────────────────────┐
                    │      CENTRAL MARKET DATA GATEWAY             │
                    │  ├── Upstream WebSocket Connection Manager    │
                    │  ├── Auto-Reconnect with Exponential Backoff │
                    │  ├── Deduplicated Scrip Subscription Pool    │
                    │  ├── Symbology Normalizer (NSE/BSE/NFO/BFO)   │
                    │  └── In-Memory Tick Buffer                   │
                    └───────────────────────┬───────────────────────┘
                                            │
        ┌───────────────────────────────────┼───────────────────────────────────┐
        ▼                                   ▼                                   ▼
[ Redis Pub/Sub: market:ticks ]    [ Redis Key: tick:{token} ]       [ Options Math Engine ]
  - Sub-millisecond tick fan-out     - Ephemeral cache (TTL 3600s)     - Python FastAPI Greeks
  - Consumed by all WS gateways      - Read by OMS limit order check   - Black-Scholes Greeks calc
```

---

## 2. Eliminating Disk I/O & File Polling

The previous implementation of `AngelOneAdapter` wrote ticks to `angel_ticks.json` on disk and polled via `fs.promises.readFile` every 500ms. In high-load production:
* All tick ingestion is **100% in-memory** via direct socket streaming.
* Python child processes communicate via standard Unix Domain Sockets, Redis Pub/Sub, or FastAPI HTTP streaming.
* Disk I/O is completely eliminated from the critical tick ingestion and quotation path.

---

## 3. Option Chain & Greeks Aggregation Architecture

Option Chain matrices (e.g. NIFTY 50 strikes, BANKNIFTY 50 strikes) are compute-heavy. To prevent CPU exhaustion:
1. **Spot Price Guard**: Spot prices are verified against NSE live index feeds every 30s (`NseOptionChainService`).
2. **Matrix Caching**: Calculated Option Chain Greeks are cached in Redis (`chain:{underlying}:{expiry}`) with a 5-second TTL during market hours.
3. **High-Frequency Differential Updates**: Client UIs subscribe to the option chain via WebSocket; only strikes with changed LTP, IV, or OI are pushed over the wire.

---

## 4. Connection Resilience & Failover Policy

* **Automatic Reconnect**: Upstream feeds implement exponential backoff ($1\text{s} \to 2\text{s} \to 4\text{s} \dots \max 30\text{s}$).
* **Heartbeat Watchdog**: If no tick is received for >45 seconds during market hours (9:15 AM – 3:30 PM IST), the watchdog forces socket reconnection and issues a Telegram administrative alert.
* **Hot Token Refresh**: Dhan access tokens can be updated live via `POST /api/internal/update-dhan-token` without restarting the server process.
