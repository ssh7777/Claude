import { NextRequest, NextResponse } from "next/server";
import { verifyJWT } from "@/lib/auth";

export async function GET(req: NextRequest) {
  try {
    await verifyJWT(req.headers.get("authorization"));
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json({ orders: [], total: 0 });
}
