import type { CryptoPrices } from "@/types";

// ── Retail margin ───────────────────────────────────────────────────────────
// RETAIL_MARGIN is the compile-time DEFAULT. The live margin is owner-set in
// the admin dashboard and stored in the ledger — server code reads it via
// getRetailMargin() in lib/settings.ts and passes it in explicitly. This file
// stays ledger-free so client components can import retailPrice safely.
export const RETAIL_MARGIN = 1.7; // 70% default margin

export function retailPrice(wholesaleUsd: number, margin: number = RETAIL_MARGIN): number {
  return Math.ceil(wholesaleUsd * margin * 100) / 100;
}

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

let priceCache: CryptoPrices | null = null;

export async function getCryptoPrices(): Promise<CryptoPrices> {
  if (priceCache && Date.now() - priceCache.updatedAt < CACHE_TTL_MS) {
    return priceCache;
  }

  const apiKey = process.env.COINGECKO_API_KEY;
  const headers: Record<string, string> = { Accept: "application/json" };
  if (apiKey) headers["x-cg-pro-api-key"] = apiKey;

  const url =
    "https://api.coingecko.com/api/v3/simple/price?ids=monero,ethereum&vs_currencies=usd";

  let data: { monero?: { usd?: number }; ethereum?: { usd?: number } };
  try {
    const res = await fetch(url, {
      headers,
      next: { revalidate: 300 },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) throw new Error(`CoinGecko ${res.status}`);
    data = (await res.json()) as typeof data;
  } catch {
    // Fallback: try an alternative free price source
    try {
      const altRes = await fetch(
        "https://api.binance.com/api/v3/ticker/price?symbols=%5B%22ETHUSDT%22,%22XMRUSDT%22%5D",
        { signal: AbortSignal.timeout(5000) }
      );
      if (altRes.ok) {
        const pairs = (await altRes.json()) as { symbol: string; price: string }[];
        const eth = parseFloat(pairs.find((p) => p.symbol === "ETHUSDT")?.price ?? "0");
        const xmr = parseFloat(pairs.find((p) => p.symbol === "XMRUSDT")?.price ?? "0");
        if (eth > 0 && xmr > 0) {
          priceCache = { xmr, eth, updatedAt: Date.now() };
          return priceCache;
        }
      }
    } catch {}
    return priceCache ?? { xmr: 175, eth: 2600, updatedAt: Date.now() };
  }

  priceCache = {
    xmr: data.monero?.usd ?? 175,
    eth: data.ethereum?.usd ?? 3500,
    updatedAt: Date.now(),
  };

  return priceCache;
}

export async function usdToXmr(usd: number): Promise<number> {
  const { xmr } = await getCryptoPrices();
  return usd / xmr;
}

export async function usdToEth(usd: number): Promise<number> {
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
  return amount.toFixed(6) + " XMR";
}

export function formatEth(amount: number): string {
  return amount.toFixed(6) + " ETH";
}
