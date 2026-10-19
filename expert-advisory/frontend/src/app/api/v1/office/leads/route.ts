import { NextRequest, NextResponse } from "next/server";
import { leadsStore, LeadStatus } from "@/lib/leads-store";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get("query") || searchParams.get("search") || "";
    const status = searchParams.get("status") || "ALL";
    const temp = searchParams.get("temp") || "ALL";

    let leads = leadsStore.getLeads();

    if (query) {
      const q = query.toLowerCase();
      leads = leads.filter(
        (l) =>
          l.name.toLowerCase().includes(q) ||
          l.mobile.includes(q) ||
          l.email.toLowerCase().includes(q) ||
          l.id.toLowerCase().includes(q) ||
          (l.city && l.city.toLowerCase().includes(q))
      );
    }

    if (status !== "ALL") {
      leads = leads.filter((l) => l.status.toLowerCase() === status.toLowerCase());
    }

    if (temp !== "ALL") {
      leads = leads.filter((l) => l.temperature === temp);
    }

    return NextResponse.json({
      success: true,
      data: leads,
      total: leads.length,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { id, action, durationSec, disposition, notes, agent } = body;

    // 1. Check if this is a Telecalling / Call Log interaction
    if (action === "call" && id) {
      const updated = leadsStore.recordCall(id, {
        durationSec: Number(durationSec) || 0,
        disposition: disposition || "Connected",
        notes: notes || "",
        agent: agent || "Advisory Rep",
      });
      if (!updated) {
        return NextResponse.json({ success: false, message: "Lead not found" }, { status: 404 });
      }
      return NextResponse.json({
        success: true,
        data: updated,
        message: "Call interaction recorded successfully",
      });
    }

    // 2. Otherwise, treat as Create New Lead
    const fullName = String(body.name || body.fullName || body.full_name || "").trim();
    const rawMobile = String(body.mobile || body.phone || "").trim();
    const cleanMobile = rawMobile.replace(/\D/g, "").slice(-10);

    if (!fullName) {
      return NextResponse.json(
        { success: false, message: "Full Name is required" },
        { status: 400 }
      );
    }

    if (cleanMobile.length < 10) {
      return NextResponse.json(
        { success: false, message: "A valid 10-digit mobile number is required" },
        { status: 400 }
      );
    }

    const newLead = leadsStore.addLead({
      leadCode: body.id || body.leadCode,
      fullName,
      mobile: cleanMobile,
      email: body.email,
      city: body.city || "Mumbai",
      capitalRange: body.capital || body.capitalRange,
      segments: body.segment || body.segments,
      source: body.source || "Manual Direct Inbound",
      assignedAgent: body.assignedAgent || body.assignedTo || "Vikram Malhotra",
      notes: body.notes || body.message,
      status: (body.status ? String(body.status).toLowerCase() : "new") as LeadStatus,
    });

    return NextResponse.json(
      {
        success: true,
        data: newLead,
        message: `Lead ${newLead.id} created successfully`,
      },
      { status: 201 }
    );
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { id, status, updates, assignedAgent, assignedTo } = body;

    if (!id) {
      return NextResponse.json({ success: false, message: "Missing lead id" }, { status: 400 });
    }

    let payload: any = {};
    if (updates && typeof updates === "object") {
      payload = { ...updates };
    }
    if (status) {
      payload.status = String(status).toLowerCase();
    }
    if (assignedAgent || assignedTo) {
      payload.assignedAgent = assignedAgent || assignedTo;
      payload.assignedTo = assignedAgent || assignedTo;
    }

    if (Object.keys(payload).length === 0) {
      return NextResponse.json(
        { success: false, message: "No updates provided" },
        { status: 400 }
      );
    }

    const updated = leadsStore.updateLead(id, payload);
    if (!updated) {
      return NextResponse.json({ success: false, message: "Lead not found" }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      data: updated,
      message: `Lead ${id} updated successfully`,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    let id = searchParams.get("id");

    if (!id) {
      const body = await request.json().catch(() => ({}));
      id = body.id;
    }

    if (!id) {
      return NextResponse.json({ success: false, message: "Missing lead id" }, { status: 400 });
    }

    const deleted = leadsStore.deleteLead(id);
    if (!deleted) {
      return NextResponse.json({ success: false, message: "Lead not found" }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      message: `Lead ${id} deleted successfully`,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
