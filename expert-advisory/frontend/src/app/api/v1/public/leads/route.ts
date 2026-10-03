import { NextResponse, type NextRequest } from "next/server";
import { leadsStore } from "@/lib/leads-store";

const BACKEND_URL = process.env.BACKEND_URL ?? "http://127.0.0.1:8000";
const TRADEGROW_API_URL = process.env.TRADEGROW_API_URL ?? "https://tradegrowx.in";

// TradeGrow server URL — hosts the AdvisoryWhatsAppService webhook endpoint
const TRADEGROW_SERVER_URL = process.env.TRADEGROW_SERVER_URL ?? "http://127.0.0.1:3001";

/**
 * Fire-and-forget: Trigger the Advisory WhatsApp welcome sequence via the
 * TradeGrow server's internal webhook. Non-blocking — never delays the lead
 * response if the server is unreachable.
 */
async function triggerAdvisoryWelcome(params: {
  phone: string;
  leadId: string;
  fullName: string;
}) {
  try {
    await fetch(`${TRADEGROW_SERVER_URL}/internal/advisory/welcome`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-internal-key": process.env.INTERNAL_API_KEY || "advisory_internal_key" },
      body: JSON.stringify(params),
      signal: AbortSignal.timeout(4000),
    });
  } catch {
    // Silently swallow — WhatsApp trigger is best-effort, not critical path
  }
}


export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));

    // Basic validation
    const fullName = String(body.full_name || body.fullName || "").trim();
    const rawMobile = String(body.mobile || body.phone || "").trim();
    const cleanMobile = rawMobile.replace(/\D/g, "").slice(-10);

    if (!fullName || cleanMobile.length < 10) {
      return NextResponse.json(
        {
          success: false,
          error_code: "VALIDATION_FAILED",
          message: "Please provide both your full name and a valid 10-digit mobile number.",
          errors: {
            ...(!fullName ? { full_name: ["Full name is required."] } : {}),
            ...(cleanMobile.length < 10 ? { mobile: ["A valid 10-digit mobile number is required."] } : {}),
          },
        },
        { status: 422 }
      );
    }

    let dispatchedLeadCode = `TG-LEAD-2026-${Math.floor(1000 + Math.random() * 9000)}`;
    let tgEmailDispatched = false;

    // 1. Forward to TradeGrow Unified Email & WarRoom Engine
    try {
      const tgPayload = {
        fullName,
        phone: cleanMobile,
        email: body.email,
        city: body.city,
        state: body.state,
        source: body.form_key || body.source || "EXPERT_STOCKS_SITE",
        capitalRange: body.capital_range,
        segments: body.segments,
        message: body.message,
        assessment: body.assessment,
        consentWhatsApp: body.consents?.whatsapp !== false,
      };

      const tgResp = await fetch(`${TRADEGROW_API_URL}/api/v1/public/leads`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(tgPayload),
        signal: AbortSignal.timeout(3500),
      });

      if (tgResp.ok) {
        const tgData = await tgResp.json();
        if (tgData && tgData.data && tgData.data.leadCode) {
          dispatchedLeadCode = tgData.data.leadCode;
        }
        tgEmailDispatched = true;
      }
    } catch (err: any) {
      console.warn("[Leads Forwarding] TradeGrow email engine unreachable / deferred:", err.message);
    }

    // 2. Save directly in Expert Stocks persistent storage so /office shows it immediately!
    try {
      leadsStore.addLead({
        leadCode: dispatchedLeadCode,
        fullName,
        mobile: cleanMobile,
        email: body.email,
        city: body.city,
        capitalRange: body.capital_range,
        segments: body.segments,
        source: body.form_key || body.source || "Contact Form",
        message: body.message,
        assessment: body.assessment,
      });
    } catch (err: any) {
      console.warn("[Leads Store] Could not record to local store:", err.message);
    }

    // 3. Trigger Expert Stocks Advisory WhatsApp welcome sequence (fire & forget)
    // Calls AdvisoryWhatsAppService.triggerLeadWelcome via the TradeGrow server webhook
    triggerAdvisoryWelcome({
      phone: cleanMobile,
      leadId: dispatchedLeadCode,
      fullName,
    });

    // 4. Forward to Laravel CRM backend if reachable
    try {
      const response = await fetch(`${BACKEND_URL}/api/v1/public/leads`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          ...body,
          mobile: cleanMobile,
          full_name: fullName,
        }),
        signal: AbortSignal.timeout(3000),
      });

      if (response.ok) {
        const laravelData = await response.json();
        return NextResponse.json({
          ...laravelData,
          leadCode: dispatchedLeadCode,
          emailDispatched: tgEmailDispatched,
        });
      }
    } catch {
      // Laravel backend is offline or on serverless; continue gracefully
    }

    console.log(`[Lead Successfully Handled] Ref: ${dispatchedLeadCode}, Name: ${fullName}, Mobile: ${cleanMobile}, Form: ${body.form_key || "general"}`);

    const isRpm = body.form_key === "risk_assessment" || Boolean(body.assessment);
    const successMsg = isRpm
      ? `Thank you, ${fullName}! Your Risk Assessment has been recorded (Ref: ${dispatchedLeadCode}). A copy has been dispatched to ${body.email || "our research desk"}.`
      : `Thank you, ${fullName}! Your consultation request has been received (Ref: ${dispatchedLeadCode}). An authorized advisory representative will contact you at +91 ${cleanMobile} shortly.`;

    return NextResponse.json(
      {
        success: true,
        data: {
          leadCode: dispatchedLeadCode,
          message: successMsg,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("[Leads Route Error]", error);
    return NextResponse.json(
      {
        success: false,
        error_code: "INTERNAL_ERROR",
        message: "An unexpected error occurred while processing your request. Please connect directly via WhatsApp at +91 92388 37041 or info@expertstocks.in.",
      },
      { status: 500 }
    );
  }
}
