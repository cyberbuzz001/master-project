ALTER TABLE trading.orders DROP CONSTRAINT IF EXISTS orders_qty_consistency;
ALTER TABLE trading.orders ADD CONSTRAINT orders_qty_consistency CHECK(filled_quantity >= 0 AND filled_quantity <= quantity);
ALTER TABLE market.instruments DROP CONSTRAINT IF EXISTS instruments_tick_positive;
ALTER TABLE market.instruments ADD CONSTRAINT instruments_tick_positive CHECK(tick_size > 0);
ALTER TABLE ledger.entries DROP CONSTRAINT IF EXISTS ledger_currency_match;
ALTER TABLE ledger.entries ADD CONSTRAINT ledger_currency_match CHECK(length(currency)=3);
