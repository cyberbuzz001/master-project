-- Migration 009: Closed Trades & Trade History Schema
-- Permanent storage for closed/squared-off positions with per-trade P&L calculations

CREATE TABLE IF NOT EXISTS closed_trades (
  id                  TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  user_id             TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  position_id         TEXT,
  instrument_token    TEXT NOT NULL,
  symbol              TEXT NOT NULL,
  exchange            TEXT NOT NULL DEFAULT 'NSE',
  product_type        TEXT NOT NULL DEFAULT 'MIS',
  entry_side          TEXT NOT NULL CHECK (entry_side IN ('BUY', 'SELL')),
  exit_side           TEXT NOT NULL CHECK (exit_side IN ('BUY', 'SELL')),
  quantity            INTEGER NOT NULL CHECK (quantity > 0),
  entry_price         NUMERIC(15,4) NOT NULL,
  exit_price          NUMERIC(15,4) NOT NULL,
  gross_pnl           NUMERIC(20,4) NOT NULL,
  charges             NUMERIC(10,4) NOT NULL DEFAULT 0.0,
  net_pnl             NUMERIC(20,4) NOT NULL,
  exit_reason         TEXT NOT NULL DEFAULT 'MANUAL_EXIT'
                      CHECK (exit_reason IN ('MARKET_SQUARE_OFF','TARGET_LIMIT','STOP_LOSS','MANUAL_EXIT','PARTIAL_EXIT','EXPIRY','SYSTEM_EXIT')),
  entry_order_id      TEXT,
  exit_order_id       TEXT,
  execution_id        TEXT UNIQUE,
  closed_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_closed_trades_user_id ON closed_trades(user_id);
CREATE INDEX IF NOT EXISTS idx_closed_trades_symbol ON closed_trades(symbol);
CREATE INDEX IF NOT EXISTS idx_closed_trades_closed_at ON closed_trades(closed_at DESC);
