import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { exchangeFyersAuthCode } from "@/lib/fyers";
import { requireIntegrationAdmin } from "@/lib/integration-admin";

export const dynamic = "force-dynamic";
export async function GET(request: NextRequest) {
  const denied = await requireIntegrationAdmin(request);
  if (denied) return denied;
  const expected = request.cookies.get("fyers_oauth_state")?.value ?? "";
  const actual = request.nextUrl.searchParams.get("state") ?? "";
  const code = request.nextUrl.searchParams.get("auth_code");
  let response: NextResponse;
  if (!code || !/^[a-f0-9]{64}$/.test(expected) || !/^[a-f0-9]{64}$/.test(actual) || actual.length !== expected.length || !timingSafeEqual(Buffer.from(actual), Buffer.from(expected))) {
    response = NextResponse.json({ success: false, message: "Invalid or expired authorization state. Start again." }, { status: 400 });
  } else {
    const result = await exchangeFyersAuthCode(code);
    response = NextResponse.json({ success: result.success, message: result.success ? "Broker connected." : "Broker authorization failed." }, { status: result.success ? 200 : 502 });
  }
  response.cookies.set("fyers_oauth_state", "", { path: "/api/v1/auth/fyers/callback", maxAge: 0 });
  response.headers.set("Cache-Control", "no-store");
  return response;
}
