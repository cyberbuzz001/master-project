import { NextRequest, NextResponse } from "next/server";
import { proxyBackend } from "@/lib/backend-proxy";

/** Compatibility bridge for the CRM UI; persistence belongs to Laravel. */
export function GET(request: NextRequest) {
  return proxyBackend(request, "/api/v1/employee/leads");
}

export function POST(request: NextRequest) {
  return proxyBackend(request, "/api/v1/employee/leads");
}

export async function PATCH(request: NextRequest) {
  return proxyBackendWithLeadId(request, "PATCH");
}

export async function DELETE(request: NextRequest) {
  return proxyBackendWithLeadId(request, "DELETE");
}

async function proxyBackendWithLeadId(request: NextRequest, method: "PATCH" | "DELETE") {
  const body = method === "PATCH" ? await request.clone().json().catch(() => ({})) : {};
  const id = request.nextUrl.searchParams.get("id") || body.id;
  if (!id || typeof id !== "string") {
    return NextResponse.json({ success: false, message: "Lead id is required." }, { status: 422 });
  }

  if (method === "DELETE") {
    return proxyBackend(new NextRequest(request.url, { method, headers: request.headers }), `/api/v1/employee/leads/${encodeURIComponent(id)}`);
  }

  const updates = body.updates ?? body;
  return proxyBackend(new NextRequest(request.url, {
    method,
    headers: request.headers,
    body: JSON.stringify(updates),
  }), `/api/v1/employee/leads/${encodeURIComponent(id)}`);
}
