CREATE TABLE IF NOT EXISTS trading.orders (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 client_order_id UUID NOT NULL UNIQUE,
 trading_account_id UUID NOT NULL REFERENCES trading.accounts(id),
 instrument_id UUID NOT NULL REFERENCES market.instruments(id),
 side VARCHAR(10) NOT NULL, product_type VARCHAR(20) NOT NULL, order_type VARCHAR(20) NOT NULL,
 quantity NUMERIC(20,4) NOT NULL CHECK(quantity > 0), disclosed_quantity NUMERIC(20,4),
 price NUMERIC(20,8), trigger_price NUMERIC(20,8), validity VARCHAR(20) NOT NULL DEFAULT 'DAY',
 status VARCHAR(30) NOT NULL DEFAULT 'NEW', filled_quantity NUMERIC(20,4) NOT NULL DEFAULT 0,
 remaining_quantity NUMERIC(20,4), average_execution_price NUMERIC(20,8),
 rejection_code VARCHAR(100), rejection_reason TEXT, idempotency_key VARCHAR(255) NOT NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 UNIQUE(trading_account_id,idempotency_key)
);
CREATE TABLE IF NOT EXISTS trading.order_events (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 order_id UUID NOT NULL REFERENCES trading.orders(id) ON DELETE CASCADE,
 event_type VARCHAR(100) NOT NULL, previous_status VARCHAR(50), new_status VARCHAR(50),
 payload JSONB NOT NULL DEFAULT '{}'::jsonb, source VARCHAR(100) NOT NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
