// Live XMR / ETH → USD exchange rates. SERVER ONLY.
//
// Kept separate from `lib/prices.ts` because that module is imported by client
// components; anything reachable from here pulls in PostgreSQL.
//
// Resolution order:
//   1. CoinGecko  (Pro key used automatically when COINGECKO_API_KEY is set)
//   2. Kraken     (no geo-restriction, quotes both XMR and ETH)
//   3. Binance    (kept for regions where it is reachable)
//   4. Last known good quote — process cache, then PostgreSQL `app_kv`
//   5. Operator static fallback (FALLBACK_XMR_USD / FALLBACK_ETH_USD)
//
// A single rate-limited provider can therefore never take checkout down.

import type { CryptoPrices, PriceSource } from "@/types";

const FRESH_MS = 5 * 60 * 1000;
const MAX_STALE_MS = 6 * 60 * 60 * 1000;
/** A quote that moved more than this fraction vs. a fresh baseline is rejected. */
const MAX_DRIFT = 0.25;

const PERSISTED_KEY = "price_last_good";

let priceCache: CryptoPrices | null = null;
let inFlight: Promise<CryptoPrices> | null = null;

export class PriceUnavailableError extends Error {
  readonly reasons: string[];
  constructor(reasons: string[]) {
    super(`Live crypto pricing is temporarily unavailable: ${reasons.join(" | ")}`);
    this.name = "PriceUnavailableError";
    this.reasons = reasons;
  }
}

function envMs(name: string, fallback: number): number {
  const raw = Number(process.env[name]);
  return Number.isSafeInteger(raw) && raw >= 1000 ? raw : fallback;
}

function freshWindowMs(): number {
  return envMs("PRICE_FRESH_MS", FRESH_MS);
}

function maxStaleMs(): number {
  return envMs("PRICE_MAX_STALE_MS", MAX_STALE_MS);
}

function isPositive(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : "unknown error";
}

function normalize(source: PriceSource, xmr: unknown, eth: unknown): CryptoPrices {
  if (!isPositive(xmr) || !isPositive(eth)) {
    throw new Error(`${source} returned incomplete exchange rates`);
  }
  return { xmr, eth, updatedAt: Date.now(), source, stale: false };
}

function timedFetch(url: string, init?: RequestInit): Promise<Response> {
  return fetch(url, { cache: "no-store", signal: AbortSignal.timeout(6_000), ...init });
}

// ── Sources ─────────────────────────────────────────────────────────────────

async function fetchCoinGecko(): Promise<CryptoPrices> {
  const base = (process.env.PRICE_COINGECKO_BASE ?? "https://api.coingecko.com/api/v3").replace(/\/+$/, "");
  const headers: Record<string, string> = { Accept: "application/json" };
  const apiKey = process.env.COINGECKO_API_KEY?.trim();
  if (apiKey) {
    // CoinGecko accepts either header depending on the plan; send both so a
    // Pro key lifts the free-tier rate limit without further configuration.
    headers["x-cg-pro-api-key"] = apiKey;
    headers["x-cg-demo-api-key"] = apiKey;
  }
  const res = await timedFetch(`${base}/simple/price?ids=monero,ethereum&vs_currencies=usd`, { headers });
  if (!res.ok) throw new Error(`CoinGecko returned HTTP ${res.status}`);
  const data = (await res.json()) as { monero?: { usd?: unknown }; ethereum?: { usd?: unknown } };
  return normalize("coingecko", data.monero?.usd, data.ethereum?.usd);
}

async function fetchKraken(): Promise<CryptoPrices> {
  const base = (process.env.PRICE_KRAKEN_BASE ?? "https://api.kraken.com/0/public").replace(/\/+$/, "");
  const res = await timedFetch(`${base}/Ticker?pair=XMRUSD,ETHUSD`);
  if (!res.ok) throw new Error(`Kraken returned HTTP ${res.status}`);
  const data = (await res.json()) as {
    error?: string[];
    result?: Record<string, { c?: [string, ...string[]] }>;
  };
  if (data.error?.length) throw new Error(`Kraken error: ${data.error.join(", ")}`);
  const result = data.result ?? {};
  const lastClose = (keys: string[]): number | undefined => {
    for (const key of keys) {
      const close = result[key]?.c?.[0];
      if (close != null) return Number(close);
    }
    return undefined;
  };
  return normalize("kraken", lastClose(["XXMRZUSD", "XMRUSD"]), lastClose(["XETHZUSD", "ETHUSD"]));
}

async function fetchBinance(): Promise<CryptoPrices> {
  const base = (process.env.PRICE_BINANCE_BASE ?? "https://api.binance.com/api/v3").replace(/\/+$/, "");
  const res = await timedFetch(
    `${base}/ticker/price?symbols=${encodeURIComponent(JSON.stringify(["ETHUSDT", "XMRUSDT"]))}`
  );
  if (!res.ok) throw new Error(`Binance returned HTTP ${res.status}`);
  // Binance answers HTTP 200 with an eligibility error body from restricted
  // locations, so the payload must be validated, not just the status code.
  const payload = (await res.json()) as unknown;
  if (!Array.isArray(payload)) {
    const message = (payload as { msg?: string } | null)?.msg;
    throw new Error(`Binance error: ${message ?? "unexpected response"}`);
  }
  const pairs = payload as { symbol?: string; price?: string }[];
  const priceOf = (symbol: string): number | undefined => {
    const found = pairs.find((item) => item.symbol === symbol);
    return found ? Number(found.price) : undefined;
  };
  return normalize("binance", priceOf("XMRUSDT"), priceOf("ETHUSDT"));
}

/** Operator-pinned static rates, used only when every live source and the cache fail. */
function staticFallback(): CryptoPrices | null {
  const xmr = Number(process.env.FALLBACK_XMR_USD);
  const eth = Number(process.env.FALLBACK_ETH_USD);
  if (!isPositive(xmr) || !isPositive(eth)) return null;
  return { xmr, eth, updatedAt: Date.now(), source: "static_fallback", stale: true };
}

const SOURCES: { name: PriceSource; fetch: () => Promise<CryptoPrices> }[] = [
  { name: "coingecko", fetch: fetchCoinGecko },
  { name: "kraken", fetch: fetchKraken },
  { name: "binance", fetch: fetchBinance },
];

// ── Durable shared cache (PostgreSQL) ───────────────────────────────────────

async function readPersisted(): Promise<CryptoPrices | null> {
  if (!process.env.DATABASE_URL?.trim()) return null;
  try {
    const { ledgerGet } = await import("@/lib/ledger");
    const stored = await ledgerGet<CryptoPrices>(PERSISTED_KEY);
    if (!stored) return null;
    if (!isPositive(stored.xmr) || !isPositive(stored.eth) || !Number.isFinite(stored.updatedAt)) {
      return null;
    }
    return stored;
  } catch {
    return null;
  }
}

async function writePersisted(prices: CryptoPrices): Promise<void> {
  if (!process.env.DATABASE_URL?.trim()) return;
  try {
    const { ledgerSet } = await import("@/lib/ledger");
    await ledgerSet(PERSISTED_KEY, prices);
  } catch (error) {
    console.warn("[prices] could not persist last-known-good rate:", describe(error));
  }
}

function usable(cached: CryptoPrices | null, now: number): CryptoPrices | null {
  if (!cached) return null;
  const age = now - cached.updatedAt;
  if (age < 0 || age > maxStaleMs()) return null;
  return { ...cached, stale: age > freshWindowMs() };
}

function withinDrift(candidate: CryptoPrices, baseline: CryptoPrices): boolean {
  const drift = (a: number, b: number) => Math.abs(a - b) / b;
  return drift(candidate.xmr, baseline.xmr) <= MAX_DRIFT && drift(candidate.eth, baseline.eth) <= MAX_DRIFT;
}

async function refresh(): Promise<CryptoPrices> {
  const failures: string[] = [];
  const now = Date.now();

  // Sanity baseline: a quote gathered moments ago. A >25% move inside one
  // freshness window means the provider returned the wrong asset or unit, so
  // that source is skipped rather than invoicing a customer on a bad rate.
  const baselineUsable =
    priceCache && now - priceCache.updatedAt >= 0 && now - priceCache.updatedAt < freshWindowMs()
      ? priceCache
      : null;

  for (const source of SOURCES) {
    try {
      const prices = await source.fetch();
      if (baselineUsable && !withinDrift(prices, baselineUsable)) {
        failures.push(`${source.name}: rejected (drifted >${MAX_DRIFT * 100}% from the last good rate)`);
        continue;
      }
      priceCache = prices;
      // Persist without awaiting so a slow ledger write never delays checkout.
      void writePersisted(prices);
      if (failures.length) {
        console.warn(`[prices] served by ${source.name} after failures: ${failures.join(" | ")}`);
      }
      return prices;
    } catch (error) {
      failures.push(`${source.name}: ${describe(error)}`);
    }
  }

  const candidates = [usable(priceCache, now), usable(await readPersisted(), now)].filter(
    (value): value is CryptoPrices => value !== null
  );
  const cached = candidates.sort((a, b) => b.updatedAt - a.updatedAt)[0];
  if (cached) {
    console.error(
      `[prices] all live sources failed (${failures.join(" | ")}); serving a ` +
        `${Math.round((now - cached.updatedAt) / 60_000)}m-old quote from ${cached.source ?? "cache"}`
    );
    priceCache = cached;
    return cached;
  }

  const fallback = staticFallback();
  if (fallback) {
    console.error(
      `[prices] all live sources failed and no cached quote is usable (${failures.join(" | ")}); ` +
        `using the operator static fallback (XMR=${fallback.xmr}, ETH=${fallback.eth})`
    );
    return fallback;
  }

  throw new PriceUnavailableError(failures);
}

/** Current XMR/ETH → USD rates, resolved through the ladder described above. */
export async function getCryptoPrices(): Promise<CryptoPrices> {
  if (priceCache && Date.now() - priceCache.updatedAt < freshWindowMs()) return priceCache;

  // Single-flight: concurrent callers share one upstream refresh so a burst of
  // serverless invocations cannot amplify into a rate-limit ban.
  if (inFlight) return inFlight;
  inFlight = refresh().finally(() => {
    inFlight = null;
  });
  return inFlight;
}

/** Last quote held in this process, without triggering a network call. */
export function peekCryptoPrices(): CryptoPrices | null {
  return priceCache;
}

export async function usdToXmr(usd: number): Promise<number> {
  if (!Number.isFinite(usd) || usd <= 0) throw new Error("Invalid USD amount");
  const { xmr } = await getCryptoPrices();
  return usd / xmr;
}

export async function usdToEth(usd: number): Promise<number> {
  if (!Number.isFinite(usd) || usd <= 0) throw new Error("Invalid USD amount");
  const { eth } = await getCryptoPrices();
  return usd / eth;
}

export async function convertUsdToCrypto(
  usd: number,
  cryptoType: "monero" | "ethereum"
): Promise<number> {
  if (cryptoType === "monero") return usdToXmr(usd);
  return usdToEth(usd);
}
