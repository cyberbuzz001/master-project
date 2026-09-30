# OMS_SCALABILITY.md — Order Management System & Matching Concurrency

**Platform**: Trade Grow (Stocksharp Multi-User Brokerage & Paper Trading System)  
**Author**: Senior Principal FinTech & OMS Specialist  
**Status**: Production Specification (Version 1.0)

---

## 1. Order Lifecycle & Strict State Machine

Order state transitions must follow a strict, non-reversible state machine:

```
                      [ USER SUBMISSION ]
                               │
                               ▼
                            [ CREATED ]
                               │
                               ▼
                          [ VALIDATING ]
                               │
                ┌──────────────┴──────────────┐
                │                             │ (RMS Failed)
                ▼                             ▼
          [ ACCEPTED ]                  [ REJECTED ] (Terminal)
                │
                ▼
          [ EXECUTING ] (Atomic Claim Guard)
                │
        ┌───────┴───────┬──────────────┐
        ▼               ▼              ▼
    [ FILLED ]  [ PARTIALLY_FILLED ] [ CANCELLED ]
   (Terminal)          │             (Terminal)
                       ▼
                  [ FILLED ]
```

### 1.1 State Invariants
* **Terminal States**: `FILLED`, `REJECTED`, `CANCELLED`, `EXPIRED`. No order can transition out of a terminal state.
* **Database Check Constraint**: Enforced at the schema level via `orders_status_check`.

---

## 2. Distributed Idempotency Guard

Every order submission must supply an `idempotency_key` (or UUID generated from payload hash). 

### 2.1 Multi-Node Deduplication Protocol
```typescript
// Step 1: Atomic Redis Distributed Lock (10s expiry)
const lockKey = `lock:order:${idempotencyKey}`;
const locked = await redis.set(lockKey, userId, 'NX', 'EX', 10);

if (!locked) {
  // Concurrent duplicate request in flight — return existing order record
  const existing = await queryOne('SELECT order_id, status FROM orders WHERE idempotency_key = $1 AND user_id = $2', [idempotencyKey, userId]);
  if (existing) return { success: true, orderId: existing.order_id };
  return { success: false, error: 'CONCURRENT_ORDER_SUBMISSION_IN_PROGRESS' };
}

try {
  // Step 2: Pre-trade RMS checks & Margin blocking in PostgreSQL ACID transaction
  // Step 3: Insert order into PostgreSQL with UNIQUE constraint on idempotency_key
} finally {
  // Lock automatically expires or is released
}
```

---

## 3. Dedicated OMS Matching Worker (Single Leader Election)

In a horizontally scaled environment with $N$ application servers, running the matching loop on every server creates database lock collisions and redundant queries.

### 3.1 Architecture
* The matching loop is decoupled into a **Dedicated Matching Worker** process.
* If multiple worker instances are run for high availability, worker leader election is managed via Redis:
```typescript
async function acquireMatchingLeadership(): Promise<boolean> {
  const result = await redis.set('leader:matching_worker', WORKER_ID, 'NX', 'EX', 5);
  return result === 'OK';
}
```
* Only the designated leader worker queries `SELECT * FROM orders WHERE status IN ('ACCEPTED', 'PENDING') LIMIT 100` and dispatches simulated fills.

---

## 4. Execution Fill & Financial Settlement Transaction

The execution fill, position update, closed trade journaling, and wallet ledger settlement execute in a **single ACID transaction**:

```sql
BEGIN;
  -- 1. Insert immutable trade execution record with tick provenance
  INSERT INTO executions (id, order_id, user_id, trade_id, symbol, side, quantity, price, ...)
  VALUES (...);

  -- 2. Update order to FILLED
  UPDATE orders SET status = 'FILLED', filled_quantity = quantity, average_price = $1, updated_at = NOW()
  WHERE id = $2;

  -- 3. Lock user position row and calculate weighted average price & realized P&L
  SELECT * FROM positions WHERE user_id = $3 AND symbol = $4 AND product_type = $5 FOR UPDATE;
  UPDATE positions SET net_qty = ..., average_price = ..., realized_pnl = ... WHERE id = ...;

  -- 4. Record closed trade if position closed/reduced
  INSERT INTO closed_trades (...) VALUES (...);

  -- 5. Lock user virtual wallet, adjust cash balance and used margin
  SELECT * FROM virtual_wallets WHERE user_id = $3 FOR UPDATE;
  UPDATE virtual_wallets SET cash_balance = cash_balance + $realizedPnl, used_margin = $newMargin WHERE user_id = $3;

  -- 6. Journal settlement in wallet_ledger
  INSERT INTO wallet_ledger (id, user_id, transaction_type, amount, balance_before, balance_after, ...)
  VALUES (...);
COMMIT;
```
