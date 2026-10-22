import { NextResponse } from "next/server";
import { campaignsStore } from "@/lib/campaigns-store";

export async function GET() {
  try {
    const referrals = campaignsStore.getReferrals();
    const history = campaignsStore.getPayoutHistory();

    const pendingPayouts = referrals.filter((r) => r.payoutStatus === "PENDING_TDS" && r.rewardEarned > 0);
    const totalPendingAmount = pendingPayouts.reduce((acc, r) => acc + r.rewardEarned, 0);
    const totalTdsPayable = Math.round(totalPendingAmount * 0.05);
    const netPayable = totalPendingAmount - totalTdsPayable;

    return NextResponse.json({
      success: true,
      data: {
        referrals,
        payoutHistory: history,
        summary: {
          pendingCount: pendingPayouts.length,
          totalPendingGross: totalPendingAmount,
          totalTdsPayable,
          netPayable,
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
    const { referralId, utrNumber, processedBy } = body;

    if (!referralId || !utrNumber) {
      return NextResponse.json(
        { success: false, error: "referralId and utrNumber are required." },
        { status: 400 }
      );
    }

    const record = campaignsStore.processPayout(referralId, utrNumber, processedBy || "Finance Desk");
    if (!record) {
      return NextResponse.json({ success: false, error: "Referral record not found." }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      data: record,
      message: `NEFT payout recorded. UTR: ${utrNumber}. 5% Section 194H TDS deducted (₹${record.tdsDeducted}).`,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
