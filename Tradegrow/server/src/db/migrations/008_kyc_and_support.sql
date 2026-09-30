-- Migration: 008_kyc_and_support.sql
-- Description: Schema for KYC Applications, Protected Documents, and Customer Support Tickets

CREATE TABLE IF NOT EXISTS kyc_applications (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    pan_number TEXT,
    aadhaar_number TEXT,
    bank_account_name TEXT,
    bank_account_number TEXT,
    bank_ifsc TEXT,
    bank_name TEXT,
    status TEXT DEFAULT 'NOT_STARTED', -- NOT_STARTED, SUBMITTED, UNDER_REVIEW, APPROVED, REJECTED, RESUBMISSION_REQUIRED
    rejection_reason TEXT,
    rejection_category TEXT,
    submitted_at TIMESTAMPTZ,
    reviewed_at TIMESTAMPTZ,
    reviewed_by TEXT REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS kyc_documents (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
    kyc_application_id TEXT NOT NULL REFERENCES kyc_applications(id) ON DELETE CASCADE,
    document_type TEXT NOT NULL, -- PAN_CARD, AADHAAR_FRONT, AADHAAR_BACK, BANK_PROOF
    file_path TEXT NOT NULL,
    original_filename TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    file_size INTEGER NOT NULL,
    uploaded_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS support_tickets (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
    user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
    customer_id TEXT,
    category TEXT NOT NULL, -- TRADING, ACCOUNT, KYC, FUNDS, TECHNICAL, OTHER
    priority TEXT DEFAULT 'MEDIUM', -- LOW, MEDIUM, HIGH, URGENT
    subject TEXT NOT NULL,
    description TEXT NOT NULL,
    status TEXT DEFAULT 'OPEN', -- OPEN, IN_PROGRESS, RESOLVED, CLOSED
    admin_notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ensure user_id column exists on support_tickets table if created previously
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'support_tickets' AND column_name = 'user_id') THEN
        ALTER TABLE support_tickets ADD COLUMN user_id TEXT REFERENCES users(id) ON DELETE CASCADE;
    END IF;
END $$;

-- Backfill user_id from customer_id if present
UPDATE support_tickets SET user_id = customer_id WHERE user_id IS NULL AND customer_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_kyc_apps_user_id ON kyc_applications(user_id);
CREATE INDEX IF NOT EXISTS idx_kyc_apps_status ON kyc_applications(status);
CREATE INDEX IF NOT EXISTS idx_support_tickets_user_id ON support_tickets(user_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_status ON support_tickets(status);
