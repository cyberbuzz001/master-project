-- =============================================================================
-- Migration 046: AI Research Reports Engine & Multi-Channel Distribution System
-- 1. Create research_reports table for institutional research reports
-- 2. Create research_distributions table for multi-channel delivery audit logs
-- 3. Seed default system_settings for automated AI scheduling and distribution
-- =============================================================================

-- ─── 1. Research Reports Table ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS research_reports (
  id                   TEXT PRIMARY KEY DEFAULT ('rep_' || gen_random_uuid()::TEXT),
  report_code          TEXT UNIQUE NOT NULL,
  category             TEXT NOT NULL,
  title                TEXT NOT NULL,
  summary              TEXT NOT NULL,
  timeframe            TEXT NOT NULL DEFAULT 'Intraday',
  sentiment            TEXT NOT NULL CHECK (sentiment IN ('Bullish', 'Bearish', 'Neutral', 'High Alert')),
  author               TEXT NOT NULL DEFAULT 'AI Quantitative Desk',
  compliance_id        TEXT NOT NULL,
  read_time            TEXT NOT NULL DEFAULT '3 min read',
  tags                 TEXT[] DEFAULT '{}',
  metrics              JSONB DEFAULT '[]'::JSONB,
  content              JSONB NOT NULL,
  recommendations      JSONB DEFAULT '[]'::JSONB,
  disclosures          JSONB DEFAULT '{}'::JSONB,
  status               TEXT NOT NULL DEFAULT 'PUBLISHED' CHECK (status IN ('DRAFT', 'GENERATED', 'APPROVED', 'PUBLISHED', 'ARCHIVED')),
  source_data_snapshot JSONB,
  published_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  valid_until          TIMESTAMPTZ,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_research_reports_status ON research_reports(status);
CREATE INDEX IF NOT EXISTS idx_research_reports_category ON research_reports(category);
CREATE INDEX IF NOT EXISTS idx_research_reports_published_at ON research_reports(published_at DESC);
CREATE INDEX IF NOT EXISTS idx_research_reports_sentiment ON research_reports(sentiment);

-- ─── 2. Research Distributions Audit Table ───────────────────────────────────
CREATE TABLE IF NOT EXISTS research_distributions (
  id                  TEXT PRIMARY KEY DEFAULT ('dist_' || gen_random_uuid()::TEXT),
  report_id           TEXT NOT NULL REFERENCES research_reports(id) ON DELETE CASCADE,
  recipient_id        TEXT,
  recipient_name      TEXT,
  channel             TEXT NOT NULL CHECK (channel IN ('WHATSAPP', 'EMAIL', 'WEBSOCKET', 'IN_APP')),
  destination         TEXT NOT NULL,
  status              TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'SENT', 'DELIVERED', 'FAILED', 'SKIPPED')),
  external_message_id TEXT,
  error_message       TEXT,
  sent_at             TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_research_distributions_report_id ON research_distributions(report_id);
CREATE INDEX IF NOT EXISTS idx_research_distributions_recipient_id ON research_distributions(recipient_id);
CREATE INDEX IF NOT EXISTS idx_research_distributions_channel ON research_distributions(channel);
CREATE INDEX IF NOT EXISTS idx_research_distributions_status ON research_distributions(status);

-- ─── 3. Seed Default AI Research Configuration ──────────────────────────────
INSERT INTO system_settings (key, value, description)
VALUES 
  ('AI_RESEARCH_AUTO_SCHEDULE_ENABLED', 'true', 'Master toggle for daily automated research report generation'),
  ('AI_RESEARCH_AUTO_DISPATCH_WHATSAPP', 'true', 'Automatically dispatch published reports to opted-in WhatsApp clients'),
  ('AI_RESEARCH_AUTO_DISPATCH_EMAIL', 'true', 'Automatically dispatch published reports to active email subscribers'),
  ('AI_RESEARCH_SEBI_ENTITY', 'TradeGrow Securities Pvt Ltd / Expert Stocks Advisory (SEBI Reg: INH000012345)', 'SEBI compliance entity signature attached to AI reports'),
  ('AI_RESEARCH_ANALYST_NAME', 'Quantitative Research Cell', 'Designated research analyst desk credit')
ON CONFLICT (key) DO NOTHING;

-- ─── 4. Notifications Check Constraint Update ────────────────────────────────
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE notifications ADD CONSTRAINT notifications_type_check
  CHECK (type IN ('ORDER_FILLED', 'ORDER_REJECTED', 'ALERT_TRIGGERED', 'SYSTEM', 'ADMIN_MESSAGE', 'RESEARCH_REPORT'));
