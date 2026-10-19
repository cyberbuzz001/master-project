import { NextRequest, NextResponse } from "next/server";
import { leadsStore } from "@/lib/leads-store";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const lead = leadsStore.getLead(id);
  if (!lead) {
    return NextResponse.json({ success: false, message: "Lead not found" }, { status: 404 });
  }
  return NextResponse.json({ success: true, data: lead });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const updated = leadsStore.updateLead(id, body);
  if (!updated) {
    return NextResponse.json({ success: false, message: "Lead not found" }, { status: 404 });
  }
  return NextResponse.json({ success: true, data: updated, message: `Lead ${id} updated successfully` });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const deleted = leadsStore.deleteLead(id);
  if (!deleted) {
    return NextResponse.json({ success: false, message: "Lead not found" }, { status: 404 });
  }
  return NextResponse.json({ success: true, message: `Lead ${id} deleted successfully` });
}
