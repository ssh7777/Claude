import { NextRequest, NextResponse } from "next/server";
import { verifyJWT } from "@/lib/auth";
import { getOrderById } from "@/lib/db";
import { getEsimStatus } from "@/lib/pikasim";
import { decryptField } from "@/lib/crypto-utils";
import { supabaseAdmin } from "@/lib/db";

export async function GET(
  req: NextRequest,
  { params }: { params: { orderId: string } }
) {
  let jwt;
  try {
    jwt = await verifyJWT(req.headers.get("authorization"));
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const order = await getOrderById(params.orderId, jwt.walletHash);
  if (!order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  // Optionally refresh status from PikaSim
  if (order.status === "completed" || order.status === "activated") {
    try {
      const iccid = await decryptField(order.iccid_encrypted);
      const status = await getEsimStatus(iccid);

      // Update usage data
      await supabaseAdmin
        .from("orders")
        .update({
          data_used_gb: status.dataUsedGb,
          data_remaining_gb: status.dataRemainingGb,
          status: status.status === "expired" ? "expired" : order.status,
        })
        .eq("id", params.orderId);

      return NextResponse.json({
        ...order,
        data_used_gb: status.dataUsedGb,
        data_remaining_gb: status.dataRemainingGb,
      });
    } catch {
      // Return cached data if PikaSim is unavailable
    }
  }

  return NextResponse.json(order);
}
