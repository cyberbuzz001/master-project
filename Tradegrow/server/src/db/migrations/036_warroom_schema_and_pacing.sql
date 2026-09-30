-- ============================================================================
-- Migration 036: Trade Grow — 1,000 Users War Room Schema & Pacing Engine
-- Target Schema: warroom
-- ============================================================================

CREATE SCHEMA IF NOT EXISTS warroom;

-- 1. Master 90-Day Growth Plan
CREATE TABLE IF NOT EXISTS warroom.growth_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(150) NOT NULL,
    target_activated_users INT NOT NULL DEFAULT 1000,
    total_budget_paisa BIGINT NOT NULL DEFAULT 75000000, -- ₹7,50,000 in paisa
    target_cpau_paisa BIGINT NOT NULL DEFAULT 75000, -- ₹750 in paisa
    start_date DATE NOT NULL DEFAULT CURRENT_DATE,
    end_date DATE NOT NULL DEFAULT (CURRENT_DATE + INTERVAL '90 days'),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

-- 2. Daily Targets & Pacing Calendar
CREATE TABLE IF NOT EXISTS warroom.daily_pacing (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    plan_id UUID NOT NULL REFERENCES warroom.growth_plans(id) ON DELETE CASCADE,
    pacing_date DATE NOT NULL,
    target_leads INT NOT NULL DEFAULT 56,
    actual_leads INT NOT NULL DEFAULT 0,
    target_kyc_completed INT NOT NULL DEFAULT 16,
    actual_kyc_completed INT NOT NULL DEFAULT 0,
    target_activations INT NOT NULL DEFAULT 11,
    actual_activations INT NOT NULL DEFAULT 0,
    budget_allocated_paisa BIGINT NOT NULL DEFAULT 833300, -- ~₹8,333/day
    actual_spend_paisa BIGINT NOT NULL DEFAULT 0,
    cumulative_activations INT NOT NULL DEFAULT 0,
    required_run_rate NUMERIC(6,2) NOT NULL DEFAULT 11.11,
    status VARCHAR(20) NOT NULL DEFAULT 'ON_TRACK',
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    CONSTRAINT uq_plan_pacing_date UNIQUE (plan_id, pacing_date)
);

CREATE INDEX IF NOT EXISTS idx_pacing_date ON warroom.daily_pacing(pacing_date DESC);

-- 3. Canonical Leads Intake
CREATE TABLE IF NOT EXISTS warroom.leads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_code VARCHAR(30) UNIQUE NOT NULL,
    phone_e164 VARCHAR(20) NOT NULL,
    email VARCHAR(255),
    full_name VARCHAR(150),
    source VARCHAR(50) NOT NULL DEFAULT 'TRUST_WEBSITE',
    stage VARCHAR(40) NOT NULL DEFAULT 'NEW',
    score INT NOT NULL DEFAULT 10,
    assigned_agent_id VARCHAR(100),
    first_touchpoint_id BIGINT,
    last_touchpoint_id BIGINT,
    converted_user_id VARCHAR(100),
    consent_whatsapp BOOLEAN NOT NULL DEFAULT TRUE,
    consent_timestamp TIMESTAMPTZ DEFAULT clock_timestamp(),
    is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
    deleted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

CREATE INDEX IF NOT EXISTS idx_leads_phone ON warroom.leads(phone_e164);
CREATE INDEX IF NOT EXISTS idx_leads_stage ON warroom.leads(stage);
CREATE INDEX IF NOT EXISTS idx_leads_created ON warroom.leads(created_at DESC);

-- 4. Lead State Transition Events
CREATE TABLE IF NOT EXISTS warroom.lead_events (
    id BIGSERIAL PRIMARY KEY,
    lead_id UUID NOT NULL REFERENCES warroom.leads(id) ON DELETE CASCADE,
    from_stage VARCHAR(40),
    to_stage VARCHAR(40) NOT NULL,
    actor VARCHAR(100) NOT NULL DEFAULT 'SYSTEM',
    notes TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

CREATE INDEX IF NOT EXISTS idx_lead_events_lead ON warroom.lead_events(lead_id, created_at DESC);

-- 5. Permanent Immutable Marketing Touchpoints
CREATE TABLE IF NOT EXISTS warroom.touchpoints (
    id BIGSERIAL PRIMARY KEY,
    session_id VARCHAR(64) NOT NULL,
    lead_id UUID REFERENCES warroom.leads(id) ON DELETE SET NULL,
    user_id VARCHAR(100),
    channel VARCHAR(40) NOT NULL,
    campaign_id UUID,
    creator_id UUID,
    referral_code_id UUID,
    utm_source VARCHAR(100),
    utm_medium VARCHAR(100),
    utm_campaign VARCHAR(100),
    utm_term VARCHAR(100),
    utm_content VARCHAR(100),
    landing_page VARCHAR(255) NOT NULL,
    referrer_url TEXT,
    ip_hash VARCHAR(64) NOT NULL,
    user_agent TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

CREATE INDEX IF NOT EXISTS idx_touchpoints_session ON warroom.touchpoints(session_id);
CREATE INDEX IF NOT EXISTS idx_touchpoints_lead ON warroom.touchpoints(lead_id);
CREATE INDEX IF NOT EXISTS idx_touchpoints_created ON warroom.touchpoints(created_at DESC);

-- 6. Marketing Campaigns
CREATE TABLE IF NOT EXISTS warroom.campaigns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(150) NOT NULL,
    channel VARCHAR(50) NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'DRAFT',
    budget_paisa BIGINT NOT NULL DEFAULT 0,
    target_cpau_paisa BIGINT NOT NULL DEFAULT 75000,
    start_date DATE NOT NULL DEFAULT CURRENT_DATE,
    end_date DATE,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

-- 7. Creator & Micro-Influencer CRM
CREATE TABLE IF NOT EXISTS warroom.creators (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    creator_code VARCHAR(30) UNIQUE NOT NULL,
    name VARCHAR(150) NOT NULL,
    platform VARCHAR(30) NOT NULL,
    handle VARCHAR(100) NOT NULL,
    followers_count INT NOT NULL DEFAULT 0,
    category VARCHAR(50) NOT NULL DEFAULT 'STOCK_MARKET_EDUCATION',
    tier VARCHAR(10) NOT NULL DEFAULT 'MICRO',
    payout_model VARCHAR(30) NOT NULL DEFAULT 'CPA_PER_ACTIVATION',
    payout_rate_paisa BIGINT NOT NULL DEFAULT 35000, -- ₹350
    vanity_slug VARCHAR(50) UNIQUE NOT NULL,
    total_clicks INT NOT NULL DEFAULT 0,
    total_leads INT NOT NULL DEFAULT 0,
    total_kyc_completed INT NOT NULL DEFAULT 0,
    total_activated INT NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

-- 8. Customer Referral Codes & Vanity Slugs
CREATE TABLE IF NOT EXISTS warroom.referral_codes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR(100) NOT NULL,
    code VARCHAR(30) UNIQUE NOT NULL,
    total_clicks INT NOT NULL DEFAULT 0,
    total_signups INT NOT NULL DEFAULT 0,
    total_activations INT NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

CREATE INDEX IF NOT EXISTS idx_referral_user ON warroom.referral_codes(user_id);

-- 9. Referral Rewards Ledger (Anti-Fraud)
CREATE TABLE IF NOT EXISTS warroom.referral_rewards (
    id BIGSERIAL PRIMARY KEY,
    referral_code_id UUID NOT NULL REFERENCES warroom.referral_codes(id),
    referrer_user_id VARCHAR(100) NOT NULL,
    referee_user_id VARCHAR(100) NOT NULL,
    reward_type VARCHAR(30) NOT NULL DEFAULT 'BROKERAGE_CREDIT',
    amount_paisa BIGINT NOT NULL DEFAULT 25000, -- ₹250
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    qualification_idempotency_key VARCHAR(100) UNIQUE NOT NULL,
    disbursed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    CONSTRAINT uq_referral_pair UNIQUE (referrer_user_id, referee_user_id)
);

-- 10. KYC Application Step Tracker (Non-Sensitive)
CREATE TABLE IF NOT EXISTS warroom.kyc_applications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id UUID NOT NULL REFERENCES warroom.leads(id) ON DELETE CASCADE,
    user_id VARCHAR(100),
    external_provider VARCHAR(30) NOT NULL DEFAULT 'DIDIT',
    external_session_id VARCHAR(100) UNIQUE NOT NULL,
    current_step VARCHAR(40) NOT NULL DEFAULT 'INITIATED',
    status VARCHAR(30) NOT NULL DEFAULT 'IN_PROGRESS',
    rejection_code VARCHAR(50),
    started_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_kyc_status ON warroom.kyc_applications(status, current_step);

-- 11. Activation Records (Official Registry for the 1,000 Milestone)
CREATE TABLE IF NOT EXISTS warroom.activation_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR(100) UNIQUE NOT NULL,
    milestone_index INT UNIQUE NOT NULL,
    activated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    first_meaningful_action VARCHAR(50) NOT NULL DEFAULT 'FIRST_ORDER_FILLED',
    reference_order_id VARCHAR(100),
    acquisition_campaign_id UUID,
    acquisition_creator_id UUID,
    acquisition_referral_id UUID,
    cost_to_activate_paisa BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

CREATE INDEX IF NOT EXISTS idx_activations_milestone ON warroom.activation_records(milestone_index ASC);

-- 12. WhatsApp Contacts (Opt-In / Opt-Out Engine)
CREATE TABLE IF NOT EXISTS warroom.whatsapp_contacts (
    id BIGSERIAL PRIMARY KEY,
    phone_e164 VARCHAR(20) UNIQUE NOT NULL,
    opt_in BOOLEAN NOT NULL DEFAULT TRUE,
    opt_in_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    opt_out BOOLEAN NOT NULL DEFAULT FALSE,
    opt_out_at TIMESTAMPTZ,
    last_message_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

-- 13. WhatsApp Message Ledger
CREATE TABLE IF NOT EXISTS warroom.whatsapp_messages (
    id BIGSERIAL PRIMARY KEY,
    provider VARCHAR(30) NOT NULL DEFAULT 'META_CLOUD',
    message_id VARCHAR(100) UNIQUE NOT NULL,
    phone_e164 VARCHAR(20) NOT NULL,
    direction VARCHAR(10) NOT NULL DEFAULT 'OUTBOUND',
    template_name VARCHAR(100),
    status VARCHAR(20) NOT NULL DEFAULT 'SENT',
    error_code VARCHAR(50),
    idempotency_key VARCHAR(100) UNIQUE NOT NULL,
    sent_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    delivered_at TIMESTAMPTZ,
    read_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_wa_phone ON warroom.whatsapp_messages(phone_e164);

-- 14. 100 Content / Ad Ideas Repository
CREATE TABLE IF NOT EXISTS warroom.content_ideas (
    id SERIAL PRIMARY KEY,
    idea_index INT UNIQUE NOT NULL,
    category VARCHAR(50) NOT NULL,
    hook TEXT NOT NULL,
    script_body TEXT NOT NULL,
    visual_direction TEXT NOT NULL,
    caption TEXT NOT NULL,
    call_to_action TEXT NOT NULL,
    target_audience VARCHAR(100) NOT NULL,
    funnel_stage VARCHAR(30) NOT NULL,
    compliance_approved BOOLEAN NOT NULL DEFAULT TRUE,
    publication_status VARCHAR(20) NOT NULL DEFAULT 'SCHEDULED',
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

-- 15. Operational Tasks & KYC Recovery
CREATE TABLE IF NOT EXISTS warroom.tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_type VARCHAR(40) NOT NULL,
    priority VARCHAR(20) NOT NULL DEFAULT 'MEDIUM',
    title VARCHAR(200) NOT NULL,
    description TEXT,
    assigned_to_id VARCHAR(100),
    lead_id UUID REFERENCES warroom.leads(id) ON DELETE SET NULL,
    user_id VARCHAR(100),
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    due_at TIMESTAMPTZ,
    resolved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

CREATE INDEX IF NOT EXISTS idx_warroom_tasks_status ON warroom.tasks(status, priority);

-- ============================================================================
-- Seed Initial 90-Day Plan & Default Pacing
-- ============================================================================
INSERT INTO warroom.growth_plans (
    id, name, target_activated_users, total_budget_paisa, target_cpau_paisa, start_date, end_date, is_active
) VALUES (
    '00000000-0000-0000-0000-000000000001',
    'Trade Grow 90-Day 1,000 Active Users Sprint',
    1000,
    75000000,
    75000,
    CURRENT_DATE,
    CURRENT_DATE + INTERVAL '90 days',
    TRUE
) ON CONFLICT (id) DO NOTHING;

-- Seed Today's Target in daily_pacing
INSERT INTO warroom.daily_pacing (
    plan_id, pacing_date, target_leads, actual_leads, target_kyc_completed, actual_kyc_completed,
    target_activations, actual_activations, budget_allocated_paisa, actual_spend_paisa,
    cumulative_activations, required_run_rate, status
) VALUES (
    '00000000-0000-0000-0000-000000000001',
    CURRENT_DATE,
    56, 0,
    16, 0,
    11, 0,
    833300, 0,
    0, 11.11, 'ON_TRACK'
) ON CONFLICT (plan_id, pacing_date) DO NOTHING;
