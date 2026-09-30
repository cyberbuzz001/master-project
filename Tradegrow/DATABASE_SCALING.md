# DATABASE_SCALING.md — Database Scaling, Connection Pooling & Partitioning

**Platform**: Trade Grow (Stocksharp Multi-User Brokerage & Paper Trading System)  
**Author**: Senior Principal FinTech & Database Architect  
**Status**: Production Specification (Version 1.0)

---

## 1. Database Architecture & PostgreSQL Role Separation

The primary transactional database is **PostgreSQL 16 with TimescaleDB**. Financial correctness dictates that all critical balance, order, position, and ledger writes remain strongly consistent with full ACID transactions.

```
                           APPLICATION / WORKER NODES
                                       │
                                       ▼
                     ┌───────────────────────────────────┐
                     │         PgBouncer Layer           │
                     │  - Pool Mode: Transaction         │
                     │  - Max Client Connections: 200    │
                     │  - Default Pool Size: 25          │
                     └─────────────────┬─────────────────┘
                                       │
        ┌──────────────────────────────┴──────────────────────────────┐
        ▼                                                             ▼
[ PRIMARY DATABASE (Read/Write) ]                             [ READ REPLICA (Read-Only) ]
  - Orders, Trades, Executions                                  - Executive Dashboard Queries
  - Virtual Wallets & Ledger                                    - Customer 360 Analytics
  - Positions & Holdings                                        - Historical Audit Logs
  - Streaming Replication ────────────────────────────────────► - Trade Book EOD Reports
```

---

## 2. PgBouncer Connection Pooling Strategy

Without a connection pooler, scaling to $N$ application instances with $P$ pool size produces $N \times P$ direct backend connections, quickly exhausting PostgreSQL's `max_connections` (typically 100 on standard VPS).

### 2.1 Sizing Formula
$$\text{Total DB Connections} = \text{App Instances} \times \text{Node Pool Size} \le \text{PgBouncer Max}$$

* **App Instances**: 4 Node.js instances $\times$ 10 pool connections = 40 connections.
* **Worker Instances**: 2 background workers $\times$ 5 pool connections = 10 connections.
* **PgBouncer Client Pool**: Set to 100 max client connections, multiplexed onto 20 persistent server connections to PostgreSQL.

### 2.2 Pool Modes
* **Transaction Pooling**: Used for all standard OMS/RMS operations. Connections are returned to the pool immediately upon `COMMIT` or `ROLLBACK`.
* **Session Pooling**: Restricted to migration runners (`runMigrations()`) requiring DDL locks.

---

## 3. High-Performance Indexing Strategy (Migration 018)

To eliminate full table scans during high-frequency trading and order matching:

| Table | Index Columns | Purpose | Index Type |
| :--- | :--- | :--- | :--- |
| **`orders`** | `(status, created_at ASC)` WHERE `status IN ('ACCEPTED','PENDING')` | Sub-millisecond ExecutionEngine matching loop query | Partial B-Tree |
| **`orders`** | `(user_id, status, created_at DESC)` | Instant user order book & active orders view | Composite B-Tree |
| **`orders`** | `(idempotency_key)` | O(1) deduplication check on order submission | Unique B-Tree |
| **`positions`** | `(user_id, updated_at DESC)` | Fast live portfolio loading | Composite B-Tree |
| **`executions`** | `(user_id, executed_at DESC)` | Fast intraday trade book retrieval | Composite B-Tree |
| **`wallet_ledger`** | `(user_id, created_at DESC)` | Fast ledger journal pagination | Composite B-Tree |
| **`instruments`** | `(instrument_token, active)` | O(1) scrip master token validation | Composite B-Tree |
| **`closed_trades`**| `(user_id, closed_at DESC)` | Fast P&L history and analytics | Composite B-Tree |

---

## 4. Time-Series Hypertable & Archival Strategy

Market ticks and historical candles are stored in TimescaleDB hypertables partitioned by timestamp:

```sql
-- Convert ticks table to TimescaleDB hypertable partitioned in 1-day chunks
SELECT create_hypertable('ticks', 'timestamp', chunk_time_interval => INTERVAL '1 day', if_not_exists => TRUE);

-- Auto-compress chunks older than 7 days
ALTER TABLE ticks SET (timescaledb.compress, timescaledb.compress_segmentby = 'instrument_token');
SELECT add_compression_policy('ticks', INTERVAL '7 days');

-- Retain raw ticks for 30 days, candles permanently
SELECT add_retention_policy('ticks', INTERVAL '30 days');
```

---

## 5. Slow Query Audit & Optimization Rules

1. **No N+1 Queries**: Fetch orders, executions, and positions in single parameterized queries with `WHERE user_id = $1` instead of looping through lists.
2. **Mandatory Pagination**: All list endpoints (`/api/v1/orders`, `/api/v1/customers`, `/api/v1/admin/trades`) must enforce `LIMIT` $\le 200$ and `OFFSET`.
3. **Query Timeouts**: Every statement executed via `pg.Pool` enforces a `statement_timeout = 5000` (5 seconds) to prevent runaway transactions from locking financial tables.
