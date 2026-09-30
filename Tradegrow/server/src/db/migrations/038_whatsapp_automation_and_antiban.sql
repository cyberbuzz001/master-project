-- ============================================================================
-- Migration 037: WhatsApp Anti-Ban Automation Ledger & Opt-Out Registry
-- Schema: warroom
-- ============================================================================

CREATE SCHEMA IF NOT EXISTS warroom;

CREATE TABLE IF NOT EXISTS warroom.whatsapp_contacts (
    id BIGSERIAL PRIMARY KEY,
    phone_e164 VARCHAR(20) UNIQUE NOT NULL,
    opt_in BOOLEAN NOT NULL DEFAULT TRUE,
    opt_in_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    opt_out BOOLEAN NOT NULL DEFAULT FALSE,
    opt_out_at TIMESTAMPTZ,
    last_message_at TIMESTAMPTZ,
    warmup_tier INT NOT NULL DEFAULT 1,
    daily_sent_count INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

CREATE TABLE IF NOT EXISTS warroom.whatsapp_messages (
    id BIGSERIAL PRIMARY KEY,
    provider VARCHAR(30) NOT NULL DEFAULT 'EVOLUTION_API',
    message_id VARCHAR(100) UNIQUE NOT NULL,
    phone_e164 VARCHAR(20) NOT NULL,
    direction VARCHAR(10) NOT NULL DEFAULT 'OUTBOUND',
    template_name VARCHAR(100),
    status VARCHAR(20) NOT NULL DEFAULT 'SENT',
    error_code VARCHAR(255),
    idempotency_key VARCHAR(100) UNIQUE NOT NULL,
    sent_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    delivered_at TIMESTAMPTZ,
    read_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_wa_phone ON warroom.whatsapp_messages(phone_e164);
CREATE INDEX IF NOT EXISTS idx_wa_idempotency ON warroom.whatsapp_messages(idempotency_key);
