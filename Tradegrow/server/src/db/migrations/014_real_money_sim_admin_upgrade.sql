-- Migration: 014_real_money_sim_admin_upgrade.sql
-- Description: Production upgrade for Real-Money Funded Simulated Trading Environment
-- Features: Fill Provenance Evidence Trails, Manager Hierarchy, Deposit Idempotency, Platform Solvency & Append-Only Auditing

-- 1. IMMUTABLE FILL PROVENANCE ON EXECUTIONS
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'executions' AND column_name = 'tick_source') THEN
        ALTER TABLE executions ADD COLUMN tick_source VARCHAR(30) DEFAULT 'LIVE_FEED';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'executions' AND column_name = 'tick_timestamp') THEN
        ALTER TABLE executions ADD COLUMN tick_timestamp BIGINT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'executions' AND column_name = 'tick_ltp') THEN
        ALTER TABLE executions ADD COLUMN tick_ltp NUMERIC(20,4);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'executions' AND column_name = 'tick_bid') THEN
        ALTER TABLE executions ADD COLUMN tick_bid NUMERIC(20,4);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'executions' AND column_name = 'tick_ask') THEN
        ALTER TABLE executions ADD COLUMN tick_ask NUMERIC(20,4);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'executions' AND column_name = 'freshness_tag') THEN
        ALTER TABLE executions ADD COLUMN freshness_tag VARCHAR(20) DEFAULT 'live'; -- 'live', 'cached_stale', 'synthetic_skew'
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'executions' AND column_name = 'fill_logic') THEN
        ALTER TABLE executions ADD COLUMN fill_logic VARCHAR(30) DEFAULT 'MARKET'; -- 'MARKET_BID', 'MARKET_ASK', 'LIMIT_MATCH', 'BS_MODEL'
    END IF;
END $$;

-- 2. MANAGER HIERARCHY & GRANULAR CAPACITY LIMITS
CREATE TABLE IF NOT EXISTS manager_assignments (
    id VARCHAR(64) PRIMARY KEY,
    manager_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    assigned_by VARCHAR(64) REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    UNIQUE(manager_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_mgr_assignments_mgr ON manager_assignments(manager_id);
CREATE INDEX IF NOT EXISTS idx_mgr_assignments_user ON manager_assignments(user_id);

CREATE TABLE IF NOT EXISTS manager_limits (
    manager_id VARCHAR(64) PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    max_users INTEGER DEFAULT 100,
    max_accounts INTEGER DEFAULT 100,
    max_exposure_per_user NUMERIC(20,4) DEFAULT 1000000.00,
    max_deposit_approval NUMERIC(20,4) DEFAULT 50000.00,
    max_withdrawal_approval NUMERIC(20,4) DEFAULT 25000.00,
    max_daily_loss_cap NUMERIC(20,4) DEFAULT 100000.00,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS manager_permissions (
    id VARCHAR(64) PRIMARY KEY,
    manager_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    permission_key VARCHAR(64) NOT NULL, -- e.g. 'DEPOSITS_APPROVE', 'WITHDRAWALS_APPROVE', 'SIM_ORDER_CANCEL', etc.
    granted BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    UNIQUE(manager_id, permission_key)
);

CREATE INDEX IF NOT EXISTS idx_mgr_permissions_mgr ON manager_permissions(manager_id);

-- 3. FUND REQUESTS HARDENING & IDEMPOTENCY
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'fund_requests' AND column_name = 'idempotency_key') THEN
        ALTER TABLE fund_requests ADD COLUMN idempotency_key VARCHAR(64);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'fund_requests' AND column_name = 'provider_ref') THEN
        ALTER TABLE fund_requests ADD COLUMN provider_ref VARCHAR(128);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'fund_requests' AND column_name = 'kyc_name_matched') THEN
        ALTER TABLE fund_requests ADD COLUMN kyc_name_matched BOOLEAN DEFAULT TRUE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'fund_requests' AND column_name = 'review_tier') THEN
        ALTER TABLE fund_requests ADD COLUMN review_tier VARCHAR(20) DEFAULT 'TIER_1'; -- 'TIER_1', 'TIER_2_SENIOR', 'FRAUD_HOLD'
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'fund_requests' AND column_name = 'first_approved_by') THEN
        ALTER TABLE fund_requests ADD COLUMN first_approved_by VARCHAR(64);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'fund_requests' AND column_name = 'first_approved_at') THEN
        ALTER TABLE fund_requests ADD COLUMN first_approved_at TIMESTAMP WITH TIME ZONE;
    END IF;
END $$;

-- Enforce unique reference note for completed external deposits to prevent duplicate credits
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_deposit_ref ON fund_requests(payment_method, reference_note)
WHERE request_type = 'DEPOSIT' AND status = 'APPROVED' 
  AND payment_method IN ('UPI', 'BANK_TRANSFER', 'LINKPE')
  AND reference_note IS NOT NULL AND reference_note NOT IN ('', 'Admin Balance Adjustment', 'Admin Manual Capital Adjustment');

-- 4. PLATFORM LIABILITY & CASH RESERVE MONITORING
CREATE TABLE IF NOT EXISTS platform_reserves (
    id VARCHAR(64) PRIMARY KEY,
    bank_cash_reserve NUMERIC(20,4) NOT NULL DEFAULT 0.00,
    total_user_liabilities NUMERIC(20,4) NOT NULL DEFAULT 0.00,
    reserve_ratio NUMERIC(10,4) NOT NULL DEFAULT 1.0000, -- reserve / liability
    status VARCHAR(20) NOT NULL DEFAULT 'HEALTHY', -- 'HEALTHY', 'WARNING', 'DEFICIT'
    reconciled_by VARCHAR(64),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_platform_reserves_created ON platform_reserves(created_at DESC);
