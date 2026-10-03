/**
 * Meta WhatsApp Cloud API Webhook Handler
 * Expert Stocks Advisory Bot — +91 92388 37041
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

const WEBHOOK_SECRET =
  process.env.ADVISORY_WHATSAPP_WEBHOOK_SECRET || 'expert_stocks_webhook_2026';

const TRADEGROW_SERVER_URL =
  process.env.TRADEGROW_SERVER_URL || 'http://localhost:5000';

const INTERNAL_KEY =
  process.env.INTERNAL_API_KEY || 'advisory_internal_2026_key';

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
  // Always acknowledge instantly — Meta retries if we don't respond within 20s
  const body = await req.json().catch(() => null);

  // Fire and forget — forward to TradeGrow internal handler
  forwardToTradeGrow(body).catch((err) =>
    console.error('[Meta Webhook] Forward error:', err?.message)
  );

  return NextResponse.json({ success: true }, { status: 200 });
}

async function forwardToTradeGrow(payload: any) {
  if (!payload) return;

  const object = payload?.object;
  const entries = payload?.entry || [];

  if (object !== 'whatsapp_business_account' || entries.length === 0) return;

  // Process inbound messages and status updates locally if TradeGrow server not reachable
  try {
    await fetch(`${TRADEGROW_SERVER_URL}/internal/advisory/meta-webhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-internal-key': INTERNAL_KEY,
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(5000),
    });
    console.log('[Meta Webhook] ✅ Forwarded payload to TradeGrow server.');
  } catch (err: any) {
    console.warn('[Meta Webhook] TradeGrow server unreachable — logging locally:', err.message);
    // Log message details locally for manual review
    for (const entry of entries) {
      for (const change of entry?.changes || []) {
        const value = change?.value;
        for (const msg of value?.messages || []) {
          console.log(`[Meta Webhook] Inbound from ${msg?.from}: "${msg?.text?.body || '[non-text]'}"`);
        }
        for (const status of value?.statuses || []) {
          console.log(`[Meta Webhook] Status update msgId=${status?.id} → ${status?.status}`);
        }
      }
    }
  }
}
