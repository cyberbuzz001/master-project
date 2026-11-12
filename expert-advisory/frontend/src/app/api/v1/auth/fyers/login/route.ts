import { randomBytes } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getFyersConfig } from "@/lib/fyers";
import { requireIntegrationAdmin } from "@/lib/integration-admin";

export const dynamic = "force-dynamic";
export async function GET(request: NextRequest) {
  const denied = await requireIntegrationAdmin(request);
  if (denied) return denied;
  const config = getFyersConfig();
  const callback = new URL("/api/v1/auth/fyers/callback", process.env.NEXT_PUBLIC_SITE_URL || request.nextUrl.origin).href;
  if (!config.appId || (config.redirectUri && config.redirectUri !== callback)) {
    return NextResponse.json({ success: false, message: "Configure the broker app and its callback for this origin." }, { status: 503 });
  }
  const state = randomBytes(32).toString("hex");
  const url = new URL("https://api-t1.fyers.in/api/v3/generate-authcode");
  url.search = new URLSearchParams({ client_id: config.appId, redirect_uri: callback, response_type: "code", state }).toString();
  const response = NextResponse.redirect(url);
  response.headers.set("Cache-Control", "no-store");
  response.cookies.set("fyers_oauth_state", state, { path: "/api/v1/auth/fyers/callback", httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", maxAge: 600 });
  return response;
}
