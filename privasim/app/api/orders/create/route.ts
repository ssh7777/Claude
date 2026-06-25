import { NextRequest, NextResponse } from "next/server";
import { verifyJWT } from "@/lib/auth";
import { getPackageDetails } from "@/lib/pikasim";
import { generateMoneroPaymentInfo } from "@/lib/monero";
import { generateEthereumPaymentInfo } from "@/lib/ethereum";
import { createInvoiceRecord } from "@/lib/db";
import { encryptField } from "@/lib/crypto-utils";
import { rateLimit, RATE_LIMITS } from "@/lib/rateLimit";
import type { CryptoType } from "@/types";

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0] ?? "unknown";

  // JWT is optional — associate with wallet if provided, otherwise anonymous
  let walletHash: string = crypto.randomUUID().replace(/-/g, "");
  try {
    const jwt = await verifyJWT(req.headers.get("authorization"));
    walletHash = jwt.walletHash;
  } catch {
    // Anonymous purchase — rate limit by IP
  }

  const { allowed } = rateLimit(`orders:${walletHash || ip}`, RATE_LIMITS.orders);
  if (!allowed) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  let body: { packageCode?: string; cryptoType?: CryptoType };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { packageCode, cryptoType = "monero" } = body;

  if (!packageCode) {
    return NextResponse.json({ error: "packageCode is required" }, { status: 400 });
  }

  if (!["monero", "ethereum"].includes(cryptoType)) {
    return NextResponse.json({ error: "cryptoType must be 'monero' or 'ethereum'" }, { status: 400 });
  }

  try {
    // Fetch package details to get price
    const pkg = await getPackageDetails(packageCode);
    if (!pkg) {
      return NextResponse.json({ error: "Package not found" }, { status: 404 });
    }

    // Apply 50% markup on all plans
    const markup = 1.50;
    const priceUsd = Math.ceil(pkg.priceUsd * markup * 100) / 100;

    // Generate payment info
    const paymentInfo =
      cryptoType === "monero"
        ? await generateMoneroPaymentInfo(priceUsd)
        : await generateEthereumPaymentInfo(priceUsd);

    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

    // Store invoice (in-memory — no external DB needed)
    await createInvoiceRecord({
      invoice_id: paymentInfo.invoiceId,
      wallet_id_hash: walletHash,
      package_code: packageCode,
      amount_usd: priceUsd,
      amount_crypto: cryptoType === "monero"
        ? (paymentInfo as typeof paymentInfo & { amountXmr: number }).amountXmr
        : (paymentInfo as typeof paymentInfo & { amountEth: number }).amountEth,
      crypto_type: cryptoType,
      payment_address_encrypted: await encryptField(paymentInfo.address),
      expires_at: expiresAt,
    });

    return NextResponse.json({
      invoiceId: paymentInfo.invoiceId,
      packageCode,
      packageName: pkg.name,
      amountUsd: priceUsd,
      amountCrypto:
        cryptoType === "monero"
          ? (paymentInfo as typeof paymentInfo & { amountXmr: number }).amountXmr
          : (paymentInfo as typeof paymentInfo & { amountEth: number }).amountEth,
      cryptoType,
      paymentAddress: paymentInfo.address,
      qrCode: paymentInfo.qrCode,
      paymentUrl: paymentInfo.paymentUrl,
      expiresAt,
    });
  } catch (err) {
    console.error("Order creation failed:", err);
    return NextResponse.json({ error: "Failed to create order" }, { status: 500 });
  }
}
