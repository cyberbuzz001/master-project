-- Order idempotency keys are supplied by clients and must be unique only
-- within the submitting account. The original schema/index enforced a global
-- uniqueness constraint, causing unrelated accounts to collide.
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_idempotency_key_key;
DROP INDEX IF EXISTS idx_orders_idempotency_lookup;

CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_user_idempotency_lookup
  ON orders(user_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;
