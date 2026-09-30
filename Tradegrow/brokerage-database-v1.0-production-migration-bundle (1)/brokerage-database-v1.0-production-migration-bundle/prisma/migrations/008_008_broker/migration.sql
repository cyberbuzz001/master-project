CREATE TABLE IF NOT EXISTS broker.accounts (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 trading_account_id UUID NOT NULL REFERENCES trading.accounts(id),
 broker_code VARCHAR(50) NOT NULL,
 broker_client_reference VARCHAR(255),
 status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE',
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 UNIQUE(trading_account_id,broker_code)
);
