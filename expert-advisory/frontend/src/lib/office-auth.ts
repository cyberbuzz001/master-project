import { NextResponse } from "next/server";
import type { Me } from "./api-types";

const BACKEND_URL = process.env.BACKEND_URL;

/**
 * The office API routes are server-side BFF endpoints. They must validate the
 * Laravel session before touching any CRM or operational store.
 */
export async function requireStaffSession(request: Request): Promise<NextResponse | null> {
  if (!BACKEND_URL) {
    return NextResponse.json(
      { success: false, error_code: "AUTH_CONFIGURATION_MISSING", message: "The staff API is not configured." },
      { status: 503 },
    );
  }

  const cookie = request.headers.get("cookie");
  if (!cookie) {
    return NextResponse.json(
      { success: false, error_code: "UNAUTHENTICATED", message: "A staff session is required." },
      { status: 401 },
    );
  }

  try {
    const response = await fetch(`${BACKEND_URL}/api/v1/me`, {
      headers: { Accept: "application/json", Cookie: cookie },
      cache: "no-store",
      signal: AbortSignal.timeout(3000),
    });

    if (!response.ok) {
      return NextResponse.json(
        { success: false, error_code: "UNAUTHENTICATED", message: "Your staff session is invalid or expired." },
        { status: 401 },
      );
    }

    const body = (await response.json()) as { success?: boolean; data?: Me };
    const me = body.data;
    if (!body.success || !me || me.user_type !== "staff") {
      return NextResponse.json(
        { success: false, error_code: "STAFF_ACCESS_REQUIRED", message: "Staff access is required." },
        { status: 403 },
      );
    }

    return null;
  } catch {
    return NextResponse.json(
      { success: false, error_code: "AUTH_SERVICE_UNAVAILABLE", message: "The staff authentication service is unavailable." },
      { status: 503 },
    );
  }
}
