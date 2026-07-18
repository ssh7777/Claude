import { NextRequest, NextResponse } from "next/server";
import { getInvoiceById } from "@/lib/db";

export async function GET(_req: NextRequest, props: { params: Promise<{ orderId: string }> }) {
  const params = await props.params;
  const invoice = await getInvoiceById(params.orderId);
  if (!invoice) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  // Auto-expire invoices past their expiry time
  if (invoice.status === "pending" && new Date(invoice.expires_at) < new Date()) {
    invoice.status = "expired";
  }

  return NextResponse.json({
    status: invoice.status,
    esimReady: !!(invoice.iccid_encrypted && invoice.activation_code_encrypted),
    confirmations: invoice.received_confirmations,
    esimPurchasedAt: invoice.esim_purchased_at,
  });
}
