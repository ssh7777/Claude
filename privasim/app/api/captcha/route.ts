import { NextRequest, NextResponse } from "next/server";
import { createChallenge } from "@/lib/captcha";
import { rateLimit, RateLimitUnavailableError } from "@/lib/rateLimit";

// Issue a proof-of-work challenge for the checkout. Rate-limited so the
// endpoint itself can't be used to farm challenges.
export async function GET(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0] ?? "unknown";
  try {
    const { allowed } = await rateLimit(`captcha:${ip}`, { windowMs: 60_000, max: 30 });
    if (!allowed) return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  } catch (error) {
    if (error instanceof RateLimitUnavailableError) {
      return NextResponse.json(
        { error: "Checkout is temporarily unavailable. Please try again shortly.", code: "database_unavailable" },
        { status: 503 }
      );
    }
    console.error("[captcha] unexpected rate-limit failure:", error);
    return NextResponse.json(
      { error: "Checkout is temporarily unavailable. Please try again shortly.", code: "internal_error" },
      { status: 503 }
    );
  }

  try {
    return NextResponse.json(createChallenge());
  } catch (error) {
    // Almost always a missing/short JWT_SECRET.
    console.error("[captcha] challenge creation failed:", error instanceof Error ? error.message : error);
    return NextResponse.json(
      { error: "Checkout is not configured on the server. Please contact support.", code: "configuration_error" },
      { status: 503 }
    );
  }
}
