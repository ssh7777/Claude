import { NextRequest, NextResponse } from "next/server";
import { checkCountryCoverage, searchEsimPackages } from "@/lib/pikasim";
import { rateLimit, RATE_LIMITS } from "@/lib/rateLimit";

export const revalidate = 3600;

export async function GET(
  req: NextRequest,
  { params }: { params: { countryCode: string } }
) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0] ?? "unknown";
  const { allowed } = rateLimit(`search:${ip}`, RATE_LIMITS.search);

  if (!allowed) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const countryCode = params.countryCode?.toUpperCase();
  if (!countryCode || countryCode.length !== 2) {
    return NextResponse.json({ error: "Invalid country code" }, { status: 400 });
  }

  try {
    const [coverage, packages] = await Promise.all([
      checkCountryCoverage(countryCode),
      searchEsimPackages(countryCode),
    ]);

    const dataPackages = packages.filter((p) => p.type === "data");
    const phonePackages = packages.filter((p) => p.type === "phone");

    const dataPrices = dataPackages.map((p) => p.priceUsd);
    const phonePrices = phonePackages.map((p) => p.priceUsd);

    return NextResponse.json(
      {
        countryCode,
        hasData: coverage.hasData,
        hasPhone: coverage.hasPhone,
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
        headers: { "Cache-Control": "public, s-maxage=3600" },
      }
    );
  } catch (err) {
    console.error("Country fetch error:", err);
    return NextResponse.json({ error: "Failed to fetch country data" }, { status: 500 });
  }
}
