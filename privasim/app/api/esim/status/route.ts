import { NextRequest, NextResponse } from "next/server";
import { getEsimStatus } from "@/lib/pikasim";
import { rateLimit, RATE_LIMITS } from "@/lib/rateLimit";

export async function GET(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0] ?? "unknown";
  const { allowed } = rateLimit(`esim-status:${ip}`, RATE_LIMITS.search);
  if (!allowed) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

  const { searchParams } = new URL(req.url);
  const iccid = searchParams.get("iccid");

  if (!iccid) {
    return NextResponse.json({ error: "iccid is required" }, { status: 400 });
  }

  try {
    const status = await getEsimStatus(iccid);
    return NextResponse.json(status);
  } catch (err) {
    console.error("eSIM status error:", err);
    return NextResponse.json({ error: "Failed to fetch eSIM status" }, { status: 500 });
  }
}
