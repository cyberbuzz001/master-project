# 11 — Trading Engine Inventory

## Overview

The trading engine is a VIRTUAL/SIMULATED engine only.
Real money trading is PERMANENTLY DISABLED by SafetyLock.

```
SafetyLock.REAL_MONEY_TRADING_ALLOWED = false  (hardcoded constant)
SafetyLock.assertSimulationOnly() throws if process.env.REAL_MONEY_TRADING === 'true'
```

## Components

### OMS — Order Management System (OMS.ts)

**Purpose:** Accept, validate, and queue orders for simulated execution.

**Flow:**
1. `submitOrder(dto)` called from REST routes
2. `SafetyLock.assertSimulationOnly()` — guards every order
3. User existence validation
4. Idempotency key check (prevent duplicate orders)
5. `RMS.validateOrder()` — pre-trade risk check
6. `INSERT INTO orders (status='ACCEPTED')`
7. `VirtualWalletLedger.reserveMargin()` — lock buying power
8. `ExecutionEngine.queueOrder()` — add to fill queue

**Order States:**
- ACCEPTED → queued for execution
- PENDING → limit order waiting for price
- FILLED → executed
- PARTIALLY_FILLED → partial execution
- REJECTED → failed RMS/validation
- CANCELLED → user or admin cancelled

### RMS — Risk Management System (RMS.ts)

**Purpose:** Pre-trade risk validation before any order is accepted.

**Checks:**
1. Sufficient buying power / margin
2. Position limits per user
3. Daily loss limits
4. Circuit breaker price checks
5. Instrument trading status
6. Option contract validity (expiry, strike)
7. Max order quantity limits

**RMS Configuration:** Loaded from `system_settings` table (managed via admin API).

### ExecutionEngine (ExecutionEngine.ts)

**Purpose:** Simulate order fills at market/limit prices.

**Mechanism:**
- Runs a setInterval loop
- For each ACCEPTED/PENDING order:
  - MARKET orders: filled immediately at current LTP
  - LIMIT orders: filled when LTP crosses limit price
  - SL/SL_M: filled when trigger price is hit
- On fill: `INSERT INTO executions`, UPDATE positions, update wallet

**Fill Simulation:**
- Market orders: filled within 1 tick interval (~500ms)
- Limit orders: checked every 500ms against cached LTP
- Simulated slippage: configurable (default 0)

### PortfolioService (PortfolioService.ts)

**Purpose:** Manage positions and holdings.

**getUserPositions():**
- Query current day's net positions from `positions` table
- Enrich with live LTP from MarketDataEngine
- Calculate unrealized P&L per position
- Calculate total portfolio P&L

**getUserHoldings():**
- Query delivery (CNC) holdings from `holdings` table
- Enrich with current LTP
- Calculate investment P&L

### VirtualWalletLedger (VirtualWalletLedger.ts)

**Purpose:** Virtual money management.

**Operations:**
- `getWallet(userId)` — current balance + margin + P&L
- `reserveMargin(userId, amount)` — lock margin for open order
- `releaseMargin(userId, amount)` — release on cancel/reject
- `recordFill(userId, fill)` — debit/credit on execution
- `adminAdjustBalance(userId, amount, adminId, reason)` — admin fund operations

**All transactions are ledger-tracked** in `wallet_ledger` table.

### MarginEngineService (MarginEngineService.ts)

**Purpose:** Calculate margin requirements for orders.

**calculateQuote():**
- Uses SPAN margin approximation
- Considers underlying LTP, strike, option type, expiry
- Returns: margin_required, premium_required, total_required, available
- Option BUY: pay full premium
- Option SELL: pay SPAN margin (typically 15-20x premium)
- Equity: CNC = full value, MIS = 20% leverage

**calculatePortfolioMargin():**
- Calculates total portfolio margin across all open positions
- Checks for spread benefits (long + short same underlying)

## Trading Rules Enforced

| Rule | Implementation |
|------|---------------|
| Real money disabled | SafetyLock (hardcoded) |
| Max daily loss | system_settings.MAX_DAILY_LOSS_PERCENT |
| Max open positions | system_settings.MAX_OPEN_POSITIONS |
| Max order quantity | system_settings.MAX_ORDER_QUANTITY |
| Position limits | RMS.validateOrder() |
| Margin check | VirtualWalletLedger.getWallet() |
| Idempotency | orders.idempotency_key unique constraint |

## F&O Stock Service (FnOStockService.ts)

**Purpose:** Provide list of top F&O-eligible stocks for the Explore view.

**Data:** Seeded with top ~100 NSE F&O stocks (RELIANCE, TCS, INFY, HDFCBANK, etc.)
**Real-time:** Enriched with live LTP from MarketDataEngine tick cache
**Endpoints:** Top gainers, losers, volume shockers

## Reconciliation Monitor (ReconciliationMonitorService.ts)

**Purpose:** Detect and alert on price discrepancies between:
- Live WebSocket tick
- Database stored prices
- Redis cached prices

Runs every 60 seconds. Logs warnings but does NOT auto-correct.

## Accuracy Check Service (AccuracyCheckService.ts)

**Purpose:** Validate that option chain prices are realistic:
- Checks that CE + PE ≈ forward price (put-call parity)
- Validates that IV is within normal range (5%–200%)
- Alerts admin if pricing appears anomalous

Runs every 60 seconds. Logs to audit system.

## Simulated Brokerage Structure

| Charge | Rate | Notes |
|--------|------|-------|
| Equity delivery | 0% | Free (like Zerodha) |
| Equity intraday | 0.03% per side | |
| F&O | ₹20 flat | Per order |
| STT | Per SEBI rates | On sells |
| Exchange charges | Per exchange | |

Brokerage credited to platform account via wallet_ledger.
