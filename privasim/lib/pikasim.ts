// PikaSim MCP API wrapper — SERVER-SIDE ONLY
// This file must NEVER be imported from client components

import type { EsimPackage, PikaSimPackage, PikaSimPurchaseResult } from "@/types";

const PIKASIM_ENDPOINT = "https://pikasim.com/mcp";

function getApiKey(): string {
  const key = process.env.PIKASIM_API_KEY;
  if (!key) throw new Error("PIKASIM_API_KEY is not configured");
  return key;
}

async function callMCP(
  toolName: string,
  args: Record<string, unknown>,
  requiresAuth: boolean = false
): Promise<unknown> {
  const body = {
    jsonrpc: "2.0",
    id: Date.now(),
    method: "tools/call",
    params: { name: toolName, arguments: args },
  };

  // Always send API key — PikaSim requires auth on all endpoints
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${getApiKey()}`,
  };

  void requiresAuth; // kept for call-site clarity

  const response = await fetch(PIKASIM_ENDPOINT, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`PikaSim API error: ${response.status} ${response.statusText}`);
  }

  const json = await response.json();

  if (json.error) {
    throw new Error(`PikaSim tool error: ${json.error.message || JSON.stringify(json.error)}`);
  }

  return json.result ?? json;
}

function normalizePikaPackage(pkg: PikaSimPackage): EsimPackage {
  const dataNum = parseFloat(pkg.data) || 0;
  return {
    code: pkg.packageCode,
    name: pkg.packageName,
    country: pkg.destination,
    countryCode: pkg.destinationCode,
    dataAmount: pkg.data,
    durationDays: pkg.duration,
    priceUsd: pkg.price,
    type: pkg.type === "phone" ? "phone" : "data",
    networks: pkg.networks ?? [],
    smsSupported: pkg.sms,
    voiceSupported: pkg.voice,
    topupAllowed: pkg.topup,
  };
}

// Public tools — no auth required

export async function searchEsimPackages(
  country?: string,
  type: "data" | "phone" | "all" = "all"
): Promise<EsimPackage[]> {
  const args: Record<string, unknown> = {};
  if (country) args.country = country.toUpperCase();
  if (type !== "all") args.type = type;

  const result = await callMCP("search_esim_packages", args) as { packages?: PikaSimPackage[] };
  return (result.packages ?? []).map(normalizePikaPackage);
}

export async function searchPhonePlans(country?: string): Promise<EsimPackage[]> {
  const args: Record<string, unknown> = { type: "phone" };
  if (country) args.country = country.toUpperCase();

  const result = await callMCP("search_phone_plans", args) as { packages?: PikaSimPackage[] };
  return (result.packages ?? []).map(normalizePikaPackage);
}

export async function getPackageDetails(packageCode: string): Promise<EsimPackage | null> {
  try {
    const result = await callMCP("get_package_details", { packageCode }) as PikaSimPackage;
    return normalizePikaPackage(result);
  } catch {
    return null;
  }
}

export async function checkCountryCoverage(countryCode: string): Promise<{
  hasData: boolean;
  hasPhone: boolean;
  dataCount: number;
  phoneCount: number;
}> {
  const result = await callMCP("check_country_coverage", {
    country: countryCode.toUpperCase(),
  }) as { hasData?: boolean; hasPhone?: boolean; dataCount?: number; phoneCount?: number };
  return {
    hasData: result.hasData ?? false,
    hasPhone: result.hasPhone ?? false,
    dataCount: result.dataCount ?? 0,
    phoneCount: result.phoneCount ?? 0,
  };
}

export async function getPricing(packageCode: string, currency = "USD"): Promise<number> {
  const result = await callMCP("get_pricing", { packageCode, currency }) as { price?: number };
  return result.price ?? 0;
}

// Authenticated tools — requires PIKASIM_API_KEY

export async function checkAgentBalance(): Promise<{ balanceUsd: number; balanceCrypto?: number }> {
  const result = await callMCP("check_balance", {}, true) as { balanceUsd?: number; balance?: number };
  return { balanceUsd: result.balanceUsd ?? result.balance ?? 0 };
}

export async function purchaseEsim(packageCode: string): Promise<PikaSimPurchaseResult> {
  const result = await callMCP("purchase_esim", { packageCode }, true) as PikaSimPurchaseResult;
  if (!result.iccid || !result.activationCode) {
    throw new Error("PikaSim purchase returned incomplete data");
  }
  return result;
}

export async function purchasePhonePlan(packageCode: string): Promise<PikaSimPurchaseResult> {
  const result = await callMCP("purchase_phone_plan", { packageCode }, true) as PikaSimPurchaseResult;
  if (!result.iccid || !result.activationCode) {
    throw new Error("PikaSim phone plan purchase returned incomplete data");
  }
  return result;
}

export async function getEsimStatus(iccid: string): Promise<{
  status: string;
  dataUsedGb: number;
  dataRemainingGb: number;
  expiresAt: string;
}> {
  const result = await callMCP("get_esim_status", { iccid }, true) as {
    status?: string;
    dataUsed?: number;
    dataRemaining?: number;
    expiresAt?: string;
  };
  return {
    status: result.status ?? "unknown",
    dataUsedGb: result.dataUsed ?? 0,
    dataRemainingGb: result.dataRemaining ?? 0,
    expiresAt: result.expiresAt ?? "",
  };
}

export async function topupEsim(iccid: string, packageCode: string): Promise<boolean> {
  await callMCP("topup_esim", { iccid, packageCode }, true);
  return true;
}

export async function cancelEsim(iccid: string): Promise<boolean> {
  await callMCP("cancel_esim", { iccid }, true);
  return true;
}

export async function listAgentOrders(page = 1, limit = 50): Promise<unknown[]> {
  const result = await callMCP("list_orders", { page, limit }, true) as { orders?: unknown[] };
  return result.orders ?? [];
}
