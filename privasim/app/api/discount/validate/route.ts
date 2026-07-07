import { NextRequest, NextResponse } from "next/server";
import { checkCouponUsable } from "@/lib/discounts";
import { rateLimit } from "@/lib/rateLimit";

// Public validation for the checkout promo field. Tightly rate-limited so
// codes cannot be brute-forced (12-hex HMAC = infeasible anyway).
export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0] ?? "unknown";
  const { allowed } = rateLimit(`discount:${ip}`, { windowMs: 60_000, max: 10 });
  if (!allowed) {
    return NextResponse.json({ error: "Too many attempts — wait a minute" }, { status: 429 });
  }

  let code = "";
  try {
    code = String((await req.json()).code ?? "");
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const check = await checkCouponUsable(code);
  if (!check.valid) {
    return NextResponse.json({ valid: false, reason: check.reason }, { status: 200 });
  }
  return NextResponse.json({ valid: true, percent: check.percent, label: check.label });
}
