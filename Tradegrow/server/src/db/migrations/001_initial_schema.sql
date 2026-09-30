-- Migration 001: Core schema — Users, Wallets, Ledger, Orders, Executions, Positions, Holdings
-- Replaces SQLite schema. Adds proper constraints, indexes, and row-level locking support.

-- ================================================
-- EXTENSIONS
-- ================================================
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- ================================================
-- USERS & AUTHENTICATION
-- ================================================
CREATE TABLE IF NOT EXISTS users (
  id                    TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  username              TEXT UNIQUE NOT NULL,
  email                 TEXT UNIQUE NOT NULL,
  password_hash         TEXT NOT NULL,
  role                  TEXT NOT NULL DEFAULT 'USER'
                        CHECK (role IN ('SUPER_ADMIN','ADMIN','MANAGER','FINANCE_MANAGER','RISK_MANAGER','OPERATIONS_MANAGER','KYC_OFFICER','DEALER','SUPPORT_AGENT','ANALYST','USER','READ_ONLY_AUDITOR')),
  status                TEXT NOT NULL DEFAULT 'ACTIVE'
                        CHECK (status IN ('ACTIVE','SUSPENDED','DISABLED','PENDING_VERIFICATION')),
  totp_secret           TEXT,
  is_totp_enabled       BOOLEAN NOT NULL DEFAULT FALSE,
  failed_login_attempts INTEGER NOT NULL DEFAULT 0,
  locked_until          TIMESTAMPTZ,
  last_login_at         TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_email    ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_role     ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_status   ON users(status);

-- ================================================
-- VIRTUAL WALLETS
-- ================================================
CREATE TABLE IF NOT EXISTS virtual_wallets (
  id                  TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  user_id             TEXT UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  cash_balance        NUMERIC(20,4) NOT NULL DEFAULT 1000000.0 CHECK (cash_balance >= 0),
  used_margin         NUMERIC(20,4) NOT NULL DEFAULT 0.0        CHECK (used_margin >= 0),
  realized_pnl        NUMERIC(20,4) NOT NULL DEFAULT 0.0,
  unrealized_pnl      NUMERIC(20,4) NOT NULL DEFAULT 0.0,
  status              TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','FROZEN','SUSPENDED')),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wallets_user_id ON virtual_wallets(user_id);

-- ================================================
-- WALLET LEDGER (IMMUTABLE TRANSACTION JOURNAL)
-- ================================================
CREATE TABLE IF NOT EXISTS wallet_ledger (
  id               TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  transaction_id   TEXT UNIQUE NOT NULL DEFAULT gen_random_uuid()::TEXT,
  user_id          TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  transaction_type TEXT NOT NULL
                   CHECK (transaction_type IN ('CREDIT','DEBIT','MARGIN_BLOCK','MARGIN_RELEASE','PNL_SETTLEMENT','ADMIN_ADJUSTMENT','CHARGE_DEBIT')),
  amount           NUMERIC(20,4) NOT NULL,
  balance_before   NUMERIC(20,4) NOT NULL,
  balance_after    NUMERIC(20,4) NOT NULL,
  reference_id     TEXT,
  created_by       TEXT NOT NULL,
  metadata         JSONB,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Ledger is append-only — never update or delete
CREATE INDEX IF NOT EXISTS idx_ledger_user_id    ON wallet_ledger(user_id);
CREATE INDEX IF NOT EXISTS idx_ledger_created_at ON wallet_ledger(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ledger_type       ON wallet_ledger(transaction_type);

-- ================================================
-- INSTRUMENTS MASTER
-- ================================================
CREATE TABLE IF NOT EXISTS instruments (
  id                TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  instrument_token  TEXT UNIQUE NOT NULL,
  exchange          TEXT NOT NULL CHECK (exchange IN ('NSE','BSE','NFO','BFO','MCX','CDS')),
  segment           TEXT NOT NULL,
  symbol            TEXT NOT NULL,
  trading_symbol    TEXT NOT NULL,
  name              TEXT NOT NULL,
  company_name      TEXT,
  isin              TEXT,
  lot_size          INTEGER NOT NULL DEFAULT 1,
  tick_size         NUMERIC(10,5) NOT NULL DEFAULT 0.05,
  strike            NUMERIC(15,2) DEFAULT 0.0,
  option_type       TEXT DEFAULT 'XX' CHECK (option_type IN ('CE','PE','XX')),
  expiry            DATE,
  instrument_type   TEXT NOT NULL DEFAULT 'EQ',
  active            BOOLEAN NOT NULL DEFAULT TRUE,
  first_seen_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_instruments_symbol   ON instruments(symbol);
CREATE INDEX IF NOT EXISTS idx_instruments_exchange ON instruments(exchange);
CREATE INDEX IF NOT EXISTS idx_instruments_type     ON instruments(instrument_type);
CREATE INDEX IF NOT EXISTS idx_instruments_active   ON instruments(active) WHERE active = TRUE;
CREATE INDEX IF NOT EXISTS idx_instruments_expiry   ON instruments(expiry);

-- ================================================
-- INSTRUMENT MASTER VERSIONS
-- ================================================
CREATE TABLE IF NOT EXISTS instrument_master_versions (
  version_id           TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  source_url           TEXT NOT NULL,
  file_hash            TEXT NOT NULL,
  record_count         INTEGER NOT NULL DEFAULT 0,
  valid_count          INTEGER NOT NULL DEFAULT 0,
  inserted_count       INTEGER NOT NULL DEFAULT 0,
  updated_count        INTEGER NOT NULL DEFAULT 0,
  processing_duration_ms INTEGER NOT NULL DEFAULT 0,
  status               TEXT NOT NULL DEFAULT 'SUCCESS',
  error_message        TEXT,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ================================================
-- INSTRUMENT CHANGE LOG
-- ================================================
CREATE TABLE IF NOT EXISTS instrument_change_log (
  id               TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  instrument_token TEXT NOT NULL,
  change_type      TEXT NOT NULL CHECK (change_type IN ('CREATED','UPDATED','EXPIRED','DEACTIVATED')),
  old_value        JSONB,
  new_value        JSONB,
  source_version   TEXT NOT NULL,
  changed_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_instrument_log_token ON instrument_change_log(instrument_token);

-- ================================================
-- ORDERS
-- ================================================
CREATE TABLE IF NOT EXISTS orders (
  id               TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  order_id         TEXT UNIQUE NOT NULL,
  user_id          TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  instrument_token TEXT NOT NULL,
  exchange         TEXT NOT NULL,
  symbol           TEXT NOT NULL,
  side             TEXT NOT NULL CHECK (side IN ('BUY','SELL')),
  quantity         INTEGER NOT NULL CHECK (quantity > 0),
  filled_quantity  INTEGER NOT NULL DEFAULT 0,
  price            NUMERIC(15,4) NOT NULL DEFAULT 0.0 CHECK (price >= 0),
  trigger_price    NUMERIC(15,4) DEFAULT 0.0,
  average_price    NUMERIC(15,4) DEFAULT 0.0,
  order_type       TEXT NOT NULL CHECK (order_type IN ('MARKET','LIMIT','SL','SL_M')),
  product_type     TEXT NOT NULL CHECK (product_type IN ('MIS','CNC','NRML')),
  status           TEXT NOT NULL DEFAULT 'CREATED'
                   CHECK (status IN ('CREATED','VALIDATING','RMS_CHECK','ACCEPTED','PENDING','EXECUTING','PARTIALLY_FILLED','FILLED','REJECTED','CANCELLED','EXPIRED')),
  rejection_reason TEXT,
  idempotency_key  TEXT UNIQUE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_orders_user_id    ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_status     ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_symbol     ON orders(symbol);

-- ================================================
-- ORDER EVENTS (State Transition History) — NEW
-- ================================================
CREATE TABLE IF NOT EXISTS order_events (
  id          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  order_id    TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  from_status TEXT,
  to_status   TEXT NOT NULL,
  reason      TEXT,
  actor       TEXT NOT NULL DEFAULT 'SYSTEM',
  metadata    JSONB,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_order_events_order_id ON order_events(order_id);

-- ================================================
-- EXECUTIONS / TRADES
-- ================================================
CREATE TABLE IF NOT EXISTS executions (
  id               TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  order_id         TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  user_id          TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  trade_id         TEXT UNIQUE NOT NULL DEFAULT gen_random_uuid()::TEXT,
  symbol           TEXT NOT NULL,
  exchange         TEXT NOT NULL DEFAULT 'NSE',
  side             TEXT NOT NULL CHECK (side IN ('BUY','SELL')),
  quantity         INTEGER NOT NULL CHECK (quantity > 0),
  price            NUMERIC(15,4) NOT NULL CHECK (price > 0),
  brokerage        NUMERIC(10,4) NOT NULL DEFAULT 0.0,
  stt              NUMERIC(10,4) NOT NULL DEFAULT 0.0,
  gst              NUMERIC(10,4) NOT NULL DEFAULT 0.0,
  exchange_charges NUMERIC(10,4) NOT NULL DEFAULT 0.0,
  total_charges    NUMERIC(10,4) NOT NULL DEFAULT 0.0,
  slippage_pct     NUMERIC(8,6) DEFAULT 0.0,
  executed_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_executions_user_id    ON executions(user_id);
CREATE INDEX IF NOT EXISTS idx_executions_order_id   ON executions(order_id);
CREATE INDEX IF NOT EXISTS idx_executions_symbol     ON executions(symbol);
CREATE INDEX IF NOT EXISTS idx_executions_executed_at ON executions(executed_at DESC);

-- ================================================
-- POSITIONS (Intraday + Short-term)
-- ================================================
CREATE TABLE IF NOT EXISTS positions (
  id            TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  user_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  symbol        TEXT NOT NULL,
  exchange      TEXT NOT NULL,
  product_type  TEXT NOT NULL CHECK (product_type IN ('MIS','CNC','NRML')),
  buy_qty       INTEGER NOT NULL DEFAULT 0,
  sell_qty      INTEGER NOT NULL DEFAULT 0,
  net_qty       INTEGER NOT NULL DEFAULT 0,
  buy_price     NUMERIC(15,4) NOT NULL DEFAULT 0.0,
  sell_price    NUMERIC(15,4) NOT NULL DEFAULT 0.0,
  average_price NUMERIC(15,4) NOT NULL DEFAULT 0.0,
  ltp           NUMERIC(15,4) NOT NULL DEFAULT 0.0,
  realized_pnl  NUMERIC(20,4) NOT NULL DEFAULT 0.0,
  unrealized_pnl NUMERIC(20,4) NOT NULL DEFAULT 0.0,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, symbol, product_type)
);

CREATE INDEX IF NOT EXISTS idx_positions_user_id ON positions(user_id);
CREATE INDEX IF NOT EXISTS idx_positions_symbol  ON positions(symbol);

-- ================================================
-- HOLDINGS (CNC Delivery Portfolio)
-- ================================================
CREATE TABLE IF NOT EXISTS holdings (
  id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  user_id         TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  symbol          TEXT NOT NULL,
  exchange        TEXT NOT NULL,
  quantity        INTEGER NOT NULL DEFAULT 0,
  average_price   NUMERIC(15,4) NOT NULL DEFAULT 0.0,
  ltp             NUMERIC(15,4) NOT NULL DEFAULT 0.0,
  current_value   NUMERIC(20,4) NOT NULL DEFAULT 0.0,
  pnl             NUMERIC(20,4) NOT NULL DEFAULT 0.0,
  pnl_percentage  NUMERIC(8,4) NOT NULL DEFAULT 0.0,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, symbol)
);

CREATE INDEX IF NOT EXISTS idx_holdings_user_id ON holdings(user_id);

-- ================================================
-- PORTFOLIO SNAPSHOTS (Daily P&L History)
-- ================================================
CREATE TABLE IF NOT EXISTS portfolio_snapshots (
  id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  user_id         TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  snapshot_date   DATE NOT NULL,
  total_value     NUMERIC(20,4) NOT NULL,
  cash_balance    NUMERIC(20,4) NOT NULL,
  holdings_value  NUMERIC(20,4) NOT NULL DEFAULT 0.0,
  positions_pnl   NUMERIC(20,4) NOT NULL DEFAULT 0.0,
  realized_pnl    NUMERIC(20,4) NOT NULL DEFAULT 0.0,
  day_pnl         NUMERIC(20,4) NOT NULL DEFAULT 0.0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, snapshot_date)
);

CREATE INDEX IF NOT EXISTS idx_snapshots_user_id ON portfolio_snapshots(user_id);
CREATE INDEX IF NOT EXISTS idx_snapshots_date    ON portfolio_snapshots(snapshot_date DESC);

-- ================================================
-- UPDATED_AT TRIGGER FUNCTION
-- ================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to mutable tables
DO $$ BEGIN
  CREATE TRIGGER trg_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TRIGGER trg_wallets_updated_at
    BEFORE UPDATE ON virtual_wallets
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TRIGGER trg_orders_updated_at
    BEFORE UPDATE ON orders
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
