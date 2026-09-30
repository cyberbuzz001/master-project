-- Migration 012: Add user profile fields and KYC completion enforcement
-- Adds full_name, phone_number, city, address, dob to users table and is_kyc_completed flag.

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'full_name') THEN
        ALTER TABLE users ADD COLUMN full_name TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'phone_number') THEN
        ALTER TABLE users ADD COLUMN phone_number TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'city') THEN
        ALTER TABLE users ADD COLUMN city TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'address') THEN
        ALTER TABLE users ADD COLUMN address TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'date_of_birth') THEN
        ALTER TABLE users ADD COLUMN date_of_birth TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'is_kyc_completed') THEN
        ALTER TABLE users ADD COLUMN is_kyc_completed BOOLEAN DEFAULT FALSE;
    END IF;
END $$;

-- Pre-verify existing active accounts so default admin/demo users remain enabled
UPDATE users SET is_kyc_completed = TRUE WHERE role IN ('SUPER_ADMIN', 'ADMIN', 'RISK_MANAGER', 'OPERATIONS_MANAGER');
