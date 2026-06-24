import { NextRequest, NextResponse } from "next/server";
import { searchEsimPackages } from "@/lib/pikasim";
import { queryPackageCache, upsertPackageCache } from "@/lib/db";
import { rateLimit, RATE_LIMITS } from "@/lib/rateLimit";

export const revalidate = 3600; // 1 hour ISR

export async function GET(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0] ?? "unknown";
  const { allowed } = rateLimit(`search:${ip}`, RATE_LIMITS.search);

  if (!allowed) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const { searchParams } = new URL(req.url);
  const country = searchParams.get("country")?.toUpperCase();
  const type = (searchParams.get("type") ?? "all") as "data" | "phone" | "all";

  if (type !== "all" && type !== "data" && type !== "phone") {
    return NextResponse.json({ error: "type must be 'data', 'phone', or 'all'" }, { status: 400 });
  }

  try {
    // Check cache first
    if (country) {
      const cached = await queryPackageCache(country, type === "all" ? undefined : type);
      if (cached && cached.length > 0) {
        return NextResponse.json(
          {
            packages: cached.map((p) => ({
              code: p.package_code,
              name: p.package_name,
              country,
              countryCode: country,
              dataAmount: p.data_amount,
              priceUsd: p.price_usd,
              type: p.product_type,
              networks: p.networks,
            })),
            cached: true,
          },
          {
            headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" },
          }
        );
      }
    }

    // Fetch from PikaSim
    const packages = await searchEsimPackages(country, type);

    // Cache the results for future requests
    if (country && packages.length > 0) {
      await upsertPackageCache(
        packages.map((p) => ({
          country_code: country,
          product_type: p.type,
          package_code: p.code,
          package_name: p.name,
          data_amount: p.dataAmount,
          price_usd: p.priceUsd,
          networks: p.networks,
        }))
      );
    }

    const response = {
      packages,
      dataEsims: packages.filter((p) => p.type === "data"),
      phoneEsims: packages.filter((p) => p.type === "phone"),
      total: packages.length,
    };

    return NextResponse.json(response, {
      headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" },
    });
  } catch (err) {
    console.error("Package search error:", err);
    return NextResponse.json({ error: "Failed to fetch packages" }, { status: 500 });
  }
}
