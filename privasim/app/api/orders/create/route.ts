import { NextRequest, NextResponse } from "next/server";
import { verifyJWT } from "@/lib/auth";
import { getPackageDetails } from "@/lib/pikasim";
import { generateMoneroPaymentInfo } from "@/lib/monero";
import { generateEthereumPaymentInfo, generateUsdtPaymentInfo } from "@/lib/ethereum";
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

  let body: {
    packageCode?: string;
    cryptoType?: string;
    topupIccid?: string;
    discountCode?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { packageCode, cryptoType = "monero", topupIccid, discountCode } = body;

  if (!packageCode) {
    return NextResponse.json({ error: "packageCode is required" }, { status: 400 });
  }

  // "other" = 100+ coins via AnonPay swap → settles as XMR to our wallet
  if (!["monero", "ethereum", "usdt_eth", "other"].includes(cryptoType)) {
    return NextResponse.json(
      { error: "cryptoType must be 'monero', 'ethereum', 'usdt_eth' or 'other'" },
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

    // Discount codes: verified and applied SERVER-SIDE only — the client
    // never controls the price. Forged/expired codes are simply ignored.
    let priceUsd = retailPrice(pkg.priceUsd);
    let appliedDiscount: { label: string; percent: number } | null = null;
    if (discountCode) {
      const { verifyDiscountCode, applyDiscount } = await import("@/lib/discounts");
      const check = verifyDiscountCode(discountCode);
      if (check.valid) {
        priceUsd = applyDiscount(priceUsd, check.percent);
        appliedDiscount = { label: check.label, percent: check.percent };
      }
    }

    // "other" (100+ coins via AnonPay) settles as XMR → use the Monero invoice
    const paymentInfo =
      cryptoType === "monero" || cryptoType === "other"
        ? await generateMoneroPaymentInfo(priceUsd)
        : cryptoType === "usdt_eth"
          ? await generateUsdtPaymentInfo(priceUsd)
          : await generateEthereumPaymentInfo(priceUsd);

    const expiresAt = new Date(
      Date.now() + (cryptoType === "other" ? 60 : 15) * 60 * 1000
    ).toISOString();

    const amountCrypto =
      cryptoType === "monero" || cryptoType === "other"
        ? (paymentInfo as { amountXmr: number }).amountXmr
        : cryptoType === "usdt_eth"
          ? (paymentInfo as { amountUsdt: number }).amountUsdt
          : (paymentInfo as { amountEth: number }).amountEth;

    // AnonPay checkout link: buyer pays in BTC/LTC/100+ coins, Trocador swaps
    // and delivers XMR to our wallet. No registration, no API key.
    const anonpayUrl =
      cryptoType === "other"
        ? `https://trocador.app/anonpay/?ticker_to=xmr&network_to=Mainnet&address=${encodeURIComponent(paymentInfo.address)}&amount=${(amountCrypto * 1.02).toFixed(6)}&name=PRIVASIM&description=${paymentInfo.invoiceId}`
        : undefined;

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
      crypto_type: cryptoType === "other" ? "monero" : cryptoType,
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
      anonpayUrl,
      discount: appliedDiscount,
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
