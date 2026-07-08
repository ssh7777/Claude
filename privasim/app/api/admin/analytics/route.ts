import { NextRequest, NextResponse } from "next/server";
import { getAnalytics } from "@/lib/analytics";

// Owner-only traffic + sales analytics by source.
export async function GET(req: NextRequest) {
  const apiKey = process.env.PIKASIM_API_KEY ?? "";
  if (!apiKey || req.headers.get("x-admin-key") !== apiKey) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const sources = await getAnalytics();
  const totals = sources.reduce(
    (a, s) => ({
      visits: a.visits + s.visits,
      checkouts: a.checkouts + s.checkouts,
      sales: a.sales + s.sales,
      revenueUsd: Math.round((a.revenueUsd + s.revenueUsd) * 100) / 100,
    }),
    { visits: 0, checkouts: 0, sales: 0, revenueUsd: 0 }
  );
  return NextResponse.json({ sources, totals });
}
