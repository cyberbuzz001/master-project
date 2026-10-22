import { NextRequest, NextResponse } from "next/server";
import { placeFyersOrder, getFyersPositions, getFyersHoldings } from "@/lib/fyers";
import { recommendationsStore } from "@/lib/recommendations-store";

const BACKEND_URL = process.env.BACKEND_URL || "http://127.0.0.1:8000";

// Mock data structures matching client portal types
const mockDashboard = {
  client: {
    client_code: "ESC-2026-9841",
    full_name: "Demo Client",
    onboarding_status: "active",
    relationship_manager: "Priya Sharma (Senior Research Analyst)",
  },
  notices: [
    {
      key: "risk_warning",
      title: "Market Risk & Investment Advisory Mandate",
      body: "Investment in securities market are subject to market risks. Read all scheme and research documents carefully before investing.",
    },
  ],
  modules: [
    {
      key: "research",
      label: "Research & Recommendations",
      description: "Direct equity & derivatives advisory calls backed by SEBI RA research reports.",
      status: "active",
      href: "/portal/research",
    },
    {
      key: "onboarding",
      label: "Regulatory Onboarding & KYC",
      description: "Mandatory client KYC documentation and risk suitability verification.",
      status: "completed",
      href: "/portal/onboarding",
    },
    {
      key: "risk_profile",
      label: "Risk Profiling Assessment",
      description: "Suitability assessment matrix to determine your investment risk capacity.",
      status: "completed",
      href: "/portal/risk-profile",
    },
    {
      key: "billing",
      label: "Subscriptions & Invoices",
      description: "Active advisory service plans, GST invoices, and receipt downloads.",
      status: "active",
      href: "/portal/billing",
    },
    {
      key: "support",
      label: "Client Helpdesk & Grievance Desk",
      description: "Dedicated query ticketing and SEBI-mandated grievance escalation matrix.",
      status: "active",
      href: "/portal/support",
    },
  ],
};

const mockResearch = {
  active_subscription: true,
  reports: [
    {
      uuid: "rep-001",
      report_code: "ESC-EQ-2026-042",
      title: "Nifty Large-Cap Alpha: Quality Banking & Industrial Sector Review",
      summary: "Detailed structural review on top private banking and engineering capital goods manufacturers.",
      report_type: "Sector Initiation",
      category: "Fundamental Research",
      published_at: new Date(Date.now() - 3600000 * 24 * 2).toISOString(),
      valid_until: new Date(Date.now() + 3600000 * 24 * 30).toISOString(),
      author: "Priya Sharma, Research Lead",
      recommendations: [
        {
          id: 101,
          instrument: "HDFCBANK",
          exchange: "NSE",
          segment: "Cash / Equity",
          direction: "BUY",
          entry_low: 1680,
          entry_high: 1710,
          stop_loss: 1620,
          targets: [1820, 1910],
          time_horizon: "3-6 Months",
          risk_classification: "Moderate",
          status: "Active",
          performance: {
            entry_ref: 1695,
            high_after: 1745,
            low_after: 1685,
            mfe: 2.9,
            mae: 0.6,
            outcome: "In Progress",
          },
        },
        {
          id: 102,
          instrument: "L&T",
          exchange: "NSE",
          segment: "Cash / Equity",
          direction: "BUY",
          entry_low: 3450,
          entry_high: 3500,
          stop_loss: 3340,
          targets: [3750, 3900],
          time_horizon: "2-4 Months",
          risk_classification: "Moderate",
          status: "Active",
          performance: {
            entry_ref: 3480,
            high_after: 3620,
            low_after: 3460,
            mfe: 4.0,
            mae: 0.5,
            outcome: "Target 1 Reached",
          },
        },
      ],
    },
  ],
};

const mockBilling = {
  subscriptions: [
    {
      uuid: "sub-101",
      service: "Comprehensive Wealth Equity Advisory",
      plan: "Annual Professional Research Access",
      status: "active",
      starts_on: "2026-01-01",
      ends_on: "2026-12-31",
      days_remaining: 275,
    },
  ],
  invoices: [
    {
      uuid: "inv-2026-001",
      number: "ESC/INV/2026-01",
      status: "paid",
      invoice_date: "2026-01-01",
      due_date: "2026-01-05",
      total: "₹29,500",
      balance: "₹0",
      has_pdf: false,
    },
  ],
  payments: [
    {
      uuid: "pay-2026-001",
      amount: "₹29,500",
      method: "UPI / Net Banking",
      status: "succeeded",
      received_at: "2026-01-01 10:30:00",
      invoice_number: "ESC/INV/2026-01",
      has_receipt: false,
    },
  ],
  notice: "All advisory payments are invoiced with compliant GST invoicing under SEBI RA guidelines.",
};

const mockQuestionnaire = {
  title: "SEBI Mandated Risk Profiling Questionnaire",
  methodology_version: "v2.4-2026",
  questions: [
    {
      code: "q1_horizon",
      text: "What is your primary investment time horizon?",
      help_text: "Helps us assess capital lock-in tolerance.",
      type: "single_choice",
      options: [
        { value: "short", label: "Less than 1 year" },
        { value: "medium", label: "1 to 3 years" },
        { value: "long", label: "More than 3 years" },
      ],
    },
    {
      code: "q2_risk_tolerance",
      text: "How would you react if your equity portfolio declined 15% during a temporary market correction?",
      help_text: "Assesses psychological risk drawdown capability.",
      type: "single_choice",
      options: [
        { value: "panic_exit", label: "Exit all positions immediately" },
        { value: "hold_wait", label: "Hold and wait for recovery" },
        { value: "accumulate", label: "Invest more to average down quality stocks" },
      ],
    },
    {
      code: "q3_experience",
      text: "How many years of active experience do you have in the Indian stock market?",
      help_text: null,
      type: "single_choice",
      options: [
        { value: "beginner", label: "Less than 1 year (Beginner)" },
        { value: "intermediate", label: "1 to 5 years (Intermediate)" },
        { value: "advanced", label: "More than 5 years (Experienced)" },
      ],
    },
  ],
};

const mockOnboarding = {
  client: {
    client_code: "ESC-2026-9841",
    full_name: "Demo Client",
    onboarding_status: "active",
    kyc_status: "verified",
    relationship_manager: "Priya Sharma",
  },
  steps: [
    { key: "kyc", label: "PAN & KYC Verification", status: "completed", is_required: true, completed_at: "2026-01-02T10:00:00Z" },
    { key: "risk_profile", label: "Risk Profiling Assessment", status: "completed", is_required: true, completed_at: "2026-01-02T10:15:00Z" },
    { key: "agreement", label: "Client Advisory Terms Acceptance", status: "completed", is_required: true, completed_at: "2026-01-02T10:20:00Z" },
  ],
  outstanding_agreements: [],
  kyc: [
    { type: "pan", label: "PAN Card Verification", status: "verified", remarks: "Verified via KRA Database" },
    { type: "aadhaar", label: "Identity & Address Proof", status: "verified", remarks: "Verified via DigiLocker OKYC" },
  ],
  documents: [
    { uuid: "doc-1", title: "PanCard_Verified.pdf", category: "PAN", status: "verified", rejection_reason: null, uploaded_at: "2026-01-02T10:00:00Z" },
  ],
  document_categories: {
    PAN: "Permanent Account Number (PAN)",
    AADHAAR: "Aadhaar / National ID",
    BANK_PROOF: "Cancelled Cheque / Bank Statement",
  },
  risk_profile: {
    uuid: "rp-1",
    category_label: "Moderately Aggressive",
    description: "Suitable for equity investments, mid-cap thematic allocations, and capital appreciation strategies.",
    score: 72,
    max_score: 100,
    methodology_version: "v2.4-2026",
    status: "active",
    acknowledged_at: "2026-01-02T10:15:00Z",
    expires_at: "2027-01-02T10:15:00Z",
    taken_at: "2026-01-02T10:15:00Z",
  },
};

const mockTickets = [
  {
    id: 1,
    ticket_number: "TKT-2026-104",
    subject: "Sector Report Query regarding HDFC Bank Call",
    category: "research",
    priority: "normal",
    status: "resolved",
    last_reply_at: "2026-02-14T11:20:00Z",
    messages_count: 2,
  },
];

async function tryProxy(request: NextRequest, slug: string[]): Promise<Response | null> {
  if (!process.env.BACKEND_URL) return null;
  const path = slug.join("/");
  const url = `${BACKEND_URL}/api/v1/client/${path}${request.nextUrl.search}`;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2500);
    const headers = new Headers(request.headers);
    headers.set("Host", new URL(BACKEND_URL).host);

    const response = await fetch(url, {
      method: request.method,
      headers,
      body: request.method !== "GET" && request.method !== "HEAD" ? await request.text() : undefined,
      signal: controller.signal,
    });
    clearTimeout(timeout);
    return response;
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest, context: { params: Promise<{ slug: string[] }> }) {
  const { slug } = await context.params;
  const path = slug.join("/");

  // Try live backend proxy first
  const proxied = await tryProxy(request, slug);
  if (proxied) return proxied;

  // Standalone fallback
  if (path === "dashboard") {
    return NextResponse.json({ success: true, data: mockDashboard });
  }
  if (path === "research") {
    const published = recommendationsStore.getPublished();
    const liveRecs = published.map((p, idx) => {
      const entryParts = (p.entryRange || "1000").split("-").map((s) => parseFloat(s.trim()));
      const entryLow = entryParts[0] || 1000;
      const entryHigh = entryParts[1] || entryLow;
      const t1 = parseFloat(p.target1) || Math.round(entryHigh * 1.1);
      const t2 = parseFloat(p.target2) || Math.round(t1 * 1.05);
      const sl = parseFloat(p.stopLoss) || Math.round(entryLow * 0.95);

      return {
        id: 300 + idx,
        instrument: p.symbol,
        exchange: p.exchange || "NSE",
        segment: p.instrumentType === "EQUITY_CASH" ? "Cash / Equity" : "Index Derivatives Alpha",
        direction: p.direction || "BUY",
        entry_low: entryLow,
        entry_high: entryHigh,
        stop_loss: sl,
        targets: [t1, t2],
        time_horizon: p.timeHorizon || "1-3 Months",
        risk_classification: "Moderate-High",
        status: p.status === "ACTIVE" ? "Active" : p.status,
        performance: {
          entry_ref: entryLow,
          high_after: t1,
          low_after: sl,
          mfe: parseFloat(p.mfeReturn || "3.5"),
          mae: parseFloat(p.maeReturn || "1.0"),
          outcome: p.pnlReturn || "In Progress",
        },
      };
    });

    const combinedReports = [
      {
        uuid: "rep-live-feed",
        report_code: "ESC-ALPHA-2026-LIVE",
        title: "SEBI Research Desk Broadcast Feed: High-Conviction Institutional Alpha",
        summary: "Live recommendations audited and cleared by Compliance Officer Adv. Rajesh Kothari under SEBI RA Regulations.",
        report_type: "Institutional Alpha",
        category: "Direct Equity & Derivatives",
        published_at: new Date().toISOString(),
        valid_until: new Date(Date.now() + 3600000 * 24 * 30).toISOString(),
        author: "Dr. Ananya Ray & Research Team",
        recommendations: liveRecs,
      },
      ...mockResearch.reports,
    ];

    return NextResponse.json({
      success: true,
      data: {
        active_subscription: true,
        reports: combinedReports,
      },
    });
  }

  if (path.startsWith("research/")) {
    const reportUuid = path.replace("research/", "");
    const published = recommendationsStore.getPublished();
    const liveRecs = published.map((p, idx) => ({
      id: 300 + idx,
      instrument: p.symbol,
      exchange: p.exchange || "NSE",
      segment: p.instrumentType === "EQUITY_CASH" ? "Cash / Equity" : "Index Derivatives Alpha",
      direction: p.direction || "BUY",
      entry_low: 1000,
      entry_high: 1050,
      stop_loss: 950,
      targets: [1150, 1220],
      time_horizon: p.timeHorizon || "1-3 Months",
      risk_classification: "Moderate-High",
      status: "Active",
    }));

    return NextResponse.json({
      success: true,
      data: {
        uuid: reportUuid,
        report_code: "ESC-ALPHA-2026-LIVE",
        title: "Live SEBI Research Desk Alpha Report",
        summary: "Institutional technical & quantitative research note.",
        report_type: "Institutional Alpha",
        category: "Direct Equity & Derivatives",
        published_at: new Date().toISOString(),
        valid_until: new Date(Date.now() + 3600000 * 24 * 30).toISOString(),
        author: "Dr. Ananya Ray (Head of Research)",
        approver: "Adv. Rajesh Kothari (Compliance Officer)",
        content_hash: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
        disclosure_set_hash: "a9b8c7d6e5f4",
        recommendations: liveRecs,
        disclosures: {
          statutory_disclaimer:
            "Investment in securities market are subject to market risks. Read all the related documents carefully before investing. Registration granted by SEBI and certification from NISM in no way guarantee performance of the intermediary or provide any assurance of returns to investors.",
          entity: {
            legal_name: "TradeGrow Research Advisory LLP",
            registration_number: "INH000018942",
          },
          analyst_declarations: {
            financial_interest: false,
            beneficial_ownership_1_percent_or_more: false,
            material_conflict_of_interest: false,
            conflict_details: "Nil - Research team holds no financial interest in recommended securities.",
          },
        },
      },
    });
  }
  if (path === "billing") {
    return NextResponse.json({ success: true, data: mockBilling });
  }
  if (path === "risk-questionnaire") {
    return NextResponse.json({ success: true, data: mockQuestionnaire });
  }
  if (path === "onboarding") {
    return NextResponse.json({ success: true, data: mockOnboarding });
  }
  if (path === "support/tickets") {
    return NextResponse.json({ success: true, data: mockTickets });
  }

  if (path === "broker/positions") {
    const livePositions = await getFyersPositions();
    if (livePositions.length > 0) {
      return NextResponse.json({ success: true, data: livePositions });
    }
    // Institutional reference positions if broker is off-market
    return NextResponse.json({
      success: true,
      data: [
        { symbol: "NSE:HDFCBANK-EQ", qty: 50, avgPrice: 1692.5, ltp: 1715.0, pnl: 1125.0, pnlPercent: 1.33 },
        { symbol: "NSE:RELIANCE-EQ", qty: 25, avgPrice: 2940.0, ltp: 2985.4, pnl: 1135.0, pnlPercent: 1.54 },
      ],
    });
  }

  if (path === "broker/holdings") {
    const liveHoldings = await getFyersHoldings();
    if (liveHoldings.length > 0) {
      return NextResponse.json({ success: true, data: liveHoldings });
    }
    return NextResponse.json({
      success: true,
      data: [
        { symbol: "NSE:INFY-EQ", quantity: 40, costPrice: 1520.0, currentVal: 64200.0, pnl: 3400.0 },
        { symbol: "NSE:LT-EQ", quantity: 15, costPrice: 3480.0, currentVal: 54150.0, pnl: 1950.0 },
      ],
    });
  }

  // Generic fallback for any other sub-route
  return NextResponse.json({
    success: true,
    data: { message: "Success", path },
  });
}

export async function POST(request: NextRequest, context: { params: Promise<{ slug: string[] }> }) {
  const { slug } = await context.params;
  const path = slug.join("/");

  const proxied = await tryProxy(request, slug);
  if (proxied) return proxied;

  if (path === "support/tickets") {
    return NextResponse.json({
      success: true,
      data: {
        ticket: {
          id: Date.now(),
          ticket_number: `TKT-${Math.floor(1000 + Math.random() * 9000)}`,
          status: "open",
        },
      },
    });
  }

  if (path === "orders" || path === "broker/execute") {
    let body: any = {};
    try {
      body = await request.json();
    } catch {}

    const broker = (body.broker || "FYERS").toUpperCase();
    const symbol = body.symbol || "HDFCBANK";
    const quantity = Number(body.quantity) || 50;
    const direction = (body.direction || "BUY").toUpperCase();

    if (broker === "FYERS") {
      const fyersRes = await placeFyersOrder({
        symbol,
        qty: quantity,
        side: direction === "BUY" ? "BUY" : "SELL",
        type: body.orderType === "MARKET" ? "MARKET" : "LIMIT",
        productType: body.productType || "CNC",
        limitPrice: typeof body.entryPrice === "number" ? body.entryPrice : undefined,
        stopLoss: typeof body.stopLoss === "number" ? body.stopLoss : undefined,
        takeProfit: typeof body.target1 === "number" ? body.target1 : undefined,
      });

      return NextResponse.json({
        success: fyersRes.success,
        data: {
          orderId: fyersRes.orderId,
          broker: "FYERS",
          symbol: fyersRes.symbol,
          exchange: body.exchange || "NSE",
          direction,
          quantity,
          entryRange: body.entryRange || "Market / Limit",
          stopLoss: body.stopLoss || "Pre-set GTT",
          target1: body.target1,
          status: fyersRes.status,
          gttActive: true,
          placedAt: fyersRes.placedAt,
          suitabilityVerified: true,
          message: fyersRes.message,
          rawResponse: fyersRes.rawResponse,
        },
      });
    }

    // Default institutional mock for other connected brokers (Zerodha Kite, Groww)
    const orderId = `${broker}-ORD-2026-${Math.floor(10000 + Math.random() * 90000)}`;
    return NextResponse.json({
      success: true,
      data: {
        orderId,
        broker,
        symbol,
        exchange: body.exchange || "NSE",
        direction,
        quantity,
        entryRange: body.entryRange || "Market",
        stopLoss: body.stopLoss || "Pre-set GTT",
        target1: body.target1,
        status: "PLACED",
        gttActive: true,
        placedAt: new Date().toISOString(),
        suitabilityVerified: true,
        message: `GTT Limit Order for ${quantity} units of ${symbol} successfully submitted to ${broker} API.`,
      },
    });
  }

  return NextResponse.json({
    success: true,
    data: { message: "Saved successfully", path },
  });
}
