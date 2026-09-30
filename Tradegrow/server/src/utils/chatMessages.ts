/**
 * chatMessages.ts
 * Shared persistence + delivery for the live-chat feature (Support Chats — the last
 * of the four deferred items from Phase F1's gap analysis). One continuous thread
 * per customer; called from both the WS gateway's CHAT_SEND handler and the REST
 * fallback routes, so a message sent either way is recorded and delivered the same.
 */
import { execute, query } from '../db/schema';
import { generateUUID } from './crypto';
import { adminEventBus } from './adminEventBus';

export interface ChatMessageRow {
  id: string;
  customer_id: string;
  sender_id: string;
  sender_role: string;
  message: string;
  created_at: string;
  read_at: string | null;
}

/**
 * Persists a chat message and pushes it to any admin socket watching this customer
 * (per-customer ADMIN_SUBSCRIBE) or watching platform-wide (ADMIN_SUBSCRIBE_ALL) —
 * reusing the exact fan-out Phase E1 already wired up. Does NOT deliver to the
 * customer's own connection; that half (a direct, non-admin-flagged socket lookup)
 * only the WS gateway itself can do, since it alone holds the live `wss.clients` set
 * — see `deliverToUser` in `websocket/server.ts`, called by the route/handler after
 * this resolves.
 */
export async function recordChatMessage(
  customerId: string,
  senderId: string,
  senderRole: string,
  text: string
): Promise<ChatMessageRow> {
  const id = 'cmsg_' + generateUUID();
  await execute(
    `INSERT INTO chat_messages (id, customer_id, sender_id, sender_role, message) VALUES ($1, $2, $3, $4, $5)`,
    [id, customerId, senderId, senderRole, text]
  );
  const row: ChatMessageRow = {
    id, customer_id: customerId, sender_id: senderId, sender_role: senderRole,
    message: text, created_at: new Date().toISOString(), read_at: null,
  };
  adminEventBus.emitUserEvent('CHAT_MESSAGE_RECEIVED', customerId, { message: row });
  return row;
}

export async function getChatHistory(customerId: string, limit = 100): Promise<ChatMessageRow[]> {
  return query<ChatMessageRow>(
    `SELECT * FROM (
      SELECT * FROM chat_messages
      WHERE customer_id = $1
      ORDER BY created_at DESC
      LIMIT $2
    ) recent
    ORDER BY created_at ASC`,
    [customerId, limit]
  );
}

export async function markChatReadByStaff(customerId: string): Promise<void> {
  // Only staff-side reads clear the "customer is waiting" unread count — a customer
  // reading the admin's own reply doesn't need a symmetric "admin unread" concept.
  await execute(
    `UPDATE chat_messages SET read_at = NOW() WHERE customer_id = $1 AND sender_role = 'USER' AND read_at IS NULL`,
    [customerId]
  );
}
