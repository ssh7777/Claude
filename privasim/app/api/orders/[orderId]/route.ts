import { NextRequest, NextResponse } from "next/server";
import { getInvoiceById } from "@/lib/db";

// Invoice ID is a secret — anyone with it can view their order status.
// No wallet/JWT required since there's no email or identity to steal.
export async function GET(
  _req: NextRequest,
  { params }: { params: { orderId: string } }
) {
  const invoice = await getInvoiceById(params.orderId);
  if (!invoice) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  return NextResponse.json({
    id: invoice.invoice_id,
    packageCode: invoice.package_code,
    packageName: invoice.package_name,
    country: invoice.country,
    countryCode: invoice.country_code,
    dataAmount: invoice.data_amount,
    durationDays: invoice.duration_days,
    status: invoice.status,
    cryptoType: invoice.crypto_type,
    amountUsd: invoice.amount_usd,
    amountCrypto: invoice.amount_crypto,
    paymentAddress: invoice.payment_address,
    expiresAt: invoice.expires_at,
    createdAt: invoice.created_at,
    esimReady: !!(invoice.iccid_encrypted && invoice.activation_code_encrypted),
    smDpAddress: invoice.sm_dp_address,
    esimPurchasedAt: invoice.esim_purchased_at,
  });
}
