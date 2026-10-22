import { NextResponse } from "next/server";
import { recommendationsStore, ExtendedRecommendation } from "@/lib/recommendations-store";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const view = url.searchParams.get("view");

    if (view === "queue") {
      return NextResponse.json({ success: true, data: recommendationsStore.getQueue() });
    }
    if (view === "published") {
      return NextResponse.json({ success: true, data: recommendationsStore.getPublished() });
    }

    return NextResponse.json({
      success: true,
      data: {
        published: recommendationsStore.getPublished(),
        queue: recommendationsStore.getQueue(),
      },
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { action, payload } = body;

    if (!action) {
      return NextResponse.json({ success: false, error: "Action is required." }, { status: 400 });
    }

    switch (action) {
      case "CREATE_DRAFT": {
        if (!payload || !payload.symbol || !payload.direction) {
          return NextResponse.json({ success: false, error: "Symbol and direction are required." }, { status: 400 });
        }
        const draft: ExtendedRecommendation = {
          id: `REC-${Date.now().toString().slice(-6)}`,
          symbol: payload.symbol.toUpperCase(),
          exchange: payload.exchange || "NSE",
          instrumentType: payload.instrumentType || "EQUITY_CASH",
          direction: payload.direction,
          entryRange: payload.entryRange || "CMP",
          target1: payload.target1 || "",
          target2: payload.target2 || "",
          stopLoss: payload.stopLoss || "",
          timeHorizon: payload.timeHorizon || "1-2 Weeks",
          rationale: payload.rationale || "Technical breakout with institutional volume expansion.",
          advisor: payload.advisor || "Research Desk",
          approvalStatus: "PENDING_APPROVAL",
          approvalStage: "PENDING_SENIOR_REVIEW",
          juniorAnalyst: payload.juniorAnalyst || "Junior Analyst",
          status: "ACTIVE",
          pnlReturn: "0.0%",
          publishedAt: "Just now",
          complianceChecked: false,
          eligibleSegments: payload.eligibleSegments || ["Equity Cash"],
          rrRatio: payload.rrRatio || "1 : 2.0",
          conflictDeclared: true,
          contentHash: Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15),
        };
        const saved = recommendationsStore.addDraft(draft);
        return NextResponse.json({ success: true, data: saved, message: "Draft queued for Senior RA approval." });
      }

      case "SENIOR_APPROVE": {
        const { id, reviewer } = payload || {};
        if (!id) return NextResponse.json({ success: false, error: "Recommendation ID is required." }, { status: 400 });
        const success = recommendationsStore.seniorApprove(id, reviewer);
        if (!success) return NextResponse.json({ success: false, error: "Item not found in queue." }, { status: 404 });
        return NextResponse.json({ success: true, message: "Senior RA approval granted. Transferred to SEBI Compliance Gate." });
      }

      case "COMPLIANCE_PASS": {
        const { id, reviewer } = payload || {};
        if (!id) return NextResponse.json({ success: false, error: "Recommendation ID is required." }, { status: 400 });
        const success = recommendationsStore.compliancePass(id, reviewer);
        if (!success) return NextResponse.json({ success: false, error: "Item not found in queue." }, { status: 404 });
        return NextResponse.json({ success: true, message: "Compliance clearance stamped. Ready for 1-click broadcast." });
      }

      case "BROADCAST": {
        const { id } = payload || {};
        if (!id) return NextResponse.json({ success: false, error: "Recommendation ID is required." }, { status: 400 });
        const published = recommendationsStore.broadcast(id);
        if (!published) return NextResponse.json({ success: false, error: "Item not found in queue." }, { status: 404 });
        return NextResponse.json({
          success: true,
          data: published,
          message: "Recommendation broadcasted to client mobile apps, TradeGrow broker bridge, and SMS/WhatsApp feeds.",
        });
      }

      case "UPDATE_OUTCOME": {
        const { id, status, pnl } = payload || {};
        if (!id || !status) return NextResponse.json({ success: false, error: "ID and status are required." }, { status: 400 });
        const success = recommendationsStore.updateOutcome(id, status, pnl || "0.0%");
        if (!success) return NextResponse.json({ success: false, error: "Published recommendation not found." }, { status: 404 });
        return NextResponse.json({ success: true, message: "Track record updated." });
      }

      default:
        return NextResponse.json({ success: false, error: `Unknown action: ${action}` }, { status: 400 });
    }
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
