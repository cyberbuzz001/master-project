-- Migration 006: Options Derivatives Engine Schema
-- Expiry Calendars, Dynamic Lot Sizes, Margin Parameters, Zero Brokerage, Statutory Charge Configuration

-- ================================================
-- 1. EXPIRY CALENDARS
-- ================================================
CREATE TABLE IF NOT EXISTS expiry_calendars (
  id                      TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  index_name              TEXT UNIQUE NOT NULL, -- NIFTY, SENSEX, BANKNIFTY, BANKEX, FINNIFTY, MIDCPNIFTY
  exchange                TEXT NOT NULL CHECK (exchange IN ('NSE','BSE','NFO','BFO')),
  underlying_symbol       TEXT NOT NULL,
  trading_symbol_prefix   TEXT NOT NULL,
  weekly_expiry_supported BOOLEAN NOT NULL DEFAULT TRUE,
  monthly_expiry_supported BOOLEAN NOT NULL DEFAULT TRUE,
  expiry_weekday          INTEGER NOT NULL DEFAULT 4 CHECK (expiry_weekday BETWEEN 0 AND 6), -- 0=Sun, 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat
  holiday_adjustment_rule TEXT NOT NULL DEFAULT 'PREVIOUS_TRADING_DAY' CHECK (holiday_adjustment_rule IN ('PREVIOUS_TRADING_DAY', 'NEXT_TRADING_DAY')),
  active                  BOOLEAN NOT NULL DEFAULT TRUE,
  effective_from          DATE NOT NULL DEFAULT CURRENT_DATE,
  effective_to            DATE,
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_expiry_calendars_index ON expiry_calendars(index_name);
CREATE INDEX IF NOT EXISTS idx_expiry_calendars_exch  ON expiry_calendars(exchange);

-- Seed dynamic expiry calendar configurations
INSERT INTO expiry_calendars (id, index_name, exchange, underlying_symbol, trading_symbol_prefix, weekly_expiry_supported, monthly_expiry_supported, expiry_weekday, holiday_adjustment_rule)
VALUES
  ('exp_nifty',     'NIFTY',      'NSE', 'NIFTY 50',    'NIFTY',      TRUE,  TRUE, 2, 'PREVIOUS_TRADING_DAY'), -- Tuesday weekly & Last Tuesday monthly
  ('exp_sensex',    'SENSEX',     'BSE', 'SENSEX',      'SENSEX',     TRUE,  TRUE, 4, 'PREVIOUS_TRADING_DAY'), -- Thursday weekly & Last Thursday monthly
  ('exp_banknifty', 'BANKNIFTY',  'NSE', 'BANKNIFTY',   'BANKNIFTY',  FALSE, TRUE, 2, 'PREVIOUS_TRADING_DAY'), -- Monthly expiry only (Last Tuesday)
  ('exp_bankex',    'BANKEX',     'BSE', 'BANKEX',      'BANKEX',     FALSE, TRUE, 4, 'PREVIOUS_TRADING_DAY'), -- Monthly expiry only (Last Thursday)
  ('exp_finnifty',  'FINNIFTY',   'NSE', 'FINNIFTY',    'FINNIFTY',   FALSE, TRUE, 2, 'PREVIOUS_TRADING_DAY'), -- Monthly expiry only (Last Tuesday)
  ('exp_midcp',     'MIDCPNIFTY', 'NSE', 'MIDCPNIFTY',  'MIDCPNIFTY', FALSE, TRUE, 2, 'PREVIOUS_TRADING_DAY')  -- Monthly expiry only (Last Tuesday)
ON CONFLICT (index_name) DO UPDATE SET
  weekly_expiry_supported  = EXCLUDED.weekly_expiry_supported,
  monthly_expiry_supported = EXCLUDED.monthly_expiry_supported,
  expiry_weekday           = EXCLUDED.expiry_weekday,
  updated_at               = NOW();

-- ================================================
-- 2. LOT SIZE HISTORY & ACTIVE CONFIGURATION
-- ================================================
CREATE TABLE IF NOT EXISTS lot_size_history (
  id             TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  underlying     TEXT NOT NULL,
  exchange       TEXT NOT NULL,
  lot_size       INTEGER NOT NULL CHECK (lot_size > 0),
  effective_date DATE NOT NULL DEFAULT CURRENT_DATE,
  updated_by     TEXT DEFAULT 'SYSTEM',
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lot_size_history_symbol ON lot_size_history(underlying, exchange);

-- Seed authoritative lot sizes
INSERT INTO lot_size_history (id, underlying, exchange, lot_size, effective_date)
VALUES
  ('lot_nifty',     'NIFTY',      'NSE', 65,  '2026-01-01'),
  ('lot_sensex',    'SENSEX',     'BSE', 20,  '2026-01-01'),
  ('lot_banknifty', 'BANKNIFTY',  'NSE', 30,  '2026-01-01'),
  ('lot_bankex',    'BANKEX',     'BSE', 30,  '2026-01-01'),
  ('lot_finnifty',  'FINNIFTY',   'NSE', 60,  '2026-01-01'),
  ('lot_midcp',     'MIDCPNIFTY', 'NSE', 120, '2026-01-01')
ON CONFLICT (id) DO NOTHING;

-- Update instruments lot sizes in DB
UPDATE instruments SET lot_size = 65  WHERE symbol = 'NIFTY' OR symbol = 'NIFTY 50' OR name = 'NIFTY';
UPDATE instruments SET lot_size = 20  WHERE symbol = 'SENSEX' OR name = 'SENSEX';
UPDATE instruments SET lot_size = 30  WHERE symbol = 'BANKNIFTY' OR name = 'BANKNIFTY';
UPDATE instruments SET lot_size = 30  WHERE symbol = 'BANKEX' OR name = 'BANKEX';
UPDATE instruments SET lot_size = 60  WHERE symbol = 'FINNIFTY' OR name = 'FINNIFTY';
UPDATE instruments SET lot_size = 120 WHERE symbol = 'MIDCPNIFTY' OR name = 'MIDCPNIFTY';

-- ================================================
-- 3. MARGIN PARAMETERS CONFIGURATION
-- ================================================
CREATE TABLE IF NOT EXISTS margin_parameters (
  id                     TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  underlying             TEXT UNIQUE NOT NULL,
  exchange               TEXT NOT NULL,
  span_margin_rate       NUMERIC(10,4) NOT NULL DEFAULT 0.1500, -- 15% estimated SPAN fallback
  exposure_margin_rate   NUMERIC(10,4) NOT NULL DEFAULT 0.0300, -- 3% Exposure margin
  additional_margin_rate NUMERIC(10,4) NOT NULL DEFAULT 0.0000,
  rms_buffer_pct         NUMERIC(10,4) NOT NULL DEFAULT 0.0500, -- 5% RMS Buffer
  minimum_margin         NUMERIC(15,2) NOT NULL DEFAULT 0.00,
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO margin_parameters (id, underlying, exchange, span_margin_rate, exposure_margin_rate, rms_buffer_pct)
VALUES
  ('mpg_nifty',     'NIFTY',      'NSE', 0.1200, 0.0300, 0.0500),
  ('mpg_sensex',    'SENSEX',     'BSE', 0.1200, 0.0300, 0.0500),
  ('mpg_banknifty', 'BANKNIFTY',  'NSE', 0.1500, 0.0300, 0.0500),
  ('mpg_bankex',    'BANKEX',     'BSE', 0.1500, 0.0300, 0.0500),
  ('mpg_finnifty',  'FINNIFTY',   'NSE', 0.1400, 0.0300, 0.0500),
  ('mpg_midcp',     'MIDCPNIFTY', 'NSE', 0.1600, 0.0300, 0.0500)
ON CONFLICT (underlying) DO NOTHING;

-- ================================================
-- 4. BROKERAGE CONFIGURATION (ZERO BROKERAGE POLICY)
-- ================================================
CREATE TABLE IF NOT EXISTS brokerage_config (
  id            TEXT PRIMARY KEY DEFAULT 'primary_brokerage_config',
  mode          TEXT NOT NULL DEFAULT 'FREE' CHECK (mode IN ('FREE', 'CHARGED')),
  equity_flat   NUMERIC(10,2) NOT NULL DEFAULT 0.00,
  options_flat  NUMERIC(10,2) NOT NULL DEFAULT 0.00,
  intraday_flat NUMERIC(10,2) NOT NULL DEFAULT 0.00,
  updated_by    TEXT DEFAULT 'SYSTEM',
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO brokerage_config (id, mode, equity_flat, options_flat, intraday_flat)
VALUES ('primary_brokerage_config', 'FREE', 0.00, 0.00, 0.00)
ON CONFLICT (id) DO UPDATE SET mode = 'FREE', equity_flat = 0.00, options_flat = 0.00, intraday_flat = 0.00, updated_at = NOW();

-- ================================================
-- 5. STATUTORY CHARGE CONFIGURATION
-- ================================================
CREATE TABLE IF NOT EXISTS statutory_charge_config (
  id                       TEXT PRIMARY KEY DEFAULT 'primary_statutory_config',
  stt_option_sell_rate     NUMERIC(10,6) NOT NULL DEFAULT 0.001250, -- 0.125% on sell premium
  gst_rate                 NUMERIC(10,4) NOT NULL DEFAULT 0.1800,   -- 18% GST on exchange charges
  exchange_turnover_rate   NUMERIC(10,6) NOT NULL DEFAULT 0.000500, -- 0.05% turnover fee
  sebi_turnover_rate       NUMERIC(10,8) NOT NULL DEFAULT 0.000001, -- ₹10 per crore
  stamp_duty_buy_rate      NUMERIC(10,6) NOT NULL DEFAULT 0.000030, -- 0.003% on buy premium
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO statutory_charge_config (id)
VALUES ('primary_statutory_config')
ON CONFLICT (id) DO NOTHING;

-- ================================================
-- 6. MARGIN SNAPSHOTS & AUDIT LOGS
-- ================================================
CREATE TABLE IF NOT EXISTS margin_snapshots (
  id                  TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  user_id             TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  total_margin        NUMERIC(20,4) NOT NULL,
  span_margin         NUMERIC(20,4) NOT NULL,
  exposure_margin     NUMERIC(20,4) NOT NULL,
  additional_margin   NUMERIC(20,4) NOT NULL,
  available_funds     NUMERIC(20,4) NOT NULL,
  margin_utilization  NUMERIC(8,4) NOT NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_margin_snapshots_user ON margin_snapshots(user_id, created_at DESC);
