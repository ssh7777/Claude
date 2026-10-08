import { NextRequest, NextResponse } from "next/server";
import { loadPackageDetails } from "@/lib/pikasim";
import { rateLimit, RATE_LIMITS } from "@/lib/rateLimit";
import { retailPrice } from "@/lib/prices";
import { getRetailMargin } from "@/lib/settings";

export const revalidate = 300;

export async function GET(req: NextRequest, props: { params: Promise<{ packageCode: string }> }) {
  const params = await props.params;
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0] ?? "unknown";
  // Read-only endpoint: a rate-limit store outage degrades to "allow" instead
  // of taking the whole shop down.
  const { allowed } = await rateLimit(`search:${ip}`, RATE_LIMITS.search, { failOpen: true });

  if (!allowed) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const { packageCode } = params;
  if (!packageCode) {
    return NextResponse.json({ error: "packageCode is required" }, { status: 400 });
  }

  // `loadPackageDetails` falls back to the cached/committed catalog when the
  // supplier is unreachable, and reports `stale` so the client can warn that
  // the displayed price will be re-quoted when the invoice is created.
  const { pkg, stale } = await loadPackageDetails(packageCode);
  if (!pkg) {
    return NextResponse.json({ error: "Package not found" }, { status: 404 });
  }

  // retailUsd is computed HERE with the live owner-set margin so client
  // pages display exactly what the server will invoice. Display-only —
  // the authoritative charge is still computed in /api/orders/create.
  const margin = await getRetailMargin();
  return NextResponse.json(
    { ...pkg, retailUsd: retailPrice(pkg.priceUsd, margin), stale },
    { headers: { "Cache-Control": stale ? "public, s-maxage=60" : "public, s-maxage=300" } }
  );
}
