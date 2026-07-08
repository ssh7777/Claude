import { NextRequest, NextResponse } from "next/server";
import { recordEvent } from "@/lib/analytics";
import { rateLimit } from "@/lib/rateLimit";

// Lightweight analytics beacon. The client posts { source, type } on first
// visit / checkout start. No PII is stored — only aggregate source counters.
export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0] ?? "unknown";
  const { allowed } = rateLimit(`track:${ip}`, { windowMs: 60_000, max: 30 });
  if (!allowed) return NextResponse.json({ ok: false }, { status: 429 });

  let body: { source?: string; type?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const type = body.type === "checkout" ? "checkout" : "visit";
  // Prefer explicit utm_source; fall back to referrer host
  const source = body.source || req.headers.get("referer") || "direct";

  // Fire and forget — never block the user
  recordEvent(source, type).catch(() => {});
  return NextResponse.json({ ok: true });
}
