import { NextResponse } from "next/server";
import { autoLoginFyers, readStoredTokens } from "@/lib/fyers";

export const dynamic = "force-dynamic";

export async function GET() {
  const currentTokens = readStoredTokens();
  if (currentTokens?.accessToken) {
    return NextResponse.json({
      success: true,
      authenticated: true,
      message: "Fyers access token is currently active.",
      updatedAt: currentTokens.updatedAt,
    });
  }

  const result = await autoLoginFyers();
  return NextResponse.json(result);
}

export async function POST() {
  const result = await autoLoginFyers();
  return NextResponse.json(result);
}
