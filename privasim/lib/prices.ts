import type { CryptoPrices } from "@/types";

// ── Retail margin ───────────────────────────────────────────────────────────
// Single source of truth for the markup applied to every wholesale PikaSim
// price before it is shown to users or invoiced. Change it here only.
export const RETAIL_MARGIN = 1.7; // 70% margin

export function retailPrice(wholesaleUsd: number): number {
  return Math.ceil(wholesaleUsd * RETAIL_MARGIN * 100) / 100;
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
