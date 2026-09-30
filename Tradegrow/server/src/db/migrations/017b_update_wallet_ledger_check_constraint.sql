-- Migration 017: Expand wallet_ledger transaction_type check constraint
-- Allows 'CREDIT','DEBIT','DEPOSIT','WITHDRAWAL','MARGIN_BLOCK','MARGIN_RELEASE','MARGIN_RESET','PNL_SETTLEMENT','ADMIN_ADJUSTMENT','CHARGE_DEBIT','BROKERAGE'
--
-- NOTE: this codebase's migration runner (server/src/db/schema.ts runMigrations) has no
-- migrations-applied tracking table — every .sql file in this directory re-runs, unconditionally,
-- on every single server startup, in filename-sorted order. That means every migration must stay
-- idempotent against whatever data currently exists, forever, not just be correct the first time
-- it runs. 'MARGIN_RESET' was added by a later file (023_wallet_ledger_margin_reset_type.sql),
-- but since this file (017) sorts before 023 and re-applies its own (then-narrower) constraint
-- definition on every restart, once any row with transaction_type='MARGIN_RESET' actually existed
-- this file started hard-failing server startup — ALTER TABLE ... ADD CONSTRAINT validates against
-- every existing row, and 017's original list didn't include a value 023 had already allowed. Added
-- 'MARGIN_RESET' here too so this file's own constraint stays consistent with reality on every re-run.

ALTER TABLE wallet_ledger DROP CONSTRAINT IF EXISTS wallet_ledger_transaction_type_check;

ALTER TABLE wallet_ledger ADD CONSTRAINT wallet_ledger_transaction_type_check
  CHECK (transaction_type IN ('CREDIT', 'DEBIT', 'DEPOSIT', 'WITHDRAWAL', 'MARGIN_BLOCK', 'MARGIN_RELEASE', 'MARGIN_RESET', 'PNL_SETTLEMENT', 'ADMIN_ADJUSTMENT', 'CHARGE_DEBIT', 'BROKERAGE'));
