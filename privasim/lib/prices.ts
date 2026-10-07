import type { CryptoPrices } from "@/types";

export const RETAIL_MARGIN = 1.7;

export function retailPrice(wholesaleUsd: number, margin: number = RETAIL_MARGIN): number {
  if (!Number.isFinite(wholesaleUsd) || wholesaleUsd <= 0 || !Number.isFinite(margin) || margin <= 0) {
    throw new Error("Invalid retail pricing inputs");
  }
  return Math.ceil(wholesaleUsd * margin * 100) / 100;
}

const CACHE_TTL_MS = 5 * 60 * 1000;
const MAX_STALE_MS = 15 * 60 * 1000;
let priceCache: CryptoPrices | null = null;

function isPositive(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

async function fetchCoinGecko(): Promise<CryptoPrices> {
  const headers: Record<string, string> = { Accept: "application/json" };
  const apiKey = process.env.COINGECKO_API_KEY?.trim();
  if (apiKey) headers["x-cg-pro-api-key"] = apiKey;
  const res = await fetch(
    "https://api.coingecko.com/api/v3/simple/price?ids=monero,ethereum&vs_currencies=usd",
    { headers, cache: "no-store", signal: AbortSignal.timeout(5_000) }
  );
  if (!res.ok) throw new Error(`CoinGecko returned HTTP ${res.status}`);
  const data = await res.json() as {
    monero?: { usd?: unknown };
    ethereum?: { usd?: unknown };
  };
  if (!isPositive(data.monero?.usd) || !isPositive(data.ethereum?.usd)) {
    throw new Error("CoinGecko returned incomplete exchange rates");
  }
  return { xmr: data.monero.usd, eth: data.ethereum.usd, updatedAt: Date.now() };
}

async function fetchBinanceFallback(): Promise<CryptoPrices> {
  const res = await fetch(
    "https://api.binance.com/api/v3/ticker/price?symbols=%5B%22ETHUSDT%22,%22XMRUSDT%22%5D",
    { cache: "no-store", signal: AbortSignal.timeout(5_000) }
  );
  if (!res.ok) throw new Error(`Secondary price source returned HTTP ${res.status}`);
  const pairs = await res.json() as { symbol?: string; price?: string }[];
  const eth = Number(pairs.find((item) => item.symbol === "ETHUSDT")?.price);
  const xmr = Number(pairs.find((item) => item.symbol === "XMRUSDT")?.price);
  if (!isPositive(eth) || !isPositive(xmr)) throw new Error("Secondary price source returned incomplete rates");
  return { xmr, eth, updatedAt: Date.now() };
}

export async function getCryptoPrices(): Promise<CryptoPrices> {
  if (priceCache && Date.now() - priceCache.updatedAt < CACHE_TTL_MS) return priceCache;

  try {
    priceCache = await fetchCoinGecko();
    return priceCache;
  } catch (primaryError) {
    try {
      priceCache = await fetchBinanceFallback();
      return priceCache;
    } catch {
      if (priceCache && Date.now() - priceCache.updatedAt <= MAX_STALE_MS) return priceCache;
      console.error(
        "No current crypto exchange rate is available:",
        primaryError instanceof Error ? primaryError.message : "unknown error"
      );
      throw new Error("Live crypto pricing is temporarily unavailable; no invoice was created.");
    }
  }
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

export function formatXmr(amount: number): string {
  return amount.toFixed(8) + " XMR";
}

export function formatEth(amount: number): string {
  return amount.toFixed(8) + " ETH";
}
