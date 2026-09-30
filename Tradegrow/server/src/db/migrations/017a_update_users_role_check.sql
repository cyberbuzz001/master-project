-- Migration 017: Update users_role_check constraint to support all administrative & operational roles
-- Enables MANAGER, FINANCE_MANAGER, KYC_OFFICER, and other staff roles without check constraint violations

DO $$
BEGIN
    -- Drop old check constraint if exists
    ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
    
    -- Re-add check constraint with complete list of system roles
    ALTER TABLE users ADD CONSTRAINT users_role_check 
      CHECK (role IN (
        'SUPER_ADMIN',
        'ADMIN',
        'MANAGER',
        'FINANCE_MANAGER',
        'RISK_MANAGER',
        'OPERATIONS_MANAGER',
        'KYC_OFFICER',
        'DEALER',
        'SUPPORT_AGENT',
        'ANALYST',
        'USER',
        'READ_ONLY_AUDITOR'
      ));
END $$;

-- Ensure manager permissions & limits tables are ready for RBAC dashboard
CREATE TABLE IF NOT EXISTS manager_permissions (
    id VARCHAR(64) PRIMARY KEY,
    manager_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    permission_key VARCHAR(64) NOT NULL,
    granted BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    UNIQUE(manager_id, permission_key)
);

CREATE INDEX IF NOT EXISTS idx_mgr_permissions_mgr ON manager_permissions(manager_id);

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
