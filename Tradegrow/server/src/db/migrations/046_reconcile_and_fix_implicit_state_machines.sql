-- =============================================================================
-- Migration 045: Reconcile & Fix Implicit State Machines
-- 1. Retire cTrader Gateway Order Mapping schema (order_mappings, ctrader_*)
-- 2. Enforce canonical Order state constraint without phantom states
-- 3. Auto-heal any orphaned EXECUTING orders
-- 4. Add rejection_reason column to gtt_orders to close GTT dead-end state
-- 5. Harmonize triplicated KYC state across users, kyc_applications & kyc_records
-- =============================================================================

-- ─── 1. Retire cTrader Order Mapping & Terminal Tables ──────────────────────
DROP TABLE IF EXISTS order_mappings CASCADE;
DROP TABLE IF EXISTS ctrader_symbols CASCADE;
DROP TABLE IF EXISTS ctrader_accounts CASCADE;

-- ─── 2. Enforce Canonical Order Status Check Constraint ─────────────────────
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_status_check;

ALTER TABLE orders ADD CONSTRAINT orders_status_check
  CHECK (status IN (
    'CREATED',
    'VALIDATING',
    'RMS_CHECK',
    'ACCEPTED',
    'PENDING',
    'EXECUTING',
    'PARTIALLY_FILLED',
    'FILLED',
    'REJECTED',
    'CANCELLED',
    'EXPIRED'
  ));

-- ─── 3. Auto-Heal Any Orphaned EXECUTING Orders ─────────────────────────────
UPDATE orders 
SET status = 'ACCEPTED', updated_at = NOW() 
WHERE status = 'EXECUTING' AND id NOT IN (SELECT order_id FROM executions);

UPDATE orders 
SET status = 'FILLED', filled_quantity = quantity, updated_at = NOW() 
WHERE status = 'EXECUTING' AND id IN (SELECT order_id FROM executions);

-- ─── 4. GTT Engine Dead-End Prevention ──────────────────────────────────────
ALTER TABLE gtt_orders ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

-- ─── 5. Synchronize Triplicated KYC State ───────────────────────────────────
-- 5a. If users.is_kyc_completed is true or kyc_applications is APPROVED -> mark both APPROVED
UPDATE users 
SET is_kyc_completed = TRUE 
WHERE id IN (SELECT user_id FROM kyc_applications WHERE status = 'APPROVED');

UPDATE kyc_applications 
SET status = 'APPROVED', reviewed_at = COALESCE(reviewed_at, NOW()), updated_at = NOW() 
WHERE user_id IN (SELECT id FROM users WHERE is_kyc_completed = TRUE)
  AND status != 'APPROVED';

-- 5b. Backfill / sync kyc_records for all approved users
INSERT INTO kyc_records (id, customer_id, kyc_status, verification_status, risk_category, verified_at, notes, created_at, updated_at)
SELECT 
  'kyc_rec_sync_' || substr(md5(random()::text || u.id), 1, 16),
  u.id,
  'APPROVED',
  'VERIFIED',
  'MEDIUM',
  NOW(),
  'Reconciled and synchronized by Migration 045',
  NOW(),
  NOW()
FROM users u
WHERE u.is_kyc_completed = TRUE
  AND NOT EXISTS (SELECT 1 FROM kyc_records kr WHERE kr.customer_id = u.id AND kr.kyc_status = 'APPROVED')
ON CONFLICT (id) DO NOTHING;

-- 5c. Sync rejected users
UPDATE users 
SET is_kyc_completed = FALSE 
WHERE id IN (SELECT user_id FROM kyc_applications WHERE status = 'REJECTED');

-- 5d. Sync warroom kyc if present
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'warroom' AND table_name = 'kyc_applications') THEN
    UPDATE warroom.kyc_applications
    SET status = 'COMPLETED', current_step = 'VERIFIED', completed_at = NOW()
    WHERE user_id IN (SELECT id FROM users WHERE is_kyc_completed = TRUE)
      AND status != 'COMPLETED';
  END IF;
END $$;

-- ─── 6. Sweep Stale Price Alerts (>30 Days Old) ─────────────────────────────
UPDATE alerts
SET status = 'EXPIRED'
WHERE status = 'ACTIVE' AND created_at < NOW() - INTERVAL '30 days';
