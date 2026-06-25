import type { CryptoPrices } from "@/types";

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

  const res = await fetch(url, {
    headers,
    next: { revalidate: 300 },
  });

  if (!res.ok) {
    // Fallback to last cached value or hardcoded fallback
    return priceCache ?? { xmr: 175, eth: 3500, updatedAt: Date.now() };
  }

  const data = (await res.json()) as { monero?: { usd?: number }; ethereum?: { usd?: number } };

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
