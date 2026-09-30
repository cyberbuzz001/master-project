CREATE TABLE IF NOT EXISTS risk.account_limits (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 trading_account_id UUID NOT NULL REFERENCES trading.accounts(id),
 max_order_value NUMERIC(24,8), max_daily_turnover NUMERIC(24,8),
 max_exposure NUMERIC(24,8), max_open_positions INTEGER,
 active BOOLEAN NOT NULL DEFAULT true, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
