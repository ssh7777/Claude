import { timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";

export function isAdminRequest(req: NextRequest): boolean {
  const expected = Buffer.from(process.env.ADMIN_API_KEY ?? "", "utf8");
  const provided = Buffer.from(req.headers.get("x-admin-key") ?? "", "utf8");
  if (expected.length < 32 || provided.length !== expected.length) return false;
  return timingSafeEqual(provided, expected);
}
