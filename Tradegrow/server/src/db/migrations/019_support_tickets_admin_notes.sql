-- Migration 019: Add admin_notes to support_tickets
-- Fixes 500 on POST /api/v1/admin/support/tickets/:id/status, which writes
-- admin_notes but the column was never created for this table.

ALTER TABLE support_tickets ADD COLUMN IF NOT EXISTS admin_notes TEXT;
