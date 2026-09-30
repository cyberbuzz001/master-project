-- Migration: 025_didit_kyc_integration.sql
-- Description: Add Didit.me online verification fields and bank details to KYC & Users tables

-- 1. Add Didit verification fields to kyc_applications if they don't already exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'kyc_applications' AND column_name = 'verification_method') THEN
        ALTER TABLE kyc_applications ADD COLUMN verification_method TEXT DEFAULT 'MANUAL';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'kyc_applications' AND column_name = 'didit_session_id') THEN
        ALTER TABLE kyc_applications ADD COLUMN didit_session_id TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'kyc_applications' AND column_name = 'didit_session_url') THEN
        ALTER TABLE kyc_applications ADD COLUMN didit_session_url TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'kyc_applications' AND column_name = 'didit_session_status') THEN
        ALTER TABLE kyc_applications ADD COLUMN didit_session_status TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'kyc_applications' AND column_name = 'didit_decision_data') THEN
        ALTER TABLE kyc_applications ADD COLUMN didit_decision_data JSONB;
    END IF;
END $$;

-- 2. Add bank details and onboarding tracking to users table if they don't already exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'bank_name') THEN
        ALTER TABLE users ADD COLUMN bank_name TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'bank_account_number') THEN
        ALTER TABLE users ADD COLUMN bank_account_number TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'bank_account_name') THEN
        ALTER TABLE users ADD COLUMN bank_account_name TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'bank_ifsc') THEN
        ALTER TABLE users ADD COLUMN bank_ifsc TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'onboarding_completed') THEN
        ALTER TABLE users ADD COLUMN onboarding_completed BOOLEAN DEFAULT FALSE;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_kyc_didit_session_id ON kyc_applications(didit_session_id);
