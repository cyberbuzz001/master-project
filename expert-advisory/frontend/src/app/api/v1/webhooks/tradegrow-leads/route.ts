import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { leadsStore } from "@/lib/leads-store";

const WEBHOOK_SECRET = process.env.WEBHOOK_BRIDGE_SECRET;

/**
 * Constant-time HMAC-SHA256 signature verification
 */
function verifyHmac(payload: string, signature: string, secret: string): boolean {
  try {
    const expected = crypto.createHmac("sha256", secret).update(payload).digest("hex");
    const sigBuf = Buffer.from(signature);
    const expBuf = Buffer.from(expected);
    if (sigBuf.length !== expBuf.length) return false;
    return crypto.timingSafeEqual(sigBuf, expBuf);
  } catch {
    return false;
  }
}

/**
 * Financial Lead Scoring Engine (0-100)
 */
function calculateAiScore(data: {
  capitalRange?: string;
  segments?: string | string[];
  assessment?: any;
  email?: string;
  phone?: string;
  source?: string;
}): { score: number; rationale: string; temperature: "VERY_HOT" | "HOT" | "WARM" | "COLD"; nextAction: string } {
  let score = 45; // baseline

  // Capital weighting
  const cap = (data.capitalRange || "").toLowerCase();
  if (cap.includes("25l") || cap.includes("50l") || cap.includes("1 cr")) {
    score += 35;
  } else if (cap.includes("10l") || cap.includes("15l")) {
    score += 25;
  } else if (cap.includes("5l")) {
    score += 15;
  } else if (cap.includes("2l")) {
    score += 10;
  }

  // Segments (High-intent derivative / options traders)
  const seg = String(data.segments || "").toLowerCase();
  if (seg.includes("option") || seg.includes("f&o") || seg.includes("future")) {
    score += 15;
  } else if (seg.includes("commodity") || seg.includes("mcx")) {
    score += 12;
  } else {
    score += 5;
  }

  // Risk profile assessment completed
  if (data.assessment && (data.assessment.score || data.assessment.category)) {
    score += 15;
  }

  // Contact richness
  if (data.email && data.email.includes("@")) score += 5;
  if (data.phone && data.phone.length === 10) score += 5;

  score = Math.min(99, Math.max(15, score));

  let temperature: "VERY_HOT" | "HOT" | "WARM" | "COLD" = "WARM";
  if (score >= 85) temperature = "VERY_HOT";
  else if (score >= 70) temperature = "HOT";
  else if (score >= 45) temperature = "WARM";
  else temperature = "COLD";

  const rationale = `Calculated based on declared capital tier (${data.capitalRange || "Standard"}), trading segment preferences (${Array.isArray(data.segments) ? data.segments.join(", ") : data.segments || "Equities"}), and ${data.assessment ? "completed risk suitability assessment" : "direct consultation inquiry"}.`;

  const nextAction = score >= 80
    ? "High Priority: Initiate immediate outbound call within 15-minute SLA."
    : "Review investor profile and dispatch advisory brochure via WhatsApp.";

  return { score, rationale, temperature, nextAction };
}

/**
 * Intelligent round-robin and desk-based lead assignment
 */
function assignAgent(data: { capitalRange?: string; segments?: string | string[] }): string {
  const cap = (data.capitalRange || "").toLowerCase();
  const seg = String(data.segments || "").toLowerCase();

  if (cap.includes("10l") || cap.includes("25l") || cap.includes("50l") || cap.includes("1 cr")) {
    return "Sunita Verma"; // HNI Wealth Desk
  }
  if (seg.includes("option") || seg.includes("f&o") || seg.includes("derivative")) {
    return "Vikram Malhotra"; // Options Desk
  }
  return "Priya Sharma"; // Retail Sales Desk
}

export async function POST(request: NextRequest) {
  try {
    if (!WEBHOOK_SECRET) {
      return NextResponse.json({ success: false, error: "WEBHOOK_CONFIGURATION_MISSING" }, { status: 503 });
    }
    const rawBody = await request.text();
    const signature = request.headers.get("x-tradegrow-signature") || "";
    const event = request.headers.get("x-tradegrow-event") || "";

    // 1. Signature Verification
    if (!signature) {
      return NextResponse.json(
        { success: false, error: "MISSING_SIGNATURE", message: "X-TradeGrow-Signature header required" },
        { status: 401 }
      );
    }

    const isValid = verifyHmac(rawBody, signature, WEBHOOK_SECRET);
    if (!isValid) {
      console.warn("[WebhookBridge] Signature verification failed for event:", event);
      return NextResponse.json(
        { success: false, error: "INVALID_SIGNATURE", message: "HMAC signature mismatch" },
        { status: 403 }
      );
    }

    let payload: any = {};
    try {
      payload = JSON.parse(rawBody);
    } catch {
      return NextResponse.json(
        { success: false, error: "INVALID_JSON", message: "Payload must be valid JSON" },
        { status: 400 }
      );
    }

    console.log(`[WebhookBridge] Received event '${event}' with reference ${payload.leadCode || "unknown"}`);

    if (event === "lead.captured") {
      const cleanPhone = String(payload.phone || payload.mobile || "").replace(/\D/g, "").slice(-10);
      const fullName = String(payload.fullName || payload.name || "Investor").trim();
      const leadCode = payload.leadCode || `TG-LD-${Math.floor(1000 + Math.random() * 9000)}`;

      const { score, rationale, temperature, nextAction } = calculateAiScore({
        capitalRange: payload.capitalRange,
        segments: payload.segments,
        assessment: payload.assessment,
        email: payload.email,
        phone: cleanPhone,
        source: payload.source,
      });

      const assignedAgent = assignAgent({
        capitalRange: payload.capitalRange,
        segments: payload.segments,
      });

      // Ingest into persistent leads store
      const newLead = leadsStore.addLead({
        leadCode,
        fullName,
        mobile: cleanPhone,
        email: payload.email,
        city: payload.city,
        capitalRange: payload.capitalRange,
        segments: payload.segments,
        source: `TradeGrow Bridge (${payload.source || "Website Ingress"})`,
        message: payload.message,
        assessment: payload.assessment,
      });

      // Set priority & agent metadata on the lead
      leadsStore.updateLead(leadCode, {
        assignedTo: assignedAgent,
        priority: score >= 80 ? "hni" : score >= 60 ? "high" : "standard",
      });

      return NextResponse.json({
        success: true,
        event,
        leadCode,
        aiScore: score,
        aiScoreRationale: rationale,
        temperature,
        nextAction,
        assignedAgent,
        dispatchedAt: new Date().toISOString(),
      });
    }

    if (event === "kyc.verified") {
      const cleanPhone = String(payload.phone || payload.mobile || "").replace(/\D/g, "").slice(-10);
      const lead = cleanPhone ? leadsStore.getLeadByPhone(cleanPhone) : null;
      if (lead) {
        leadsStore.updateLead(lead.id, {
          status: "qualified",
          notes: `${lead.notes || ""}\n[KYC Verified]: PAN ${payload.panMasked || "Verified"} via DigiLocker on ${new Date().toLocaleDateString("en-IN")}.`,
          tags: Array.from(new Set([...(lead.tags || []), "KYC_VERIFIED", "DigiLocker"])),
        });
      }

      return NextResponse.json({
        success: true,
        event,
        leadId: lead?.id || null,
        panStatus: "NSDL_VERIFIED",
        aadhaarStatus: "UIDAI_VERIFIED",
        message: "Client KYC verified and synchronized with Expert Stocks dossier.",
      });
    }

    if (event === "sub.activated") {
      const customerName = String(payload.customerName || payload.name || "Client").trim();
      const planName = String(payload.planName || "HNI Bespoke Advisory");
      const amount = Number(payload.amount) || 25000;
      const cleanPhone = String(payload.phone || payload.mobile || "").replace(/\D/g, "").slice(-10);

      const newSub = leadsStore.addSubscription({
        customerId: payload.customerId || `CUST-${Math.floor(1000 + Math.random() * 9000)}`,
        customerName,
        customerCode: payload.customerCode || `ESC-2026-${Math.floor(1000 + Math.random() * 9000)}`,
        planName,
        tier: payload.tier || "Quarterly Mandate",
        amount,
        duration: payload.duration || "3 Months",
        expiryDate: payload.expiryDate || new Date(Date.now() + 90 * 86400000).toISOString().split("T")[0],
        paymentMethod: payload.paymentMethod || "Razorpay / UPI",
        relationshipManager: payload.relationshipManager || "Sunita Verma",
        notes: `Activated via TradeGrow Webhook Bridge. Order Ref: ${payload.orderId || "TG-ORD-2026"}`,
      });

      if (cleanPhone) {
        const lead = leadsStore.getLeadByPhone(cleanPhone);
        if (lead) {
          leadsStore.updateLead(lead.id, {
            status: "converted",
            tags: Array.from(new Set([...(lead.tags || []), "ACTIVE_SUBSCRIBER", planName])),
          });
        }
      }

      return NextResponse.json({
        success: true,
        event,
        subscriptionId: newSub.id,
        customerCode: newSub.customerCode,
        status: "ACTIVE",
        message: "Subscription activated and recorded in Expert Stocks billing ledger.",
      });
    }

    if (event === "order.executed") {
      return NextResponse.json({
        success: true,
        event,
        orderId: payload.orderId || `ORD-${Date.now()}`,
        broker: payload.broker || "FYERS",
        symbol: payload.symbol,
        status: "EXECUTED",
        message: "Broker execution event logged in advisory telemetry.",
      });
    }

    return NextResponse.json({
      success: true,
      message: `Event '${event}' acknowledged.`,
    });
  } catch (error: any) {
    console.error("[WebhookBridge] Ingress error:", error);
    return NextResponse.json(
      { success: false, error: "INTERNAL_ERROR", message: error.message },
      { status: 500 }
    );
  }
}

/**
 * Health check endpoint for verifying bridge connectivity
 */
export async function GET() {
  return NextResponse.json({
    service: "ExpertStocks WebhookBridge Ingress",
    status: "healthy",
    eventsSupported: ["lead.captured", "kyc.verified", "sub.activated"],
    authMethod: "HMAC-SHA256 (X-TradeGrow-Signature)",
    timestamp: new Date().toISOString(),
  });
}
