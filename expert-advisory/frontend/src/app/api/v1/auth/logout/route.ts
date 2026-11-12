import { NextRequest } from "next/server";
import { proxyBackend } from "@/lib/backend-proxy";

export function POST(request: NextRequest) {
  return proxyBackend(request, "/api/v1/auth/logout");
}
