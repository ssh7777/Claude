import { NextRequest, NextResponse } from "next/server";
import { verifyJWT } from "@/lib/auth";
import { getPackageDetails } from "@/lib/pikasim";
import { generateMoneroPaymentInfo } from "@/lib/monero";
import { generateEthereumPaymentInfo } from "@/lib/ethereum";
import { createInvoiceRecord } from "@/lib/db";
import { rateLimit, RATE_LIMITS } from "@/lib/rateLimit";
import { retailPrice } from "@/lib/prices";
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

  let body: { packageCode?: string; cryptoType?: CryptoType; topupIccid?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { packageCode, cryptoType = "monero", topupIccid } = body;

  if (!packageCode) {
    return NextResponse.json({ error: "packageCode is required" }, { status: 400 });
  }

  if (!["monero", "ethereum"].includes(cryptoType)) {
    return NextResponse.json(
      { error: "cryptoType must be 'monero' or 'ethereum'" },
      { status: 400 }
    );
  }

  try {
    // Top-up invoices: price comes from the eSIM's own top-up options
    // (top-up codes differ from purchase codes and aren't in the catalog).
    let pkg: Awaited<ReturnType<typeof getPackageDetails>>;
    if (topupIccid) {
      const { getTopupOptions } = await import("@/lib/pikasim");
      const { options } = await getTopupOptions(topupIccid);
      const opt = options.find((o) => o.packageCode === packageCode);
      if (!opt || !opt.priceUsd) {
        return NextResponse.json(
          { error: "Top-up option not available for this eSIM" },
          { status: 404 }
        );
      }
      pkg = {
        code: opt.packageCode,
        name: `Top-up: ${opt.name ?? opt.packageCode}`,
        country: "Top-up",
        countryCode: "",
        dataAmount: opt.name?.split("·")[0]?.trim() ?? "",
        durationDays: 0,
        priceUsd: opt.priceUsd,
        type: "data",
        networks: [],
      };
    } else {
      pkg = await getPackageDetails(packageCode);
    }
    if (!pkg) {
      return NextResponse.json({ error: "Package not found" }, { status: 404 });
    }

    const priceUsd = retailPrice(pkg.priceUsd);

    const paymentInfo =
      cryptoType === "monero"
        ? await generateMoneroPaymentInfo(priceUsd)
        : await generateEthereumPaymentInfo(priceUsd);

    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

    const amountCrypto =
      cryptoType === "monero"
        ? (paymentInfo as { amountXmr: number }).amountXmr
        : (paymentInfo as { amountEth: number }).amountEth;

    // Store invoice with package metadata for orders page display.
    // Payment address is stored plaintext — it's already shown to the user in the QR code.
    await createInvoiceRecord({
      invoice_id: paymentInfo.invoiceId,
      wallet_id_hash: walletHash,
      package_code: packageCode,
      package_name: pkg.name,
      country: pkg.country,
      country_code: pkg.countryCode,
      data_amount: pkg.dataAmount,
      duration_days: pkg.durationDays,
      amount_usd: priceUsd,
      amount_crypto: amountCrypto,
      crypto_type: cryptoType,
      payment_address: paymentInfo.address,
      expires_at: expiresAt,
      topup_iccid: topupIccid,
    });

    return NextResponse.json({
      invoiceId: paymentInfo.invoiceId,
      packageCode,
      packageName: pkg.name,
      country: pkg.country,
      countryCode: pkg.countryCode,
      dataAmount: pkg.dataAmount,
      durationDays: pkg.durationDays,
      amountUsd: priceUsd,
      amountCrypto,
      cryptoType,
      paymentAddress: paymentInfo.address,
      qrCode: paymentInfo.qrCode,
      paymentUrl: paymentInfo.paymentUrl,
      expiresAt,
    });
  } catch (err) {
    console.error("Order creation failed:", err);
    const msg =
      err instanceof Error
        ? `${err.name}: ${err.message}`
        : typeof err === "string"
          ? err
          : JSON.stringify(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
