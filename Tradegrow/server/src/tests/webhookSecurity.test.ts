import crypto from 'crypto';
import { verifyMetaSignature, isDuplicateWebhookEvent } from '../utils/webhookSecurity';

describe('Webhook Security & Authenticity Verification', () => {
  const testSecret = 'secret_test_meta_webhook_2026_xyz';
  const testPayload = JSON.stringify({
    object: 'whatsapp_business_account',
    entry: [{ id: '12345', changes: [] }]
  });

  test('accepts valid X-Hub-Signature-256 HMAC', () => {
    const rawBuffer = Buffer.from(testPayload, 'utf8');
    const hmac = crypto.createHmac('sha256', testSecret).update(rawBuffer).digest('hex');
    const header = `sha256=${hmac}`;

    const isValid = verifyMetaSignature(rawBuffer, header, testSecret);
    expect(isValid).toBe(true);
  });

  test('rejects tampered payload', () => {
    const rawBuffer = Buffer.from(testPayload, 'utf8');
    const hmac = crypto.createHmac('sha256', testSecret).update(rawBuffer).digest('hex');
    const header = `sha256=${hmac}`;

    const tamperedBuffer = Buffer.from(testPayload + ' ', 'utf8');
    const isValid = verifyMetaSignature(tamperedBuffer, header, testSecret);
    expect(isValid).toBe(false);
  });

  test('rejects incorrect secret', () => {
    const rawBuffer = Buffer.from(testPayload, 'utf8');
    const hmac = crypto.createHmac('sha256', 'wrong_secret').update(rawBuffer).digest('hex');
    const header = `sha256=${hmac}`;

    const isValid = verifyMetaSignature(rawBuffer, header, testSecret);
    expect(isValid).toBe(false);
  });

  test('rejects missing or malformed signature header', () => {
    const rawBuffer = Buffer.from(testPayload, 'utf8');
    expect(verifyMetaSignature(rawBuffer, undefined, testSecret)).toBe(false);
    expect(verifyMetaSignature(rawBuffer, 'invalid_header', testSecret)).toBe(false);
    expect(verifyMetaSignature(rawBuffer, 'md5=abcd1234', testSecret)).toBe(false);
  });

  test('detects and suppresses replayed webhook message IDs', async () => {
    const uniqueMsgId = `wamid_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    const firstSeen = await isDuplicateWebhookEvent('meta_test', uniqueMsgId);
    expect(firstSeen).toBe(false);

    const replayed = await isDuplicateWebhookEvent('meta_test', uniqueMsgId);
    expect(replayed).toBe(true);

    const anotherMsg = await isDuplicateWebhookEvent('meta_test', `${uniqueMsgId}_other`);
    expect(anotherMsg).toBe(false);
  });
});

