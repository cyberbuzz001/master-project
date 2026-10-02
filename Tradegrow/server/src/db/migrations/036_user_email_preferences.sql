-- 036_user_email_preferences.sql
-- Adds per-user email notification toggle and super admin alert config

-- 1. Add email_notifications_enabled column to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_notifications_enabled BOOLEAN NOT NULL DEFAULT TRUE;
CREATE INDEX IF NOT EXISTS idx_users_email_notifications ON users(email_notifications_enabled);

-- 2. Add Super Admin notification configuration
INSERT INTO system_config (key, value, updated_at)
VALUES 
  ('SUPER_ADMIN_ALERT_EMAIL', 'cyberbuzz.mail@gmail.com', NOW()),
  ('SUPER_ADMIN_NOTIFICATIONS_ENABLED', 'true', NOW())
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();
