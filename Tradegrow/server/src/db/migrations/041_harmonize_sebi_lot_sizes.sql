-- ============================================================
-- Migration 041: Harmonize SEBI Lot Sizes Across Instruments & Derivatives
-- Document Reference: Audit Finding H-01
-- Mandate: Authoritative reconciliation to 65 (NIFTY), 30 (BANKNIFTY),
-- 20 (SENSEX), 60 (FINNIFTY), 120 (MIDCPNIFTY), 30 (BANKEX).
-- ============================================================

-- Ensure lot_size_history table exists
CREATE TABLE IF NOT EXISTS lot_size_history (
  id             TEXT PRIMARY KEY,
  underlying     TEXT NOT NULL,
  exchange       TEXT NOT NULL,
  lot_size       INTEGER NOT NULL,
  effective_date DATE NOT NULL,
  updated_by     TEXT DEFAULT 'SYSTEM',
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Insert or update latest SEBI standardized lot sizes
INSERT INTO lot_size_history (id, underlying, exchange, lot_size, effective_date, updated_by)
VALUES
  ('lot_nifty_2026',      'NIFTY',      'NSE', 65,  '2026-01-01', 'SEBI_MIGRATION_041'),
  ('lot_sensex_2026',     'SENSEX',     'BSE', 20,  '2026-01-01', 'SEBI_MIGRATION_041'),
  ('lot_banknifty_2026',  'BANKNIFTY',  'NSE', 30,  '2026-01-01', 'SEBI_MIGRATION_041'),
  ('lot_bankex_2026',     'BANKEX',     'BSE', 30,  '2026-01-01', 'SEBI_MIGRATION_041'),
  ('lot_finnifty_2026',   'FINNIFTY',   'NSE', 60,  '2026-01-01', 'SEBI_MIGRATION_041'),
  ('lot_midcp_2026',      'MIDCPNIFTY', 'NSE', 120, '2026-01-01', 'SEBI_MIGRATION_041')
ON CONFLICT (id) DO UPDATE SET 
  lot_size = EXCLUDED.lot_size,
  effective_date = EXCLUDED.effective_date,
  updated_by = EXCLUDED.updated_by;

-- Update Index Cash Instruments
UPDATE instruments SET lot_size = 65  WHERE symbol IN ('NIFTY', 'NIFTY 50', 'NIFTY50') OR (exchange = 'NSE' AND trading_symbol = 'NIFTY50');
UPDATE instruments SET lot_size = 30  WHERE symbol IN ('BANKNIFTY', 'NIFTY BANK') OR (exchange = 'NSE' AND trading_symbol = 'BANKNIFTY');
UPDATE instruments SET lot_size = 20  WHERE symbol IN ('SENSEX', 'BSE SENSEX') OR (exchange = 'BSE' AND trading_symbol = 'SENSEX');
UPDATE instruments SET lot_size = 60  WHERE symbol = 'FINNIFTY' OR (exchange = 'NSE' AND trading_symbol = 'FINNIFTY');
UPDATE instruments SET lot_size = 120 WHERE symbol = 'MIDCPNIFTY' OR (exchange = 'NSE' AND trading_symbol = 'MIDCPNIFTY');
UPDATE instruments SET lot_size = 30  WHERE symbol = 'BANKEX' OR (exchange = 'BSE' AND trading_symbol = 'BANKEX');

-- Update Derivatives Options & Futures Contracts
UPDATE instruments SET lot_size = 65 
WHERE exchange IN ('NSE','NFO') 
  AND (symbol ILIKE 'NIFTY%' OR trading_symbol ILIKE 'NIFTY%') 
  AND symbol NOT ILIKE 'FINNIFTY%' 
  AND symbol NOT ILIKE 'MIDCPNIFTY%'
  AND trading_symbol NOT ILIKE 'FINNIFTY%' 
  AND trading_symbol NOT ILIKE 'MIDCPNIFTY%';

UPDATE instruments SET lot_size = 30 
WHERE exchange IN ('NSE','NFO') 
  AND (symbol ILIKE 'BANKNIFTY%' OR trading_symbol ILIKE 'BANKNIFTY%');

UPDATE instruments SET lot_size = 20 
WHERE exchange IN ('BSE','BFO') 
  AND (symbol ILIKE 'SENSEX%' OR trading_symbol ILIKE 'SENSEX%');

UPDATE instruments SET lot_size = 60 
WHERE exchange IN ('NSE','NFO') 
  AND (symbol ILIKE 'FINNIFTY%' OR trading_symbol ILIKE 'FINNIFTY%');

UPDATE instruments SET lot_size = 120 
WHERE exchange IN ('NSE','NFO') 
  AND (symbol ILIKE 'MIDCPNIFTY%' OR trading_symbol ILIKE 'MIDCPNIFTY%');

UPDATE instruments SET lot_size = 30 
WHERE exchange IN ('BSE','BFO') 
  AND (symbol ILIKE 'BANKEX%' OR trading_symbol ILIKE 'BANKEX%');

