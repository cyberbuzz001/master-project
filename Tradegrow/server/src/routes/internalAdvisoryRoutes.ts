/**
 * Advisory WhatsApp Routes — Meta Cloud API + Internal Triggers
 *
 * TWO categories of endpoints:
 *
 * 1. PUBLIC (Meta Webhooks) — No internal key required. Meta calls these:
 *    GET  /internal/advisory/meta-webhook   — Meta webhook verification challenge
 *    POST /internal/advisory/meta-webhook   — Inbound messages & status updates from Meta
 *
 * 2. INTERNAL (Protected by x-internal-key header) — Called by Expert Stocks frontend:
 *    POST /internal/advisory/welcome          — Trigger lead welcome sequence
 *    POST /internal/advisory/followup         — Trigger consultation follow-up
 *    POST /internal/advisory/kyc-nudge        — Trigger KYC onboarding nudge
 *    POST /internal/advisory/report           — Dispatch a research report
 *    POST /internal/advisory/plan-activated   — Confirm plan activation (transactional)
 *    GET  /internal/advisory/health           — Bot health & metrics
 *    GET  /internal/advisory/qrcode           — Instance connection state
 *    POST /internal/advisory/status           — Manual status update
 *
 * Mount in index.ts:
 *   app.use('/internal/advisory', internalAdvisoryRouter);
 *
 * Meta App Dashboard Webhook URL (set in Meta Developer Console):
 *   https://YOUR_DOMAIN/internal/advisory/meta-webhook
 *   Verify Token: value of ADVISORY_WHATSAPP_WEBHOOK_SECRET env var
 */

import { Router, type Request, type Response } from 'express';
import { AdvisoryWhatsAppService } from '../services/AdvisoryWhatsAppService';
import { verifyMetaSignature, isDuplicateWebhookEvent } from '../utils/webhookSecurity';

export const internalAdvisoryRouter = Router();

const INTERNAL_KEY = process.env.INTERNAL_API_KEY;
if (!INTERNAL_KEY) {
  console.warn("[Security] ⚠️ INTERNAL_API_KEY environment variable is not configured. Internal routes will reject all requests.");
}

// ─── PUBLIC: Meta Webhook Endpoints (Signature-verified, NO internal key guard) ──

/**
 * GET /internal/advisory/meta-webhook
 * Meta calls this to verify your webhook URL when configured in App Dashboard.
 */
internalAdvisoryRouter.get('/meta-webhook', (req: Request, res: Response) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  const expectedToken = process.env.ADVISORY_WHATSAPP_WEBHOOK_SECRET;

  if (!expectedToken) {
    console.error('[Advisory Meta Webhook] ADVISORY_WHATSAPP_WEBHOOK_SECRET is not configured.');
    return res.status(500).json({ error: 'Server misconfiguration: Webhook secret not set' });
  }

  if (mode === 'subscribe' && token === expectedToken) {
    console.log('[Advisory Meta Webhook] ✅ Webhook verified by Meta.');
    return res.status(200).send(challenge);
  }

  console.warn('[Advisory Meta Webhook] ❌ Verification failed — token mismatch.');
  return res.status(403).json({ error: 'Forbidden: Webhook verify token mismatch' });
});

/**
 * POST /internal/advisory/meta-webhook
 * Meta sends inbound messages and delivery status updates here.
 * Verified cryptographically with HMAC-SHA256 (X-Hub-Signature-256) and replay-protected.
 */
internalAdvisoryRouter.post('/meta-webhook', async (req: Request, res: Response) => {
  const appSecret = process.env.WHATSAPP_APP_SECRET || process.env.META_APP_SECRET || process.env.ADVISORY_WHATSAPP_APP_SECRET;
  const signature = req.headers['x-hub-signature-256'] as string;
  const rawBody = (req as any).rawBody;

  // Verify authenticity with timing-safe HMAC SHA-256
  if (process.env.NODE_ENV === 'production' || appSecret) {
    if (!appSecret || !verifyMetaSignature(rawBody, signature, appSecret)) {
      console.warn('[Advisory Meta Webhook] ❌ Rejected: Invalid or missing X-Hub-Signature-256');
      return res.status(401).json({ error: 'Unauthorized: Invalid signature' });
    }
  }

  // Respond 200 once authenticated so Meta does not retry
  res.status(200).json({ success: true });

  try {
    const body = req.body;
    if (body?.object !== 'whatsapp_business_account') return;

    const svc = AdvisoryWhatsAppService.getInstance();

    for (const entry of body?.entry || []) {
      for (const change of entry?.changes || []) {
        const value = change?.value;

        // ── Inbound Messages ──────────────────────────────────────────────────
        for (const msg of value?.messages || []) {
          const fromRaw = msg?.from;
          const messageId = msg?.id;
          const bodyText = msg?.text?.body || msg?.button?.text || '';

          if (fromRaw && messageId) {
            // Deduplicate event ID to prevent replay attacks
            const isDuplicate = await isDuplicateWebhookEvent('meta_advisory_msg', messageId);
            if (isDuplicate) {
              console.log(`[Advisory Meta Webhook] Skipping duplicate messageId: ${messageId}`);
              continue;
            }

            const fromE164 = svc.normalizePhoneE164(fromRaw);
            console.log(`[Advisory Meta Webhook] Inbound from ${fromE164}: "${bodyText}"`);
            await svc.handleInboundMessage(fromE164, bodyText, messageId);
          }
        }

        // ── Delivery Status Updates ───────────────────────────────────────────
        for (const status of value?.statuses || []) {
          const messageId = status?.id;
          const statusValue = status?.status?.toUpperCase();

          if (messageId && ['DELIVERED', 'READ', 'FAILED'].includes(statusValue)) {
            const isDuplicate = await isDuplicateWebhookEvent('meta_advisory_status', `${messageId}_${statusValue}`);
            if (isDuplicate) continue;

            await svc.handleStatusUpdate(
              messageId,
              statusValue as 'DELIVERED' | 'READ' | 'FAILED',
              status?.errors?.[0]?.code?.toString()
            );
          }
        }
      }
    }
  } catch (err: any) {
    console.error('[Advisory Meta Webhook] Error processing payload:', err.message);
  }
});

// ─── Internal Key Guard Middleware (applies to all routes below) ──────────────
function requireInternalKey(req: Request, res: Response, next: Function) {
  const key = req.headers['x-internal-key'] as string;
  if (!INTERNAL_KEY || key !== INTERNAL_KEY) {
    return res.status(403).json({ success: false, error: 'Forbidden: Invalid internal key' });
  }
  next();
}

internalAdvisoryRouter.use(requireInternalKey);

const advisory = () => AdvisoryWhatsAppService.getInstance();

// ─────────────────────────────────────────────────────────────────────────────
// POST /internal/advisory/welcome
// Trigger the Sequence 1 welcome message for a new lead
// Body: { phone, leadId, fullName? }
// ─────────────────────────────────────────────────────────────────────────────
internalAdvisoryRouter.post('/welcome', async (req: Request, res: Response) => {
  try {
    const { phone, leadId, fullName } = req.body;

    if (!phone || !leadId) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: phone, leadId',
      });
    }

    const result = await advisory().triggerLeadWelcome(phone, leadId, fullName);

    console.log(
      `[Advisory Webhook] Lead welcome dispatched: ${leadId} → ${phone} (status: ${result.status})`
    );

    return res.json({ success: result.success, status: result.status, messageId: result.messageId });
  } catch (err: any) {
    console.error('[Advisory Webhook] /welcome error:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /internal/advisory/followup
// Trigger the Sequence 2 consultation follow-up message
// Body: { phone, leadId, fullName? }
// ─────────────────────────────────────────────────────────────────────────────
internalAdvisoryRouter.post('/followup', async (req: Request, res: Response) => {
  try {
    const { phone, leadId, fullName } = req.body;
    if (!phone || !leadId) {
      return res.status(400).json({ success: false, error: 'Missing phone or leadId' });
    }

    const result = await advisory().triggerConsultationFollowUp(phone, leadId, fullName);
    return res.json({ success: result.success, status: result.status, messageId: result.messageId });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /internal/advisory/kyc-nudge
// Trigger the Sequence 4 KYC onboarding nudge
// Body: { phone, leadId, fullName? }
// ─────────────────────────────────────────────────────────────────────────────
internalAdvisoryRouter.post('/kyc-nudge', async (req: Request, res: Response) => {
  try {
    const { phone, leadId, fullName } = req.body;
    if (!phone || !leadId) {
      return res.status(400).json({ success: false, error: 'Missing phone or leadId' });
    }

    const result = await advisory().triggerKycOnboardingNudge(phone, leadId, fullName);
    return res.json({ success: result.success, status: result.status, messageId: result.messageId });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /internal/advisory/report
// Dispatch a complimentary research report
// Body: { phone, leadId, reportTitle, reportUrl }
// ─────────────────────────────────────────────────────────────────────────────
internalAdvisoryRouter.post('/report', async (req: Request, res: Response) => {
  try {
    const { phone, leadId, reportTitle, reportUrl } = req.body;
    if (!phone || !leadId || !reportTitle || !reportUrl) {
      return res.status(400).json({ success: false, error: 'Missing phone, leadId, reportTitle, or reportUrl' });
    }

    const result = await advisory().triggerResearchReportDispatch(phone, leadId, reportTitle, reportUrl);
    return res.json({ success: result.success, status: result.status, messageId: result.messageId });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /internal/advisory/plan-activated
// Confirm plan activation (urgentTransactional — bypasses hours guard)
// Body: { phone, clientId, fullName?, planName? }
// ─────────────────────────────────────────────────────────────────────────────
internalAdvisoryRouter.post('/plan-activated', async (req: Request, res: Response) => {
  try {
    const { phone, clientId, fullName, planName } = req.body;
    if (!phone || !clientId) {
      return res.status(400).json({ success: false, error: 'Missing phone or clientId' });
    }

    const result = await advisory().triggerPlanActivation(phone, clientId, fullName, planName);
    return res.json({ success: result.success, status: result.status, messageId: result.messageId });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /internal/advisory/health
// Returns bot metrics, connection state, and daily limits
// ─────────────────────────────────────────────────────────────────────────────
internalAdvisoryRouter.get('/health', async (_req: Request, res: Response) => {
  try {
    const metrics = await advisory().getMetrics();
    return res.json({ success: true, data: metrics });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /internal/advisory/qrcode
// Returns the QR code to pair the Expert Stocks advisory number
// ─────────────────────────────────────────────────────────────────────────────
internalAdvisoryRouter.get('/qrcode', async (_req: Request, res: Response) => {
  try {
    const qr = await advisory().getQRCode();
    return res.json({ success: true, data: qr });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /internal/advisory/inbound
// Receives inbound messages from Evolution API webhook for the advisory instance
// Body: { from, body, messageId }
// ─────────────────────────────────────────────────────────────────────────────
internalAdvisoryRouter.post('/inbound', async (req: Request, res: Response) => {
  try {
    const { from, body: msgBody, messageId } = req.body;
    if (!from || !messageId) {
      return res.status(400).json({ success: false, error: 'Missing from or messageId' });
    }

    const normalizedFrom = advisory().normalizePhoneE164(from);
    const result = await advisory().handleInboundMessage(normalizedFrom, msgBody || '', messageId);

    console.log(
      `[Advisory Webhook] Inbound from ${normalizedFrom}: optOut=${result.optOutTriggered}`
    );

    return res.json({ success: true, ...result });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /internal/advisory/status
// Receive delivery status updates from Evolution API / Meta webhook
// Body: { messageId, status, errorCode? }
// ─────────────────────────────────────────────────────────────────────────────
internalAdvisoryRouter.post('/status', async (req: Request, res: Response) => {
  try {
    const { messageId, status, errorCode } = req.body;
    if (!messageId || !status) {
      return res.status(400).json({ success: false, error: 'Missing messageId or status' });
    }

    const updated = await advisory().handleStatusUpdate(messageId, status, errorCode);
    return res.json({ success: updated });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});
