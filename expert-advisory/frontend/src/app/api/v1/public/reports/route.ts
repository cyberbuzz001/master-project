import { NextResponse } from "next/server";
import { getDailyPublishedReports } from "@/lib/reports";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const category = url.searchParams.get("category");
  const query = url.searchParams.get("q");

  let reports = getDailyPublishedReports();

  if (category && category !== "All") {
    reports = reports.filter((r) => r.category.toLowerCase() === category.toLowerCase());
  }

  if (query) {
    const qLower = query.toLowerCase();
    reports = reports.filter(
      (r) =>
        r.title.toLowerCase().includes(qLower) ||
        r.summary.toLowerCase().includes(qLower) ||
        r.tags.some((t) => t.toLowerCase().includes(qLower))
    );
  }

  return NextResponse.json({
    success: true,
    total: reports.length,
    timestamp: Date.now(),
    data: reports,
  });
}
