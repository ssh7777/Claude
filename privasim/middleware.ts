import { NextRequest, NextResponse } from "next/server";

const RATE_STORE = new Map<string, { count: number; reset: number }>();

function checkRate(key: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  const entry = RATE_STORE.get(key);
  if (!entry || now > entry.reset) {
    RATE_STORE.set(key, { count: 1, reset: now + windowMs });
    return true;
  }
  if (entry.count >= max) return false;
  entry.count += 1;
  return true;
}

// Privacy-preserving visitor fingerprint: rotating daily hash of IP+UA.
// Raw IP is never stored or logged — only a truncated one-way hash that
// changes every day, enough to count unique visitors in Vercel logs
// without being able to identify anyone.
async function visitorId(ip: string, ua: string): Promise<string> {
  const day = new Date().toISOString().slice(0, 10);
  const data = new TextEncoder().encode(`${ip}|${ua}|${day}|privasim`);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash).slice(0, 6))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// Paths that must never be indexed by search engines
const NOINDEX_PREFIXES = ["/api", "/orders", "/checkout", "/admin", "/esim"];

export async function middleware(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "anon";
  const pathname = req.nextUrl.pathname;

  // Block direct access to env files and VCS paths
  if (pathname.includes(".env") || pathname.includes("/.git")) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  // Global rate limit: 200 req/min per IP
  if (!checkRate(`global:${ip}`, 200, 60_000)) {
    return new NextResponse("Too Many Requests", { status: 429 });
  }

  // Tighter limits on auth endpoints
  if (pathname.startsWith("/api/auth")) {
    if (!checkRate(`auth:${ip}`, 10, 60_000)) {
      return new NextResponse("Too Many Requests", { status: 429 });
    }
  }

  // Webhook endpoints — additional origin check
  if (pathname.startsWith("/api/webhooks")) {
    const origin = req.headers.get("origin");
    // Webhooks come from payment processors, not browsers
    if (origin) {
      return new NextResponse("Forbidden", { status: 403 });
    }
  }

  // Anonymous visitor analytics — page views only, no assets/API noise.
  // Appears in Vercel runtime logs; filter on "visit:" to analyse traffic.
  if (!pathname.startsWith("/api") && !pathname.includes(".")) {
    const ua = req.headers.get("user-agent") ?? "";
    const vid = await visitorId(ip, ua);
    const device = /mobile|iphone|android/i.test(ua) ? "mobile" : "desktop";
    const ref = req.headers.get("referer") ?? "-";
    console.log(`visit: vid=${vid} path=${pathname} device=${device} ref=${ref.slice(0, 80)}`);
  }

  const response = NextResponse.next();

  // Privacy headers
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("Referrer-Policy", "no-referrer");

  // noindex ONLY private paths — public pages MUST be indexable for SEO
  if (NOINDEX_PREFIXES.some((p) => pathname.startsWith(p))) {
    response.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");
  }

  // Remove server-identifying headers
  response.headers.delete("x-powered-by");
  response.headers.delete("server");

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|public/).*)"],
};
