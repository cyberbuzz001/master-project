# LOAD_TEST_PLAN.md — Load Testing, Concurrency & Chaos Scenarios

**Platform**: Trade Grow (Stocksharp Multi-User Brokerage & Paper Trading System)  
**Author**: Senior Principal FinTech QA & Performance Engineer  
**Status**: Production Specification (Version 1.0)

---

## 1. Load Testing Strategy & Objectives

The load testing framework validates that high concurrency, market volatility bursts, and rapid order submissions never cause:
1. Duplicate order executions.
2. Race condition fund over-allocations or negative cash balances.
3. Database connection pool exhaustion.
4. WebSocket tick delivery stalls.

---

## 2. Test Scenarios Matrix

```
┌─────────────────────────┬──────────────┬───────────────┬───────────────────────────────┐
│ Test Scenario           │ Concurrency  │ Duration      │ Key Validation Targets        │
├─────────────────────────┼──────────────┼───────────────┼───────────────────────────────┤
│ **1. Order Concurrency**│ 100 users    │ 60 seconds    │ 0 duplicate executions;       │
│                         │ 1,000 orders │               │ exact ledger balance parity   │
├─────────────────────────┼──────────────┼───────────────┼───────────────────────────────┤
│ **2. WebSocket Fan-Out**│ 500 sockets  │ 120 seconds   │ 5,000 ticks/sec throughput;   │
│                         │              │               │ <50ms propagation latency     │
├─────────────────────────┼──────────────┼───────────────┼───────────────────────────────┤
│ **3. Option Chain Burst**│ 100 users   │ 60 seconds    │ Greeks matrix cache hits;     │
│                         │ 50 req/sec   │               │ P95 response < 100ms          │
├─────────────────────────┼──────────────┼───────────────┼───────────────────────────────┤
│ **4. Chaos Simulation** │ 50 users     │ 180 seconds   │ Redis temporary restart;      │
│                         │ + Kill Redis │               │ graceful in-memory fallback   │
└─────────────────────────┴──────────────┴───────────────┴───────────────────────────────┘
```

---

## 3. Automated Concurrency Validation Script

The script `scripts/load_test_order_concurrency.ts` executes automated race condition validation:
* Submits 100 concurrent order requests containing 50 unique idempotency keys and 50 duplicate keys.
* Verifies that exactly 50 orders are accepted into the database and 50 duplicates return original order confirmations without extra margin deductions.
* Verifies that total ledger credits equal total ledger debits plus net cash balance.
