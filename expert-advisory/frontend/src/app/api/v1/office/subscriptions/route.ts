import { NextRequest, NextResponse } from "next/server";
import { leadsStore, StoredSubscription } from "@/lib/leads-store";

export async function GET() {
  try {
    const subscriptions = leadsStore.getSubscriptions();
    return NextResponse.json({
      success: true,
      data: subscriptions,
      total: subscriptions.length,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { customerName, planName, amount, expiryDate, customerId } = body;

    if (!customerName || !planName) {
      return NextResponse.json(
        { success: false, message: "Customer Name and Plan Name are required" },
        { status: 400 }
      );
    }

    const newSub = leadsStore.addSubscription({
      customerId: customerId || `CUST-${Math.floor(1000 + Math.random() * 9000)}`,
      customerName: customerName.trim(),
      customerCode: body.customerCode,
      planName: planName.trim(),
      tier: body.tier || "Standard Tier",
      amount: Number(amount) || 25000,
      duration: body.duration || "3 Months",
      startDate: body.startDate,
      expiryDate: expiryDate || new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
      paymentMethod: body.paymentMethod || "Razorpay / UPI",
      relationshipManager: body.relationshipManager || "Vikram Malhotra",
      notes: body.notes,
    });

    return NextResponse.json(
      {
        success: true,
        data: newSub,
        message: `Subscription ${newSub.id} created successfully`,
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
    const { id, updates } = body;

    if (!id) {
      return NextResponse.json({ success: false, message: "Missing subscription id" }, { status: 400 });
    }

    const payload = updates || body;
    delete payload.id;

    const updated = leadsStore.updateSubscription(id, payload);
    if (!updated) {
      return NextResponse.json({ success: false, message: "Subscription not found" }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      data: updated,
      message: `Subscription ${id} updated successfully`,
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
      return NextResponse.json({ success: false, message: "Missing subscription id" }, { status: 400 });
    }

    const deleted = leadsStore.deleteSubscription(id);
    if (!deleted) {
      return NextResponse.json({ success: false, message: "Subscription not found" }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      message: `Subscription ${id} removed successfully`,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
