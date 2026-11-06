ALTER TABLE users
  ADD COLUMN IF NOT EXISTS password_changed_at TIMESTAMPTZ;

UPDATE users
SET password_changed_at = COALESCE(password_changed_at, updated_at, created_at, NOW())
WHERE password_changed_at IS NULL;
