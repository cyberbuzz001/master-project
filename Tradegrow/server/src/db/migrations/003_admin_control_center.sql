-- ============================================================
-- Migration 003: Admin Control Center Tables
-- KYC Records, Risk Events, Risk Limits, Kill Switch Log, Support Tickets
-- ============================================================

-- KYC Records
CREATE TABLE IF NOT EXISTS kyc_records (
  id VARCHAR(64) PRIMARY KEY,
  customer_id VARCHAR(64) NOT NULL REFERENCES users(id),
  kyc_status VARCHAR(30) NOT NULL DEFAULT 'DRAFT',
  verification_status VARCHAR(30) DEFAULT 'PENDING',
  risk_category VARCHAR(20) DEFAULT 'MEDIUM',
  document_type VARCHAR(50),
  document_reference TEXT,
  notes TEXT,
  verified_by VARCHAR(64),
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_kyc_records_customer ON kyc_records(customer_id);
CREATE INDEX IF NOT EXISTS idx_kyc_records_status ON kyc_records(kyc_status);

-- Risk Events
CREATE TABLE IF NOT EXISTS risk_events (
  id VARCHAR(64) PRIMARY KEY,
  customer_id VARCHAR(64) REFERENCES users(id),
  event_type VARCHAR(50) NOT NULL,
  severity VARCHAR(20) NOT NULL DEFAULT 'MEDIUM',
  details JSONB DEFAULT '{}',
  resolved BOOLEAN NOT NULL DEFAULT FALSE,
  resolved_by VARCHAR(64),
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_risk_events_customer ON risk_events(customer_id);
CREATE INDEX IF NOT EXISTS idx_risk_events_severity ON risk_events(severity);
CREATE INDEX IF NOT EXISTS idx_risk_events_resolved ON risk_events(resolved);

-- Risk Limits
CREATE TABLE IF NOT EXISTS risk_limits (
  id VARCHAR(64) PRIMARY KEY,
  scope_type VARCHAR(30) NOT NULL,
  scope_id VARCHAR(64) NOT NULL,
  max_order_value NUMERIC(20,2) DEFAULT 10000000,
  max_order_quantity NUMERIC(20,4) DEFAULT 50000,
  max_exposure NUMERIC(20,2) DEFAULT 50000000,
  max_position NUMERIC(20,4) DEFAULT 100000,
  status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_risk_limits_scope ON risk_limits(scope_type, scope_id);

-- Kill Switch Log (append-only audit trail for trading halts)
CREATE TABLE IF NOT EXISTS kill_switch_log (
  id VARCHAR(64) PRIMARY KEY,
  actor_id VARCHAR(64) NOT NULL,
  actor_role VARCHAR(30) NOT NULL,
  scope VARCHAR(50) NOT NULL,
  action VARCHAR(20) NOT NULL,
  reason TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_kill_switch_log_scope ON kill_switch_log(scope);

-- Support Tickets
CREATE TABLE IF NOT EXISTS support_tickets (
  id VARCHAR(64) PRIMARY KEY,
  customer_id VARCHAR(64) REFERENCES users(id),
  assigned_to VARCHAR(64),
  category VARCHAR(50) NOT NULL DEFAULT 'GENERAL',
  priority VARCHAR(20) NOT NULL DEFAULT 'MEDIUM',
  status VARCHAR(30) NOT NULL DEFAULT 'NEW',
  subject TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_support_tickets_customer ON support_tickets(customer_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_status ON support_tickets(status);

-- Trading Kill Switch State (current state of each scope)
CREATE TABLE IF NOT EXISTS kill_switch_state (
  scope VARCHAR(50) PRIMARY KEY,
  is_active BOOLEAN NOT NULL DEFAULT FALSE,
  activated_by VARCHAR(64),
  activated_at TIMESTAMPTZ,
  reason TEXT
);

-- Seed default kill switch scopes (all ACTIVE = trading allowed)
INSERT INTO kill_switch_state (scope, is_active) VALUES
  ('GLOBAL', FALSE),
  ('NSE', FALSE),
  ('BSE', FALSE),
  ('MCX', FALSE),
  ('EQUITY', FALSE),
  ('FUTURES', FALSE),
  ('OPTIONS', FALSE)
ON CONFLICT (scope) DO NOTHING;
