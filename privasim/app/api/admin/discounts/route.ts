import { NextRequest, NextResponse } from "next/server";
import { createDiscountCode, MAX_PERCENT } from "@/lib/discounts";

// Owner-only discount code generator. Same key gate as the other admin
// routes — only someone holding the reseller API key can mint codes.
export async function POST(req: NextRequest) {
  const apiKey = process.env.PIKASIM_API_KEY ?? "";
  const provided = req.headers.get("x-admin-key") ?? "";
  if (!apiKey || provided !== apiKey) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { label?: string; percent?: number; validDays?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const percent = Number(body.percent);
  const validDays = Number(body.validDays ?? 30);
  if (!Number.isFinite(percent) || percent < 1 || percent > MAX_PERCENT) {
    return NextResponse.json({ error: `percent must be 1–${MAX_PERCENT}` }, { status: 400 });
  }

  const code = createDiscountCode(body.label ?? "PROMO", percent, validDays);
  return NextResponse.json({ code, percent: Math.round(percent), validDays: Math.round(validDays) });
}
