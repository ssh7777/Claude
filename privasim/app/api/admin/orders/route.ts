import { NextRequest, NextResponse } from "next/server";
import { listAgentOrders, checkAgentBalance } from "@/lib/pikasim";

// Admin-only: live order history + wallet balance synced from the backend.
// Protected by the PIKASIM_API_KEY (same pattern as the diagnostic routes) —
// only the store owner knows it. Never linked from public pages.

export async function GET(req: NextRequest) {
  const apiKey = process.env.PIKASIM_API_KEY ?? "";
  const provided =
    new URL(req.url).searchParams.get("key") ?? req.headers.get("x-admin-key") ?? "";

  if (!apiKey || provided !== apiKey) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const page = Math.max(1, parseInt(new URL(req.url).searchParams.get("page") ?? "1", 10));

  try {
    const [orders, balance] = await Promise.all([
      listAgentOrders(page, 50),
      checkAgentBalance().catch(() => ({ balanceUsd: -1 })),
    ]);
    return NextResponse.json({
      balanceUsd: balance.balanceUsd,
      orders: orders.orders,
      summary: orders.summary ?? null,
      page,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to sync orders";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
