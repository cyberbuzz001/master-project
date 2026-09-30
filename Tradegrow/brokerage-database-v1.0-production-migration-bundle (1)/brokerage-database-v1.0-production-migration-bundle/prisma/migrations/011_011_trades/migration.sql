CREATE TABLE IF NOT EXISTS trading.trades (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 order_id UUID NOT NULL REFERENCES trading.orders(id),
 trading_account_id UUID NOT NULL REFERENCES trading.accounts(id),
 instrument_id UUID NOT NULL REFERENCES market.instruments(id),
 broker_trade_id VARCHAR(255), side VARCHAR(10) NOT NULL,
 quantity NUMERIC(20,4) NOT NULL CHECK(quantity > 0),
 execution_price NUMERIC(20,8) NOT NULL CHECK(execution_price >= 0),
 gross_value NUMERIC(24,8) NOT NULL CHECK(gross_value >= 0),
 executed_at TIMESTAMPTZ NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_trades_broker_trade ON trading.trades(broker_trade_id) WHERE broker_trade_id IS NOT NULL;
