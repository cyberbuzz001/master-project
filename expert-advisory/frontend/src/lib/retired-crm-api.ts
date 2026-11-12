import { NextResponse } from "next/server";

/** Retired prototype endpoints must never read or mutate the local JSON stores. */
export function retiredCrmApi() {
  return NextResponse.json({ success: false, error_code: "ENDPOINT_RETIRED", message: "Use the authenticated back-office at /office." }, {
    status: 410, headers: { "Cache-Control": "private, no-store" },
  });
}
