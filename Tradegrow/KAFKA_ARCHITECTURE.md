# KAFKA_ARCHITECTURE.md — Event Streaming, Partitioning & Evolution Strategy

**Platform**: Trade Grow (Stocksharp Multi-User Brokerage & Paper Trading System)  
**Author**: Senior Principal FinTech & Distributed Systems Architect  
**Status**: Production Specification & Evaluation (Version 1.0)

---

## 1. Executive Summary & Evaluation

Kafka is a powerful distributed streaming platform designed for enterprise scale (millions of events per second across distributed clusters). 

For Trade Grow's current operational scale (50–1,000 users), introducing a multi-broker Kafka cluster + ZooKeeper/KRaft adds unnecessary operational overhead, 2GB+ memory overhead, and operational maintenance without performance gain over optimized Redis Streams & PostgreSQL.

However, as Trade Grow scales to **5,000–50,000+ users** and multi-broker routing, the platform is architecturally prepared to introduce Kafka using the topic topology defined below.

---

## 2. Target Kafka Logical Topics & Partitioning Strategy

When Kafka is introduced, topics are partitioned by **Symbol** or **UserId** to ensure strict sequential processing:

```
┌─────────────────────────┬────────────┬─────────────────────────────┬───────────────────────┐
│ Topic Name              │ Partitions │ Partition Key               │ Description           │
├─────────────────────────┼────────────┼─────────────────────────────┼───────────────────────┤
│ **`market.ticks.raw`**  │ 12         │ `instrumentToken`           │ Ingested raw ticks    │
│ **`market.ticks.quote`**│ 12         │ `instrumentToken`           │ Processed clean ticks │
│ **`orders.submitted`**  │ 16         │ `userId`                    │ Validated new orders  │
│ **`orders.executed`**   │ 16         │ `userId`                    │ Filled trades         │
│ **`positions.events`**  │ 16         │ `userId`                    │ Incremental P&L events│
│ **`ledger.journal`**    │ 8          │ `userId`                    │ Immutable fund events │
│ **`audit.security`**    │ 4          │ `adminId` / `userId`        │ Compliance & security │
└─────────────────────────┴────────────┴─────────────────────────────┴───────────────────────┘
```

---

## 3. Order & Financial Correctness Rule

> [!CAUTION]
> **Fundamental Kafka Rule**: Never assume Kafka message publishing means business processing succeeded. Financial state MUST be confirmed in PostgreSQL transactions before or synchronously with Kafka event dispatch (using the **Transactional Outbox Pattern**).

---

## 4. Transactional Outbox Pattern for Zero Data Loss

To guarantee that database writes and Kafka event publication never diverge:

```
[ HTTP Request: Place Order ]
       │
       ▼
[ withTransaction(client) ]
  ├── INSERT INTO orders (...)
  ├── UPDATE virtual_wallets (...)
  └── INSERT INTO outbox_events (event_type, payload, status = 'PENDING')
       │
       ▼ [ COMMIT ]
       │
[ Outbox Poller Worker ]
  ├── Reads PENDING outbox_events
  ├── Publishes to Kafka Topic (`orders.submitted`)
  └── Marks outbox_events as PUBLISHED
```

This guarantees **At-Least-Once delivery** with zero risk of database rollback causing ghost Kafka messages.
