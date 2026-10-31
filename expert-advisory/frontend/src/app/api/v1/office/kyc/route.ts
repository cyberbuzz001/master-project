import { NextResponse } from "next/server";
import { leadsStore } from "@/lib/leads-store";
import { requireStaffSession } from "@/lib/office-auth";

export async function GET(request: Request) {
  const unauthorized = await requireStaffSession(request);
  if (unauthorized) return unauthorized;

  const kycRecords = leadsStore.getKycRecords();
  return NextResponse.json({
    success: true,
    data: kycRecords,
  });
}
