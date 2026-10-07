import { NextRequest, NextResponse } from "next/server";

const NOINDEX_PREFIXES = ["/api", "/orders", "/checkout", "/admin", "/esim"];

export function proxy(req: NextRequest) {
  const pathname = req.nextUrl.pathname;
  if (pathname.includes(".env") || pathname.includes("/.git")) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const response = NextResponse.next();
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("Referrer-Policy", "no-referrer");
  response.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");

  if (NOINDEX_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    response.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");
  }

  response.headers.delete("x-powered-by");
  response.headers.delete("server");
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|public/).*)"],
};
