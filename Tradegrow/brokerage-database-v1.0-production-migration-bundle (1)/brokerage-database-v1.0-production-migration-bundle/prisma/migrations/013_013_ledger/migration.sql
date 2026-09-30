CREATE TABLE IF NOT EXISTS ledger.chart_of_accounts (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), account_code VARCHAR(100) UNIQUE NOT NULL,
 account_name VARCHAR(255) NOT NULL, account_type VARCHAR(30) NOT NULL,
 parent_id UUID REFERENCES ledger.chart_of_accounts(id), active BOOLEAN NOT NULL DEFAULT true
);
CREATE TABLE IF NOT EXISTS ledger.accounts (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), trading_account_id UUID REFERENCES trading.accounts(id),
 chart_account_id UUID NOT NULL REFERENCES ledger.chart_of_accounts(id),
 account_code VARCHAR(150) UNIQUE NOT NULL, currency CHAR(3) NOT NULL DEFAULT 'INR',
 status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE'
);
CREATE TABLE IF NOT EXISTS ledger.transactions (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), transaction_reference VARCHAR(150) UNIQUE NOT NULL,
 transaction_type VARCHAR(100) NOT NULL, source_type VARCHAR(100), source_id UUID,
 status VARCHAR(30) NOT NULL DEFAULT 'POSTED', description TEXT,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS ledger.entries (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), transaction_id UUID NOT NULL REFERENCES ledger.transactions(id),
 ledger_account_id UUID NOT NULL REFERENCES ledger.accounts(id),
 debit NUMERIC(24,8) NOT NULL DEFAULT 0 CHECK(debit >= 0),
 credit NUMERIC(24,8) NOT NULL DEFAULT 0 CHECK(credit >= 0),
 currency CHAR(3) NOT NULL DEFAULT 'INR', created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 CHECK((debit > 0 AND credit = 0) OR (credit > 0 AND debit = 0))
);
