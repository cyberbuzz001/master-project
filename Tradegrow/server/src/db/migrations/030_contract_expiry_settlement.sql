-- Migration 030: Contract Expiry Settlement & Clean System Settings
-- Ensures automated settlement for expired derivatives (options & futures)
-- and repairs corrupted system_settings keys.

-- 1. Restore/Upsert valid system_settings keys
INSERT INTO system_settings (key, value, description) VALUES
  ('EXPIRY_SETTLEMENT_ENABLED',          'true',        'Master switch for daily 15:30 IST contract expiry settlement'),
  ('EXPIRY_SETTLEMENT_TIME',             '15:30',       'IST HH:MM time the daily contract expiry settlement runs'),
  ('MIS_AUTO_SQUARE_OFF_ENABLED',        'true',        'Master on/off switch for the scheduled MIS auto square-off job'),
  ('MIS_AUTO_SQUARE_OFF_TIME',           '15:15',       'IST HH:MM time the auto square-off job runs'),
  ('MIS_AUTO_SQUARE_OFF_PRODUCT_TYPES',  'MIS',         'Comma-separated product_type values subject to auto square-off')
ON CONFLICT (key) DO NOTHING;

-- If keys were previously corrupted with 'LIVE', repair them to valid defaults
UPDATE system_settings
SET value = 'true', updated_at = NOW()
WHERE key = 'MIS_AUTO_SQUARE_OFF_ENABLED' AND value = 'LIVE';

UPDATE system_settings
SET value = '15:15', updated_at = NOW()
WHERE key = 'MIS_AUTO_SQUARE_OFF_TIME' AND value = 'LIVE';

UPDATE system_settings
SET value = 'MIS', updated_at = NOW()
WHERE key = 'MIS_AUTO_SQUARE_OFF_PRODUCT_TYPES' AND value = 'LIVE';

-- 2. Ensure closed_trades exit_reason check includes all settlement & expiry reasons
ALTER TABLE closed_trades DROP CONSTRAINT IF EXISTS closed_trades_exit_reason_check;
ALTER TABLE closed_trades ADD CONSTRAINT closed_trades_exit_reason_check
  CHECK (exit_reason IN (
    'MARKET_SQUARE_OFF',
    'TARGET_LIMIT',
    'STOP_LOSS',
    'MANUAL_EXIT',
    'PARTIAL_EXIT',
    'EXPIRY',
    'EXPIRY_SETTLEMENT',
    'EXPIRED_WORTHLESS',
    'SYSTEM_EXIT',
    'ADMIN_SQUARE_OFF',
    'RMS_AUTO_SQUARE_OFF',
    'RMS_LOSS_SQUARE_OFF'
  ));

-- 3. Helpful indexes for fast expiry lookups
CREATE INDEX IF NOT EXISTS idx_closed_trades_exit_reason
  ON closed_trades(exit_reason, closed_at DESC);
