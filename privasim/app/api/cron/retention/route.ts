import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { deleteOldInvoices } from "@/lib/db";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET ?? "";
  const authorization = req.headers.get("authorization") ?? "";
  const expected = Buffer.from(`Bearer ${secret}`);
  const provided = Buffer.from(authorization);
  if (secret.length < 32 || expected.length !== provided.length || !timingSafeEqual(expected, provided)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const deleted = await deleteOldInvoices();
    return NextResponse.json({ ok: true, deleted }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Retention cleanup failed:", error instanceof Error ? error.message : "unknown error");
    return NextResponse.json({ error: "Retention cleanup failed" }, { status: 503 });
  }
}
