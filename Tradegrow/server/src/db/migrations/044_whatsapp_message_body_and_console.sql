-- =============================================================================
-- Migration 044: WhatsApp Live Chat Console & Message Body Persistence
-- =============================================================================

ALTER TABLE warroom.whatsapp_messages ADD COLUMN IF NOT EXISTS message_body TEXT;
ALTER TABLE warroom.whatsapp_messages ADD COLUMN IF NOT EXISTS sender_name VARCHAR(255);
ALTER TABLE warroom.whatsapp_messages ADD COLUMN IF NOT EXISTS media_url TEXT;
ALTER TABLE warroom.whatsapp_messages ADD COLUMN IF NOT EXISTS media_type VARCHAR(50);

CREATE INDEX IF NOT EXISTS idx_wa_messages_phone_sent ON warroom.whatsapp_messages(phone_e164, sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_wa_messages_direction ON warroom.whatsapp_messages(direction);
