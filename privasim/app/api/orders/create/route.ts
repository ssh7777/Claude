import { NextRequest, NextResponse } from "next/server";
import { verifyJWT } from "@/lib/auth";
import { getPackageDetails } from "@/lib/pikasim";
import { generateMoneroPaymentInfo } from "@/lib/monero";
import { generateEthereumPaymentInfo, generateUsdtPaymentInfo } from "@/lib/ethereum";
import { CouponUnavailableError, createInvoiceRecord } from "@/lib/db";
import { rateLimit, RATE_LIMITS } from "@/lib/rateLimit";
import { retailPrice } from "@/lib/prices";
import { getRetailMargin } from "@/lib/settings";
import { encryptField, generateSecureId } from "@/lib/crypto-utils";
import { createInvoiceToken } from "@/lib/invoiceToken";


const PACKAGE_CODE = /^[A-Za-z0-9._-]{1,128}$/;
const ICCID = /^\d{18,22}$/;
const MAX_BODY_BYTES = 16 * 1024;

async function readJsonBody(req: NextRequest): Promise<Record<string, unknown> | null> {
  const reader = req.body?.getReader();
  if (!reader) return null;
  const decoder = new TextDecoder();
  let raw = "";
  let totalBytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalBytes += value.byteLength;
      if (totalBytes > MAX_BODY_BYTES) {
        await reader.cancel();
        throw new Error("Request body too large");
      }
      raw += decoder.decode(value, { stream: true });
    }
    raw += decoder.decode();
    const parsed: unknown = JSON.parse(raw);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : null;
  } finally {
    reader.releaseLock();
  }
}

export async function POST(req: NextRequest) {
  const contentLength = Number(req.headers.get("content-length") ?? 0);
  if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
    return NextResponse.json({ error: "Request body too large" }, { status: 413 });
  }
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const authorization = req.headers.get("authorization");
  let walletHash: string;

  if (authorization) {
    try {
      walletHash = (await verifyJWT(authorization)).walletHash;
    } catch {
      return NextResponse.json({ error: "Invalid wallet session" }, { status: 401 });
    }
  } else {
    // A stable per-invoice pseudonymous identifier; throttling remains by IP.
    walletHash = generateSecureId();
  }

  const { allowed } = await rateLimit(
    `orders:${authorization ? walletHash : ip}`,
    RATE_LIMITS.orders
  );
  if (!allowed) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

  let body: {
    packageCode?: unknown;
    cryptoType?: unknown;
    topupIccid?: unknown;
    discountCode?: unknown;
    captcha?: unknown;
  };
  try {
    const parsedBody = await readJsonBody(req);
    if (!parsedBody) return NextResponse.json({ error: "Expected a JSON object" }, { status: 400 });
    body = parsedBody as typeof body;
  } catch (error) {
    if (error instanceof Error && error.message === "Request body too large") {
      return NextResponse.json({ error: "Request body too large" }, { status: 413 });
    }
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { verifySolution } = await import("@/lib/captcha");
  if (!verifySolution(body.captcha as Record<string, unknown>)) {
    return NextResponse.json({ error: "Verification failed or expired. Please retry." }, { status: 400 });
  }

  const packageCode = typeof body.packageCode === "string" ? body.packageCode.trim() : "";
  const cryptoType = typeof body.cryptoType === "string" ? body.cryptoType : "monero";
  const topupIccid = typeof body.topupIccid === "string" ? body.topupIccid.trim() : "";
  const discountCode = typeof body.discountCode === "string" ? body.discountCode.trim() : "";

  if (!PACKAGE_CODE.test(packageCode)) {
    return NextResponse.json({ error: "A valid packageCode is required" }, { status: 400 });
  }
  if (!("monero,ethereum,usdt_eth,other".split(",")).includes(cryptoType)) {
    return NextResponse.json({ error: "Unsupported payment method" }, { status: 400 });
  }
  if (body.topupIccid !== undefined && !ICCID.test(topupIccid)) {
    return NextResponse.json({ error: "Invalid eSIM ICCID" }, { status: 400 });
  }
  if (discountCode.length > 128) {
    return NextResponse.json({ error: "Invalid discount code" }, { status: 400 });
  }

  try {
    let pkg: Awaited<ReturnType<typeof getPackageDetails>>;
    if (topupIccid) {
      const { getTopupOptions } = await import("@/lib/pikasim");
      const { options } = await getTopupOptions(topupIccid);
      const option = options.find((item) => item.packageCode === packageCode);
      if (!option || !Number.isFinite(option.priceUsd) || !option.priceUsd || option.priceUsd <= 0) {
        return NextResponse.json({ error: "Top-up option not available for this eSIM" }, { status: 404 });
      }
      pkg = {
        code: option.packageCode,
        name: `Top-up: ${option.name ?? option.packageCode}`,
        country: "Top-up",
        countryCode: "",
        dataAmount: option.name?.split("·")[0]?.trim() ?? "",
        durationDays: 0,
        priceUsd: option.priceUsd,
        type: "data",
        networks: [],
      };
    } else {
      pkg = await getPackageDetails(packageCode);
    }
    if (!pkg || !Number.isFinite(pkg.priceUsd) || pkg.priceUsd <= 0) {
      return NextResponse.json({ error: "Package not found or has invalid pricing" }, { status: 404 });
    }

    let priceUsd = retailPrice(pkg.priceUsd, await getRetailMargin());
    let appliedDiscount: { label: string; percent: number } | null = null;
    if (discountCode) {
      const { checkCouponUsable, applyDiscount } = await import("@/lib/discounts");
      const check = await checkCouponUsable(discountCode);
      if (check.valid) {
        priceUsd = applyDiscount(priceUsd, check.percent);
        appliedDiscount = { label: check.label, percent: check.percent };
      }
    }

    const paymentInfo =
      cryptoType === "monero" || cryptoType === "other"
        ? await generateMoneroPaymentInfo(priceUsd)
        : cryptoType === "usdt_eth"
          ? await generateUsdtPaymentInfo(priceUsd)
          : await generateEthereumPaymentInfo(priceUsd);

    const amountCrypto = "amountXmr" in paymentInfo
      ? paymentInfo.amountXmr
      : "amountUsdt" in paymentInfo
        ? paymentInfo.amountUsdt
        : paymentInfo.amountEth;
    const expiresAt = new Date(Date.now() + (cryptoType === "other" ? 60 : 15) * 60 * 1000).toISOString();
    const normalizedCryptoType = cryptoType === "other" ? "monero" : cryptoType;
    const anonpayUrl = cryptoType === "other"
      ? `https://trocador.app/anonpay/?ticker_to=xmr&network_to=Mainnet&address=${encodeURIComponent(paymentInfo.address)}&amount=${(amountCrypto * 1.02).toFixed(8)}&name=PRIVASIM&description=${paymentInfo.invoiceId}`
      : undefined;

    const invoiceToken = createInvoiceToken(paymentInfo.invoiceId);
    const topupIccidEncrypted = topupIccid ? await encryptField(topupIccid) : undefined;
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
      crypto_type: normalizedCryptoType,
      payment_address: paymentInfo.address,
      expires_at: expiresAt,
      topup_iccid_encrypted: topupIccidEncrypted,
      monero_subaddress_index: "subaddressIndex" in paymentInfo ? paymentInfo.subaddressIndex : undefined,
      monero_account_index: "accountIndex" in paymentInfo ? paymentInfo.accountIndex : undefined,
    }, appliedDiscount ? discountCode : undefined);

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
      invoiceToken,
    });
  } catch (error) {
    if (error instanceof CouponUnavailableError) {
      return NextResponse.json(
        { error: "This discount code is no longer available. Please restart checkout without it or choose another code." },
        { status: 409 }
      );
    }
    console.error("Invoice creation failed:", error instanceof Error ? error.message : "unknown error");
    return NextResponse.json(
      { error: "Checkout is temporarily unavailable. Please try again later." },
      { status: 503 }
    );
  }
}
