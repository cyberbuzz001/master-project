import { NextResponse, type NextRequest } from "next/server";
import type { Me } from "@/lib/api-types";

const BACKEND_URL = process.env.BACKEND_URL;

export async function GET(request: NextRequest) {
  try {
    const sessionCookie = request.cookies.get("esc_session")?.value;

    if (sessionCookie) {
      try {
        const decoded = JSON.parse(Buffer.from(sessionCookie, "base64").toString("utf-8")) as Me;
        return NextResponse.json({
          success: true,
          data: decoded,
        });
      } catch (_) {}
    }

    // Proxy to Laravel backend if configured
    if (BACKEND_URL) {
      try {
        const resp = await fetch(`${BACKEND_URL}/api/v1/me`, {
          method: "GET",
          headers: {
            Accept: "application/json",
            ...(request.headers.get("cookie") ? { Cookie: request.headers.get("cookie")! } : {}),
          },
          signal: AbortSignal.timeout(3000),
        });

        if (resp.ok) {
          const data = await resp.json();
          return NextResponse.json(data);
        }
      } catch (_) {}
    }

    return NextResponse.json(
      {
        success: false,
        error_code: "UNAUTHENTICATED",
        message: "Your session has expired. Please sign in again.",
      },
      { status: 401 }
    );
  } catch (err: any) {
    return NextResponse.json(
      {
        success: false,
        error_code: "INTERNAL_ERROR",
        message: "Failed to verify session.",
      },
      { status: 500 }
    );
  }
}
