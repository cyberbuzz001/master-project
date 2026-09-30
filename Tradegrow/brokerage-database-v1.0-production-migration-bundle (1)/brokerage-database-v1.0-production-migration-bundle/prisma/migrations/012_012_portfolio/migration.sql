CREATE TABLE IF NOT EXISTS portfolio.positions (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 trading_account_id UUID NOT NULL REFERENCES trading.accounts(id),
 instrument_id UUID NOT NULL REFERENCES market.instruments(id),
 product_type VARCHAR(20) NOT NULL, quantity NUMERIC(20,4) NOT NULL DEFAULT 0,
 average_price NUMERIC(20,8) NOT NULL DEFAULT 0, realized_pnl NUMERIC(24,8) NOT NULL DEFAULT 0,
 unrealized_pnl NUMERIC(24,8) NOT NULL DEFAULT 0, last_price NUMERIC(20,8),
 updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 UNIQUE(trading_account_id,instrument_id,product_type)
);
CREATE TABLE IF NOT EXISTS portfolio.holdings (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 trading_account_id UUID NOT NULL REFERENCES trading.accounts(id),
 instrument_id UUID NOT NULL REFERENCES market.instruments(id),
 quantity NUMERIC(20,4) NOT NULL DEFAULT 0, available_quantity NUMERIC(20,4) NOT NULL DEFAULT 0,
 pledged_quantity NUMERIC(20,4) NOT NULL DEFAULT 0, average_price NUMERIC(20,8),
 updated_at TIMESTAMPTZ NOT NULL DEFAULT now(), UNIQUE(trading_account_id,instrument_id)
);
