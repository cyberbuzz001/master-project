import { NextRequest } from "next/server";
import { proxyBackend } from "@/lib/backend-proxy";

// Persist once in the authoritative CRM. Backend validation, throttling and
// consent handling run before any communication is scheduled.
export function POST(request: NextRequest) {
  return proxyBackend(request, "/api/v1/public/leads");
}
