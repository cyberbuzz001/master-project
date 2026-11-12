import { NextRequest, NextResponse } from "next/server";
import { proxyBackend } from "@/lib/backend-proxy";

type Context = { params: Promise<{ slug: string[] }> };

async function handle(request: NextRequest, context: Context) {
  const { slug } = await context.params;
  if (slug.some((part) => !/^[a-zA-Z0-9_-]+$/.test(part))) {
    return NextResponse.json({ success: false, message: "Invalid path." }, { status: 400 });
  }
  return proxyBackend(request, `/api/v1/client/${slug.join("/")}`);
}

export { handle as GET, handle as POST, handle as PUT, handle as PATCH, handle as DELETE };
