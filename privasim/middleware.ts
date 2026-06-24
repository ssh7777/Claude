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

export function middleware(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0] ?? "anon";
  const pathname = req.nextUrl.pathname;

  // Block direct access to env files
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

  const response = NextResponse.next();

  // Privacy headers
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("Referrer-Policy", "no-referrer");
  response.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");

  // Remove server-identifying headers
  response.headers.delete("x-powered-by");
  response.headers.delete("server");

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|public/).*)"],
};
