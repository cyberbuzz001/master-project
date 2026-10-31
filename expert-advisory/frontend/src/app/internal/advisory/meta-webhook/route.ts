/**
 * Meta WhatsApp Cloud API Webhook Handler
 * Expert Stocks Advisory Bot — +91 92018 00995
 *
 * GET  /internal/advisory/meta-webhook  — Verification challenge (Meta calls this once on setup)
 * POST /internal/advisory/meta-webhook  — Inbound messages & delivery status updates
 *
 * This route lives in the Next.js frontend so it is served at
 * https://expertstocks.in/internal/advisory/meta-webhook
 * which is the URL registered in Meta App Dashboard.
 *
 * Verify token must match ADVISORY_WHATSAPP_WEBHOOK_SECRET in .env
 */

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

const WEBHOOK_SECRET = process.env.ADVISORY_WHATSAPP_WEBHOOK_SECRET;
const META_APP_SECRET = process.env.META_APP_SECRET;

const TRADEGROW_SERVER_URL =
  process.env.TRADEGROW_SERVER_URL || process.env.TRADEGROW_API_URL || 'https://tradegrowx.in';

const INTERNAL_KEY = process.env.INTERNAL_API_KEY;

// ─────────────────────────────────────────────────────────────────────────────
// GET — Meta Webhook Verification Challenge
// Meta sends: hub.mode=subscribe, hub.verify_token, hub.challenge
// We must echo back hub.challenge as plain text if the token matches.
// ─────────────────────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);

  const mode      = searchParams.get('hub.mode');
  const token     = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');

  console.log('[Meta Webhook] Verification attempt:', { mode, token: token?.slice(0, 8) + '...' });

  if (mode === 'subscribe' && token === WEBHOOK_SECRET) {
    console.log('[Meta Webhook] ✅ Verified by Meta — returning challenge.');
    return new NextResponse(challenge, {
      status: 200,
      headers: { 'Content-Type': 'text/plain' },
    });
  }

  console.warn('[Meta Webhook] ❌ Verification failed — token mismatch.');
  return NextResponse.json(
    { error: 'Forbidden: verify token mismatch' },
    { status: 403 }
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// POST — Inbound Messages & Delivery Status Updates from Meta
// Meta sends all events here. We immediately return 200 then forward
// the payload to the TradeGrow server for processing.
// ─────────────────────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  if (!META_APP_SECRET || !INTERNAL_KEY) {
    return NextResponse.json({ success: false, error: 'WEBHOOK_CONFIGURATION_MISSING' }, { status: 503 });
  }

  // Always acknowledge instantly — Meta retries if we don't respond within 20s
  const rawBody = await req.text();
  const signature = req.headers.get('x-hub-signature-256') || '';
  const expected = `sha256=${crypto.createHmac('sha256', META_APP_SECRET).update(rawBody).digest('hex')}`;
  const sigBuf = Buffer.from(signature);
  const expectedBuf = Buffer.from(expected);
  if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
    return NextResponse.json({ success: false, error: 'INVALID_WEBHOOK_SIGNATURE' }, { status: 403 });
  }
  let body: unknown;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ success: false, error: 'INVALID_JSON' }, { status: 400 });
  }

  // Fire and forget — forward to TradeGrow internal handler
  forwardToTradeGrow(body, INTERNAL_KEY).catch((err) =>
    console.error('[Meta Webhook] Forward error:', err?.message)
  );

  return NextResponse.json({ success: true }, { status: 200 });
}

import { leadsStore } from '@/lib/leads-store';

async function forwardToTradeGrow(payload: any, internalKey: string) {
  if (!payload) return;

  const object = payload?.object;
  const entries = payload?.entry || [];

  if (object !== 'whatsapp_business_account' || entries.length === 0) return;

  // 1. Process inbound messages and persist locally in CRM leadsStore
  try {
    for (const entry of entries) {
      for (const change of entry?.changes || []) {
        const value = change?.value;
        for (const msg of value?.messages || []) {
          const fromPhone = String(msg?.from || '');
          const textBody = msg?.text?.body || (msg?.type ? `[${msg.type} message]` : '[Inbound message]');
          console.log(`[Meta Webhook] Inbound from ${fromPhone}: "${textBody}"`);
          if (fromPhone) {
            leadsStore.recordWhatsAppMessage(fromPhone, {
              text: textBody,
              sender: 'client',
              status: 'delivered',
            });
          }
        }
        for (const status of value?.statuses || []) {
          console.log(`[Meta Webhook] Status update msgId=${status?.id} → ${status?.status}`);
        }
      }
    }
  } catch (err: any) {
    console.warn('[Meta Webhook] Error recording inbound message to leadsStore:', err.message);
  }

  // 2. Forward payload to TradeGrow server for centralized event bus/automation
  try {
    await fetch(`${TRADEGROW_SERVER_URL}/internal/advisory/meta-webhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-internal-key': internalKey,
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(5000),
    });
    console.log('[Meta Webhook] ✅ Forwarded payload to TradeGrow server.');
  } catch (err: any) {
    console.warn('[Meta Webhook] TradeGrow server unreachable:', err.message);
  }
}
