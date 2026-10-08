import { NextRequest, NextResponse } from "next/server";
import { assertDatabaseReachable, checkConfig, checkOptionalConfig } from "@/lib/configCheck";
import { peekCryptoPrices } from "@/lib/priceFeed";
import { isSupplierConfigured } from "@/lib/pikasim";
import { isValidEthAddress, isValidMoneroAddress } from "@/lib/configCheck";

export const dynamic = "force-dynamic";

/**
 * Deployment readiness probe.
 *
 * Unauthenticated callers get booleans only — never secret values. Passing the
 * `ADMIN_API_KEY` header additionally runs live probes (database round-trip,
 * supplier reachability, exchange-rate resolution) which are more expensive.
 */
export async function GET(req: NextRequest) {
  const issues = checkConfig();
  const warnings = checkOptionalConfig();

  const base = {
    ok: issues.length === 0,
    env: {
      DATABASE_URL: Boolean(process.env.DATABASE_URL?.trim()),
      JWT_SECRET: (process.env.JWT_SECRET?.length ?? 0) >= 32,
      PAYMENT_HASH_SECRET: (process.env.PAYMENT_HASH_SECRET?.length ?? 0) >= 32,
      DB_ENCRYPTION_KEY: Boolean(process.env.DB_ENCRYPTION_KEY?.trim()),
      COUPON_SIGNING_SECRET: (process.env.COUPON_SIGNING_SECRET?.length ?? 0) >= 32,
      ADMIN_API_KEY: (process.env.ADMIN_API_KEY?.length ?? 0) >= 32,
      CRON_SECRET: (process.env.CRON_SECRET?.length ?? 0) >= 32,
      PIKASIM_API_KEY: isSupplierConfigured(),
      ETHEREUM_WALLET_ADDRESS: isValidEthAddress(process.env.ETHEREUM_WALLET_ADDRESS ?? ""),
      MONERO_WALLET_PRIMARY: isValidMoneroAddress(process.env.MONERO_WALLET_PRIMARY ?? ""),
    },
    blockingIssues: issues.map((issue) => issue.key),
    warnings: warnings.map((issue) => issue.key),
    priceQuoteAgeMs: peekCryptoPrices() ? Date.now() - peekCryptoPrices()!.updatedAt : null,
  };

  // Cheap liveness probe included for everyone: "the env vars are set" and
  // "the database actually answers" are the two things that break checkout.
  try {
    const started = Date.now();
    await assertDatabaseReachable();
    Object.assign(base, { databaseReachable: true, databaseLatencyMs: Date.now() - started });
  } catch (error) {
    Object.assign(base, {
      databaseReachable: false,
      databaseError: error instanceof Error ? error.message : "unknown",
    });
    (base as { ok: boolean }).ok = false;
  }

  const adminKey = req.headers.get("x-admin-key");
  const configuredAdmin = process.env.ADMIN_API_KEY;
  const authorized =
    Boolean(configuredAdmin && adminKey && adminKey.length === configuredAdmin.length) &&
    (() => {
      // Constant-time-ish comparison without pulling in the admin helper.
      let diff = 0;
      for (let i = 0; i < configuredAdmin!.length; i++) {
        diff |= configuredAdmin!.charCodeAt(i) ^ adminKey!.charCodeAt(i);
      }
      return diff === 0;
    })();

  if (!authorized) {
    return NextResponse.json(base, { headers: { "Cache-Control": "no-store" } });
  }

  const probes: Record<string, unknown> = {};

  try {
    const started = Date.now();
    await assertDatabaseReachable();
    probes.database = { ok: true, latencyMs: Date.now() - started };
  } catch (error) {
    probes.database = { ok: false, error: error instanceof Error ? error.message : "unknown" };
  }

  try {
    const { getCryptoPrices } = await import("@/lib/priceFeed");
    const started = Date.now();
    const prices = await getCryptoPrices();
    probes.pricing = {
      ok: true,
      latencyMs: Date.now() - started,
      source: prices.source,
      stale: prices.stale,
      xmr: prices.xmr,
      eth: prices.eth,
    };
  } catch (error) {
    probes.pricing = { ok: false, error: error instanceof Error ? error.message : "unknown" };
  }

  try {
    const { loadCatalog } = await import("@/lib/pikasim");
    const started = Date.now();
    const catalog = await loadCatalog("JP", "data");
    probes.supplier = {
      ok: catalog.source === "supplier",
      latencyMs: Date.now() - started,
      source: catalog.source,
      packages: catalog.packages.length,
    };
  } catch (error) {
    probes.supplier = { ok: false, error: error instanceof Error ? error.message : "unknown" };
  }

  return NextResponse.json(
    { ...base, detail: issues.map((issue) => issue.message), probes },
    { headers: { "Cache-Control": "no-store" } }
  );
}
