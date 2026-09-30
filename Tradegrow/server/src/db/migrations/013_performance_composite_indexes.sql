-- Migration 013: High-Performance Composite & Partial Indexes
-- Optimizes high-throughput execution matching, live portfolio queries, and user trade history.

-- 1. ExecutionEngine Pending Order Matching loop (runs every 500ms when orders exist)
CREATE INDEX IF NOT EXISTS idx_orders_pending_matching
  ON orders(status, created_at ASC)
  WHERE status IN ('ACCEPTED', 'PENDING');

-- 2. User Active & Historic Orders lookup by user_id and status
CREATE INDEX IF NOT EXISTS idx_orders_user_status_created
  ON orders(user_id, status, created_at DESC);

-- 3. Live User Positions lookup and sorting by freshness
CREATE INDEX IF NOT EXISTS idx_positions_user_updated
  ON positions(user_id, updated_at DESC);

-- 4. Closed trades / Intraday Trade Book lookup by user
CREATE INDEX IF NOT EXISTS idx_closed_trades_user_closed
  ON closed_trades(user_id, closed_at DESC);

-- 5. Executions / Trade history by user
CREATE INDEX IF NOT EXISTS idx_executions_user_executed
  ON executions(user_id, executed_at DESC);

-- 6. Wallet ledger transaction history by user
CREATE INDEX IF NOT EXISTS idx_wallet_ledger_user_created
  ON wallet_ledger(user_id, created_at DESC);
