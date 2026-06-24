import { NextRequest, NextResponse } from "next/server";
import { getPackageDetails } from "@/lib/pikasim";
import { rateLimit, RATE_LIMITS } from "@/lib/rateLimit";

export const revalidate = 3600;

export async function GET(
  req: NextRequest,
  { params }: { params: { packageCode: string } }
) {
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

    return NextResponse.json(pkg, {
      headers: { "Cache-Control": "public, s-maxage=3600" },
    });
  } catch (err) {
    console.error("Package fetch error:", err);
    return NextResponse.json({ error: "Failed to fetch package" }, { status: 500 });
  }
}
