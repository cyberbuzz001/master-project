# MONITORING_PLAN.md — Observability, Metrics & Telemetry

**Platform**: Trade Grow (Stocksharp Multi-User Brokerage & Paper Trading System)  
**Author**: Senior Principal FinTech SRE & DevOps Engineer  
**Status**: Production Specification (Version 1.0)

---

## 1. Observability Pillars

Trade Grow implements full observability across **Metrics, Structured JSON Logs, and Distributed Request Tracing**:

```
                                  TELEMETRY PIPELINE
                                          │
        ┌─────────────────────────────────┼─────────────────────────────────┐
        ▼                                 ▼                                 ▼
[ PROMETHEUS METRICS ]          [ STRUCTURED JSON LOGS ]          [ HEALTH PROBE MATRIX ]
  - HTTP RPS & P95 Latency        - Request ID & Trace ID           - /health/live
  - Active WS Connections         - Financial Action Audits         - /health/ready
  - PostgreSQL Pool Util.         - Strict Secrets Redaction        - /health/dependencies
  - Redis Memory & Evictions      - Pino High-Speed Output          - Reconciliation Reports
```

---

## 2. Core Operational Metrics Matrix

| Category | Metric Name | Target SLA | Warning Threshold | Critical Threshold |
| :--- | :--- | :--- | :--- | :--- |
| **API Health** | `http_requests_total` | > 99.9% 2xx | Error rate > 1% | Error rate > 5% |
| **API Latency** | `http_request_duration_p95` | < 150 ms | > 250 ms | > 500 ms |
| **Orders** | `oms_orders_placed_total` | Monotonic | Spikes > 50/sec | Drop to 0 during market |
| **Matching** | `oms_matching_cycle_duration`| < 50 ms | > 150 ms | > 500 ms |
| **WebSocket** | `ws_connected_clients` | Stable | Disconnects > 10%/min | Disconnects > 30%/min |
| **Tick Delivery** | `market_data_tick_latency_ms` | < 50 ms | > 100 ms | > 300 ms |
| **PostgreSQL** | `pg_pool_active_connections` | < 60% pool | > 75% pool | > 90% pool |
| **Redis** | `redis_memory_used_bytes` | < 512 MB | > 750 MB | > 900 MB |

---

## 3. High-Priority Alerting Rules (Telegram & Webhooks)

Alerts are sent to administrators via Telegram (`sendTelegramAlert`) and webhook integrations:

1. **Exchange Feed Disconnect Alert**: Fired if no tick is received for >45 seconds during IST market hours.
2. **Dhan Access Token Expiry Alert**: Fired at 60 minutes and 15 minutes before JWT token expiration.
3. **Database Connection Saturation Alert**: Fired when active pool connections exceed 80% capacity for 1 minute.
4. **Reconciliation Divergence Alert**: Fired when live cache tick deviates $>0.50\%$ from reference exchange quote.
