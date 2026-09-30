-- Migration 002: Watchlists, Alerts, Audit Logs, System Settings, Sessions

-- ================================================
-- WATCHLISTS
-- ================================================
CREATE TABLE IF NOT EXISTS watchlists (
  id         TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_watchlists_user_id ON watchlists(user_id);

CREATE TABLE IF NOT EXISTS watchlist_items (
  id               TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  watchlist_id     TEXT NOT NULL REFERENCES watchlists(id) ON DELETE CASCADE,
  instrument_token TEXT NOT NULL,
  symbol           TEXT NOT NULL,
  exchange         TEXT NOT NULL,
  sort_order       INTEGER NOT NULL DEFAULT 0,
  added_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(watchlist_id, instrument_token)
);

CREATE INDEX IF NOT EXISTS idx_watchlist_items_watchlist ON watchlist_items(watchlist_id);

-- ================================================
-- PRICE ALERTS
-- ================================================
CREATE TABLE IF NOT EXISTS alerts (
  id             TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  user_id        TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  instrument_token TEXT NOT NULL,
  symbol         TEXT NOT NULL,
  condition_type TEXT NOT NULL CHECK (condition_type IN ('GREATER_THAN','LESS_THAN','CROSSES_ABOVE','CROSSES_BELOW')),
  target_value   NUMERIC(15,4) NOT NULL,
  status         TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','TRIGGERED','CANCELLED','EXPIRED')),
  message        TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  triggered_at   TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_alerts_user_id ON alerts(user_id);
CREATE INDEX IF NOT EXISTS idx_alerts_status  ON alerts(status) WHERE status = 'ACTIVE';
CREATE INDEX IF NOT EXISTS idx_alerts_symbol  ON alerts(symbol);

-- ================================================
-- NOTIFICATIONS
-- ================================================
CREATE TABLE IF NOT EXISTS notifications (
  id          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type        TEXT NOT NULL CHECK (type IN ('ORDER_FILLED','ORDER_REJECTED','ALERT_TRIGGERED','SYSTEM','ADMIN_MESSAGE')),
  title       TEXT NOT NULL,
  body        TEXT NOT NULL,
  is_read     BOOLEAN NOT NULL DEFAULT FALSE,
  metadata    JSONB,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  read_at     TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id    ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_unread     ON notifications(user_id) WHERE is_read = FALSE;
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);

-- ================================================
-- AUDIT LOGS (Immutable)
-- ================================================
CREATE TABLE IF NOT EXISTS audit_logs (
  id            TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  actor_id      TEXT NOT NULL,
  actor_role    TEXT NOT NULL,
  action        TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id   TEXT,
  before_state  JSONB,
  after_state   JSONB,
  ip_address    INET,
  user_agent    TEXT,
  request_id    TEXT,
  timestamp     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_actor_id  ON audit_logs(actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_action    ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON audit_logs(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_audit_resource  ON audit_logs(resource_type, resource_id);

-- ================================================
-- SYSTEM SETTINGS & RISK CONTROL PARAMS
-- ================================================
CREATE TABLE IF NOT EXISTS system_settings (
  key         TEXT PRIMARY KEY,
  value       TEXT NOT NULL,
  description TEXT,
  is_secret   BOOLEAN NOT NULL DEFAULT FALSE,
  updated_by  TEXT,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ================================================
-- FEATURE FLAGS
-- ================================================
CREATE TABLE IF NOT EXISTS feature_flags (
  key         TEXT PRIMARY KEY,
  enabled     BOOLEAN NOT NULL DEFAULT FALSE,
  description TEXT,
  updated_by  TEXT,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ================================================
-- SESSIONS & REFRESH TOKENS
-- ================================================
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash  TEXT UNIQUE NOT NULL,
  device_info TEXT,
  ip_address  INET,
  expires_at  TIMESTAMPTZ NOT NULL,
  revoked_at  TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id    ON refresh_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_token_hash ON refresh_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_expires_at ON refresh_tokens(expires_at);

-- ================================================
-- SEED DEFAULT SYSTEM SETTINGS
-- ================================================
INSERT INTO system_settings (key, value, description) VALUES
  ('MAX_ORDER_QTY',                    '10000',  'Maximum allowed quantity per order'),
  ('MAX_ORDER_VALUE',                  '5000000','Maximum order value in INR'),
  ('MAX_POSITION_LIMIT',               '50000',  'Maximum accumulated position quantity'),
  ('INTRADAY_LEVERAGE_MULTIPLIER',     '5',      'Leverage multiplier for MIS Intraday orders'),
  ('SIMULATED_BROKERAGE_PERCENT',      '0.0003', 'Simulated brokerage fee multiplier (0.03%)'),
  ('REAL_MONEY_TRADING',               'false',  'Hardcoded system safety lock — never change'),
  ('DEFAULT_VIRTUAL_CAPITAL',          '1000000','Default virtual capital for new users (INR)'),
  ('MAX_DAILY_LOSS_PCT',               '50',     'Max daily loss as % of starting capital before trading halt'),
  ('MIN_PASSWORD_LENGTH',              '8',      'Minimum password length for user accounts'),
  ('SESSION_DURATION_HOURS',           '24',     'Default JWT access token validity in hours')
ON CONFLICT (key) DO NOTHING;

-- Seed feature flags
INSERT INTO feature_flags (key, enabled, description) VALUES
  ('ENABLE_MARKET_DATA',       TRUE,  'Enable market data feed'),
  ('ENABLE_ANGELONE',          TRUE,  'Enable Angel One SmartAPI market data'),
  ('ENABLE_ALPHAVANTAGE',      TRUE,  'Enable Alpha Vantage market data'),
  ('ENABLE_OPTIONS',           TRUE,  'Enable options trading simulation'),
  ('ENABLE_PAPER_TRADING',     TRUE,  'Enable paper trading'),
  ('ENABLE_ADMIN',             TRUE,  'Enable admin panel'),
  ('ENABLE_2FA',               TRUE,  'Enable TOTP 2FA for users'),
  ('REAL_MONEY_TRADING_ENABLED', FALSE, 'PERMANENT: Real money trading — MUST REMAIN FALSE')
ON CONFLICT (key) DO NOTHING;
