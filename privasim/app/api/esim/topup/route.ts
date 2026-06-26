import { NextRequest, NextResponse } from "next/server";
import { topupEsim } from "@/lib/pikasim";
import { rateLimit, RATE_LIMITS } from "@/lib/rateLimit";

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
    await topupEsim(iccid, packageCode);
    return NextResponse.json({ success: true, message: "Top-up successful" });
  } catch (err) {
    console.error("eSIM topup error:", err);
    return NextResponse.json({ error: "Failed to top up eSIM" }, { status: 500 });
  }
}
