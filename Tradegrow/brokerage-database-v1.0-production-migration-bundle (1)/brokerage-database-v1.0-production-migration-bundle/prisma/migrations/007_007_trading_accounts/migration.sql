CREATE TABLE IF NOT EXISTS trading.accounts (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 customer_id UUID NOT NULL REFERENCES customers.customers(id),
 account_number VARCHAR(50) NOT NULL UNIQUE,
 status VARCHAR(30) NOT NULL DEFAULT 'PENDING',
 trading_enabled BOOLEAN NOT NULL DEFAULT false,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS trading.account_segments (
 account_id UUID NOT NULL REFERENCES trading.accounts(id) ON DELETE CASCADE,
 segment_id UUID NOT NULL REFERENCES market.segments(id),
 enabled BOOLEAN NOT NULL DEFAULT false,
 PRIMARY KEY(account_id,segment_id)
);
