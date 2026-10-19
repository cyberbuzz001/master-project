import { NextResponse, type NextRequest } from "next/server";
import { sendSuitabilityEmail } from "@/lib/email-service";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { email, fullName, phone, leadCode, assessment } = body;

    if (!email || !email.includes("@")) {
      return NextResponse.json(
        { success: false, message: "Valid email address is required." },
        { status: 422 }
      );
    }

    if (!assessment) {
      return NextResponse.json(
        { success: false, message: "Assessment data is required." },
        { status: 422 }
      );
    }

    const result = await sendSuitabilityEmail({
      to: email.trim(),
      fullName: fullName || "Investor",
      phone: phone || "",
      leadCode: leadCode || `ESC-RPM-${Math.floor(1000 + Math.random() * 9000)}`,
      assessment,
    });

    return NextResponse.json({
      success: result.success,
      message: result.success
        ? "Suitability certificate dispatched successfully from info@expertstocks.in."
        : `Email dispatch error: ${result.error}`,
      from: "info@expertstocks.in",
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, message: err.message || "Failed to dispatch email." },
      { status: 500 }
    );
  }
}
