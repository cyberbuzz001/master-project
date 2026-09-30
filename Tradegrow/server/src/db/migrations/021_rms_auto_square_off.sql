-- Migration 021: RMS Auto Square-Off Engine
-- Adds configuration, order/trade tagging, and a supporting index for the
-- scheduled MIS auto square-off engine (Phase 1 of the RMS overhaul).

INSERT INTO system_settings (key, value, description) VALUES
  ('RMS_MODE',                          'LIVE',        'RMS engine mode: SIMULATION (log/audit only) or LIVE (submits real square-off orders)'),
  ('MIS_AUTO_SQUARE_OFF_ENABLED',       'true',        'Master on/off switch for the scheduled MIS auto square-off job'),
  ('MIS_AUTO_SQUARE_OFF_TIME',          '15:15',       'IST HH:MM time the auto square-off job runs'),
  ('MIS_AUTO_SQUARE_OFF_PRODUCT_TYPES', 'MIS',         'Comma-separated product_type values subject to auto square-off')
ON CONFLICT (key) DO NOTHING;

ALTER TABLE orders ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'USER';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS reason TEXT;

ALTER TABLE closed_trades DROP CONSTRAINT IF EXISTS closed_trades_exit_reason_check;
ALTER TABLE closed_trades ADD CONSTRAINT closed_trades_exit_reason_check
  CHECK (exit_reason IN ('MARKET_SQUARE_OFF','TARGET_LIMIT','STOP_LOSS','MANUAL_EXIT','PARTIAL_EXIT','EXPIRY','SYSTEM_EXIT','ADMIN_SQUARE_OFF','RMS_AUTO_SQUARE_OFF'));

CREATE INDEX IF NOT EXISTS idx_positions_open_by_product
  ON positions(product_type) WHERE net_qty != 0;
