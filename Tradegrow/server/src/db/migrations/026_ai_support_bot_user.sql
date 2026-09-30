-- Migration 026: AI Support Bot system user
-- The AI customer-support agent posts chat replies through chat_messages.sender_id,
-- which has a NOT NULL FK to users(id) — it needs a real row, not a magic string.
-- status = 'DISABLED' + an unusable password_hash mean this account can never log in
-- (routes/api.ts's /auth/login rejects non-ACTIVE users before password verification).
INSERT INTO users (id, username, email, password_hash, role, status, client_id)
VALUES (
  'usr_ai_support_bot',
  'tradegrow_ai_support',
  'ai-support@tradegrow.internal',
  'DISABLED_NO_LOGIN_' || encode(gen_random_bytes(24), 'hex'),
  'SUPPORT_AGENT',
  'DISABLED',
  'TG-BOT-0001'
)
ON CONFLICT (id) DO NOTHING;
