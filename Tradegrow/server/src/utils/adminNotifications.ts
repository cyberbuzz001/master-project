/**
 * adminNotifications.ts
 *
 * Persists genuinely alert-worthy admin events into the `admin_notifications`
 * table (provisioned by migration 016, "for future real-time alerts" — never
 * wired to anything until now) and pushes them live over the same /ws
 * connection Phase E1 already wired admin pages into.
 *
 * Deliberately NOT called from every adminEventBus emit site — most of those
 * (POSITION_UPDATED, FUNDS_UPDATED, routine ORDER_CREATED) are high-frequency
 * sync signals for an already-open page, not something worth a persistent,
 * needs-review notification. Call sites here are hand-picked to be the
 * actually-alert-worthy subset: high/critical RMS risk events, an account
 * auto-suspension, a new fund request needing action, and a fund request
 * escalated past a first approver's authority.
 */
import { execute } from '../db/schema';
import { adminEventBus } from './adminEventBus';
import { generateUUID } from './crypto';

export async function createAdminNotification(
  eventType: string,
  userId: string | null,
  payload: Record<string, any>
): Promise<void> {
  const id = 'ntf_' + generateUUID();
  await execute(
    `INSERT INTO admin_notifications (id, event_type, user_id, payload) VALUES ($1, $2, $3, $4)`,
    [id, eventType, userId, JSON.stringify(payload)]
  ).catch((err: any) => console.error('[AdminNotifications] Failed to persist:', err.message));

  // Routed the same way OrderMonitor/FundsDashboard already subscribe (ADMIN_SUBSCRIBE_ALL) —
  // userId here is only the notification's subject, not a delivery-scoping key, so a
  // system-wide event (e.g. no specific customer) can safely use a placeholder.
  adminEventBus.emitUserEvent('ADMIN_NOTIFICATION_CREATED', userId || 'SYSTEM', {
    id, eventType, userId, payload, createdAt: Date.now(),
  });
}
