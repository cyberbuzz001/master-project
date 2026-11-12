import { createHmac, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { proxyBackend } from "@/lib/backend-proxy";

export const runtime = "nodejs";

export function GET(request: NextRequest) {
  const expected = process.env.ADVISORY_WHATSAPP_WEBHOOK_SECRET;
  if (!expected) return NextResponse.json({ success: false }, { status: 503 });
  const params = request.nextUrl.searchParams;
  const token = params.get("hub.verify_token") ?? "";
  const actual = Buffer.from(token);
  const wanted = Buffer.from(expected);
  if (params.get("hub.mode") !== "subscribe" || !params.has("hub.challenge") || actual.length !== wanted.length || !timingSafeEqual(actual, wanted)) {
    return NextResponse.json({ success: false }, { status: 403 });
  }
  return new NextResponse(params.get("hub.challenge"), { headers: { "Content-Type": "text/plain", "Cache-Control": "no-store" } });
}

export async function POST(request: NextRequest) {
  // The app secret signs POST bodies; it is different from the GET verify token.
  const secret = process.env.ADVISORY_WHATSAPP_APP_SECRET;
  if (!secret) return NextResponse.json({ success: false }, { status: 503 });
  const signature = request.headers.get("x-hub-signature-256") ?? "";
  if (!/^sha256=[a-f0-9]{64}$/.test(signature)) {
    return NextResponse.json({ success: false }, { status: 403 });
  }
  const raw = Buffer.from(await request.clone().arrayBuffer());
  const expected = createHmac("sha256", secret).update(raw).digest();
  if (!timingSafeEqual(Buffer.from(signature.slice(7), "hex"), expected)) {
    return NextResponse.json({ success: false }, { status: 403 });
  }
  // Await durable backend acceptance. A failure stays non-2xx so Meta can retry.
  return proxyBackend(request, "/api/v1/webhooks/whatsapp");
}
