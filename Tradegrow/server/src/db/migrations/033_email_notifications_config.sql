-- 033_email_notifications_config.sql
-- Adds default email system settings and delivery logging table

-- 1. Insert default email configurations into system_config if not exists
INSERT INTO system_config (key, value, updated_at)
VALUES 
  ('SMTP_HOST', 'smtp.hostinger.com', NOW()),
  ('SMTP_PORT', '465', NOW()),
  ('SMTP_SECURE', 'true', NOW()),
  ('SMTP_USER', 'notifications@tradegrowx.in', NOW()),
  ('SMTP_PASS', '', NOW()),
  ('EMAIL_FROM', '"TradeGrow" <notifications@tradegrowx.in>', NOW()),
  ('EMAIL_NOTIFICATIONS_ENABLED', 'true', NOW()),
  ('EMAIL_NOTIFY_ORDERS', 'true', NOW()),
  ('EMAIL_NOTIFY_FUNDS', 'true', NOW()),
  ('EMAIL_NOTIFY_KYC', 'true', NOW()),
  ('EMAIL_NOTIFY_SECURITY', 'true', NOW())
ON CONFLICT (key) DO NOTHING;

-- 2. Email Delivery Log Table
CREATE TABLE IF NOT EXISTS email_delivery_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR(64),
  to_email VARCHAR(255) NOT NULL,
  subject VARCHAR(255) NOT NULL,
  template_type VARCHAR(64) NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'SENT',
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_email_logs_user_id ON email_delivery_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_email_logs_created_at ON email_delivery_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_logs_template ON email_delivery_logs(template_type);
