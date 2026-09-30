CREATE SCHEMA IF NOT EXISTS reporting;
CREATE TABLE IF NOT EXISTS reporting.daily_account_snapshots (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 trading_account_id UUID NOT NULL REFERENCES trading.accounts(id),
 business_date DATE NOT NULL,
 cash_balance NUMERIC(24,8) NOT NULL DEFAULT 0,
 portfolio_value NUMERIC(24,8) NOT NULL DEFAULT 0,
 realized_pnl NUMERIC(24,8) NOT NULL DEFAULT 0,
 unrealized_pnl NUMERIC(24,8) NOT NULL DEFAULT 0,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 UNIQUE(trading_account_id,business_date)
);
