-- B1 fix: 'MARGIN_RESET' was used as a wallet_ledger.transaction_type by
-- POST /funds/reset-margin but was never a permitted value under this check
-- constraint, so the ledger insert always threw (a 500 on every call to that
-- route). Widen the constraint to make it a legal value, matching the
-- established pattern from prior CHECK-constraint widenings in this codebase.
ALTER TABLE wallet_ledger DROP CONSTRAINT IF EXISTS wallet_ledger_transaction_type_check;
ALTER TABLE wallet_ledger ADD CONSTRAINT wallet_ledger_transaction_type_check
  CHECK (transaction_type = ANY (ARRAY[
    'CREDIT'::text, 'DEBIT'::text, 'DEPOSIT'::text, 'WITHDRAWAL'::text,
    'MARGIN_BLOCK'::text, 'MARGIN_RELEASE'::text, 'MARGIN_RESET'::text,
    'PNL_SETTLEMENT'::text, 'ADMIN_ADJUSTMENT'::text, 'CHARGE_DEBIT'::text,
    'BROKERAGE'::text
  ]));
