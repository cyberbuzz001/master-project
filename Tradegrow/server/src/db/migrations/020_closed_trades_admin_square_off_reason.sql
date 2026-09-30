-- Migration 020: Allow ADMIN_SQUARE_OFF as a closed_trades exit_reason
-- The admin force-exit endpoint (POST /admin/positions/:id/square-off) has
-- always written exit_reason='ADMIN_SQUARE_OFF', but the check constraint
-- from migration 009 never included it, so every admin square-off attempt
-- against a position that gets recorded to closed_trades fails with
-- "violates check constraint closed_trades_exit_reason_check" and the
-- whole transaction (position + wallet settlement) rolls back.
--
-- NOTE (added during Phase C perf/correctness pass): this codebase's migration
-- runner has no migrations-applied tracking table — every .sql file re-runs on
-- every server startup, oldest filename first. Migration 021 later widens this
-- same constraint to add 'RMS_AUTO_SQUARE_OFF'. Because 020 sorts before 021 and
-- unconditionally reapplies its own (narrower) definition on every restart, the
-- first time any row actually had exit_reason='RMS_AUTO_SQUARE_OFF', this file
-- would hard-fail on its next re-run (ALTER TABLE ADD CONSTRAINT validates
-- existing rows) before 021 ever got a chance to re-widen it — an exact repeat
-- of the bug found in migration 017 vs 023. Included 'RMS_AUTO_SQUARE_OFF' here
-- too so 020's own definition never regresses behind what 021 (and reality)
-- already allow.

ALTER TABLE closed_trades DROP CONSTRAINT IF EXISTS closed_trades_exit_reason_check;

ALTER TABLE closed_trades ADD CONSTRAINT closed_trades_exit_reason_check
  CHECK (exit_reason IN ('MARKET_SQUARE_OFF','TARGET_LIMIT','STOP_LOSS','MANUAL_EXIT','PARTIAL_EXIT','EXPIRY','SYSTEM_EXIT','ADMIN_SQUARE_OFF','RMS_AUTO_SQUARE_OFF'));
