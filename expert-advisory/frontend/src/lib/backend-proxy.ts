import "server-only";

import { NextRequest, NextResponse } from "next/server";

/** Laravel owns authentication, authorization, CSRF validation and persistence. */
export async function proxyBackend(request: NextRequest, path: string): Promise<Response> {
  const backend = process.env.BACKEND_URL;
  if (!backend) return unavailable();

  // Do not follow upstream redirects with credentials or cache personal responses.
  const headers = new Headers();
  for (const name of ["accept", "content-type", "cookie", "x-xsrf-token", "x-csrf-token", "origin", "referer", "x-hub-signature-256"]) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }
  headers.set("accept", "application/json");
  try {
    const upstream = await fetch(`${backend.replace(/\/$/, "")}${path}${request.nextUrl.search}`, {
      method: request.method,
      headers,
      body: ["GET", "HEAD"].includes(request.method) ? undefined : await request.arrayBuffer(),
      cache: "no-store",
      redirect: "manual",
      signal: AbortSignal.timeout(15000),
    });
    const responseHeaders = new Headers({ "Cache-Control": "private, no-store" });
    for (const name of ["content-type", "content-disposition", "retry-after"]) {
      const value = upstream.headers.get(name);
      if (value) responseHeaders.set(name, value);
    }
    for (const cookie of upstream.headers.getSetCookie()) responseHeaders.append("set-cookie", cookie);
    if (upstream.status >= 300 && upstream.status < 400) {
      return NextResponse.json({ success: false, message: "The API returned an unexpected redirect." }, { status: 502 });
    }
    return new Response(upstream.body, { status: upstream.status, headers: responseHeaders });
  } catch {
    return unavailable();
  }
}

function unavailable() {
  return NextResponse.json({ success: false, error_code: "BACKEND_UNAVAILABLE", message: "The service is temporarily unavailable. Please try again later." }, {
    status: 503, headers: { "Cache-Control": "private, no-store" },
  });
}
