-- Migration: 016_user_status_lock_and_sessions.sql
-- Description: Extends user status enum with LOCKED and CLOSED states.
-- Adds lock tracking, closure tracking, and login_sessions for admin audit.

-- ============================================================
-- 1. EXTEND users.status CHECK CONSTRAINT
-- ============================================================
-- Drop the old CHECK constraint and recreate it with LOCKED + CLOSED
DO $$
BEGIN
    -- Remove old constraint if it exists
    ALTER TABLE users DROP CONSTRAINT IF EXISTS users_status_check;
EXCEPTION WHEN undefined_object THEN NULL;
END $$;

-- Re-add with full status set
ALTER TABLE users ADD CONSTRAINT users_status_check
    CHECK (status IN ('ACTIVE','SUSPENDED','DISABLED','PENDING_VERIFICATION','LOCKED','CLOSED'));

-- ============================================================
-- 2. ADD LOCK TRACKING COLUMNS TO users
-- ============================================================
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'locked_reason') THEN
        ALTER TABLE users ADD COLUMN locked_reason TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'locked_by') THEN
        ALTER TABLE users ADD COLUMN locked_by TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'locked_at') THEN
        ALTER TABLE users ADD COLUMN locked_at TIMESTAMPTZ;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'unlocked_by') THEN
        ALTER TABLE users ADD COLUMN unlocked_by TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'unlocked_at') THEN
        ALTER TABLE users ADD COLUMN unlocked_at TIMESTAMPTZ;
    END IF;
END $$;

-- ============================================================
-- 3. ADD CLOSURE TRACKING COLUMNS TO users
-- ============================================================
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'closed_reason') THEN
        ALTER TABLE users ADD COLUMN closed_reason TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'closed_by') THEN
        ALTER TABLE users ADD COLUMN closed_by TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'closed_at') THEN
        ALTER TABLE users ADD COLUMN closed_at TIMESTAMPTZ;
    END IF;
END $$;

-- ============================================================
-- 4. ADD SUSPENSION TRACKING COLUMNS TO users
-- ============================================================
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'suspended_reason') THEN
        ALTER TABLE users ADD COLUMN suspended_reason TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'suspended_by') THEN
        ALTER TABLE users ADD COLUMN suspended_by TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'suspended_at') THEN
        ALTER TABLE users ADD COLUMN suspended_at TIMESTAMPTZ;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'suspended_until') THEN
        ALTER TABLE users ADD COLUMN suspended_until TIMESTAMPTZ;
    END IF;
END $$;

-- ============================================================
-- 5. LOGIN SESSIONS TABLE (for admin login activity view)
-- ============================================================
CREATE TABLE IF NOT EXISTS login_sessions (
    id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
    user_id         TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    session_token   TEXT,                          -- JWT jti or session id
    ip_address      INET,
    user_agent      TEXT,
    device_type     TEXT,                          -- 'desktop', 'mobile', 'tablet'
    login_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    logout_at       TIMESTAMPTZ,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    login_result    TEXT NOT NULL DEFAULT 'SUCCESS' 
                    CHECK (login_result IN ('SUCCESS','FAILED','BLOCKED','MFA_REQUIRED')),
    failure_reason  TEXT                           -- 'WRONG_PASSWORD', 'ACCOUNT_LOCKED' etc.
);

CREATE INDEX IF NOT EXISTS idx_login_sessions_user_id  ON login_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_login_sessions_login_at ON login_sessions(login_at DESC);
CREATE INDEX IF NOT EXISTS idx_login_sessions_active   ON login_sessions(is_active) WHERE is_active = TRUE;

-- ============================================================
-- 6. ADMIN_NOTIFICATIONS TABLE (for future real-time alerts)
-- ============================================================
CREATE TABLE IF NOT EXISTS admin_notifications (
    id          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
    event_type  TEXT NOT NULL,          -- 'USER_STATUS_CHANGED', 'TRADE_EXECUTED', etc.
    user_id     TEXT REFERENCES users(id) ON DELETE CASCADE,
    payload     JSONB NOT NULL DEFAULT '{}',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    read_at     TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_admin_notifications_type    ON admin_notifications(event_type);
CREATE INDEX IF NOT EXISTS idx_admin_notifications_user    ON admin_notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_admin_notifications_created ON admin_notifications(created_at DESC);
