import { NextRequest, NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/adminAuth";
import { listAgentOrders, checkAgentBalance } from "@/lib/pikasim";

export async function GET(req: NextRequest) {
  if (!isAdminRequest(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const requestedPage = Number.parseInt(new URL(req.url).searchParams.get("page") ?? "1", 10);
  const page = Number.isSafeInteger(requestedPage) ? Math.min(100_000, Math.max(1, requestedPage)) : 1;
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
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Admin supplier sync failed:", error instanceof Error ? error.message : "unknown error");
    return NextResponse.json({ error: "Supplier service is temporarily unavailable" }, { status: 502 });
  }
}
