import { NextRequest, NextResponse } from "next/server";
import { verifyJWT } from "@/lib/auth";
import { getOrdersByWalletHash } from "@/lib/db";

export async function GET(req: NextRequest) {
  let jwt;
  try {
    jwt = await verifyJWT(req.headers.get("authorization"));
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const orders = await getOrdersByWalletHash(jwt.walletHash);
    return NextResponse.json({ orders, total: orders.length });
  } catch (err) {
    console.error("Orders fetch error:", err);
    return NextResponse.json({ error: "Failed to fetch orders" }, { status: 500 });
  }
}
