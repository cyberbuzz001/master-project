CREATE TABLE IF NOT EXISTS settlement.settlements (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 trading_account_id UUID NOT NULL REFERENCES trading.accounts(id),
 settlement_date DATE NOT NULL, status VARCHAR(30) NOT NULL DEFAULT 'PENDING',
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(), completed_at TIMESTAMPTZ
);
CREATE TABLE IF NOT EXISTS settlement.obligations (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 settlement_id UUID NOT NULL REFERENCES settlement.settlements(id),
 obligation_type VARCHAR(50) NOT NULL, amount NUMERIC(24,8), quantity NUMERIC(20,4),
 instrument_id UUID REFERENCES market.instruments(id), status VARCHAR(30) NOT NULL DEFAULT 'PENDING'
);
