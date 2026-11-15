# TradeGrowX Pass 1: order-to-ledger audit

Scope: OMS, ExecutionEngine, VirtualWalletLedger, PortfolioService, RMS, MarginMath, database transaction wrapper, Redis lock helper, tick cache/broadcast path. Order routes, schema migrations and shutdown handler inspected for specific dependencies. This is a source audit, not certification of the deployed service. Prior UI/credential edits in the working tree are separate from these fixes.

## 1. Risk matrix

| Severity | Category | Finding | Disposition |
|---|---|---|---|
| CRITICAL | Options Math/Ledger | Losses exceeding cash are silently forgiven by cash clamping | Patched in follow-up; migration 045 must be deployed |
| HIGH | Concurrency | Cancel can overwrite a committed fill | Patched |
| HIGH | Concurrency | Modify can amend an already executed order | Patched |
| HIGH | Concurrency | Execution uses an obsolete quantity/price snapshot | Patched with conditional execution |
| HIGH | WebSocket/Redis | Out-of-order ticks rejected by cache still reach consumers | Patched for direct token ordering |
| MEDIUM | Resilience | Expired Redis lock owner can delete successor lock | Open |

## 2. Detailed findings

### [CRITICAL] Cash clamping violates the accounting invariant

Follow-up: settlement now applies the same PostgreSQL NUMERIC delta to cash and realized P&L, logs the signed P&L cash movement, and fails if no wallet exists. Migration `045_signed_wallet_cash.sql` removes the original nonnegative cash constraint. Wallet buying power and client/admin available-margin displays now preserve negative values; withdrawable funds remain nonnegative. Admin capital adjustments can also leave signed cash balances. Three focused regression tests pass; migration and settlement have not been verified against a running PostgreSQL instance. Previously clamped historical balances require separate reconciliation. The original analysis below describes the pre-fix behavior.

Evidence: `server/src/trading/VirtualWalletLedger.ts:401`, `settleTradeExecutionInTransaction`; `server/src/db/migrations/001_initial_schema.sql:42`; `server/src/trading/VirtualWalletLedger.ts:92`, `getWallet`.

Scenario: initial capital/cash 100, realized loss 150, margin released to zero. Settlement persists cash 0 and realized P&L -150. Expected cash/available margin is -50. The ledger has silently created 50. `getWallet` additionally clamps buying power to zero.

Root cause: `Math.max(0.00, cashBalance + realizedPnlDelta)` combined with a nonnegative cash CHECK. The raw arithmetic uses JavaScript Number after parsing NUMERIC, so exact decimal accounting is also not established by this implementation.

Required fix: an additive migration must allow signed cash or introduce an explicit deficit liability; settlement must preserve the full loss using PostgreSQL NUMERIC arithmetic, and the wallet must expose signed available margin separately from spendable funds. Do not apply only this one-line change against the current schema:

```diff
- const newCash = Math.max(0.00, cashBalance + realizedPnlDelta);
+ const newCash = cashBalance + realizedPnlDelta;
```

That change alone would make underwater fills roll back under the current CHECK and leave the exit unsettled. A deployment-ready migration cannot be certified without inspecting the actual constraint catalog and all capital-adjustment/deficit readers. Existing historical drift also needs reconciliation rather than rewriting balances blindly.

Verification: seed capital 100; close a position with loss 150; assert cash=-50, realized=-150, used_margin=0, signed available=-50. Repeat decimal gain/loss cycles and concurrent exits against PostgreSQL; assert exact NUMERIC equality with capital-adjustment ledger totals. No real database execution was performed in this pass.

### [HIGH] Cancellation races execution

Evidence/fix: `server/src/trading/OMS.ts:266`, `cancelOrder`.

Scenario: cancellation reads ACCEPTED; execution commits FILLED and books a position; cancellation's unconditional UPDATE overwrites it with CANCELLED. The user sees a cancelled order with an executed position.

Applied patch:

```diff
- UPDATE orders SET status = 'CANCELLED', updated_at = NOW() WHERE id = $1
+ UPDATE orders SET status = 'CANCELLED', updated_at = NOW()
+ WHERE id = $1 AND user_id = $2
+ AND status IN ('ACCEPTED', 'PENDING', 'OPEN', 'TRIGGER_PENDING') RETURNING id
```

The transaction returns false if it loses. Margin recomputation and post-commit unregistration happen only after a successful transition. Ownership is checked again in the write.

Verification: `server/src/tests/orderMutationRace.test.ts` drives the initial ACCEPTED read followed by a failed database transition, asserting failure and no margin/index effects. This uses a mocked transaction; run a real two-connection barrier test with fill committed between read and UPDATE before release.

### [HIGH] Modification races execution

Evidence/fix: `server/src/trading/OMS.ts:362`, `modifyOrder`.

Scenario: amendment reads ACCEPTED with quantity 65; fill commits; amendment writes quantity 130 and re-registers the already filled order. Orders, executions and positions disagree.

Applied patch:

```diff
- UPDATE orders SET price = $1, quantity = $2, updated_at = NOW() WHERE id = $3
+ UPDATE orders SET price = $1, quantity = $2, updated_at = NOW()
+ WHERE id = $3 AND user_id = $4 AND status IN ('ACCEPTED', 'PENDING') RETURNING id
```

Zero updated rows throw within the transaction, before margin recomputation and index registration.

Verification: `orderMutationRace.test.ts` asserts an amendment losing to a fill performs neither operation. PostgreSQL barrier test remains required.

### [HIGH] Fill uses a superseded order snapshot

Evidence/fix: `server/src/trading/ExecutionEngine.ts:551` and `:576`, `executeOrder`.

Scenario: engine loads 65 units; amendment commits 130; engine updates `filled_quantity = quantity` from the database (130) but inserts an execution using the captured `qty` (65). A changed LIMIT price can similarly bypass the newly requested limit.

Applied patch:

```diff
  WHERE id = $2 AND status IN ('ACCEPTED', 'PENDING', 'EXECUTING')
+ AND quantity = $3 AND price = $4 AND COALESCE(trigger_price, 0) = $5
  RETURNING id
- [price, order.id]
+ [price, order.id, qty, Number(order.price || 0), Number(order.trigger_price || 0)]
```

A superseded snapshot cannot record a fill. The periodic pending-order sweep reloads database state; an already claimed EXECUTING order uses the existing recovery path. This adds no external order-routing behavior.

Verification: `server/src/tests/executionSnapshotRace.test.ts` verifies the conditional transition and that losing the transition never reaches position accounting. Test recovery through a real worker restart separately.

### [HIGH] Rejected ticks still reach subscribers and Redis

Evidence/fix: `server/src/marketData/MarketDataEngine.ts:208`, `broadcastTick`; `:379`, `setCachedTick`; cluster subscriber at `:78`.

Scenario: timestamp T+1 reaches cache; delayed timestamp T arrives. Cache rejects it, but the void result previously allowed broadcastTick to call matching subscribers and write the older value to Redis. Consumers could execute against the older price while the local cache retained the new one.

Applied patch:

```diff
- this.setCachedTick(tick);
+ if (!this.setCachedTick(tick)) return;
  this.globalCallbacks.forEach(cb => cb(tick));
```

`setCachedTick` now returns an acceptance boolean, rejects non-finite timestamp/LTP or nonpositive LTP, and returns false for older timestamps. Both local and cluster dispatch honor that result.

Verification: `server/src/tests/tickOrderingRegression.test.ts` seeds a newer tick, sends an older one, and asserts unchanged cache and no subscriber/Redis writes. Cross-alias ordering and timestamp-unit consistency need separate provider-contract tests; this patch establishes ordering only for the direct token check.

### [MEDIUM] Redis lock release does not check ownership

Evidence: `server/src/db/redis.ts:320`, `acquireLock`, and `:327`, `releaseLock`; `server/src/trading/OMS.ts:97`, `submitOrder`.

Scenario: A acquires a 10-second lock, stalls beyond its TTL; B acquires the same key; A resumes and unconditionally DELs B's lock. C can now enter with B. OMS uses a user ID rather than a unique acquisition token.

Required fix: pass a random token per acquisition to releaseLock, and use atomic compare-and-delete Lua, mirrored in the in-memory implementation. Inspect/migrate every caller before changing the helper. Lua core:

```lua
if redis.call('get', KEYS[1]) == ARGV[1] then
  return redis.call('del', KEYS[1])
end
return 0
```

Verification: A acquires; allow A's TTL to expire; B acquires; A releases; assert B's token is still stored and C cannot acquire. Global unique idempotency indexes exist (`001_initial_schema.sql:158`, `018_production_scalability_indexes.sql:15`), so this finding alone does not establish duplicate committed orders.

## 3. Defensive safeguards and remaining verification

- Present: zero fee constants in `ExecutionEngine.executeOrder` (around line 555) and `MarginMath.ZERO_CHARGES`; transaction rollback/release in `db/pool.ts:126`; wallet row locks in `VirtualWalletLedger.recomputeUsedMarginForUser:141`; conditional FILLED transition in executeOrder; unique idempotency indexes; expiry validation in `RMS.validateOrder:215`; SIGTERM/SIGINT handlers in `index.ts:291`. Do not describe these as missing.
- Missing from the inspected settlement path: signed deficit handling and exact decimal accumulation. Wire both into settlement, wallet reads and a migration together.
- Stale pricing remains a concern: `MarginMath.resolveReferencePrice:145` returns stale/fallback values, and `RMS.ts:231` explicitly permits that policy. Separate indicative display valuation from acceptance and fill eligibility. A complete fill-path freshness/circuit-limit audit is still required before concluding every stale order can execute.
- Add real PostgreSQL/Redis concurrency tests using at least two database connections, concurrent cancel/modify/fill, lock expiry and worker restart. The four new tests are deterministic unit regressions, not load-test evidence.
- The full WebSocket disconnect/subscription lifecycle, Nginx/PM2 deployment, Python options math, BigQuery, and every wallet mutation are outside this pass. No absence claims are made for them.

Validation: three focused regression suites, four tests passing. Full production build and diff checks run for this pass; deployment and real database concurrency checks remain outstanding. No claim of overall production readiness.
