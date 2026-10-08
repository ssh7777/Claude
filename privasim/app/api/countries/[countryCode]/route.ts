import { NextRequest, NextResponse } from "next/server";
import { loadCatalog } from "@/lib/pikasim";
import { rateLimit, RATE_LIMITS } from "@/lib/rateLimit";

export const revalidate = 3600;

export async function GET(req: NextRequest, props: { params: Promise<{ countryCode: string }> }) {
  const params = await props.params;
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0] ?? "unknown";
  // Read-only endpoint: degrade to "allow" if the rate-limit store is down.
  const { allowed } = await rateLimit(`search:${ip}`, RATE_LIMITS.search, { failOpen: true });

  if (!allowed) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const countryCode = params.countryCode?.toUpperCase();
  if (!countryCode || countryCode.length !== 2) {
    return NextResponse.json({ error: "Invalid country code" }, { status: 400 });
  }

  // `loadCatalog` never throws: supplier → PostgreSQL snapshot → static snapshot.
  const catalog = await loadCatalog(countryCode);
  const packages = catalog.packages;

  const dataPackages = packages.filter((p) => p.type === "data");
  const phonePackages = packages.filter((p) => p.type === "phone");

  const dataPrices = dataPackages.map((p) => p.priceUsd);
  const phonePrices = phonePackages.map((p) => p.priceUsd);

  return NextResponse.json(
    {
      countryCode,
      stale: catalog.stale,
      source: catalog.source,
      hasData: dataPackages.length > 0,
      hasPhone: phonePackages.length > 0,
      dataEsims: {
        count: dataPackages.length,
        priceRangeMin: dataPrices.length ? Math.min(...dataPrices) : 0,
        priceRangeMax: dataPrices.length ? Math.max(...dataPrices) : 0,
        packages: dataPackages,
      },
      phoneEsims: {
        count: phonePackages.length,
        priceRangeMin: phonePrices.length ? Math.min(...phonePrices) : 0,
        priceRangeMax: phonePrices.length ? Math.max(...phonePrices) : 0,
        packages: phonePackages,
      },
    },
    {
      headers: {
        "Cache-Control": catalog.stale ? "public, s-maxage=300" : "public, s-maxage=3600",
      },
    }
  );
}
