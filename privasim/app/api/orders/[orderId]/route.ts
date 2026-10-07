import { NextRequest, NextResponse } from "next/server";
import { getInvoiceById } from "@/lib/db";
import { verifyInvoiceToken } from "@/lib/invoiceToken";

export async function GET(req: NextRequest, props: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await props.params;
  const token = verifyInvoiceToken(req.headers.get("x-invoice-token") ?? "");
  if (!token || token.invoiceId !== orderId) {
    return NextResponse.json({ error: "Invalid invoice credentials" }, { status: 401 });
  }
  const invoice = await getInvoiceById(orderId);
  if (!invoice) return NextResponse.json({ error: "Order not found" }, { status: 404 });

  return NextResponse.json({
    id: invoice.invoice_id,
    packageCode: invoice.package_code,
    packageName: invoice.package_name,
    country: invoice.country,
    countryCode: invoice.country_code,
    dataAmount: invoice.data_amount,
    durationDays: invoice.duration_days,
    status: invoice.status,
    fulfillmentStatus: invoice.fulfillment_status,
    cryptoType: invoice.crypto_type,
    amountUsd: invoice.amount_usd,
    amountCrypto: invoice.amount_crypto,
    paymentAddress: invoice.payment_address,
    expiresAt: invoice.expires_at,
    createdAt: invoice.created_at,
    esimReady: invoice.fulfillment_status === "complete" && !!(invoice.iccid_encrypted && invoice.activation_code_encrypted),
    isTopup: !!invoice.topup_iccid_encrypted,
    topupComplete: !!invoice.topup_iccid_encrypted && invoice.fulfillment_status === "complete",
    esimPurchasedAt: invoice.esim_purchased_at,
  }, { headers: { "Cache-Control": "no-store" } });
}
