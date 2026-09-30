-- Migration 022: RMS Loss-Tier Monitor
-- Adds the 6-tier risk-threshold table, the continuous loss-monitor config,
-- a per-user reduce-only restriction flag, and supporting indexes for
-- Phase 2 of the RMS overhaul (80%-loss auto-liquidation).

CREATE TABLE IF NOT EXISTS rms_risk_tiers (
  tier_name     TEXT PRIMARY KEY,
  threshold_pct NUMERIC NOT NULL,
  severity      TEXT NOT NULL,
  action        TEXT NOT NULL CHECK (action IN ('LOG','RESTRICT','SQUAREOFF','SUSPEND')),
  sort_order    INT NOT NULL
);

INSERT INTO rms_risk_tiers (tier_name, threshold_pct, severity, action, sort_order) VALUES
  ('WARNING',         50,  'LOW',      'LOG',       1),
  ('ALERT',           60,  'MEDIUM',   'LOG',       2),
  ('CRITICAL',        70,  'HIGH',     'RESTRICT',  3),
  ('AUTO_SQUARE_OFF', 80,  'HIGH',     'SQUAREOFF', 4),
  ('EMERGENCY',       90,  'CRITICAL', 'SQUAREOFF', 5),
  ('HARD_BREACH',     100, 'CRITICAL', 'SUSPEND',   6)
ON CONFLICT (tier_name) DO NOTHING;

INSERT INTO system_settings (key, value, description) VALUES
  ('RMS_LOSS_MONITOR_ENABLED',     'true', 'Master on/off switch for the continuous loss-tier monitor'),
  ('RMS_LOSS_MONITOR_INTERVAL_MS', '3000', 'Poll cadence for the loss-tier monitor, in milliseconds')
ON CONFLICT (key) DO NOTHING;

ALTER TABLE users ADD COLUMN IF NOT EXISTS risk_restriction TEXT
  CHECK (risk_restriction IS NULL OR risk_restriction = 'REDUCE_ONLY');

CREATE INDEX IF NOT EXISTS idx_orders_rms_dedup
  ON orders(user_id, symbol, product_type, status)
  WHERE source = 'RMS' AND status IN ('ACCEPTED','PENDING','EXECUTING');

CREATE INDEX IF NOT EXISTS idx_positions_open_all
  ON positions(net_qty)
  INCLUDE (user_id, symbol, exchange, product_type, average_price, ltp)
  WHERE net_qty != 0;
