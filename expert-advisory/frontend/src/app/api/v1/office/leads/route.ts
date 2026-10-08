import { NextRequest, NextResponse } from "next/server";
import { leadsStore } from "@/lib/leads-store";

export async function GET() {
  const leads = leadsStore.getLeads();
  return NextResponse.json({
    success: true,
    data: leads,
  });
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, status, updates } = body;
    if (!id) {
      return NextResponse.json({ success: false, message: "Missing lead id" }, { status: 400 });
    }
    let updated;
    if (updates && typeof updates === "object") {
      updated = leadsStore.updateLead(id, updates);
    } else if (status) {
      updated = leadsStore.updateLeadStatus(id, status);
    } else {
      return NextResponse.json({ success: false, message: "Missing status or updates payload" }, { status: 400 });
    }
    return NextResponse.json({ success: true, data: updated });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, action, durationSec, disposition, notes, agent } = body;
    if (!id) {
      return NextResponse.json({ success: false, message: "Missing lead id" }, { status: 400 });
    }
    if (action === "call") {
      const updated = leadsStore.recordCall(id, {
        durationSec: Number(durationSec) || 0,
        disposition: disposition || "Connected",
        notes: notes || "",
        agent: agent || "Advisory Rep",
      });
      return NextResponse.json({ success: true, data: updated });
    }
    return NextResponse.json({ success: false, message: "Unknown action" }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
