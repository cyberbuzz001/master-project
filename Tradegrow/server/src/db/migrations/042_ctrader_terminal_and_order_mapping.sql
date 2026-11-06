-- Migration 042: cTrader Terminal Connection & Institutional Order Mapping Engine
-- Provides native cTrader Open API integration, OAuth CTID account linkage, and two-way order mapping.

-- ============================================================
-- 1. CTRADER ACCOUNTS (Linked via Spotware OAuth 2.0 / CTID)
-- ============================================================
CREATE TABLE IF NOT EXISTS ctrader_accounts (
  id                    TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  user_id               TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  ctid_trader_account_id BIGINT UNIQUE NOT NULL,
  trader_login          TEXT NOT NULL,
  is_live               BOOLEAN NOT NULL DEFAULT FALSE,
  access_token          TEXT NOT NULL,
  refresh_token         TEXT NOT NULL,
  token_expires_at      TIMESTAMPTZ NOT NULL,
  account_status        TEXT NOT NULL DEFAULT 'ACTIVE'
                        CHECK (account_status IN ('ACTIVE','DISABLED','SUSPENDED')),
  server_name           TEXT NOT NULL DEFAULT 'cTrader Demo',
  currency              TEXT NOT NULL DEFAULT 'INR',
  leverage              INTEGER NOT NULL DEFAULT 100,
  balance               NUMERIC(20,4) NOT NULL DEFAULT 0.0,
  equity                NUMERIC(20,4) NOT NULL DEFAULT 0.0,
  margin_used           NUMERIC(20,4) NOT NULL DEFAULT 0.0,
  free_margin           NUMERIC(20,4) NOT NULL DEFAULT 0.0,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ctrader_accounts_user_id ON ctrader_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_ctrader_accounts_ctid    ON ctrader_accounts(ctid_trader_account_id);
CREATE INDEX IF NOT EXISTS idx_ctrader_accounts_status  ON ctrader_accounts(account_status);

-- ============================================================
-- 2. CTRADER SYMBOL CATALOG & MAPPING
-- ============================================================
CREATE TABLE IF NOT EXISTS ctrader_symbols (
  id                        TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  symbol_id                 BIGINT UNIQUE NOT NULL,
  symbol_name               TEXT NOT NULL,
  base_asset                TEXT NOT NULL,
  quote_asset               TEXT NOT NULL,
  lot_size                  NUMERIC(15,4) NOT NULL DEFAULT 1.0,
  digits                    INTEGER NOT NULL DEFAULT 2,
  min_volume                BIGINT NOT NULL DEFAULT 100,
  step_volume               BIGINT NOT NULL DEFAULT 100,
  max_volume                BIGINT NOT NULL DEFAULT 1000000000,
  tradegrow_instrument_token TEXT,
  tradegrow_symbol          TEXT,
  is_active                 BOOLEAN NOT NULL DEFAULT TRUE,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ctrader_symbols_name ON ctrader_symbols(symbol_name);
CREATE INDEX IF NOT EXISTS idx_ctrader_symbols_tg   ON ctrader_symbols(tradegrow_symbol);

-- ============================================================
-- 3. TWO-WAY ORDER MAPPINGS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS order_mappings (
  id                    TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  internal_order_id     TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  external_order_id     BIGINT,                 -- cTrader numeric orderId
  external_position_id  BIGINT,                 -- cTrader numeric positionId
  ctid_trader_account_id BIGINT NOT NULL,
  client_order_id       TEXT NOT NULL UNIQUE,   -- Idempotent clOrdId (e.g. TG_USR_TIMESTAMP)
  broker_symbol         TEXT NOT NULL,          -- TradeGrow symbol (e.g. NIFTY26NOV25000CE or RELIANCE)
  ctrader_symbol_id     BIGINT NOT NULL,        -- cTrader numeric symbolId
  mapped_side           TEXT NOT NULL CHECK (mapped_side IN ('BUY','SELL')),
  mapped_volume         BIGINT NOT NULL,        -- Scaled volume in cents
  order_type            TEXT NOT NULL CHECK (order_type IN ('MARKET','LIMIT','STOP','STOP_LIMIT')),
  status                TEXT NOT NULL DEFAULT 'SUBMITTED'
                        CHECK (status IN ('SUBMITTED','ACCEPTED','FILLED','PARTIALLY_FILLED','REJECTED','CANCELLED','EXPIRED')),
  execution_price       NUMERIC(15,4),
  raw_execution_event   JSONB,
  rejection_reason      TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_order_mappings_internal ON order_mappings(internal_order_id);
CREATE INDEX IF NOT EXISTS idx_order_mappings_external ON order_mappings(external_order_id);
CREATE INDEX IF NOT EXISTS idx_order_mappings_position ON order_mappings(external_position_id);
CREATE INDEX IF NOT EXISTS idx_order_mappings_client   ON order_mappings(client_order_id);
CREATE INDEX IF NOT EXISTS idx_order_mappings_status   ON order_mappings(status);
CREATE INDEX IF NOT EXISTS idx_order_mappings_account  ON order_mappings(ctid_trader_account_id);

