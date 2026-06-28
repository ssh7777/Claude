// PikaSim API wrapper — SERVER-SIDE ONLY
// Package listing: REST at https://pikasim.com/api (GET only)
// Purchases & account ops: MCP JSON-RPC 2.0 at https://pikasim.com/mcp

import type { EsimPackage, ProductType, PikaSimPackage, PikaSimPurchaseResult } from "@/types";

const PIKASIM_REST  = "https://pikasim.com/api";
const PIKASIM_MCP   = "https://pikasim.com/mcp";

function getApiKey(): string {
  const key = process.env.PIKASIM_API_KEY;
  if (!key) throw new Error("PIKASIM_API_KEY is not configured");
  return key;
}

// ── MCP JSON-RPC 2.0 transport ──────────────────────────────────────────────

async function callMCP(toolName: string, args: Record<string, unknown>): Promise<unknown> {
  const body = {
    jsonrpc: "2.0",
    id: Date.now(),
    method: "tools/call",
    params: { name: toolName, arguments: args },
  };

  const response = await fetch(PIKASIM_MCP, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Accept": "application/json",
      "Authorization": `Bearer ${getApiKey()}`,
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`PikaSim MCP ${response.status}: ${text.slice(0, 300)}`);
  }

  const json = await response.json() as {
    result?: unknown;
    error?: { message?: string; code?: number };
  };

  if (json.error) {
    throw new Error(`PikaSim tool error: ${json.error.message ?? JSON.stringify(json.error)}`);
  }

  // MCP may wrap the payload in content blocks: { result: { content: [{ type:"text", text:"{...}" }] } }
  // Or it may return the payload directly: { result: { iccid: "...", ... } }
  const result = json.result as Record<string, unknown> | undefined;
  if (result && Array.isArray(result.content)) {
    const textBlock = (result.content as { type: string; text?: string }[])
      .find((b) => b.type === "text" && b.text);
    if (textBlock?.text) {
      try { return JSON.parse(textBlock.text); } catch { return textBlock.text; }
    }
  }

  return result ?? json;
}

// ── REST GET transport (package listing only) ─────────────────────────────

async function apiGet<T>(path: string, params?: Record<string, string>): Promise<T> {
  const url = new URL(`${PIKASIM_REST}${path}`);
  if (params) {
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  }

  const key = process.env.PIKASIM_API_KEY;
  const headers: Record<string, string> = { Accept: "application/json" };
  if (key) headers["X-API-Key"] = key;

  const response = await fetch(url.toString(), { method: "GET", headers, cache: "no-store" });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`PikaSim ${response.status} ${response.statusText}: ${text.slice(0, 300)}`);
  }

  return response.json() as Promise<T>;
}

// ── Package normalization ─────────────────────────────────────────────────

function extractDataFromName(name: string): string | null {
  const match = name.match(/\b(\d+(?:\.\d+)?)\s*(TB|GB|MB|KB)\b/i);
  if (!match) return null;
  const num = parseFloat(match[1]);
  const unit = match[2].toUpperCase();
  if (unit === "KB") return `${Math.round(num / 1024)} MB`;
  if (unit === "MB") return num >= 1024 ? `${Math.round(num / 1024)} GB` : `${num} MB`;
  if (unit === "GB") return `${num} GB`;
  if (unit === "TB") return `${num} TB`;
  return null;
}

function normalizePikaPackage(pkg: PikaSimPackage): EsimPackage {
  let priceUsd = 0;
  if (typeof pkg.priceUSD === "number") priceUsd = pkg.priceUSD;
  else if (typeof pkg.priceUsd === "number") priceUsd = pkg.priceUsd;
  else if (typeof pkg.price === "number") priceUsd = pkg.price / 10000;

  let dataAmount = "Unknown";
  const pkgName = pkg.name ?? pkg.packageName ?? "";
  const nameData = pkgName ? extractDataFromName(pkgName) : null;
  if (nameData) {
    dataAmount = nameData;
  } else if (typeof pkg.volume === "number" && pkg.volume >= 1048576) {
    const gb = pkg.volume / 1073741824;
    dataAmount = gb >= 1 ? `${Math.round(gb)} GB` : `${Math.round(gb * 1024)} MB`;
  } else if (typeof pkg.volumeGB === "number") {
    const v = pkg.volumeGB;
    const isMb = priceUsd > 0 && v > 0 && priceUsd / v < 0.10;
    if (isMb) {
      dataAmount = v >= 1024 ? `${Math.round(v / 1024)} GB` : `${Math.round(v)} MB`;
    } else {
      dataAmount = v >= 1 ? `${v} GB` : `${Math.round(v * 1024)} MB`;
    }
  } else if (pkg.data) {
    dataAmount = pkg.data;
  } else if (pkg.isUnlimited) {
    dataAmount = "Unlimited";
  }

  const country     = pkg.location     ?? pkg.destination     ?? "";
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

// ── Public API ─────────────────────────────────────────────────────────────

export async function searchEsimPackages(
  country?: string,
  type: "data" | "phone" | "all" = "all"
): Promise<EsimPackage[]> {
  const params: Record<string, string> = {};
  if (country) params.country = country.toUpperCase();
  if (type !== "all") params.type = type;

  try {
    const result = await apiGet<{ packages?: PikaSimPackage[] }>("/packages/all-countries", params);
    let packages = result.packages ?? [];

    if (country) {
      const code = country.toUpperCase();
      packages = packages.filter(
        (p) => (p.locationCode ?? p.destinationCode ?? "").toUpperCase() === code
      );
    }
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
  try {
    const result = await apiGet<{ packages?: PikaSimPackage[] }>("/packages/all-countries");
    const pkg = (result.packages ?? []).find((p) => p.packageCode === packageCode);
    return pkg ? normalizePikaPackage(pkg) : null;
  } catch {
    return null;
  }
}

export async function checkAgentBalance(): Promise<{ balanceUsd: number }> {
  const result = await callMCP("check_balance", {}) as {
    balanceUsd?: number; balance?: number; balance_usd?: number;
  };
  return { balanceUsd: result.balanceUsd ?? result.balance_usd ?? result.balance ?? 0 };
}

function normalizeStr(v: unknown): string | undefined {
  if (v == null) return undefined;
  const s = String(v).trim();
  return s || undefined;
}

export async function purchaseEsim(packageCode: string): Promise<PikaSimPurchaseResult> {
  const raw = await callMCP("purchase_esim", { packageCode }) as Record<string, unknown>;

  const iccid = normalizeStr(raw.iccid ?? raw.ICCID);
  const activationCode = normalizeStr(
    raw.activationCode ?? raw.activation_code ?? raw.lpa ?? raw.ac ?? raw.code
  );
  const smDpAddress = normalizeStr(
    raw.smDpAddress ?? raw.sm_dp_address ?? raw.smdp ?? raw.sm_dp ?? raw.address
  );
  const orderId = normalizeStr(raw.orderId ?? raw.order_id ?? raw.id ?? raw.uuid);

  // PikaSim may be async — return what we have even if ICCID is missing yet.
  // The caller should check result.iccid; if empty, store orderId and wait for webhook.
  if (!orderId && !iccid) {
    const fields = Object.keys(raw).join(", ");
    throw new Error(
      `eSIM purchase returned no usable data. Fields: [${fields}]. Response: ${JSON.stringify(raw).slice(0, 500)}`
    );
  }

  return {
    orderId: orderId ?? "",
    iccid: iccid ?? "",
    activationCode: activationCode ?? "",
    smDpAddress: smDpAddress ?? "",
    status: normalizeStr(raw.status) ?? "processing",
    qrCodeUrl: normalizeStr(raw.qrCodeUrl ?? raw.qr_code_url),
  };
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
  const result = await callMCP("get_esim_status", { iccid }) as {
    status?: string;
    dataUsed?: number;
    dataRemaining?: number;
    data_used_gb?: number;
    data_remaining_gb?: number;
    expiresAt?: string;
    expires_at?: string;
  };
  return {
    status: result.status ?? "unknown",
    dataUsedGb: result.dataUsed ?? result.data_used_gb ?? 0,
    dataRemainingGb: result.dataRemaining ?? result.data_remaining_gb ?? 0,
    expiresAt: result.expiresAt ?? result.expires_at ?? "",
  };
}

export async function topupEsim(iccid: string, packageCode: string): Promise<boolean> {
  await callMCP("topup_esim", { iccid, packageCode });
  return true;
}

export async function cancelEsim(iccid: string): Promise<boolean> {
  await callMCP("cancel_esim", { iccid });
  return true;
}

export async function listAgentOrders(page = 1, limit = 50): Promise<unknown[]> {
  const result = await callMCP("list_orders", { page, limit }) as { orders?: unknown[] };
  return result.orders ?? [];
}
