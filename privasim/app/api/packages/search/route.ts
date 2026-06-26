import { NextRequest, NextResponse } from "next/server";
import { searchEsimPackages } from "@/lib/pikasim";
import { rateLimit, RATE_LIMITS } from "@/lib/rateLimit";

export const revalidate = 300;

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
    return NextResponse.json(
      { error: "type must be 'data', 'phone', or 'all'" },
      { status: 400 }
    );
  }

  try {
    const packages = await searchEsimPackages(country, type);

    return NextResponse.json(
      {
        packages,
        dataEsims: packages.filter((p) => p.type === "data"),
        phoneEsims: packages.filter((p) => p.type === "phone"),
        total: packages.length,
      },
      {
        headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" },
      }
    );
  } catch (err) {
    console.error("Package search error:", err);
    return NextResponse.json({ error: "Failed to fetch packages" }, { status: 500 });
  }
}
