-- 034_email_high_priority_and_registration_otp.sql
-- Configures High-Priority Only email dispatch policy and Registration Email OTP verification

INSERT INTO system_config (key, value, updated_at)
VALUES 
  ('EMAIL_HIGH_PRIORITY_ONLY', 'true', NOW()),
  ('REQUIRE_REGISTRATION_EMAIL_OTP', 'true', NOW()),
  ('EMAIL_NOTIFY_ORDERS', 'false', NOW())
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();
