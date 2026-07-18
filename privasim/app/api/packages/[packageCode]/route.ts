import { NextRequest, NextResponse } from "next/server";
import { getPackageDetails } from "@/lib/pikasim";
import { rateLimit, RATE_LIMITS } from "@/lib/rateLimit";
import { retailPrice } from "@/lib/prices";
import { getRetailMargin } from "@/lib/settings";

export const revalidate = 300;

export async function GET(req: NextRequest, props: { params: Promise<{ packageCode: string }> }) {
  const params = await props.params;
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0] ?? "unknown";
  const { allowed } = rateLimit(`search:${ip}`, RATE_LIMITS.search);

  if (!allowed) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const { packageCode } = params;
  if (!packageCode) {
    return NextResponse.json({ error: "packageCode is required" }, { status: 400 });
  }

  try {
    const pkg = await getPackageDetails(packageCode);
    if (!pkg) {
      return NextResponse.json({ error: "Package not found" }, { status: 404 });
    }

    // retailUsd is computed HERE with the live owner-set margin so client
    // pages display exactly what the server will invoice. Display-only —
    // the authoritative charge is still computed in /api/orders/create.
    const margin = await getRetailMargin();
    return NextResponse.json(
      { ...pkg, retailUsd: retailPrice(pkg.priceUsd, margin) },
      { headers: { "Cache-Control": "public, s-maxage=300" } }
    );
  } catch (err) {
    console.error("Package fetch error:", err);
    return NextResponse.json({ error: "Failed to fetch package" }, { status: 500 });
  }
}
