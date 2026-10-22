import { NextResponse } from "next/server";
import { campaignsStore } from "@/lib/campaigns-store";
import type { CrmCampaign } from "@/lib/crm-data";

export async function GET() {
  try {
    const campaigns = campaignsStore.getCampaigns();
    const totalSpent = campaigns.reduce((acc, c) => acc + c.spend, 0);
    const totalRevenue = campaigns.reduce((acc, c) => acc + c.revenue, 0);
    const totalConverted = campaigns.reduce((acc, c) => acc + c.converted, 0);
    const blendedCac = totalConverted > 0 ? Math.round(totalSpent / totalConverted) : 0;
    const overallRoas = totalSpent > 0 ? (totalRevenue / totalSpent).toFixed(2) + "x" : "0x";

    return NextResponse.json({
      success: true,
      data: {
        campaigns,
        metrics: {
          totalSpent,
          totalRevenue,
          totalConverted,
          blendedCac,
          overallRoas,
        },
      },
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    if (!body || !body.name) {
      return NextResponse.json({ success: false, error: "Campaign name is required." }, { status: 400 });
    }

    const newCampaign: CrmCampaign = {
      id: body.id || `CMP-2026-0${campaignsStore.getCampaigns().length + 1}`,
      name: body.name.trim(),
      type: body.type || "NEW_LEAD",
      channel: body.channel || "Google Ads",
      sent: body.sent || 0,
      delivered: body.delivered || 0,
      opened: body.opened || 0,
      clicked: body.clicked || 0,
      converted: body.converted || 0,
      revenue: body.revenue || 0,
      spend: Number(body.spend) || 0,
      roi: body.roi || "0.0x",
      status: "ACTIVE",
    };

    const saved = campaignsStore.addCampaign(newCampaign);
    return NextResponse.json({ success: true, data: saved, message: "Campaign created successfully." });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
