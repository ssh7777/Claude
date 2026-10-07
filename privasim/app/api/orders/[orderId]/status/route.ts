import { NextRequest, NextResponse } from "next/server";
import { expireInvoiceIfOverdue, getInvoiceById } from "@/lib/db";
import { verifyInvoiceToken } from "@/lib/invoiceToken";

export async function GET(req: NextRequest, props: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await props.params;
  const token = verifyInvoiceToken(req.headers.get("x-invoice-token") ?? "");
  if (!token || token.invoiceId !== orderId) {
    return NextResponse.json({ error: "Invalid invoice credentials" }, { status: 401 });
  }

  await expireInvoiceIfOverdue(orderId);
  const invoice = await getInvoiceById(orderId);
  if (!invoice) return NextResponse.json({ error: "Order not found" }, { status: 404 });

  return NextResponse.json({
    status: invoice.status,
    fulfillmentStatus: invoice.fulfillment_status,
    esimReady: invoice.fulfillment_status === "complete" && !!(invoice.iccid_encrypted && invoice.activation_code_encrypted),
    isTopup: !!invoice.topup_iccid_encrypted,
    topupComplete: !!invoice.topup_iccid_encrypted && invoice.fulfillment_status === "complete",
    confirmations: invoice.received_confirmations,
    esimPurchasedAt: invoice.esim_purchased_at,
  }, { headers: { "Cache-Control": "no-store" } });
}
