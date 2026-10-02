import { NextResponse } from "next/server";
import { leadsStore } from "@/lib/leads-store";

export async function GET() {
  const kycRecords = leadsStore.getKycRecords();
  return NextResponse.json({
    success: true,
    data: kycRecords,
  });
}
