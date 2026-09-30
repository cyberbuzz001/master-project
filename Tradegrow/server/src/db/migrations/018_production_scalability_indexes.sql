-- Migration: 018_production_scalability_indexes.sql
-- Description: Production Covering & Partial Indexes for High-Throughput Trading & Sub-Millisecond Queries

-- 1. Covering partial index for ExecutionEngine pending order matching loop
CREATE INDEX IF NOT EXISTS idx_orders_matching_loop
  ON orders(status, created_at ASC, id, symbol, instrument_token, side, quantity, price, order_type)
  WHERE status IN ('ACCEPTED', 'PENDING');

-- 2. Fast User Active Order queries with covering fields
CREATE INDEX IF NOT EXISTS idx_orders_user_active_lookup
  ON orders(user_id, status, created_at DESC)
  INCLUDE (symbol, side, quantity, filled_quantity, price, order_type);

-- 3. Idempotency Key instant lookup
CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_idempotency_lookup
  ON orders(idempotency_key)
  WHERE idempotency_key IS NOT NULL;

-- 4. Scrip Master token & symbol active resolution
CREATE INDEX IF NOT EXISTS idx_instruments_token_active
  ON instruments(instrument_token, active)
  INCLUDE (symbol, name, lot_size, tick_size, strike, option_type, expiry);

-- 5. Executions / Trade Book user filtering & sorting
CREATE INDEX IF NOT EXISTS idx_executions_user_time
  ON executions(user_id, executed_at DESC)
  INCLUDE (symbol, side, quantity, price, total_charges);

-- 6. User Positions live state resolution
CREATE INDEX IF NOT EXISTS idx_positions_user_netqty
  ON positions(user_id, net_qty, updated_at DESC)
  INCLUDE (symbol, product_type, buy_qty, sell_qty, average_price, ltp, realized_pnl);

-- 7. Closed Trades P&L history lookup
CREATE INDEX IF NOT EXISTS idx_closed_trades_user_history
  ON closed_trades(user_id, closed_at DESC)
  INCLUDE (symbol, gross_pnl, net_pnl, quantity, entry_price, exit_price);

-- 8. Wallet Ledger transaction journal lookup
CREATE INDEX IF NOT EXISTS idx_wallet_ledger_user_history
  ON wallet_ledger(user_id, created_at DESC)
  INCLUDE (transaction_type, amount, balance_before, balance_after, reference_id);
