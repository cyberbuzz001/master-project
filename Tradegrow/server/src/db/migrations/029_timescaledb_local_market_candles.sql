-- ==============================================================================
-- 029_timescaledb_local_market_candles.sql
-- TimescaleDB Hypertable, Compression & Retention Policy for local_market_candles
-- ==============================================================================

DO $$
BEGIN
  -- 1. Ensure TimescaleDB extension is enabled if available
  CREATE EXTENSION IF NOT EXISTS timescaledb CASCADE;

  -- 2. Ensure datetime column index exists
  CREATE INDEX IF NOT EXISTS idx_local_market_candles_dt ON local_market_candles (datetime DESC);

  -- 3. Convert local_market_candles to a hypertable on datetime (chunk interval 7 days)
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'timescaledb') THEN
    BEGIN
      PERFORM create_hypertable(
        'local_market_candles',
        'datetime',
        chunk_time_interval => INTERVAL '7 days',
        if_not_exists => TRUE,
        migrate_data => TRUE
      );

      -- 4. Enable TimescaleDB Columnar Compression (segmented by instrument_token, timeframe)
      ALTER TABLE local_market_candles SET (
        timescaledb.compress,
        timescaledb.compress_segmentby = 'instrument_token, timeframe, exchange',
        timescaledb.compress_orderby = 'datetime DESC'
      );

      -- 5. Auto-compress candles older than 14 days
      PERFORM add_compression_policy('local_market_candles', INTERVAL '14 days', if_not_exists => TRUE);

      -- 6. Auto-drop raw 1-minute historical candles older than 90 days
      PERFORM add_retention_policy('local_market_candles', INTERVAL '90 days', if_not_exists => TRUE);

      RAISE NOTICE 'TimescaleDB hypertable, compression, and retention configured for local_market_candles.';
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'TimescaleDB hypertable setup skipped or already active: %', SQLERRM;
    END;
  END IF;
END $$;
