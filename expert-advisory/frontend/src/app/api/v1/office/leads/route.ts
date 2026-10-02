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
    const { id, status } = body;
    if (!id || !status) {
      return NextResponse.json({ success: false, message: "Missing id or status" }, { status: 400 });
    }
    const updated = leadsStore.updateLeadStatus(id, status);
    return NextResponse.json({ success: true, data: updated });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
