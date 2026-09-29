# ADR-003: Database Consolidation to PostgreSQL 16, TimescaleDB & Redis 7

**Status**: ACCEPTED  
**Date**: September 2026  
**Deciders**: Lead FinTech Systems Architect, Database Administrator  

---

## Context
`Tradegrow` relies on PostgreSQL 16 with TimescaleDB for its financial ledger, orders, and tick hypertables, while `Expert advisory` defaults to SQLite in development and MySQL in production. Running and maintaining separate database engines increases operational complexity, prevents foreign key constraints across domains, and complicates point-in-time recovery.

## Decision
We consolidate all persistence requirements into an enterprise **PostgreSQL 16 cluster** augmented by **TimescaleDB** and **Redis 7**:
1. **Logical Separation via Schemas**: Instead of disparate databases, we partition data into `core`, `broker`, `market`, and `advisory` schemas.
2. **High-Frequency Time-Series**: TimescaleDB hypertables handle high-velocity market data candles and trade events.
3. **In-Memory Caching & Pub/Sub**: Redis 7 handles real-time tick caching, distributed locks, rate limiting, and event streaming (Redis Streams).
4. **ORM / Driver Alignment**: The Node.js broker service continues using connection-pooled `pg`, while Laravel's Eloquent models are configured with PostgreSQL driver credentials.

## Consequences
### Positive
* Single backup, replication, disaster recovery, and point-in-time recovery (PITR) strategy.
* Cross-schema relational integrity (e.g. `broker.orders.advisory_recommendation_id` references `advisory.recommendations.id`).
* Standardized connection pooling via PgBouncer.

### Negative
* Laravel migrations in `Expert advisory` must be verified for PostgreSQL-specific data types and syntax (e.g., `gen_random_uuid()`, `JSONB`).
