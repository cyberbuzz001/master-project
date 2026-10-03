/**
 * Advisory WhatsApp Automation & Message Engine
 * Expert Stocks — +91 92388 37041
 *
 * PRIMARY PROVIDER: Meta WhatsApp Cloud API (Official Business API)
 * Completely independent from the TradeGrow WhatsApp engine.
 * Uses a separate DB schema: advisory.*
 *
 * Meta Cloud API Notes:
 * ─────────────────────────────────────────────────────────────
 * - First outbound message to a new contact MUST use an approved template
 * - Reply messages (within 24h customer-service window) can be free-text
 * - Templates need to be submitted via Meta Business Manager for approval
 * - Webhook verification (GET) and message events (POST) handled by internalAdvisoryRoutes
 *
 * Environment Variables Required (Meta Cloud API):
 * ─────────────────────────────────────────────────────────────
 * ADVISORY_WHATSAPP_PROVIDER           = META_CLOUD
 * ADVISORY_WHATSAPP_META_TOKEN         = <Permanent System User Access Token from Meta>
 * ADVISORY_WHATSAPP_PHONE_NUMBER_ID    = <Phone Number ID from Meta Business Manager>
 * ADVISORY_WHATSAPP_WABA_ID            = <WhatsApp Business Account ID>
 * ADVISORY_WHATSAPP_WEBHOOK_SECRET     = <Webhook verify token you set in Meta App Dashboard>
 * ADVISORY_WHATSAPP_DAILY_LIMIT        = 80
 *
 * Optional (Evolution API fallback):
 * ─────────────────────────────────────────────────────────────
 * ADVISORY_WHATSAPP_PROVIDER           = EVOLUTION_API
 * ADVISORY_WHATSAPP_API_URL            = http://127.0.0.1:8081
 * ADVISORY_WHATSAPP_API_KEY            = <Evolution API key>
 * ADVISORY_WHATSAPP_INSTANCE_NAME      = expert_stocks
 */

import { query, queryOne } from '../db/schema';
import crypto from 'crypto';

// ─── Type Contracts ───────────────────────────────────────────────────────────

export interface AdvisoryMessageResult {
  success: boolean;
  messageId?: string;
  status:
    | 'SENT'
    | 'FAILED'
    | 'SKIPPED_OPT_OUT'
    | 'SKIPPED_DUPLICATE'
    | 'SKIPPED_OUTSIDE_HOURS'
    | 'SKIPPED_NOT_ON_WHATSAPP'
    | 'SKIPPED_WARMUP_LIMIT';
  error?: string;
}

export interface AdvisoryAntiBanOptions {
  simulateTyping?: boolean;
  applySpintax?: boolean;
  urgentTransactional?: boolean;
  customDelayMs?: number;
}

// ─── Main Service ─────────────────────────────────────────────────────────────

export class AdvisoryWhatsAppService {
  private static instance: AdvisoryWhatsAppService;

  // Outbound pacing state (per-instance, isolated from TradeGrow service)
  private lastDispatchTimestamp: number = 0;
  private readonly minJitterDelayMs: number = 3500;
  private readonly maxJitterDelayMs: number = 7500;
  private dailyWarmupLimit: number;

  private constructor() {
    this.dailyWarmupLimit = parseInt(
      process.env.ADVISORY_WHATSAPP_DAILY_LIMIT || '80',
      10
    );
  }

  public static getInstance(): AdvisoryWhatsAppService {
    if (!AdvisoryWhatsAppService.instance) {
      AdvisoryWhatsAppService.instance = new AdvisoryWhatsAppService();
    }
    return AdvisoryWhatsAppService.instance;
  }

  // ─── Utility: Phone Normalization ─────────────────────────────────────────

  public normalizePhoneE164(phone: string): string {
    const digits = phone.replace(/\D/g, '');
    if (digits.length === 10) return `+91${digits}`;
    if (digits.length === 12 && digits.startsWith('91')) return `+${digits}`;
    if (phone.startsWith('+')) return phone;
    return `+91${digits.slice(-10)}`;
  }

  // ─── Utility: Spintax Parser ──────────────────────────────────────────────

  public parseSpintax(text: string): string {
    const regex = /\{([^{}]+)\}/g;
    let result = text;
    while (regex.test(result)) {
      result = result.replace(regex, (_match, group) => {
        const choices = group.split('|');
        return choices[Math.floor(Math.random() * choices.length)].trim();
      });
    }
    // Anti-fingerprinting: append zero-width space with 50% probability
    if (Math.random() > 0.5) result += '\u200B';
    return result;
  }

  // ─── Utility: Business Hours Guard (IST 08:30 – 20:30) ───────────────────

  public isWithinBusinessHours(): boolean {
    try {
      const now = new Date();
      const istStr = now.toLocaleTimeString('en-US', {
        timeZone: 'Asia/Kolkata',
        hour12: false,
      });
      const [h, m] = istStr.split(':').map(Number);
      const total = h * 60 + m;
      return total >= 510 && total <= 1230; // 08:30 to 20:30
    } catch {
      return true; // Fail-safe: allow if timezone resolution fails
    }
  }

  // ─── Opt-In / Opt-Out Management (advisory schema) ───────────────────────

  public async ensureContactOptIn(phoneE164: string): Promise<boolean> {
    try {
      const existing = await queryOne<{ opt_out: boolean }>(
        `SELECT opt_out FROM advisory.whatsapp_contacts WHERE phone_e164 = $1`,
        [phoneE164]
      );
      if (existing) return !existing.opt_out;

      await query(
        `INSERT INTO advisory.whatsapp_contacts (phone_e164, opt_in, opt_out)
         VALUES ($1, TRUE, FALSE)
         ON CONFLICT (phone_e164) DO NOTHING`,
        [phoneE164]
      );
      return true;
    } catch (err: any) {
      console.warn(`[Advisory WA] Opt-in check failed: ${err.message}`);
      return true; // Fail-safe: allow message
    }
  }

  public async recordOptOut(phoneE164: string): Promise<void> {
    try {
      await query(
        `INSERT INTO advisory.whatsapp_contacts (phone_e164, opt_in, opt_out, opt_out_at)
         VALUES ($1, FALSE, TRUE, clock_timestamp())
         ON CONFLICT (phone_e164) DO UPDATE
         SET opt_out = TRUE, opt_out_at = clock_timestamp()`,
        [phoneE164]
      );
      console.log(
        `[Advisory WA Anti-Ban] 🛑 Opted out: ${phoneE164}. No further messages will be sent.`
      );
    } catch (err: any) {
      console.error(`[Advisory WA] Failed to record opt-out: ${err.message}`);
    }
  }

  // ─── Anti-Burst Jitter ────────────────────────────────────────────────────

  private async applyAntiBurstJitter(overrideMs?: number): Promise<void> {
    if (process.env.NODE_ENV === 'test') return;
    const now = Date.now();
    const elapsed = now - this.lastDispatchTimestamp;
    const target =
      overrideMs ??
      (Math.floor(
        Math.random() * (this.maxJitterDelayMs - this.minJitterDelayMs + 1)
      ) +
        this.minJitterDelayMs);

    if (elapsed < target) {
      await new Promise((r) => setTimeout(r, target - elapsed));
    }
    this.lastDispatchTimestamp = Date.now();
  }

  // ─── Daily Warm-up Governor ───────────────────────────────────────────────

  private async checkDailyWarmupLimit(): Promise<boolean> {
    try {
      const row = await queryOne<{ count: string }>(
        `SELECT COUNT(*) as count
         FROM advisory.whatsapp_messages
         WHERE direction = 'OUTBOUND'
           AND status = 'SENT'
           AND sent_at >= CURRENT_DATE`
      );
      return parseInt(row?.count || '0', 10) < this.dailyWarmupLimit;
    } catch {
      return true;
    }
  }

  // ─── Core Send Method ─────────────────────────────────────────────────────

  public async sendMessage(params: {
    phoneE164: string;
    templateName: string;
    textBody: string;
    idempotencyKey: string;
    options?: AdvisoryAntiBanOptions;
    // Meta Cloud API template fields (required for first-contact outbound messages)
    metaTemplateName?: string;        // Approved Meta template name e.g. "adv_lead_welcome"
    metaTemplateLang?: string;        // Language code e.g. "en" or "en_IN"
    metaTemplateComponents?: any[];   // Body/header variable substitutions
  }): Promise<AdvisoryMessageResult> {
    const { phoneE164, templateName, idempotencyKey, options = {} } = params;
    const {
      simulateTyping = true,
      applySpintax = true,
      urgentTransactional = false,
    } = options;

    // Guard 1 — Opt-out check
    const isEligible = await this.ensureContactOptIn(phoneE164);
    if (!isEligible) {
      console.log(`[Advisory WA Anti-Ban] Skipped opted-out: ${phoneE164}`);
      return { success: false, status: 'SKIPPED_OPT_OUT' };
    }

    // Guard 2 — Business hours
    if (!urgentTransactional && !this.isWithinBusinessHours()) {
      console.log(
        `[Advisory WA Anti-Ban] Skipped outside hours (08:30-20:30 IST): ${phoneE164}`
      );
      return { success: false, status: 'SKIPPED_OUTSIDE_HOURS' };
    }

    // Guard 3 — Daily warm-up cap
    if (!urgentTransactional) {
      const underLimit = await this.checkDailyWarmupLimit();
      if (!underLimit) {
        console.warn(
          `[Advisory WA Anti-Ban] Daily limit (${this.dailyWarmupLimit}) reached.`
        );
        return { success: false, status: 'SKIPPED_WARMUP_LIMIT' };
      }
    }

    // Guard 4 — Idempotency
    try {
      const dup = await queryOne<{ id: string }>(
        `SELECT id FROM advisory.whatsapp_messages WHERE idempotency_key = $1`,
        [idempotencyKey]
      );
      if (dup) {
        console.log(`[Advisory WA] Duplicate skipped: ${idempotencyKey}`);
        return { success: true, status: 'SKIPPED_DUPLICATE' };
      }
    } catch (_) {}

    const finalBody = applySpintax
      ? this.parseSpintax(params.textBody)
      : params.textBody;

    await this.applyAntiBurstJitter(options.customDelayMs);

    const provider =
      process.env.NODE_ENV === 'test'
        ? 'MOCK'
        : (process.env.ADVISORY_WHATSAPP_PROVIDER || 'META_CLOUD');

    let externalMsgId = `adv_wa_${crypto.randomUUID()}`;
    let isDelivered = false;
    let errorMessage: string | undefined;

    // ─── EVOLUTION API (separate instance: expert_stocks on port 8081) ─────
    if (provider === 'EVOLUTION_API' || provider === 'OPEN_WA') {
      const evoUrl = this.getEvoBaseUrl();
      const evoKey =
        process.env.ADVISORY_WHATSAPP_API_KEY || 'expert_stocks_evo_token';
      const evoInstance =
        process.env.ADVISORY_WHATSAPP_INSTANCE_NAME || 'expert_stocks';
      const cleanNumber = phoneE164.replace(/\D/g, '');

      try {
        if (simulateTyping) {
          const typingMs = Math.min(4500, Math.max(1500, finalBody.length * 30));
          await fetch(`${evoUrl}/chat/sendPresence/${evoInstance}`, {
            method: 'POST',
            headers: { apikey: evoKey, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              number: cleanNumber,
              presence: 'composing',
              delay: typingMs,
            }),
            signal: AbortSignal.timeout(4000),
          }).catch(() => {});
          await new Promise((r) => setTimeout(r, typingMs));
        }

        const res = await fetch(`${evoUrl}/message/sendText/${evoInstance}`, {
          method: 'POST',
          headers: { apikey: evoKey, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            number: cleanNumber,
            options: { delay: 1200, presence: 'composing', linkPreview: true },
            text: finalBody,
          }),
          signal: AbortSignal.timeout(6000),
        });

        const data: any = await res.json();
        if (res.ok && (data?.key?.id || data?.id)) {
          externalMsgId = data.key?.id || data.id;
          isDelivered = true;
          console.log(
            `[Advisory WA] Sent via Evolution API to ${phoneE164} (ID: ${externalMsgId})`
          );
        } else {
          errorMessage = data?.message || data?.error || 'Evolution API rejected';
          console.error(`[Advisory WA] Evolution API Error:`, data);
        }
      } catch (err: any) {
        errorMessage = err.message;
        console.error(`[Advisory WA] Evolution API request failed: ${err.message}`);
      }
    }
    // ─── META CLOUD API (PRIMARY PROVIDER) ───────────────────────────────────
    // Meta rules:
    //   • First outbound to a new contact → MUST use an approved template
    //   • Free-text allowed only within the 24-hour customer service window
    //   • templateName starting with 'adv_' maps to a pre-approved Meta template
    else if (provider === 'META_CLOUD') {
      const apiToken = process.env.ADVISORY_WHATSAPP_META_TOKEN;
      const phoneId = process.env.ADVISORY_WHATSAPP_PHONE_NUMBER_ID;

      if (apiToken && phoneId) {
        try {
          // Determine if we should send as a template or free-text reply
          const useTemplate = params.metaTemplateName && params.metaTemplateLang;

          const messagePayload = useTemplate
            ? {
                // Template message (for first-contact outbound)
                messaging_product: 'whatsapp',
                to: phoneE164.replace('+', ''),
                type: 'template',
                template: {
                  name: params.metaTemplateName,
                  language: { code: params.metaTemplateLang || 'en' },
                  components: params.metaTemplateComponents || [],
                },
              }
            : {
                // Free-text message (for 24h window replies)
                messaging_product: 'whatsapp',
                to: phoneE164.replace('+', ''),
                type: 'text',
                text: { body: finalBody, preview_url: false },
              };

          const response = await fetch(
            `https://graph.facebook.com/v21.0/${phoneId}/messages`,
            {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${apiToken}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify(messagePayload),
              signal: AbortSignal.timeout(8000),
            }
          );
          const data: any = await response.json();
          if (response.ok && data?.messages?.[0]?.id) {
            externalMsgId = data.messages[0].id;
            isDelivered = true;
            console.log(
              `[Advisory WA] ✅ Sent via Meta Cloud API to ${phoneE164} (ID: ${externalMsgId}, template: ${useTemplate ? params.metaTemplateName : 'free-text'})`
            );
          } else {
            errorMessage = data?.error?.message || `Meta Cloud API error (${response.status}): ${JSON.stringify(data?.error || data)}`;
            console.error(`[Advisory WA] Meta Cloud API error:`, data?.error || data);
          }
        } catch (err: any) {
          errorMessage = err.message;
          console.error(`[Advisory WA] Meta Cloud API request failed: ${err.message}`);
        }
      } else {
        errorMessage =
          'Advisory Meta Cloud API credentials not configured — set ADVISORY_WHATSAPP_META_TOKEN and ADVISORY_WHATSAPP_PHONE_NUMBER_ID in .env';
        console.error(`[Advisory WA] ${errorMessage}`);
      }
    }
    // ─── MOCK (local dev) ────────────────────────────────────────────────────
    else {
      isDelivered = true;
      console.log(
        `[Advisory WA MOCK] To: ${phoneE164} | Template: ${templateName} | Body: "${finalBody}"`
      );
    }

    // Persist to advisory audit ledger
    try {
      await query(
        `INSERT INTO advisory.whatsapp_messages (
           provider, message_id, phone_e164, direction, template_name,
           status, error_code, idempotency_key
         ) VALUES ($1, $2, $3, 'OUTBOUND', $4, $5, $6, $7)`,
        [
          provider,
          externalMsgId,
          phoneE164,
          templateName,
          isDelivered ? 'SENT' : 'FAILED',
          errorMessage || null,
          idempotencyKey,
        ]
      );

      await query(
        `UPDATE advisory.whatsapp_contacts
         SET last_message_at = clock_timestamp(),
             daily_sent_count = daily_sent_count + 1
         WHERE phone_e164 = $1`,
        [phoneE164]
      );
    } catch (dbErr: any) {
      console.warn(
        `[Advisory WA] Failed to save audit record: ${dbErr.message}`
      );
    }

    return {
      success: isDelivered,
      messageId: externalMsgId,
      status: isDelivered ? 'SENT' : 'FAILED',
      error: errorMessage,
    };
  }

  // ==========================================================================
  // EXPERT STOCKS ADVISORY JOURNEY SEQUENCES
  // NOTE: No "Guaranteed Return" language — research-based advisory only (SEBI)
  // ==========================================================================

  /**
   * Sequence 1 — New Lead Welcome (fires within 2 min of form submission)
   *
   * Meta Cloud API: Uses approved template "adv_lead_welcome" for first-contact outbound.
   * The template must be submitted & approved in Meta Business Manager before use.
   * Template variables: {{1}} = first name, {{2}} = lead reference ID
   */
  public async triggerLeadWelcome(
    phone: string,
    leadId: string,
    fullName?: string
  ): Promise<AdvisoryMessageResult> {
    const phoneE164 = this.normalizePhoneE164(phone);
    const name = fullName ? fullName.split(' ')[0] : 'Investor';

    // Free-text fallback (used if Evolution API or MOCK provider)
    const textBody =
      `Namaste ${name}!\n\n` +
      `Thank you for your interest in *Expert Stocks Advisory*.\n\n` +
      `Our SEBI-registered research team has noted your profile (Ref: ${leadId}) ` +
      `and an advisory specialist will reach out shortly.\n\n` +
      `Explore our latest market insights: https://expertstock.in\n\n` +
      `Reply STOP to unsubscribe.`;

    return this.sendMessage({
      phoneE164,
      templateName: 'adv_lead_welcome_v1',
      textBody,
      idempotencyKey: `adv_lead_welcome_${leadId}`,
      options: { simulateTyping: false, applySpintax: false }, // No spintax for Meta templates
      // Meta Cloud API: send as approved template for first-contact outbound
      metaTemplateName: process.env.ADVISORY_META_TEMPLATE_WELCOME || 'adv_lead_welcome',
      metaTemplateLang: process.env.ADVISORY_META_TEMPLATE_LANG || 'en',
      metaTemplateComponents: [
        {
          type: 'body',
          parameters: [
            { type: 'text', text: name },        // {{1}} = first name
            { type: 'text', text: leadId },      // {{2}} = reference ID
          ],
        },
      ],
    });
  }

  /**
   * Sequence 2 — Consultation Follow-Up (2–3 hours after welcome)
   */
  public async triggerConsultationFollowUp(
    phone: string,
    leadId: string,
    fullName?: string
  ): Promise<AdvisoryMessageResult> {
    const phoneE164 = this.normalizePhoneE164(phone);
    const name = fullName ? fullName.split(' ')[0] : 'Investor';
    const textBody =
      `{Hi|Hello} ${name},\n\n` +
      `Our advisory team is ready to discuss a *personalized investment strategy* aligned with your risk profile.\n\n` +
      `Schedule a free 15-minute consultation:\n` +
      `https://expertstock.in/contact\n\n` +
      `Or simply reply here and we will call you back.\n\n` +
      `— Expert Stocks Advisory\nReply STOP to opt out.`;

    return this.sendMessage({
      phoneE164,
      templateName: 'adv_consultation_followup',
      textBody,
      idempotencyKey: `adv_consult_followup_${leadId}`,
      options: { simulateTyping: true, applySpintax: true },
    });
  }

  /**
   * Sequence 3 — Research Report Dispatch
   */
  public async triggerResearchReportDispatch(
    phone: string,
    leadId: string,
    reportTitle: string,
    reportUrl: string
  ): Promise<AdvisoryMessageResult> {
    const phoneE164 = this.normalizePhoneE164(phone);
    const textBody =
      `*Expert Stocks — Complimentary Research Brief*\n\n` +
      `${reportTitle}\n\n` +
      `{Access|Download} your personalized market analysis:\n` +
      `${reportUrl}\n\n` +
      `Prepared by our SEBI-registered analysts for Ref: ${leadId}\n\n` +
      `Reply STOP to unsubscribe.`;

    return this.sendMessage({
      phoneE164,
      templateName: 'adv_research_report',
      textBody,
      idempotencyKey: `adv_report_${leadId}_${Date.now()}`,
      options: { simulateTyping: true, applySpintax: true },
    });
  }

  /**
   * Sequence 4 — KYC / Onboarding Nudge
   */
  public async triggerKycOnboardingNudge(
    phone: string,
    leadId: string,
    fullName?: string
  ): Promise<AdvisoryMessageResult> {
    const phoneE164 = this.normalizePhoneE164(phone);
    const name = fullName ? fullName.split(' ')[0] : 'Investor';
    const textBody =
      `{Hi|Hello} ${name}, {quick|gentle} reminder!\n\n` +
      `Your Expert Stocks advisory profile is {awaiting|pending} completion.\n\n` +
      `Complete your risk assessment in under 3 minutes:\n` +
      `https://expertstock.in/kyc?ref=${leadId}\n\n` +
      `Our team is here to assist — just reply to this message.\n\n` +
      `Reply STOP to opt out.`;

    return this.sendMessage({
      phoneE164,
      templateName: 'adv_kyc_nudge',
      textBody,
      idempotencyKey: `adv_kyc_nudge_${leadId}`,
      options: { simulateTyping: true, applySpintax: true },
    });
  }

  /**
   * Sequence 5 — Plan Activation Confirmation (urgent/transactional)
   */
  public async triggerPlanActivation(
    phone: string,
    clientId: string,
    fullName?: string,
    planName?: string
  ): Promise<AdvisoryMessageResult> {
    const phoneE164 = this.normalizePhoneE164(phone);
    const name = fullName || 'Valued Client';
    const plan = planName || 'Expert Advisory Plan';
    const textBody =
      `*Advisory Plan Activated*\n\n` +
      `{Welcome aboard|Congratulations}, ${name}!\n\n` +
      `Your *${plan}* is now active. Our research team will begin sending curated, research-backed insights.\n\n` +
      `Access your advisory dashboard:\n` +
      `https://expertstock.in/client\n\n` +
      `— Expert Stocks Advisory Team`;

    return this.sendMessage({
      phoneE164,
      templateName: 'adv_plan_activation',
      textBody,
      idempotencyKey: `adv_plan_activated_${clientId}`,
      options: {
        simulateTyping: true,
        applySpintax: true,
        urgentTransactional: true,
      },
    });
  }

  // ==========================================================================
  // INBOUND MESSAGE HANDLER
  // ==========================================================================

  public async handleInboundMessage(
    fromPhoneE164: string,
    bodyText: string,
    messageId: string
  ): Promise<{ acknowledged: boolean; optOutTriggered?: boolean }> {
    const cleanText = bodyText.trim().toUpperCase();

    if (
      ['STOP', 'UNSUBSCRIBE', 'OPTOUT', 'CANCEL', 'QUIT', 'NO'].includes(
        cleanText
      )
    ) {
      await this.recordOptOut(fromPhoneE164);

      try {
        await this.sendMessage({
          phoneE164: fromPhoneE164,
          templateName: 'adv_opt_out_ack',
          textBody:
            'You have been successfully unsubscribed from Expert Stocks WhatsApp updates. You will not receive further automated messages from us.',
          idempotencyKey: `adv_optout_ack_${messageId}`,
          options: { urgentTransactional: true, simulateTyping: false },
        });
      } catch (_) {}

      return { acknowledged: true, optOutTriggered: true };
    }

    try {
      await query(
        `INSERT INTO advisory.whatsapp_messages (
           provider, message_id, phone_e164, direction, template_name,
           status, idempotency_key
         ) VALUES ('INBOUND', $1, $2, 'INBOUND', 'INBOUND_REPLY', 'DELIVERED', $3)
         ON CONFLICT (idempotency_key) DO NOTHING`,
        [messageId, fromPhoneE164, `adv_inbound_${messageId}`]
      );
    } catch (err: any) {
      console.warn(`[Advisory WA] Failed to log inbound: ${err.message}`);
    }

    return { acknowledged: true };
  }

  // ==========================================================================
  // STATUS & DIAGNOSTICS
  // ==========================================================================

  public async handleStatusUpdate(
    messageId: string,
    status: 'DELIVERED' | 'READ' | 'FAILED',
    errorCode?: string
  ): Promise<boolean> {
    try {
      const updateField =
        status === 'DELIVERED'
          ? 'delivered_at = clock_timestamp()'
          : status === 'READ'
          ? 'read_at = clock_timestamp()'
          : '';
      const setClause = updateField
        ? `status = $2, ${updateField}, error_code = $3`
        : `status = $2, error_code = $3`;

      await query(
        `UPDATE advisory.whatsapp_messages SET ${setClause} WHERE message_id = $1`,
        [messageId, status, errorCode || null]
      );
      return true;
    } catch (err: any) {
      console.warn(`[Advisory WA] Failed to update status: ${err.message}`);
      return false;
    }
  }

  public async getConnectionState(): Promise<{ state: string; instance: string }> {
    const evoUrl = this.getEvoBaseUrl();
    const evoKey = process.env.ADVISORY_WHATSAPP_API_KEY || 'expert_stocks_evo_token';
    const evoInstance = process.env.ADVISORY_WHATSAPP_INSTANCE_NAME || 'expert_stocks';

    try {
      const res = await fetch(
        `${evoUrl}/instance/connectionState/${evoInstance}`,
        { headers: { apikey: evoKey } }
      );
      const data: any = await res.json();
      return { state: data?.instance?.state || 'unknown', instance: evoInstance };
    } catch {
      return { state: 'unreachable', instance: evoInstance };
    }
  }

  public async getQRCode(): Promise<{
    qrcode?: string;
    base64?: string;
    state?: string;
    pairingCode?: string;
    error?: string;
  }> {
    const evoUrl = this.getEvoBaseUrl();
    const evoKey = process.env.ADVISORY_WHATSAPP_API_KEY || 'expert_stocks_evo_token';
    const evoInstance = process.env.ADVISORY_WHATSAPP_INSTANCE_NAME || 'expert_stocks';

    try {
      const res = await fetch(`${evoUrl}/instance/connect/${evoInstance}`, {
        headers: { apikey: evoKey },
      });
      const data: any = await res.json();
      return {
        qrcode: data?.code,
        base64: data?.base64,
        pairingCode: data?.pairingCode,
        state: data?.base64 ? 'QR_READY' : (data?.instance?.state || 'CONNECTING'),
        error: data?.error,
      };
    } catch (err: any) {
      return { error: err.message };
    }
  }

  public async getPairingCode(phone: string): Promise<{ pairingCode?: string; error?: string }> {
    const evoUrl = this.getEvoBaseUrl();
    const evoKey = process.env.ADVISORY_WHATSAPP_API_KEY || 'expert_stocks_evo_token';
    const evoInstance = process.env.ADVISORY_WHATSAPP_INSTANCE_NAME || 'expert_stocks';
    const cleanNumber = phone.replace(/\D/g, '');

    try {
      const res = await fetch(
        `${evoUrl}/instance/connect/${evoInstance}?number=${cleanNumber}`,
        { headers: { apikey: evoKey } }
      );
      const data: any = await res.json();
      return { pairingCode: data?.pairingCode || null, error: data?.error };
    } catch (err: any) {
      return { error: err.message };
    }
  }

  public async restartInstance(): Promise<{ success: boolean; error?: string }> {
    const evoUrl = this.getEvoBaseUrl();
    const evoKey = process.env.ADVISORY_WHATSAPP_API_KEY || 'expert_stocks_evo_token';
    const evoInstance = process.env.ADVISORY_WHATSAPP_INSTANCE_NAME || 'expert_stocks';

    try {
      const res = await fetch(`${evoUrl}/instance/restart/${evoInstance}`, {
        method: 'PUT',
        headers: { apikey: evoKey },
      });
      const data: any = await res.json();
      return { success: res.ok, error: data?.error };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }

  public async getMetrics(): Promise<{
    connection: { state: string; instance: string };
    messagesSentToday: number;
    dailyWarmupLimit: number;
    warmupRemaining: number;
    optedOutCount: number;
    businessHoursActive: boolean;
  }> {
    const conn = await this.getConnectionState();
    let sentToday = 0;
    let optedOut = 0;

    try {
      const sentRow = await queryOne<{ count: string }>(
        `SELECT COUNT(*) as count
         FROM advisory.whatsapp_messages
         WHERE direction = 'OUTBOUND' AND status = 'SENT' AND sent_at >= CURRENT_DATE`
      );
      sentToday = parseInt(sentRow?.count || '0', 10);

      const optRow = await queryOne<{ count: string }>(
        `SELECT COUNT(*) as count FROM advisory.whatsapp_contacts WHERE opt_out = TRUE`
      );
      optedOut = parseInt(optRow?.count || '0', 10);
    } catch (_) {}

    return {
      connection: conn,
      messagesSentToday: sentToday,
      dailyWarmupLimit: this.dailyWarmupLimit,
      warmupRemaining: Math.max(0, this.dailyWarmupLimit - sentToday),
      optedOutCount: optedOut,
      businessHoursActive: this.isWithinBusinessHours(),
    };
  }

  // ─── Private: Resolve Evolution API base URL ──────────────────────────────

  private getEvoBaseUrl(): string {
    // Separate port (8081) from TradeGrow instance (8080)
    if (process.env.ADVISORY_WHATSAPP_API_URL)
      return process.env.ADVISORY_WHATSAPP_API_URL;
    return process.env.NODE_ENV === 'production'
      ? 'http://172.16.1.1:8081'
      : 'http://127.0.0.1:8081';
  }
}
