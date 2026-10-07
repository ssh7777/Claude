import { NextRequest, NextResponse } from "next/server";
import { getTopupOptions } from "@/lib/pikasim";
import { rateLimit, RATE_LIMITS } from "@/lib/rateLimit";
import { retailPrice } from "@/lib/prices";
import { getRetailMargin } from "@/lib/settings";

const ICCID = /^\d{18,22}$/;

// GET /api/esim/topup?iccid=… lists the purchasable top-up packages. It never
// performs a supplier-side action; the customer must create and pay an invoice.
export async function GET(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const { allowed } = await rateLimit(`topup-options:${ip}`, RATE_LIMITS.search);
  if (!allowed) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

  const iccid = new URL(req.url).searchParams.get("iccid")?.trim() ?? "";
  if (!ICCID.test(iccid)) {
    return NextResponse.json({ error: "A valid eSIM ICCID is required" }, { status: 400 });
  }

  try {
    const result = await getTopupOptions(iccid);
    const margin = await getRetailMargin();
    return NextResponse.json({
      ...result,
      options: result.options.map((option) => ({
        ...option,
        retailUsd: option.priceUsd != null ? retailPrice(option.priceUsd, margin) : undefined,
      })),
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Top-up options unavailable:", error instanceof Error ? error.message : "unknown error");
    return NextResponse.json({ error: "Failed to fetch top-up options" }, { status: 503 });
  }
}

export async function POST() {
  return NextResponse.json(
    { error: "Direct top-ups are disabled. Create and pay a top-up invoice through /api/orders/create." },
    { status: 410 }
  );
}
