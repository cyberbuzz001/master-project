-- Migration 010: Add 'EXECUTING' to orders table status check constraint
-- Fixes check constraint error that was blocking market order and limit order execution.

ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_status_check;

ALTER TABLE orders ADD CONSTRAINT orders_status_check
  CHECK (status IN ('CREATED','VALIDATING','RMS_CHECK','ACCEPTED','PENDING','EXECUTING','PARTIALLY_FILLED','FILLED','REJECTED','CANCELLED','EXPIRED'));
