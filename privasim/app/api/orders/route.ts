import { NextRequest, NextResponse } from "next/server";
import { verifyJWT } from "@/lib/auth";
import { getInvoicesByWalletHash } from "@/lib/db";

export async function GET(req: NextRequest) {
  let walletHash: string;
  try {
    const jwt = await verifyJWT(req.headers.get("authorization"));
    walletHash = jwt.walletHash;
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const invoices = await getInvoicesByWalletHash(walletHash);

  const orders = invoices.map((inv) => ({
    id: inv.invoice_id,
    packageCode: inv.package_code,
    packageName: inv.package_name,
    country: inv.country,
    countryCode: inv.country_code,
    dataAmount: inv.data_amount,
    durationDays: inv.duration_days,
    status: inv.status,
    cryptoType: inv.crypto_type,
    amountUsd: inv.amount_usd,
    amountCrypto: inv.amount_crypto,
    paymentAddress: inv.payment_address,
    expiresAt: inv.expires_at,
    createdAt: inv.created_at,
    esimReady: !!(inv.iccid_encrypted && inv.activation_code_encrypted),
  }));

  return NextResponse.json({ orders, total: orders.length });
}
