import { NextRequest, NextResponse } from "next/server";
import { readStoredTokens } from "@/lib/fyers";
import { requireIntegrationAdmin } from "@/lib/integration-admin";

export const dynamic = "force-dynamic";
export async function GET(request: NextRequest) {
  const denied = await requireIntegrationAdmin(request);
  if (denied) return denied;
  const tokens = readStoredTokens();
  return NextResponse.json({ success: true, token_present: Boolean(tokens?.accessToken), updatedAt: tokens?.updatedAt ?? null }, { headers: { "Cache-Control": "private, no-store" } });
}

// Administrative account linking uses the state-verified OAuth flow. Do not
// expose a password/TOTP auto-login operation or return provider credentials.
export function POST() {
  return NextResponse.json({ success: false, message: "Use the broker authorization flow." }, { status: 410 });
}
