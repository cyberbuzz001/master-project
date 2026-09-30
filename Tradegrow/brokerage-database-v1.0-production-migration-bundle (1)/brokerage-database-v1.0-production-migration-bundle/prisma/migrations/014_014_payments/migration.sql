CREATE TABLE IF NOT EXISTS payments.transactions (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 trading_account_id UUID NOT NULL REFERENCES trading.accounts(id),
 provider VARCHAR(100) NOT NULL, provider_reference VARCHAR(255),
 transaction_type VARCHAR(30) NOT NULL, amount NUMERIC(24,8) NOT NULL CHECK(amount > 0),
 currency CHAR(3) NOT NULL DEFAULT 'INR', status VARCHAR(30) NOT NULL DEFAULT 'CREATED',
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_payment_provider_ref ON payments.transactions(provider,provider_reference) WHERE provider_reference IS NOT NULL;
CREATE TABLE IF NOT EXISTS payments.withdrawals (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 trading_account_id UUID NOT NULL REFERENCES trading.accounts(id),
 bank_account_id UUID NOT NULL REFERENCES customers.bank_accounts(id),
 amount NUMERIC(24,8) NOT NULL CHECK(amount > 0), status VARCHAR(30) NOT NULL DEFAULT 'REQUESTED',
 approved_by UUID REFERENCES identity.users(id), provider_reference VARCHAR(255),
 created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
