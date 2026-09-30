-- ============================================================
-- Migration: 005_market_data_config_storage.sql
-- Description: Dynamic Market Data Provider Config, API Keys & Local Historical Storage
-- ============================================================

-- 1. System Configuration Table (Stores dynamic provider settings & API keys)
CREATE TABLE IF NOT EXISTS system_config (
  key VARCHAR(100) PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Local Market Candles Table (Stores downloaded historical market data locally)
CREATE TABLE IF NOT EXISTS local_market_candles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instrument_token VARCHAR(100) NOT NULL,
  symbol VARCHAR(50) NOT NULL,
  exchange VARCHAR(20) NOT NULL DEFAULT 'NSE',
  timeframe VARCHAR(20) NOT NULL,
  timestamp BIGINT NOT NULL,
  datetime TIMESTAMP WITH TIME ZONE NOT NULL,
  open NUMERIC(15, 4) NOT NULL,
  high NUMERIC(15, 4) NOT NULL,
  low NUMERIC(15, 4) NOT NULL,
  close NUMERIC(15, 4) NOT NULL,
  volume NUMERIC(20, 2) NOT NULL DEFAULT 0,
  provider VARCHAR(50) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT uk_candle_token_tf_ts UNIQUE(instrument_token, timeframe, timestamp)
);

-- Indexes for high-performance querying
CREATE INDEX IF NOT EXISTS idx_local_candles_query ON local_market_candles(instrument_token, timeframe, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_local_candles_symbol ON local_market_candles(symbol, timeframe);

-- Insert default system configuration entries if not existing
INSERT INTO system_config (key, value) VALUES
  ('PRIMARY_MARKET_DATA_PROVIDER', 'ALPHAVANTAGE'),
  ('ALPHAVANTAGE_API_KEY', 'CC23XT2DVHARWKAU'),
  ('ANGELONE_API_KEY', '4DBv6HvT'),
  ('ANGELONE_CLIENT_ID', 'N89824'),
  ('ANGELONE_CLIENT_SECRET', '9691'),
  ('ANGELONE_TOTP_SECRET', 'AV7KF7BEJBOOCVIS53TZZB2VEU'),
  ('INDIAN_STOCK_MARKET_API_BASE_URL', 'https://indian-stock-market-api.p.rapidapi.com')
ON CONFLICT (key) DO NOTHING;
