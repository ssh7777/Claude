import { NextRequest, NextResponse } from "next/server";
import { topupEsim, getTopupOptions } from "@/lib/pikasim";
import { rateLimit, RATE_LIMITS } from "@/lib/rateLimit";

// GET /api/esim/topup?iccid=… — list valid top-up packages for an eSIM.
// Top-up package codes differ from new-purchase codes (PikaSim requirement).
export async function GET(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0] ?? "unknown";
  const { allowed } = rateLimit(`topup-options:${ip}`, RATE_LIMITS.search);
  if (!allowed) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

  const iccid = new URL(req.url).searchParams.get("iccid");
  if (!iccid) return NextResponse.json({ error: "iccid is required" }, { status: 400 });

  try {
    const result = await getTopupOptions(iccid);
    return NextResponse.json(result);
  } catch (err) {
    console.error("Top-up options error:", err);
    return NextResponse.json({ error: "Failed to fetch top-up options" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0] ?? "unknown";
  const { allowed } = rateLimit(`topup:${ip}`, RATE_LIMITS.orders);
  if (!allowed) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

  let body: { iccid?: string; packageCode?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { iccid, packageCode } = body;
  if (!iccid || !packageCode) {
    return NextResponse.json({ error: "iccid and packageCode are required" }, { status: 400 });
  }

  try {
    const result = await topupEsim(iccid, packageCode);
    return NextResponse.json({ success: result.success, message: result.summary ?? "Top-up successful" });
  } catch (err) {
    console.error("eSIM topup error:", err);
    const msg = err instanceof Error ? err.message : "Failed to top up eSIM";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
