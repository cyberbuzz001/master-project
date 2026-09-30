-- Migration: 015_unique_client_identity_and_normalization.sql
-- Description: Client ID Standardization, Email Normalization, and Database-Level Unique Constraints

-- 1. Add client_id column to users table if not exists
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'client_id') THEN
        ALTER TABLE users ADD COLUMN client_id VARCHAR(32);
    END IF;
END $$;

-- 2. Backfill client_id for all existing users with formatted uppercase unique ID
UPDATE users
SET client_id = 'TG-USR-' || UPPER(SUBSTRING(REPLACE(id, 'usr_', '') FROM 1 FOR 4))
WHERE client_id IS NULL OR client_id = '';

-- Ensure any potential backfill collisions get unique numeric suffix
DO $$
DECLARE
    r RECORD;
    i INTEGER := 1000;
BEGIN
    FOR r IN (
        SELECT client_id, COUNT(*) 
        FROM users 
        GROUP BY client_id 
        HAVING COUNT(*) > 1
    ) LOOP
        FOR r IN (SELECT id FROM users WHERE client_id = r.client_id) LOOP
            UPDATE users SET client_id = 'TG-USR-' || i WHERE id = r.id;
            i := i + 1;
        END LOOP;
    END LOOP;
END $$;

-- Enforce client_id NOT NULL and UNIQUE constraint
ALTER TABLE users ALTER COLUMN client_id SET NOT NULL;
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'uq_users_client_id'
    ) THEN
        ALTER TABLE users ADD CONSTRAINT uq_users_client_id UNIQUE (client_id);
    END IF;
END $$;

-- 3. Normalize existing email and username text
UPDATE users SET email = LOWER(TRIM(email));
UPDATE users SET username = TRIM(username);

-- Disambiguate any existing duplicate usernames (case-insensitive) by appending unique suffix
DO $$
DECLARE
    r RECORD;
    i INTEGER := 1;
BEGIN
    FOR r IN (
        SELECT LOWER(TRIM(username)) as norm_user, COUNT(*) 
        FROM users 
        GROUP BY LOWER(TRIM(username)) 
        HAVING COUNT(*) > 1
    ) LOOP
        i := 1;
        FOR r IN (SELECT id, username, client_id FROM users WHERE LOWER(TRIM(username)) = r.norm_user ORDER BY created_at ASC) LOOP
            IF i > 1 THEN
                UPDATE users SET username = username || '_' || SUBSTRING(client_id FROM 8) WHERE id = r.id;
            END IF;
            i := i + 1;
        END LOOP;
    END LOOP;
END $$;

-- 4. Create Unique Case-Insensitive & Trimmed Indexes on email and username
CREATE UNIQUE INDEX IF NOT EXISTS uq_users_normalized_email ON users (LOWER(TRIM(email)));
CREATE UNIQUE INDEX IF NOT EXISTS uq_users_normalized_username ON users (LOWER(TRIM(username)));
CREATE INDEX IF NOT EXISTS idx_users_client_id ON users (client_id);

-- 5. Duplicate Account Audit Reviews Table
CREATE TABLE IF NOT EXISTS duplicate_account_reviews (
    id VARCHAR(64) PRIMARY KEY,
    primary_user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    duplicate_user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    matched_criteria VARCHAR(64) NOT NULL, -- 'EMAIL_PREFIX', 'PHONE_NUMBER', 'PAN_NUMBER', 'IP_ADDRESS'
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING_REVIEW', -- 'PENDING_REVIEW', 'CONFIRMED_MERGED', 'DISMISSED', 'FROZEN'
    notes TEXT,
    reviewed_by VARCHAR(64),
    reviewed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dup_reviews_primary ON duplicate_account_reviews(primary_user_id);
CREATE INDEX IF NOT EXISTS idx_dup_reviews_status ON duplicate_account_reviews(status);
