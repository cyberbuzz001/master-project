-- Support Chats (live chat) — the last of the four deferred items from Phase F1's gap
-- analysis. One continuous thread per customer (customer_id is the conversation key,
-- matching the existing support-ticket system's per-customer scoping) — a message row
-- may come from the customer themselves or from any staff member who replied.
CREATE TABLE IF NOT EXISTS chat_messages (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  sender_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  sender_role TEXT NOT NULL,
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  read_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_chat_messages_customer_created ON chat_messages(customer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_messages_unread ON chat_messages(customer_id) WHERE read_at IS NULL;
