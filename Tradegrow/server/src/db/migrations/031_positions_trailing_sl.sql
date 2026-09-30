-- Migration 031: Position-Level Stop-Loss & Trailing Stop-Loss
ALTER TABLE positions
  ADD COLUMN IF NOT EXISTS stop_loss_price NUMERIC(15,4) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS trailing_sl_step NUMERIC(15,4) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS trailing_sl_jump NUMERIC(15,4) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS highest_ltp_since_sl NUMERIC(15,4) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS lowest_ltp_since_sl NUMERIC(15,4) DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_positions_sl ON positions(user_id) WHERE stop_loss_price IS NOT NULL AND net_qty != 0;
