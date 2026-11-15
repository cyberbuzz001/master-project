-- Losses and administrator corrections may exceed capital. Preserve the
-- liability rather than silently forgiving it. Margin reservations remain >= 0.
ALTER TABLE virtual_wallets
  DROP CONSTRAINT IF EXISTS virtual_wallets_cash_balance_check;
