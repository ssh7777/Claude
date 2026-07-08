import { NextRequest, NextResponse } from "next/server";
import { createChallenge } from "@/lib/captcha";
import { rateLimit } from "@/lib/rateLimit";

// Issue a proof-of-work challenge for the checkout. Rate-limited so the
// endpoint itself can't be used to farm challenges.
export async function GET(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0] ?? "unknown";
  const { allowed } = rateLimit(`captcha:${ip}`, { windowMs: 60_000, max: 30 });
  if (!allowed) return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  return NextResponse.json(createChallenge());
}
