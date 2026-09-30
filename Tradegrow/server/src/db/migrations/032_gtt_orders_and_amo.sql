-- 032_gtt_orders_and_amo.sql
-- Migration: Add GTT (Good-Till-Triggered) / OCO table and AMO flag to orders

CREATE TABLE IF NOT EXISTS gtt_orders (
  id VARCHAR(64) PRIMARY KEY,
  trigger_id VARCHAR(32) UNIQUE NOT NULL,
  user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  instrument_token VARCHAR(64) NOT NULL,
  exchange VARCHAR(16) NOT NULL,
  symbol VARCHAR(64) NOT NULL,
  side VARCHAR(16) NOT NULL CHECK (side IN ('BUY', 'SELL')),
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  price NUMERIC(15, 2) NOT NULL DEFAULT 0,
  trigger_price NUMERIC(15, 2) NOT NULL,
  order_type VARCHAR(16) NOT NULL DEFAULT 'LIMIT' CHECK (order_type IN ('MARKET', 'LIMIT')),
  product_type VARCHAR(16) NOT NULL DEFAULT 'MIS' CHECK (product_type IN ('MIS', 'CNC', 'NRML')),
  condition_type VARCHAR(16) NOT NULL DEFAULT 'SINGLE' CHECK (condition_type IN ('SINGLE', 'OCO')),
  stoploss_trigger_price NUMERIC(15, 2),
  stoploss_price NUMERIC(15, 2),
  target_trigger_price NUMERIC(15, 2),
  target_price NUMERIC(15, 2),
  status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'TRIGGERED', 'CANCELLED', 'EXPIRED', 'REJECTED')),
  executed_order_id VARCHAR(64),
  triggered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_gtt_orders_user ON gtt_orders(user_id, status);
CREATE INDEX IF NOT EXISTS idx_gtt_orders_token_status ON gtt_orders(instrument_token, status);

-- Ensure orders table has is_amo and basket_id columns
ALTER TABLE orders ADD COLUMN IF NOT EXISTS is_amo BOOLEAN DEFAULT FALSE;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS basket_id VARCHAR(64);
