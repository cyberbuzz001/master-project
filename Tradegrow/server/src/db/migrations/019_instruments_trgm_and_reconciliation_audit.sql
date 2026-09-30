-- Migration: 019_instruments_trgm_and_reconciliation_audit.sql
-- Description: pg_trgm GIN Indexes on instruments table & RMS reconciliation and margin audit logging

-- 1. Enable pg_trgm extension for high-performance substring/fuzzy matching
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 2. GIN Trigram index on instruments symbol
CREATE INDEX IF NOT EXISTS idx_instruments_symbol_trgm
  ON instruments USING gin (symbol gin_trgm_ops);

-- 3. GIN Trigram index on instruments name
CREATE INDEX IF NOT EXISTS idx_instruments_name_trgm
  ON instruments USING gin (name gin_trgm_ops);

-- 4. BTree covering index for exact symbol + active + expiry lookups
CREATE INDEX IF NOT EXISTS idx_instruments_sym_act_exp
  ON instruments (symbol, active, expiry);

-- 5. Post-Trade Margin Reconciliation Audit Table
CREATE TABLE IF NOT EXISTS rms_reconciliation_audit (
  id VARCHAR(64) PRIMARY KEY,
  user_id VARCHAR(64) NOT NULL,
  symbol VARCHAR(64) NOT NULL,
  net_qty INT NOT NULL,
  current_ltp NUMERIC(15, 2) NOT NULL,
  required_margin NUMERIC(15, 2) NOT NULL,
  buying_power NUMERIC(15, 2) NOT NULL,
  shortfall NUMERIC(15, 2) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'FLAGGED', -- FLAGGED, CRITICAL, RESOLVED
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reconciliation_user_status
  ON rms_reconciliation_audit (user_id, status, created_at DESC);

-- 6. RMS Pre-Trade Margin Audit Log Table
CREATE TABLE IF NOT EXISTS rms_margin_audit_logs (
  id VARCHAR(64) PRIMARY KEY,
  user_id VARCHAR(64) NOT NULL,
  symbol VARCHAR(64) NOT NULL,
  side VARCHAR(10) NOT NULL,
  quantity INT NOT NULL,
  price NUMERIC(15, 2) NOT NULL,
  required_margin NUMERIC(15, 2) NOT NULL,
  available_funds NUMERIC(15, 2) NOT NULL,
  passed BOOLEAN NOT NULL,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rms_margin_audit_time
  ON rms_margin_audit_logs (created_at DESC, user_id);
