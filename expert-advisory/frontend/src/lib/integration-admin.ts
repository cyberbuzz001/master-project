import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { proxyBackend } from "@/lib/backend-proxy";

/** The Laravel session and permissions remain the authority for integration setup. */
export async function requireIntegrationAdmin(request: NextRequest): Promise<Response | null> {
  const response = await proxyBackend(request, "/api/v1/me");
  if (!response.ok) return response;
  const payload = await response.json().catch(() => null);
  const me = payload?.data;
  if (me?.user_type !== "staff" || !Array.isArray(me.permissions) || !me.permissions.includes("settings.manage")) {
    return NextResponse.json({ success: false, message: "Integration administration permission is required." }, { status: 403 });
  }
  if (!me.two_factor?.enabled || !me.two_factor?.verified_this_session || me.two_factor?.enrollment_required) {
    return NextResponse.json({ success: false, message: "Two-factor verification is required." }, { status: 403 });
  }
  return null;
}
