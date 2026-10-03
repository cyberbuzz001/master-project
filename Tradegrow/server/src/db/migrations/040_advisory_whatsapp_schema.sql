-- =============================================================================
-- Migration 040: Advisory WhatsApp Schema (Expert Stocks — Meta Cloud API)
-- =============================================================================
-- Creates the advisory.* namespace, separate from warroom.* (TradeGrow).
-- Tables:
--   advisory.whatsapp_contacts — opt-in/opt-out registry per phone number
--   advisory.whatsapp_messages — full audit ledger for inbound/outbound messages
-- =============================================================================

-- Create advisory schema
CREATE SCHEMA IF NOT EXISTS advisory;

-- ─── advisory.whatsapp_contacts ──────────────────────────────────────────────
-- Tracks consent status for every contact that has interacted with the bot.
-- One row per phone number (E.164 format, e.g. +919238837041)
CREATE TABLE IF NOT EXISTS advisory.whatsapp_contacts (
    id                  BIGSERIAL PRIMARY KEY,
    phone_e164          VARCHAR(20)     NOT NULL UNIQUE,
    opt_in              BOOLEAN         NOT NULL DEFAULT TRUE,
    opt_out             BOOLEAN         NOT NULL DEFAULT FALSE,
    opt_out_at          TIMESTAMPTZ,
    daily_sent_count    INTEGER         NOT NULL DEFAULT 0,
    last_message_at     TIMESTAMPTZ,
    meta_wa_id          VARCHAR(64),        -- Meta-assigned WhatsApp contact ID
    display_name        VARCHAR(255),       -- From Meta profile (if available)
    created_at          TIMESTAMPTZ         NOT NULL DEFAULT clock_timestamp(),
    updated_at          TIMESTAMPTZ         NOT NULL DEFAULT clock_timestamp()
);

CREATE INDEX IF NOT EXISTS idx_adv_contacts_phone ON advisory.whatsapp_contacts (phone_e164);
CREATE INDEX IF NOT EXISTS idx_adv_contacts_opt_out ON advisory.whatsapp_contacts (opt_out) WHERE opt_out = TRUE;

-- ─── advisory.whatsapp_messages ──────────────────────────────────────────────
-- Full audit ledger — every outbound and inbound message is recorded here.
-- This enables delivery tracking, duplicate detection (idempotency_key), and reporting.
CREATE TABLE IF NOT EXISTS advisory.whatsapp_messages (
    id                  BIGSERIAL PRIMARY KEY,
    provider            VARCHAR(32)     NOT NULL DEFAULT 'META_CLOUD',
                                        -- META_CLOUD | EVOLUTION_API | MOCK
    message_id          VARCHAR(255)    UNIQUE,  -- External message ID from Meta or Evo
    phone_e164          VARCHAR(20)     NOT NULL,
    direction           VARCHAR(10)     NOT NULL DEFAULT 'OUTBOUND',
                                        -- OUTBOUND | INBOUND
    template_name       VARCHAR(128),   -- Internal template name (e.g. adv_lead_welcome_v1)
    meta_template_name  VARCHAR(128),   -- Approved Meta template name (e.g. adv_lead_welcome)
    status              VARCHAR(20)     NOT NULL DEFAULT 'PENDING',
                                        -- PENDING | SENT | DELIVERED | READ | FAILED
    error_code          TEXT,
    idempotency_key     VARCHAR(255)    UNIQUE,
    sent_at             TIMESTAMPTZ     NOT NULL DEFAULT clock_timestamp(),
    delivered_at        TIMESTAMPTZ,
    read_at             TIMESTAMPTZ,
    created_at          TIMESTAMPTZ     NOT NULL DEFAULT clock_timestamp()
);

CREATE INDEX IF NOT EXISTS idx_adv_messages_phone ON advisory.whatsapp_messages (phone_e164);
CREATE INDEX IF NOT EXISTS idx_adv_messages_sent_at ON advisory.whatsapp_messages (sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_adv_messages_status ON advisory.whatsapp_messages (status);
CREATE INDEX IF NOT EXISTS idx_adv_messages_direction ON advisory.whatsapp_messages (direction);
CREATE INDEX IF NOT EXISTS idx_adv_messages_idempotency ON advisory.whatsapp_messages (idempotency_key);

-- ─── advisory.leads ──────────────────────────────────────────────────────────
-- Advisory-specific lead tracking (separate from warroom leads).
-- Populated from Expert Stocks contact/risk form submissions.
CREATE TABLE IF NOT EXISTS advisory.leads (
    id                  BIGSERIAL PRIMARY KEY,
    lead_code           VARCHAR(50)     NOT NULL UNIQUE,  -- e.g. TG-LEAD-2026-1001
    full_name           VARCHAR(255)    NOT NULL,
    phone_e164          VARCHAR(20)     NOT NULL,
    email               VARCHAR(255),
    city                VARCHAR(100),
    capital_range       VARCHAR(64),
    segment             VARCHAR(255),
    source              VARCHAR(128)    DEFAULT 'Contact Form',
    message             TEXT,
    -- Risk assessment data
    risk_score          INTEGER,
    risk_category       VARCHAR(64),
    risk_summary        TEXT,
    -- CRM Status
    status              VARCHAR(32)     NOT NULL DEFAULT 'new',
                                        -- new | contacted | qualified | converted | closed
    assigned_rm         VARCHAR(128),
    -- WhatsApp automation state
    welcome_sent_at     TIMESTAMPTZ,
    followup_sent_at    TIMESTAMPTZ,
    kyc_nudge_sent_at   TIMESTAMPTZ,
    created_at          TIMESTAMPTZ     NOT NULL DEFAULT clock_timestamp(),
    updated_at          TIMESTAMPTZ     NOT NULL DEFAULT clock_timestamp()
);

CREATE INDEX IF NOT EXISTS idx_adv_leads_phone ON advisory.leads (phone_e164);
CREATE INDEX IF NOT EXISTS idx_adv_leads_status ON advisory.leads (status);
CREATE INDEX IF NOT EXISTS idx_adv_leads_created ON advisory.leads (created_at DESC);

-- ─── daily_sent_count reset function ─────────────────────────────────────────
-- Resets daily message counts at midnight. Call via a scheduled cron or pg_cron.
CREATE OR REPLACE FUNCTION advisory.reset_daily_sent_counts()
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
    UPDATE advisory.whatsapp_contacts SET daily_sent_count = 0;
END;
$$;
