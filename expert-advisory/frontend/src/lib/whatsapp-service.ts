import "server-only";

/**
 * Meta WhatsApp Cloud API Service
 * WhatsApp integration for Expert Stocks Advisory (+91 92018 00995)
 */

export interface WhatsAppSendResult {
  success: boolean;
  messageId?: string;
  error?: string;
  response?: any;
}

const META_TOKEN = process.env.ADVISORY_WHATSAPP_META_TOKEN || "";
const PHONE_NUMBER_ID = process.env.ADVISORY_WHATSAPP_PHONE_NUMBER_ID || "";
const GRAPH_VERSION = process.env.ADVISORY_WHATSAPP_GRAPH_VERSION;

/**
 * Standardize phone number into WhatsApp E.164 without '+' (e.g. 918602467804)
 */
export function normalizeWhatsAppNumber(rawPhone: string): string {
  if (!rawPhone) return "";
  const digits = rawPhone.replace(/\D/g, "");
  if (digits.length === 10) {
    return `91${digits}`;
  }
  if (digits.length === 12 && digits.startsWith("91")) {
    return digits;
  }
  if (digits.startsWith("0") && digits.length === 11) {
    return `91${digits.slice(1)}`;
  }
  return digits;
}

/**
 * Send an approved Meta WhatsApp template to a client.
 */
export async function sendWhatsAppTemplate(params: {
  to: string;
  templateName: string;
  languageCode?: string;
  parameters?: string[];
}): Promise<WhatsAppSendResult> {
  if (!META_TOKEN || !PHONE_NUMBER_ID || !GRAPH_VERSION || !/^v\d+\.0$/.test(GRAPH_VERSION)) {
    return { success: false, error: "WhatsApp provider is not configured" };
  }
  const cleanPhone = normalizeWhatsAppNumber(params.to);
  if (!cleanPhone || cleanPhone.length < 10) {
    return { success: false, error: "Invalid phone number" };
  }

  const payload: any = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: cleanPhone,
    type: "template",
    template: {
      name: params.templateName,
      language: {
        code: params.languageCode || "en",
      },
    },
  };

  if (params.parameters && params.parameters.length > 0) {
    payload.template.components = [
      {
        type: "body",
        parameters: params.parameters.map((p) => ({
          type: "text",
          text: String(p),
        })),
      },
    ];
  }

  try {
    const url = `https://graph.facebook.com/${GRAPH_VERSION}/${PHONE_NUMBER_ID}/messages`;
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${META_TOKEN.trim()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(15000),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("[WhatsAppService] API Error:", data);
      return {
        success: false,
        error: data.error?.message || `HTTP ${response.status}`,
        response: data,
      };
    }

    const messageId = data.messages?.[0]?.id;
    if (!messageId) return { success: false, error: "Provider did not acknowledge the message" };

    return {
      success: true,
      messageId,
      response: data,
    };
  } catch (err: any) {
    console.error("[WhatsAppService] Network exception:", err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Send a 1-on-1 freeform text message (allowed within 24h conversation window or session replies)
 */
export async function sendWhatsAppText(params: {
  to: string;
  text: string;
}): Promise<WhatsAppSendResult> {
  if (!META_TOKEN || !PHONE_NUMBER_ID || !GRAPH_VERSION || !/^v\d+\.0$/.test(GRAPH_VERSION)) {
    return { success: false, error: "WhatsApp provider is not configured" };
  }
  const cleanPhone = normalizeWhatsAppNumber(params.to);
  if (!cleanPhone || cleanPhone.length < 10) {
    return { success: false, error: "Invalid phone number" };
  }

  const payload = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: cleanPhone,
    type: "text",
    text: {
      preview_url: false,
      body: params.text,
    },
  };

  try {
    const url = `https://graph.facebook.com/${GRAPH_VERSION}/${PHONE_NUMBER_ID}/messages`;
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${META_TOKEN.trim()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(15000),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("[WhatsAppService] Text Send Error:", data);
      return {
        success: false,
        error: data.error?.message || `HTTP ${response.status}`,
        response: data,
      };
    }

    const messageId = data.messages?.[0]?.id;
    if (!messageId) return { success: false, error: "Provider did not acknowledge the message" };

    return {
      success: true,
      messageId,
      response: data,
    };
  } catch (err: any) {
    console.error("[WhatsAppService] Network exception:", err.message);
    return { success: false, error: err.message };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// TEMPLATE SHORTCUTS — approval must be verified in the connected Meta account
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 1. adv_lead_welcome
 * Body: Thank you for your interest in Expert Stocks Advisory, {{1}}.
 * Our SEBI-registered research team has noted your profile (Ref: {{2}}) and an advisory specialist will reach out shortly.
 */
export async function sendAdvisoryLeadWelcome(
  to: string,
  fullName: string,
  leadRef: string
): Promise<WhatsAppSendResult> {
  return sendWhatsAppTemplate({
    to,
    templateName: "adv_lead_welcome",
    parameters: [fullName || "Investor", leadRef || "EXP-2026"],
  });
}

/**
 * 2. adv_risk_assessment_cert
 * Body: Hello {{1}}, Your Risk Assessment with Expert Stocks Consultancy has been completed successfully.
 * Assigned Risk Tier: {{2}}. Assessment Reference: {{3}}.
 */
export async function sendRiskAssessmentCertWhatsApp(
  to: string,
  fullName: string,
  tierName: string,
  refCode: string
): Promise<WhatsAppSendResult> {
  return sendWhatsAppTemplate({
    to,
    templateName: "adv_risk_assessment_cert",
    parameters: [fullName || "Investor", tierName || "Moderate / Growth", refCode || "RPM-2026"],
  });
}

/**
 * 3. adv_kyc_nudge
 * Body: Hello {{1}}, This is a gentle reminder from Expert Stocks Consultancy regarding your onboarding profile (Ref: {{2}})...
 */
export async function sendKycNudgeWhatsApp(
  to: string,
  fullName: string,
  leadRef: string
): Promise<WhatsAppSendResult> {
  return sendWhatsAppTemplate({
    to,
    templateName: "adv_kyc_nudge",
    parameters: [fullName || "Investor", leadRef || "EXP-2026"],
  });
}

/**
 * 4. adv_plan_activation
 * Body: Welcome to Expert Stocks Consultancy, {{1}}! Your subscription to the {{2}} advisory plan is now active. Client ID: {{3}}...
 */
export async function sendPlanActivationWhatsApp(
  to: string,
  fullName: string,
  planName: string,
  clientId: string
): Promise<WhatsAppSendResult> {
  return sendWhatsAppTemplate({
    to,
    templateName: "adv_plan_activation",
    parameters: [fullName || "Valued Client", planName || "Index Options Alpha", clientId || "CLI-2026"],
  });
}

/**
 * 5. adv_research_report
 * Body: Hello {{1}}, Our research analysts have published a new market research report: {{2}}. Report Reference: {{3}}...
 */
export async function sendResearchReportAlertWhatsApp(
  to: string,
  fullName: string,
  reportTitle: string,
  reportRef: string
): Promise<WhatsAppSendResult> {
  return sendWhatsAppTemplate({
    to,
    templateName: "adv_research_report",
    parameters: [fullName || "Investor", reportTitle || "Nifty Weekly Technical Outlook", reportRef || "REP-2026"],
  });
}

/**
 * 6. adv_order_execution (Transactional)
 * Body: Hello {{1}}, Your order for {{2}} (Qty: {{3}} @ ₹{{4}}) has been executed. Order ID: {{5}}.
 */
export async function sendOrderFilledWhatsApp(
  to: string,
  fullName: string,
  symbol: string,
  qty: number | string,
  price: number | string,
  orderId: string
): Promise<WhatsAppSendResult> {
  return sendWhatsAppTemplate({
    to,
    templateName: "adv_order_execution",
    parameters: [
      fullName || "Trader",
      symbol || "NIFTY",
      String(qty),
      typeof price === "number" ? price.toFixed(2) : String(price),
      orderId,
    ],
  });
}

/**
 * 7. adv_margin_alert (Risk / Compliance)
 * Body: URGENT RISK ALERT: Hello {{1}}, Your trading margin is in deficit by ₹{{2}}. Please deposit funds by {{3}} to prevent square-off (Client ID: {{4}}).
 */
export async function sendMarginAlertWhatsApp(
  to: string,
  fullName: string,
  shortfallAmount: number | string,
  deadlineTime: string,
  clientId: string
): Promise<WhatsAppSendResult> {
  return sendWhatsAppTemplate({
    to,
    templateName: "adv_margin_alert",
    parameters: [
      fullName || "Valued Trader",
      typeof shortfallAmount === "number" ? shortfallAmount.toLocaleString("en-IN") : String(shortfallAmount),
      deadlineTime || "15:15 IST Today",
      clientId || "TG-CLI-2026",
    ],
  });
}
