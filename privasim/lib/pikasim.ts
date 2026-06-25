// PikaSim REST API wrapper — SERVER-SIDE ONLY
// This file must NEVER be imported from client components

import type { EsimPackage, ProductType, PikaSimPackage, PikaSimPurchaseResult } from "@/types";

const PIKASIM_BASE = "https://pikasim.com/api";

function getApiKey(): string {
  const key = process.env.PIKASIM_API_KEY;
  if (!key) throw new Error("PIKASIM_API_KEY is not configured");
  return key;
}

async function apiGet<T>(path: string, params?: Record<string, string>): Promise<T> {
  const url = new URL(`${PIKASIM_BASE}${path}`);
  if (params) {
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  }

  const key = process.env.PIKASIM_API_KEY;
  const headers: Record<string, string> = { Accept: "application/json" };
  if (key) headers["X-API-Key"] = key;

  const response = await fetch(url.toString(), {
    method: "GET",
    headers,
    cache: "no-store",
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`PikaSim ${response.status} ${response.statusText}: ${text.slice(0, 300)}`);
  }

  return response.json();
}

async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(`${PIKASIM_BASE}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Accept": "application/json",
      "X-API-Key": getApiKey(),
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`PikaSim ${response.status} ${response.statusText}: ${text.slice(0, 300)}`);
  }

  return response.json();
}

function normalizePikaPackage(pkg: PikaSimPackage): EsimPackage {
  // Price: priceUSD is in dollars; price is in smallest unit (÷10000)
  let priceUsd = 0;
  if (typeof pkg.priceUSD === "number") priceUsd = pkg.priceUSD;
  else if (typeof pkg.priceUsd === "number") priceUsd = pkg.priceUsd;
  else if (typeof pkg.price === "number") priceUsd = pkg.price / 10000;

  // Data amount: prefer volumeGB, fallback to volume bytes, then data string
  let dataAmount = "Unknown";
  if (typeof pkg.volumeGB === "number") {
    dataAmount = pkg.volumeGB >= 1 ? `${pkg.volumeGB} GB` : `${Math.round(pkg.volumeGB * 1024)} MB`;
  } else if (typeof pkg.volume === "number" && pkg.volume > 0) {
    const gb = pkg.volume / 1073741824;
    dataAmount = gb >= 1 ? `${Math.round(gb)} GB` : `${Math.round(gb * 1024)} MB`;
  } else if (pkg.data) {
    dataAmount = pkg.data;
  } else if (pkg.isUnlimited) {
    dataAmount = "Unlimited";
  }

  const country = pkg.location ?? pkg.destination ?? "";
  const countryCode = pkg.locationCode ?? pkg.destinationCode ?? "";
  const durationDays = pkg.duration ?? pkg.validityDays ?? 0;
  const type: ProductType = (pkg.dataType ?? pkg.type) === "phone" ? "phone" : "data";

  return {
    code: pkg.packageCode,
    name: pkg.name ?? pkg.packageName ?? pkg.packageCode,
    country,
    countryCode,
    dataAmount,
    durationDays,
    priceUsd,
    type,
    networks: pkg.networks ?? [],
    smsSupported: pkg.sms,
    voiceSupported: pkg.voice,
    topupAllowed: pkg.topup,
  };
}

export async function searchEsimPackages(
  country?: string,
  type: "data" | "phone" | "all" = "all"
): Promise<EsimPackage[]> {
  const params: Record<string, string> = {};
  if (country) params.country = country.toUpperCase();
  if (type !== "all") params.type = type;

  try {
    const result = await apiGet<{ packages?: PikaSimPackage[] }>(
      "/packages/all-countries",
      params
    );
    let packages = result.packages ?? [];

    // Client-side country filter as fallback if API ignores the param
    if (country) {
      const code = country.toUpperCase();
      packages = packages.filter(
        (p) => (p.locationCode ?? p.destinationCode ?? "").toUpperCase() === code
      );
    }

    // Client-side type filter as fallback
    if (type !== "all") {
      packages = packages.filter((p) => (p.dataType ?? p.type) === type);
    }

    return packages.map(normalizePikaPackage);
  } catch (err) {
    console.error("[PikaSim] searchEsimPackages failed:", err);
    throw err;
  }
}

export async function getPackageDetails(packageCode: string): Promise<EsimPackage | null> {
  // PikaSim doesn't have an individual package endpoint — search all and filter
  try {
    const result = await apiGet<{ packages?: PikaSimPackage[] }>("/packages/all-countries");
    const pkg = (result.packages ?? []).find((p) => p.packageCode === packageCode);
    return pkg ? normalizePikaPackage(pkg) : null;
  } catch {
    return null;
  }
}

export async function checkAgentBalance(): Promise<{ balanceUsd: number }> {
  const result = await apiGet<{ balanceUsd?: number; balance?: number; balance_usd?: number }>(
    "/account/balance"
  );
  return { balanceUsd: result.balanceUsd ?? result.balance_usd ?? result.balance ?? 0 };
}

export async function purchaseEsim(packageCode: string): Promise<PikaSimPurchaseResult> {
  const result = await apiPost<PikaSimPurchaseResult>("/orders", { packageCode });
  if (!result.iccid || !result.activationCode) {
    throw new Error("PikaSim purchase returned incomplete data: " + JSON.stringify(result));
  }
  return result;
}

export async function purchasePhonePlan(packageCode: string): Promise<PikaSimPurchaseResult> {
  return purchaseEsim(packageCode);
}

export async function getEsimStatus(iccid: string): Promise<{
  status: string;
  dataUsedGb: number;
  dataRemainingGb: number;
  expiresAt: string;
}> {
  const result = await apiGet<{
    status?: string;
    dataUsed?: number;
    dataRemaining?: number;
    data_used_gb?: number;
    data_remaining_gb?: number;
    expiresAt?: string;
    expires_at?: string;
  }>(`/orders/${iccid}/status`);

  return {
    status: result.status ?? "unknown",
    dataUsedGb: result.dataUsed ?? result.data_used_gb ?? 0,
    dataRemainingGb: result.dataRemaining ?? result.data_remaining_gb ?? 0,
    expiresAt: result.expiresAt ?? result.expires_at ?? "",
  };
}

export async function topupEsim(iccid: string, packageCode: string): Promise<boolean> {
  await apiPost(`/orders/${iccid}/topup`, { packageCode });
  return true;
}

export async function cancelEsim(iccid: string): Promise<boolean> {
  await apiPost(`/orders/${iccid}/cancel`, {});
  return true;
}

export async function listAgentOrders(page = 1, limit = 50): Promise<unknown[]> {
  const result = await apiGet<{ orders?: unknown[] }>(
    "/orders",
    { page: String(page), limit: String(limit) }
  );
  return result.orders ?? [];
}
