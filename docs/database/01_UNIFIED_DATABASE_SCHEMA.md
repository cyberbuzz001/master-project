# TradeGrow Unified Platform — Database Schema Specification

**Document Reference**: `docs/database/01_UNIFIED_DATABASE_SCHEMA.md`  
**Target Persistence**: PostgreSQL 16 Enterprise with TimescaleDB & pg_trgm Extensions  
**Character Encoding**: UTF-8 | Collation: `en_US.UTF-8` | Timezone: `UTC`

---

## 1. Schema Architecture Overview

The TradeGrow Unified Database harmonizes the high-frequency trading ledger of `Tradegrow` with the regulatory, subscription, and CRM relational structure of `Expert advisory`.

### Logical Namespace Segregation
To maintain high transactional throughput and clean architectural boundaries within a single PostgreSQL 16 cluster, tables are organized into four logical schemas:
1. `core`: Shared identity, RBAC, KYC verification, and unified audit logs.
2. `broker`: Accounts, wallets, double-entry ledger, pre-trade RMS rules, orders, fills, and positions.
3. `market`: Security masters, symbol normalizer, options chains, and historical TimescaleDB hypertables.
4. `advisory`: Research recommendations, risk questionnaires, subscriptions, invoicing, and CRM pipelines.

```
                    ┌─────────────────────────────────────────────────────────┐
                    │            POSTGRESQL 16 / TIMESCALEDB CLUSTER          │
                    └────────────────────────────┬────────────────────────────┘
                                                 │
          ┌─────────────────────┬────────────────┴────────────────────┬─────────────────────┐
          ▼                     ▼                                     ▼                     ▼
┌──────────────────┐  ┌──────────────────┐                  ┌──────────────────┐  ┌──────────────────┐
│   schema: core   │  │  schema: broker  │                  │  schema: market  │  │ schema: advisory │
├──────────────────┤  ├──────────────────┤                  ├──────────────────┤  ├──────────────────┤
│ • users          │  │ • accounts       │                  │ • instruments    │  │ • research_recs  │
│ • profiles       │  │ • virtual_wallets│                  │ • daily_candles  │  │ • risk_profiles  │
│ • kyc_sessions   │  │ • wallet_ledger  │                  │ • tick_candles   │  │ • subscriptions  │
│ • audit_trail    │  │ • orders         │                  │   (Hypertable)   │  │ • invoices & tax │
│ • roles_perms    │  │ • executions     │                  │ • holiday_cal    │  │ • crm_leads      │
│ • sessions_2fa   │  │ • positions      │                  │ • corporate_act  │  │ • call_logs      │
└──────────────────┘  └──────────────────┘                  └──────────────────┘  └──────────────────┘
```

---

## 2. Core Identity & RBAC DDL (`core`)

```sql
CREATE SCHEMA IF NOT EXISTS core;

-- Universal User Record
CREATE TABLE core.users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_code VARCHAR(20) UNIQUE NOT NULL, -- e.g. TG108422
    email VARCHAR(255) UNIQUE NOT NULL,
    phone VARCHAR(20) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'PENDING_VERIFICATION' 
        CHECK (status IN ('PENDING_VERIFICATION', 'ACTIVE', 'SUSPENDED', 'BLOCKED', 'CLOSED')),
    kyc_status VARCHAR(30) NOT NULL DEFAULT 'NOT_STARTED'
        CHECK (kyc_status IN ('NOT_STARTED', 'IN_PROGRESS', 'VERIFIED', 'REJECTED')),
    role VARCHAR(30) NOT NULL DEFAULT 'RETAIL_TRADER'
        CHECK (role IN ('RETAIL_TRADER', 'ADVISORY_SUBSCRIBER', 'RESEARCH_ANALYST', 
                         'RESEARCH_HEAD', 'COMPLIANCE_OFFICER', 'CRM_AGENT', 'ADMIN', 'SUPER_ADMIN')),
    totp_secret VARCHAR(128),
    is_two_factor_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    last_login_at TIMESTAMPTZ,
    last_login_ip INET,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

CREATE INDEX idx_users_client_code ON core.users(client_code);
CREATE INDEX idx_users_phone ON core.users(phone);
CREATE INDEX idx_users_status_kyc ON core.users(status, kyc_status);

-- Regulatory Profile & KYC Metadata
CREATE TABLE core.user_profiles (
    user_id UUID PRIMARY KEY REFERENCES core.users(id) ON DELETE CASCADE,
    pan_number VARCHAR(10) UNIQUE,
    pan_verified BOOLEAN NOT NULL DEFAULT FALSE,
    aadhaar_ref_token VARCHAR(100),
    full_name VARCHAR(150) NOT NULL,
    date_of_birth DATE,
    gender VARCHAR(10),
    residential_address JSONB,
    bank_accounts JSONB NOT NULL DEFAULT '[]'::jsonb,
    depository_account JSONB, -- DP ID, Client ID (CDSL/NSDL)
    didit_session_id VARCHAR(100),
    risk_category VARCHAR(20) DEFAULT 'MODERATE' 
        CHECK (risk_category IN ('CONSERVATIVE', 'MODERATE', 'GROWTH', 'AGGRESSIVE')),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

-- Tamper-Evident Audit Trail
CREATE TABLE core.audit_logs (
    id BIGSERIAL PRIMARY KEY,
    actor_id UUID REFERENCES core.users(id),
    action VARCHAR(100) NOT NULL,
    resource_type VARCHAR(60) NOT NULL,
    resource_id VARCHAR(100) NOT NULL,
    old_state JSONB,
    new_state JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

CREATE INDEX idx_audit_resource ON core.audit_logs(resource_type, resource_id);
CREATE INDEX idx_audit_created ON core.audit_logs(created_at DESC);
```

---

## 3. Brokerage & Double-Entry Financial Ledger DDL (`broker`)

```sql
CREATE SCHEMA IF NOT EXISTS broker;

-- Cash & Margin Wallets
CREATE TABLE broker.virtual_wallets (
    user_id UUID PRIMARY KEY REFERENCES core.users(id) ON DELETE RESTRICT,
    currency VARCHAR(3) NOT NULL DEFAULT 'INR',
    balance_paisa BIGINT NOT NULL DEFAULT 100000000, -- Default ₹10,00,000 for simulation
    used_margin_paisa BIGINT NOT NULL DEFAULT 0,
    realized_pnl_paisa BIGINT NOT NULL DEFAULT 0,
    unrealized_pnl_paisa BIGINT NOT NULL DEFAULT 0,
    version BIGINT NOT NULL DEFAULT 0, -- Optimistic concurrency token
    updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    CONSTRAINT chk_positive_margin CHECK (used_margin_paisa >= 0)
);

-- Double-Entry Ledger (Immutable Append-Only)
CREATE TABLE broker.wallet_ledger (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES core.users(id) ON DELETE RESTRICT,
    entry_type VARCHAR(40) NOT NULL CHECK (entry_type IN (
        'DEPOSIT', 'WITHDRAWAL', 'MARGIN_BLOCK', 'MARGIN_RELEASE', 
        'TRADE_SETTLE', 'BROKERAGE_DEBIT', 'STATUTORY_TAX_DEBIT', 
        'MTM_CREDIT', 'MTM_DEBIT', 'RESET_SIMULATION'
    )),
    amount_paisa BIGINT NOT NULL, -- Positive for credit, negative for debit
    balance_after_paisa BIGINT NOT NULL,
    reference_type VARCHAR(40) NOT NULL, -- e.g. 'ORDER', 'TRADE', 'GATEWAY'
    reference_id VARCHAR(100) NOT NULL,
    narration TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

CREATE INDEX idx_ledger_user_created ON broker.wallet_ledger(user_id, created_at DESC);
CREATE INDEX idx_ledger_ref ON broker.wallet_ledger(reference_type, reference_id);

-- Order Management Table
CREATE TABLE broker.orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id VARCHAR(32) UNIQUE NOT NULL, -- External reference e.g. ORD-20260929-108422
    user_id UUID NOT NULL REFERENCES core.users(id),
    symbol VARCHAR(50) NOT NULL,
    exchange VARCHAR(10) NOT NULL CHECK (exchange IN ('NSE', 'BSE', 'NFO', 'BFO', 'MCX')),
    side VARCHAR(4) NOT NULL CHECK (side IN ('BUY', 'SELL')),
    order_type VARCHAR(10) NOT NULL CHECK (order_type IN ('MARKET', 'LIMIT', 'SL', 'SL_M')),
    product_type VARCHAR(10) NOT NULL CHECK (product_type IN ('CNC', 'MIS', 'NRML')),
    quantity INT NOT NULL CHECK (quantity > 0),
    disclosed_quantity INT DEFAULT 0,
    price_paisa BIGINT NOT NULL DEFAULT 0,
    trigger_price_paisa BIGINT NOT NULL DEFAULT 0,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING' CHECK (status IN (
        'PENDING', 'ACCEPTED', 'EXECUTING', 'FILLED', 'PARTIALLY_FILLED', 
        'CANCELLED', 'REJECTED', 'EXPIRED'
    )),
    filled_quantity INT NOT NULL DEFAULT 0,
    avg_fill_price_paisa BIGINT NOT NULL DEFAULT 0,
    rejection_reason TEXT,
    idempotency_key VARCHAR(100) NOT NULL,
    advisory_recommendation_id UUID, -- Link to Advisory Recommendation (1-click tracking)
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    CONSTRAINT uq_user_idempotency UNIQUE (user_id, idempotency_key)
);

CREATE INDEX idx_orders_user_status ON broker.orders(user_id, status);
CREATE INDEX idx_orders_matching ON broker.orders(status, symbol) WHERE status IN ('ACCEPTED', 'PARTIALLY_FILLED');

-- Trade Executions
CREATE TABLE broker.executions (
    id BIGSERIAL PRIMARY KEY,
    execution_id VARCHAR(36) UNIQUE NOT NULL,
    order_id UUID NOT NULL REFERENCES broker.orders(id),
    user_id UUID NOT NULL REFERENCES core.users(id),
    symbol VARCHAR(50) NOT NULL,
    side VARCHAR(4) NOT NULL,
    quantity INT NOT NULL CHECK (quantity > 0),
    price_paisa BIGINT NOT NULL CHECK (price_paisa > 0),
    brokerage_paisa INT NOT NULL DEFAULT 0,
    stt_paisa INT NOT NULL DEFAULT 0,
    turnover_tax_paisa INT NOT NULL DEFAULT 0,
    gst_paisa INT NOT NULL DEFAULT 0,
    stamp_duty_paisa INT NOT NULL DEFAULT 0,
    executed_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

CREATE INDEX idx_exec_user_symbol ON broker.executions(user_id, symbol, executed_at DESC);

-- Open Positions
CREATE TABLE broker.positions (
    user_id UUID NOT NULL REFERENCES core.users(id),
    symbol VARCHAR(50) NOT NULL,
    product_type VARCHAR(10) NOT NULL,
    quantity INT NOT NULL DEFAULT 0,
    buy_quantity INT NOT NULL DEFAULT 0,
    sell_quantity INT NOT NULL DEFAULT 0,
    buy_value_paisa BIGINT NOT NULL DEFAULT 0,
    sell_value_paisa BIGINT NOT NULL DEFAULT 0,
    avg_entry_price_paisa BIGINT NOT NULL DEFAULT 0,
    realized_pnl_paisa BIGINT NOT NULL DEFAULT 0,
    trailing_sl_paisa BIGINT,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    PRIMARY KEY (user_id, symbol, product_type)
);
```

---

## 4. Market Data & TimescaleDB Hypertables (`market`)

```sql
CREATE SCHEMA IF NOT EXISTS market;

-- Master Instrument Registry
CREATE TABLE market.instruments (
    id BIGSERIAL PRIMARY KEY,
    token VARCHAR(30) NOT NULL,
    exchange VARCHAR(10) NOT NULL,
    symbol VARCHAR(50) NOT NULL,
    name VARCHAR(150) NOT NULL,
    segment VARCHAR(20) NOT NULL, -- EQUITIES, NFO_FUT, NFO_OPT, MCX_COM
    lot_size INT NOT NULL DEFAULT 1,
    tick_size_paisa INT NOT NULL DEFAULT 5,
    strike_price_paisa BIGINT,
    option_type VARCHAR(2) CHECK (option_type IN ('CE', 'PE')),
    expiry_date DATE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    CONSTRAINT uq_exchange_token UNIQUE (exchange, token)
);

CREATE INDEX idx_instruments_trgm ON market.instruments USING gin(symbol gin_trgm_ops);
CREATE INDEX idx_instruments_opt ON market.instruments(symbol, expiry_date, strike_price_paisa) WHERE segment = 'NFO_OPT';

-- Time-Series Ticks (TimescaleDB Hypertable)
CREATE TABLE market.market_candles (
    time TIMESTAMPTZ NOT NULL,
    symbol VARCHAR(50) NOT NULL,
    resolution VARCHAR(5) NOT NULL, -- 1m, 5m, 15m, 1h, 1D
    open_paisa BIGINT NOT NULL,
    high_paisa BIGINT NOT NULL,
    low_paisa BIGINT NOT NULL,
    close_paisa BIGINT NOT NULL,
    volume BIGINT NOT NULL,
    open_interest BIGINT DEFAULT 0
);

-- Convert to Hypertable partitioned across time
SELECT create_hypertable('market.market_candles', 'time', if_not_exists => TRUE);
CREATE INDEX idx_candles_symbol_time ON market.market_candles(symbol, resolution, time DESC);
```

---

## 5. SEBI Advisory Desk & CRM Pipelines (`advisory`)

```sql
CREATE SCHEMA IF NOT EXISTS advisory;

-- Regulated Research Recommendations
CREATE TABLE advisory.recommendations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reference_no VARCHAR(40) UNIQUE NOT NULL, -- e.g. REC-2026-NSE-INFY-0091
    symbol VARCHAR(50) NOT NULL,
    exchange VARCHAR(10) NOT NULL,
    segment VARCHAR(20) NOT NULL,
    action VARCHAR(10) NOT NULL CHECK (action IN ('BUY', 'SELL', 'HOLD', 'ACCUMULATE')),
    horizon VARCHAR(20) NOT NULL CHECK (horizon IN ('INTRADAY', 'SWING', 'SHORT_TERM', 'LONG_TERM')),
    entry_range_min_paisa BIGINT NOT NULL,
    entry_range_max_paisa BIGINT NOT NULL,
    target_1_paisa BIGINT NOT NULL,
    target_2_paisa BIGINT,
    stop_loss_paisa BIGINT NOT NULL,
    risk_reward_ratio VARCHAR(20),
    rationale TEXT NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'DRAFT' CHECK (status IN (
        'DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'ACTIVE', 
        'TARGET_1_MET', 'TARGET_2_MET', 'STOP_LOSS_HIT', 'EXPIRED', 'CLOSED'
    )),
    analyst_id UUID NOT NULL REFERENCES core.users(id),
    approver_id UUID REFERENCES core.users(id),
    approved_at TIMESTAMPTZ,
    published_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

CREATE INDEX idx_recs_status_active ON advisory.recommendations(status) WHERE status = 'ACTIVE';

-- Client Risk Profiles (SEBI Suitability)
CREATE TABLE advisory.risk_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES core.users(id),
    score INT NOT NULL,
    category VARCHAR(30) NOT NULL CHECK (category IN ('CONSERVATIVE', 'MODERATE', 'GROWTH', 'AGGRESSIVE')),
    answers JSONB NOT NULL,
    acknowledged_by_client BOOLEAN NOT NULL DEFAULT FALSE,
    acknowledged_at TIMESTAMPTZ,
    valid_until DATE NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

CREATE INDEX idx_risk_user_active ON advisory.risk_profiles(user_id, is_active);

-- Advisory Subscription Plans
CREATE TABLE advisory.plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    code VARCHAR(50) UNIQUE NOT NULL, -- e.g. INDEX_OPTIONS_PRO
    segment VARCHAR(50) NOT NULL,
    price_paisa BIGINT NOT NULL,
    duration_days INT NOT NULL,
    min_risk_level VARCHAR(20) NOT NULL DEFAULT 'MODERATE',
    is_active BOOLEAN NOT NULL DEFAULT TRUE
);

-- Client Subscriptions
CREATE TABLE advisory.subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES core.users(id),
    plan_id UUID NOT NULL REFERENCES advisory.plans(id),
    starts_at TIMESTAMPTZ NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('PENDING', 'ACTIVE', 'EXPIRED', 'CANCELLED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

-- CRM Leads & Multi-Touch Attribution (Phases 2 & 3)
CREATE TABLE advisory.crm_leads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_code VARCHAR(30) UNIQUE NOT NULL, -- e.g. LD-10928
    phone VARCHAR(20) NOT NULL,
    email VARCHAR(255),
    full_name VARCHAR(150),
    source VARCHAR(50) NOT NULL, -- e.g. 'WEBSITE_ACQUISITION_CALCULATOR', 'GOOGLE_ADS'
    utm_source VARCHAR(100),
    utm_medium VARCHAR(100),
    utm_campaign VARCHAR(100),
    utm_term VARCHAR(100),
    utm_content VARCHAR(100),
    referrer_url TEXT,
    landing_page VARCHAR(255),
    stage VARCHAR(40) NOT NULL DEFAULT 'NEW' CHECK (stage IN (
        'NEW', 'CONTACTED', 'ENGAGED', 'DEMAT_OPENED', 'KYC_COMPLETED', 
        'PAID_SUBSCRIBER', 'UNQUALIFIED', 'LOST'
    )),
    assigned_to_id UUID REFERENCES core.users(id),
    score INT NOT NULL DEFAULT 10,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

CREATE INDEX idx_leads_phone ON advisory.crm_leads(phone);
CREATE INDEX idx_leads_stage_assigned ON advisory.crm_leads(stage, assigned_to_id);
CREATE INDEX idx_leads_utm ON advisory.crm_leads(utm_source, utm_campaign);

-- CRM Telephony & Communication Logs (Phase 5)
CREATE TABLE advisory.call_logs (
    id BIGSERIAL PRIMARY KEY,
    lead_id UUID NOT NULL REFERENCES advisory.crm_leads(id) ON DELETE CASCADE,
    agent_id UUID NOT NULL REFERENCES core.users(id),
    call_duration_seconds INT NOT NULL DEFAULT 0,
    disposition VARCHAR(50) NOT NULL, -- 'INTERESTED', 'CALLBACK_REQUESTED', 'DO_NOT_CALL', 'BUSY'
    notes TEXT,
    recording_url TEXT,
    follow_up_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);
```

---
*Schema specification certified and saved to [01_UNIFIED_DATABASE_SCHEMA.md](file:///d:/2026%20C%20downloads/tradegrow%20app/docs/database/01_UNIFIED_DATABASE_SCHEMA.md).*
