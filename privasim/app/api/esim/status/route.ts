import { NextRequest, NextResponse } from "next/server";
import { getEsimStatus } from "@/lib/pikasim";
import { rateLimit, RATE_LIMITS } from "@/lib/rateLimit";

const ICCID = /^\d{18,22}$/;

export async function GET(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const { allowed } = await rateLimit(`esim-status:${ip}`, RATE_LIMITS.search);
  if (!allowed) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

  const iccid = new URL(req.url).searchParams.get("iccid")?.trim() ?? "";
  if (!ICCID.test(iccid)) {
    return NextResponse.json({ error: "A valid eSIM ICCID is required" }, { status: 400 });
  }

  try {
    const status = await getEsimStatus(iccid);
    return NextResponse.json({
      status: String(status.status).slice(0, 64),
      dataUsedGb: Number.isFinite(status.dataUsedGb) ? status.dataUsedGb : 0,
      dataRemainingGb: Number.isFinite(status.dataRemainingGb) ? status.dataRemainingGb : 0,
      expiresAt: String(status.expiresAt ?? "").slice(0, 64),
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("eSIM status lookup failed:", error instanceof Error ? error.message : "unknown error");
    return NextResponse.json({ error: "Failed to fetch eSIM status" }, { status: 503 });
  }
}
