import { NextResponse } from "next/server";
import { getLiveMarketQuotes } from "@/lib/fyers";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const quotes = await getLiveMarketQuotes();
    return NextResponse.json({
      success: true,
      timestamp: Date.now(),
      data: quotes,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Failed fetching market quotes",
      },
      { status: 500 }
    );
  }
}
