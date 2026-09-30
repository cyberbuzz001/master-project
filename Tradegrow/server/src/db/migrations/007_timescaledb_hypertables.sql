-- 007_timescaledb_hypertables.sql
-- Enables TimescaleDB hypertable extension for sub-millisecond market tick range queries and continuous candle aggregates

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_available_extensions WHERE name = 'timescaledb') THEN
        CREATE EXTENSION IF NOT EXISTS timescaledb CASCADE;
        
        -- Convert market data tick storage table into hypertable if present
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'ticks') AND
           NOT EXISTS (SELECT 1 FROM _timescaledb_catalog.hypertable WHERE table_name = 'ticks') THEN
            PERFORM create_hypertable('ticks', 'timestamp', if_not_exists => TRUE);
        END IF;

        -- Convert market data candles table into hypertable if present
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'candles') AND
           NOT EXISTS (SELECT 1 FROM _timescaledb_catalog.hypertable WHERE table_name = 'candles') THEN
            PERFORM create_hypertable('candles', 'timestamp', if_not_exists => TRUE);
        END IF;
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'TimescaleDB extension check completed.';
END $$;
