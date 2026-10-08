import { NextRequest, NextResponse } from "next/server";
import { loadCatalog } from "@/lib/pikasim";
import { rateLimit, RATE_LIMITS } from "@/lib/rateLimit";

export const revalidate = 300;

export async function GET(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0] ?? "unknown";
  // Read-only endpoint: degrade to "allow" if the rate-limit store is down.
  const { allowed } = await rateLimit(`search:${ip}`, RATE_LIMITS.search, { failOpen: true });

  if (!allowed) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const { searchParams } = new URL(req.url);
  const country = searchParams.get("country")?.toUpperCase() ?? undefined;
  const type = (searchParams.get("type") ?? "all") as "data" | "phone" | "all";

  if (type !== "all" && type !== "data" && type !== "phone") {
    return NextResponse.json(
      { error: "type must be 'data', 'phone', or 'all'" },
      { status: 400 }
    );
  }

  // `loadCatalog` never throws: supplier -> PostgreSQL snapshot -> static snapshot.
  const catalog = await loadCatalog(country, type);
  const packages = catalog.packages;

  return NextResponse.json(
    {
      packages,
      dataEsims: packages.filter((p) => p.type === "data"),
      phoneEsims: packages.filter((p) => p.type === "phone"),
      total: packages.length,
      stale: catalog.stale,
      source: catalog.source,
    },
    {
      headers: {
        "Cache-Control": catalog.stale
          ? "public, s-maxage=60, stale-while-revalidate=600"
          : "public, s-maxage=300, stale-while-revalidate=600",
      },
    }
  );
}
