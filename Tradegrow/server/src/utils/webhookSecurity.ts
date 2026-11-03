import crypto from 'crypto';
import { redis } from '../db/redis';

/**
 * Validates Meta (WhatsApp Cloud API) X-Hub-Signature-256 header against raw payload buffer.
 * Enforces constant-time comparison to prevent timing attacks.
 */
export function verifyMetaSignature(
  rawBody: Buffer | string | undefined,
  signatureHeader: string | undefined,
  appSecret: string
): boolean {
  if (!signatureHeader || !appSecret || !rawBody) {
    return false;
  }

  const parts = signatureHeader.split('=');
  if (parts.length !== 2 || parts[0].toLowerCase() !== 'sha256') {
    return false;
  }

  const clientSignature = parts[1].trim().toLowerCase();
  const hmac = crypto.createHmac('sha256', appSecret);
  const payloadBuffer = Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(rawBody, 'utf8');
  const expectedSignature = hmac.update(payloadBuffer).digest('hex').toLowerCase();

  const clientBuf = Buffer.from(clientSignature, 'hex');
  const expectedBuf = Buffer.from(expectedSignature, 'hex');

  if (clientBuf.length !== expectedBuf.length) {
    return false;
  }

  return crypto.timingSafeEqual(clientBuf, expectedBuf);
}

/**
 * Checks and records event/message ID to prevent replay attacks across webhooks.
 * Returns true if this event is a duplicate (already processed), false if new.
 */
export async function isDuplicateWebhookEvent(
  provider: string,
  eventId: string,
  ttlSeconds = 86400
): Promise<boolean> {
  if (!eventId) return false;
  const key = `webhook_event:${provider}:${eventId.trim()}`;
  const isNew = await redis.setIfNotExists(key, '1', ttlSeconds);
  return !isNew;
}

