import { NextResponse } from "next/server";
import { getFyersConfig } from "@/lib/fyers";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const config = getFyersConfig();
  const url = new URL(request.url);
  const redirectUri =
    url.searchParams.get("redirect_uri") ||
    config.redirectUri ||
    `${url.origin}/api/v1/auth/fyers/callback`;

  const authUrl = `https://api-t1.fyers.in/api/v3/generate-authcode?client_id=${encodeURIComponent(
    config.appId
  )}&redirect_uri=${encodeURIComponent(
    redirectUri
  )}&response_type=code&state=expertstocks_state`;

  return NextResponse.redirect(authUrl);
}
