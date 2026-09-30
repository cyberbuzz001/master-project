CREATE TABLE IF NOT EXISTS market.exchanges (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), code VARCHAR(20) UNIQUE NOT NULL,
 name VARCHAR(100) NOT NULL, active BOOLEAN NOT NULL DEFAULT true
);
CREATE TABLE IF NOT EXISTS market.segments (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 exchange_id UUID NOT NULL REFERENCES market.exchanges(id),
 code VARCHAR(50) NOT NULL, name VARCHAR(100) NOT NULL, active BOOLEAN NOT NULL DEFAULT true,
 UNIQUE(exchange_id,code)
);
CREATE TABLE IF NOT EXISTS market.instruments (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 segment_id UUID NOT NULL REFERENCES market.segments(id),
 trading_symbol VARCHAR(100) NOT NULL, display_name VARCHAR(255), isin VARCHAR(20),
 instrument_token VARCHAR(100), instrument_type VARCHAR(50) NOT NULL,
 lot_size NUMERIC(20,4) NOT NULL DEFAULT 1, tick_size NUMERIC(20,8) NOT NULL,
 expiry_date DATE, strike_price NUMERIC(20,8), option_type VARCHAR(10),
 active BOOLEAN NOT NULL DEFAULT true, created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 updated_at TIMESTAMPTZ NOT NULL DEFAULT now(), UNIQUE(segment_id,trading_symbol)
);
