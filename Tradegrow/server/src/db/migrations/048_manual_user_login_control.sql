-- 048_manual_user_login_control.sql
-- Adds manual login toggle support per user and global login control

ALTER TABLE users ADD COLUMN IF NOT EXISTS login_enabled BOOLEAN DEFAULT TRUE;

UPDATE users SET login_enabled = TRUE WHERE login_enabled IS NULL;

INSERT INTO system_config (key, value, updated_at)
VALUES ('GLOBAL_USER_LOGIN_ENABLED', 'true', NOW())
ON CONFLICT (key) DO NOTHING;
