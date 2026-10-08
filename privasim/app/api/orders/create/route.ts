import { NextRequest, NextResponse } from "next/server";
import { verifyJWT } from "@/lib/auth";
import { getPackageDetails, supplierHealth } from "@/lib/pikasim";
import { generateMoneroPaymentInfo } from "@/lib/monero";
import { generateEthereumPaymentInfo, generateUsdtPaymentInfo } from "@/lib/ethereum";
import { CouponUnavailableError, createInvoiceRecord, isDatabaseConfigured } from "@/lib/db";
import { rateLimit, RateLimitUnavailableError, RATE_LIMITS } from "@/lib/rateLimit";
import { retailPrice } from "@/lib/prices";
import { PriceUnavailableError } from "@/lib/priceFeed";
import { getRetailMargin } from "@/lib/settings";
import { encryptField, generateSecureId } from "@/lib/crypto-utils";
import { createInvoiceToken } from "@/lib/invoiceToken";
import { assertDatabaseReachable, checkConfig } from "@/lib/configCheck";

const PACKAGE_CODE = /^[A-Za-z0-9._-]{1,128}$/;
const ICCID = /^\d{18,22}$/;
const MAX_BODY_BYTES = 16 * 1024;
const CRYPTO_TYPES = ["monero", "ethereum", "usdt_eth", "other"] as const;

type CheckoutCode =
  | "invalid_json"
  | "body_too_large"
  | "invalid_package_code"
  | "unsupported_payment_method"
  | "invalid_iccid"
  | "invalid_discount"
  | "invalid_session"
  | "rate_limited"
  | "captcha_failed"
  | "package_unavailable"
  | "package_not_found"
  | "pricing_unavailable"
  | "payment_address_unavailable"
  | "database_unavailable"
  | "configuration_error"
  | "internal_error";

/** Server-side diagnostic context. Never sent to the browser. */
interface Diagnostics {
  requestId: string;
  stage: string;
  packageCode?: string;
  cryptoType?: string;
  ip?: string;
}

function logFailure(context: Diagnostics, error: unknown, extra: Record<string, unknown> = {}) {
  const message = error instanceof Error ? error.message : "unknown error";
  console.error(
    JSON.stringify({
      level: "error",
      event: "invoice_creation_failed",
      requestId: context.requestId,
      stage: context.stage,
      packageCode: context.packageCode,
      cryptoType: context.cryptoType,
      error: {
        name: error instanceof Error ? error.name : "NonError",
        message,
        reasons: error instanceof PriceUnavailableError ? error.reasons : undefined,
        stack: error instanceof Error ? error.stack?.split("\n").slice(0, 6).join(" | ") : undefined,
      },
      ...extra,
    })
  );
}

function fail(
  context: Diagnostics,
  status: number,
  code: CheckoutCode,
  userMessage: string,
  error?: unknown,
  extra?: Record<string, unknown>
) {
  if (error !== undefined) logFailure(context, error, extra);
  return NextResponse.json({ error: userMessage, code, requestId: context.requestId }, { status });
}

function configFailure(context: Diagnostics, issues: { key: string; message: string }[]) {
  console.error(
    JSON.stringify({
      level: "error",
      event: "checkout_configuration_invalid",
      requestId: context.requestId,
      stage: context.stage,
      missing: issues.map((issue) => issue.key),
      detail: issues.map((issue) => issue.message),
    })
  );
  return NextResponse.json(
    {
      error:
        "Checkout is not fully configured on the server. Nothing has been charged. " +
        "Please contact support and quote this reference.",
      code: "configuration_error" as CheckoutCode,
      requestId: context.requestId,
    },
    { status: 503 }
  );
}

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
      ? (parsed as Record<string, unknown>)
      : null;
  } finally {
    reader.releaseLock();
  }
}

export async function POST(req: NextRequest) {
  const context: Diagnostics = {
    requestId: generateSecureId(),
    stage: "init",
    ip: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown",
  };

  try {
    const contentLength = Number(req.headers.get("content-length") ?? 0);
    if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
      return fail(context, 413, "body_too_large", "Request body too large");
    }

    const authorization = req.headers.get("authorization");
    let walletHash: string;

    if (authorization) {
      try {
        walletHash = (await verifyJWT(authorization)).walletHash;
      } catch (error) {
        return fail(context, 401, "invalid_session", "Invalid wallet session", error);
      }
    } else {
      // A stable per-invoice pseudonymous identifier; throttling remains by IP.
      walletHash = generateSecureId();
    }

    // ── Rate limit ──────────────────────────────────────────────────────────
    context.stage = "rate_limit";
    try {
      const { allowed } = await rateLimit(
        `orders:${authorization ? walletHash : context.ip}`,
        RATE_LIMITS.orders
      );
      if (!allowed) {
        return fail(
          context,
          429,
          "rate_limited",
          "Too many order attempts. Please wait a minute and try again."
        );
      }
    } catch (error) {
      if (error instanceof RateLimitUnavailableError) {
        return fail(
          context,
          503,
          "database_unavailable",
          "Checkout is temporarily unavailable. Please try again in a few minutes.",
          error
        );
      }
      throw error;
    }

    // ── Body ────────────────────────────────────────────────────────────────
    context.stage = "read_body";
    let body: {
      packageCode?: unknown;
      cryptoType?: unknown;
      topupIccid?: unknown;
      discountCode?: unknown;
      captcha?: unknown;
    };
    try {
      const parsedBody = await readJsonBody(req);
      if (!parsedBody) {
        return fail(context, 400, "invalid_json", "Expected a JSON object");
      }
      body = parsedBody as typeof body;
    } catch (error) {
      if (error instanceof Error && error.message === "Request body too large") {
        return fail(context, 413, "body_too_large", "Request body too large");
      }
      return fail(context, 400, "invalid_json", "Invalid JSON", error);
    }

    const packageCode = typeof body.packageCode === "string" ? body.packageCode.trim() : "";
    const cryptoType = typeof body.cryptoType === "string" ? body.cryptoType : "monero";
    const topupIccid = typeof body.topupIccid === "string" ? body.topupIccid.trim() : "";
    const discountCode = typeof body.discountCode === "string" ? body.discountCode.trim() : "";

    context.packageCode = packageCode;
    context.cryptoType = cryptoType;

    if (!PACKAGE_CODE.test(packageCode)) {
      return fail(context, 400, "invalid_package_code", "A valid packageCode is required");
    }
    if (!CRYPTO_TYPES.includes(cryptoType as (typeof CRYPTO_TYPES)[number])) {
      return fail(context, 400, "unsupported_payment_method", "Unsupported payment method");
    }
    if (body.topupIccid !== undefined && !ICCID.test(topupIccid)) {
      return fail(context, 400, "invalid_iccid", "Invalid eSIM ICCID");
    }
    if (discountCode.length > 128) {
      return fail(context, 400, "invalid_discount", "Invalid discount code");
    }

    // ── Proof of work ───────────────────────────────────────────────────────
    context.stage = "captcha";
    try {
      const { verifySolution } = await import("@/lib/captcha");
      if (!verifySolution(body.captcha as Record<string, unknown>)) {
        return fail(
          context,
          400,
          "captcha_failed",
          "Verification failed or expired. Please refresh and retry."
        );
      }
    } catch (error) {
      // Almost always a missing/short JWT_SECRET on the server.
      return configFailure(context, [
        { key: "JWT_SECRET", message: error instanceof Error ? error.message : "captcha misconfigured" },
      ]);
    }

    // ── Preflight: configuration + database ─────────────────────────────────
    context.stage = "preflight";
    const issues = checkConfig({ cryptoType: cryptoType === "other" ? "monero" : cryptoType, topup: Boolean(topupIccid) });
    if (issues.length) return configFailure(context, issues);

    context.stage = "database_probe";
    try {
      await assertDatabaseReachable();
    } catch (error) {
      return fail(
        context,
        503,
        "database_unavailable",
        "Checkout is temporarily unavailable — the order database is not reachable. Please try again shortly.",
        error,
        { databaseConfigured: isDatabaseConfigured() }
      );
    }

    // ── Package / supplier ──────────────────────────────────────────────────
    context.stage = "package_lookup";
    let pkg: Awaited<ReturnType<typeof getPackageDetails>>;
    if (topupIccid) {
      try {
        const { getTopupOptions } = await import("@/lib/pikasim");
        const { options } = await getTopupOptions(topupIccid);
        const option = options.find((item) => item.packageCode === packageCode);
        if (!option || !Number.isFinite(option.priceUsd) || !option.priceUsd || option.priceUsd <= 0) {
          return fail(context, 404, "package_not_found", "Top-up option not available for this eSIM");
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
      } catch (error) {
        return fail(
          context,
          503,
          "package_unavailable",
          "Top-up options are temporarily unavailable. Please try again shortly.",
          error
        );
      }
    } else {
      try {
        pkg = await getPackageDetails(packageCode);
      } catch (error) {
        return fail(
          context,
          503,
          "package_unavailable",
          "The eSIM supplier is temporarily unreachable. Please try again shortly.",
          error
        );
      }
    }

    if (!pkg || !Number.isFinite(pkg.priceUsd) || pkg.priceUsd <= 0) {
      // A null lookup is ambiguous: either the code is unknown, or the supplier
      // is unreachable. Never invoice from a stale catalog price, but say which
      // one it is so the customer knows whether to retry.
      const health = supplierHealth();
      if (health.degraded) {
        return fail(
          context,
          503,
          "package_unavailable",
          "The eSIM supplier is temporarily unreachable, so this plan can't be priced right now. Please try again in a few minutes.",
          undefined,
          { supplierLastError: health.lastError, supplierErrorAgeMs: health.ageMs }
        );
      }
      return fail(context, 404, "package_not_found", "Package not found or has invalid pricing");
    }

    // ── Pricing ─────────────────────────────────────────────────────────────
    context.stage = "pricing";
    let priceUsd: number;
    let appliedDiscount: { label: string; percent: number } | null = null;
    try {
      priceUsd = retailPrice(pkg.priceUsd, await getRetailMargin());
    } catch (error) {
      return fail(
        context,
        503,
        "pricing_unavailable",
        "Unable to price this plan right now. Please try again shortly.",
        error,
        { wholesaleUsd: pkg.priceUsd }
      );
    }

    if (discountCode) {
      context.stage = "discount";
      try {
        const { checkCouponUsable, applyDiscount } = await import("@/lib/discounts");
        const check = await checkCouponUsable(discountCode);
        if (check.valid) {
          priceUsd = applyDiscount(priceUsd, check.percent);
          appliedDiscount = { label: check.label, percent: check.percent };
        }
      } catch (error) {
        return fail(
          context,
          503,
          "internal_error",
          "Discount validation is temporarily unavailable. Please retry without the code, or try again shortly.",
          error
        );
      }
    }

    // ── Payment address + crypto quote ──────────────────────────────────────
    context.stage = "payment_address";
    let paymentInfo: Awaited<ReturnType<typeof generateMoneroPaymentInfo>> |
      Awaited<ReturnType<typeof generateEthereumPaymentInfo>> |
      Awaited<ReturnType<typeof generateUsdtPaymentInfo>>;
    try {
      paymentInfo =
        cryptoType === "monero" || cryptoType === "other"
          ? await generateMoneroPaymentInfo(priceUsd)
          : cryptoType === "usdt_eth"
            ? await generateUsdtPaymentInfo(priceUsd)
            : await generateEthereumPaymentInfo(priceUsd);
    } catch (error) {
      return fail(
        context,
        503,
        error instanceof PriceUnavailableError ? "pricing_unavailable" : "payment_address_unavailable",
        error instanceof PriceUnavailableError
          ? "Live exchange rates are temporarily unavailable, so no invoice was created. Please try again in a few minutes."
          : "We could not generate a payment address for this order. Please try again shortly.",
        error
      );
    }

    const amountCrypto =
      "amountXmr" in paymentInfo
        ? paymentInfo.amountXmr
        : "amountUsdt" in paymentInfo
          ? paymentInfo.amountUsdt
          : paymentInfo.amountEth;
    const expiresAt = new Date(Date.now() + (cryptoType === "other" ? 60 : 15) * 60 * 1000).toISOString();
    const normalizedCryptoType = cryptoType === "other" ? "monero" : cryptoType;
    const anonpayUrl =
      cryptoType === "other"
        ? `https://trocador.app/anonpay/?ticker_to=xmr&network_to=Mainnet&address=${encodeURIComponent(paymentInfo.address)}&amount=${(amountCrypto * 1.02).toFixed(8)}&name=PRIVASIM&description=${paymentInfo.invoiceId}`
        : undefined;

    // ── Persist ─────────────────────────────────────────────────────────────
    context.stage = "persist_invoice";
    const invoiceToken = createInvoiceToken(paymentInfo.invoiceId);
    const topupIccidEncrypted = topupIccid ? await encryptField(topupIccid) : undefined;
    await createInvoiceRecord(
      {
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
      },
      appliedDiscount ? discountCode : undefined
    );

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
        {
          error:
            "This discount code is no longer available. Please restart checkout without it or choose another code.",
          code: "invalid_discount" as CheckoutCode,
          requestId: context.requestId,
        },
        { status: 409 }
      );
    }
    return fail(
      context,
      503,
      "internal_error",
      "Checkout is temporarily unavailable. Please try again later.",
      error
    );
  }
}
