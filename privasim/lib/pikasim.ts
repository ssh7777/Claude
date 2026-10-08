// PikaSim API wrapper — SERVER-SIDE ONLY
// Package listing: REST at https://pikasim.com/api (GET only)
// Purchases & account ops: MCP JSON-RPC 2.0 at https://pikasim.com/mcp

import type { EsimPackage, ProductType, PikaSimPackage, PikaSimPurchaseResult } from "@/types";
import fallbackCatalog from "@/data/fallback-catalog.json";

// Base URLs are overridable so the supplier client can be pointed at a proxy,
// a staging endpoint, or a local mock during incident response / testing.
function restBase(): string {
  return (process.env.PIKASIM_REST_BASE ?? "https://pikasim.com/api").replace(/\/+$/, "");
}

function mcpBase(): string {
  return (process.env.PIKASIM_MCP_BASE ?? "https://pikasim.com/mcp").replace(/\/+$/, "");
}

function getApiKey(): string {
  const key = process.env.PIKASIM_API_KEY;
  if (!key) throw new Error("PIKASIM_API_KEY is not configured");
  return key;
}

/** True when the supplier client has credentials configured. */
export function isSupplierConfigured(): boolean {
  return Boolean(process.env.PIKASIM_API_KEY?.trim());
}

// ── Supplier health signal ──────────────────────────────────────────────────
// `getPackageDetails` returns null both for "genuinely unknown package" and for
// "the supplier is unreachable", which are very different situations for the
// checkout. Callers use this to tell them apart and return a retryable 503
// instead of a misleading 404.

const SUPPLIER_DEGRADED_WINDOW_MS = 5 * 60 * 1000;
let lastSupplierErrorAt = 0;
let lastSupplierError: string | null = null;

function recordSupplierError(error: unknown): void {
  lastSupplierErrorAt = Date.now();
  lastSupplierError = errText(error);
}

export interface SupplierHealth {
  degraded: boolean;
  lastError: string | null;
  ageMs: number | null;
}

export function supplierHealth(): SupplierHealth {
  if (!lastSupplierErrorAt) return { degraded: false, lastError: null, ageMs: null };
  const ageMs = Date.now() - lastSupplierErrorAt;
  return {
    degraded: ageMs < SUPPLIER_DEGRADED_WINDOW_MS,
    lastError: lastSupplierError,
    ageMs,
  };
}

// ── MCP JSON-RPC 2.0 transport ──────────────────────────────────────────────

// MCP Streamable HTTP may reply with either a plain JSON body or an
// SSE stream (text/event-stream) whose `data:` lines carry the JSON-RPC
// payload. This parses both into the JSON-RPC envelope.
export function parseMcpBody(text: string): { result?: unknown; error?: { message?: string; code?: number } } {
  const trimmed = text.trim();
  if (!trimmed) return {};
  // Plain JSON
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    try { return JSON.parse(trimmed); } catch { /* fall through to SSE */ }
  }
  // SSE: collect the last non-empty `data:` line that parses as JSON
  let parsed: { result?: unknown; error?: { message?: string; code?: number } } = {};
  for (const line of trimmed.split(/\r?\n/)) {
    const m = line.match(/^data:\s*(.*)$/);
    if (!m) continue;
    const payload = m[1].trim();
    if (!payload || payload === "[DONE]") continue;
    try { parsed = JSON.parse(payload); } catch { /* keep previous */ }
  }
  return parsed;
}

async function callMCP(toolName: string, args: Record<string, unknown>): Promise<unknown> {
  const body = {
    jsonrpc: "2.0",
    id: Date.now(),
    method: "tools/call",
    params: { name: toolName, arguments: args },
  };

  const response = await fetch(mcpBase(), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Accept": "application/json, text/event-stream",
      "Authorization": `Bearer ${getApiKey()}`,
    },
    body: JSON.stringify(body),
    cache: "no-store",
    signal: AbortSignal.timeout(60_000),
  });

  const rawText = await response.text();

  if (!response.ok) {
    throw new Error(`PikaSim MCP returned HTTP ${response.status}`);
  }

  const json = parseMcpBody(rawText) as {
    result?: unknown;
    error?: { message?: string; code?: number };
  };

  if (json.error) {
    throw new Error(
      `PikaSim supplier tool call failed${json.error.message ? `: ${json.error.message}` : ""}`
    );
  }

  // MCP wraps the payload in content blocks: { result: { content: [{ type:"text", text:"..." }] } }
  // The text may be JSON or free-form prose ("Wallet Balance: $10.00 USD").
  // Return parsed JSON when possible, otherwise { __rawText } for regex extraction.
  const result = json.result as Record<string, unknown> | undefined;
  if (result && Array.isArray(result.content)) {
    const textBlock = (result.content as { type: string; text?: string }[])
      .find((b) => b.type === "text" && b.text);
    if (textBlock?.text) {
      try { return JSON.parse(textBlock.text); } catch { return { __rawText: textBlock.text }; }
    }
  }

  return result ?? json;
}

function errText(error: unknown): string {
  return error instanceof Error ? error.message : "unknown supplier error";
}

// ── Free-text extraction (PikaSim MCP answers in prose) ────────────────────

function extractIccid(text: string): string | undefined {
  return text.match(/\b(89\d{17,18})\b/)?.[1];
}

function extractLpa(text: string): { activationCode?: string; smDpAddress?: string } {
  // Full LPA string: LPA:1$smdp.example.com$ACTIVATION-CODE
  const lpa = text.match(/LPA:1\$([^$\s]+)\$([A-Za-z0-9._-]+)/i);
  if (lpa) return { smDpAddress: lpa[1], activationCode: `LPA:1$${lpa[1]}$${lpa[2]}` };
  const smdp = text.match(/SM-?DP\+?(?:\s*Address)?\s*[:=]\s*([^\s,]+)/i)?.[1];
  const code = text.match(/Activation\s*Code\s*[:=]\s*([^\s,]+)/i)?.[1];
  return { smDpAddress: smdp, activationCode: code };
}

function extractOrderId(text: string): string | undefined {
  return (
    text.match(/Order\s*(?:ID|#)?\s*[:=]?\s*([A-Za-z0-9_-]{6,})/i)?.[1] ??
    text.match(/\b([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\b/i)?.[1]
  );
}

function extractUsd(text: string): number | undefined {
  const m = text.match(/\$\s*([\d,]+(?:\.\d+)?)/);
  return m ? parseFloat(m[1].replace(/,/g, "")) : undefined;
}

// ── REST GET transport (package listing only) ─────────────────────────────

async function apiGet<T>(path: string, params?: Record<string, string>): Promise<T> {
  const url = new URL(`${restBase()}${path}`);
  if (params) {
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  }

  const key = process.env.PIKASIM_API_KEY;
  const headers: Record<string, string> = { Accept: "application/json" };
  if (key) headers["X-API-Key"] = key;

  // Catalog reads are cached for 5 min in Next's data cache and shared by
  // every page — without this, EVERY render re-downloaded the ~900 KB
  // all-countries catalog (the main cause of slow page loads). Purchases
  // and other MCP calls stay strictly no-store.
  const response = await fetch(url.toString(), {
    method: "GET",
    headers,
    next: { revalidate: 300 },
    signal: AbortSignal.timeout(10_000),
  });

  if (!response.ok) {
    const error = new Error(`PikaSim catalog request returned HTTP ${response.status}`);
    recordSupplierError(error);
    throw error;
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
  const rawType = pkg.dataType ?? pkg.type;
  const type: ProductType = rawType === "phone" || rawType === 2 ? "phone" : "data";

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
      // REST encodes dataType numerically (1 = data eSIM); phone plans are
      // never served by this endpoint, only by the MCP search. Treat any
      // non-"phone" value as data so numeric shapes aren't filtered to zero.
      packages = packages.filter((p) => {
        const t = p.dataType ?? p.type;
        const isPhone = t === "phone" || t === 2;
        return type === "phone" ? isPhone : !isPhone;
      });
    }

    return packages.map(normalizePikaPackage);
  } catch (err) {
    recordSupplierError(err);
    console.error("[PikaSim] searchEsimPackages failed:", errText(err));
    throw err;
  }
}

// Global multi-country data packages (13 plans covering 120+ countries).
// Dedicated REST endpoint — these do NOT appear in country-filtered results.
export async function getGlobalPackages(): Promise<EsimPackage[]> {
  const result = await apiGet<{ packages?: PikaSimPackage[] }>("/packages/global");
  return (result.packages ?? []).map((p) => {
    const pkg = normalizePikaPackage(p);
    return {
      ...pkg,
      country: (p as { region?: string }).region ?? "Global (120+ countries)",
      countryCode: "GLOBAL",
    };
  });
}

export interface PhonePlan {
  packageCode: string;
  name: string;
  minutes: number;
  sms: number;
  dataAmount: string;
  durationDays: number;
  priceUsd: number; // wholesale — apply retailPrice() before display
}

// Phone-number eSIMs (real carrier number, voice + SMS + data).
// Only exposed via the MCP search tool; the prose response lists plans as:
//   Phone-number plan [code]: 10 min + 10 SMS + 1GB data | 7 days | $25.34 | ...
export async function getPhonePlans(scope: { country?: string; region?: string } = { region: "Global" }): Promise<PhonePlan[]> {
  const raw = await callMCP("search_phone_plans", scope) as { __rawText?: string };
  const text = raw.__rawText ?? "";
  const plans: PhonePlan[] = [];
  const lineRe =
    /\[([^\]]+)\]:\s*(\d+)\s*min\s*\+\s*(\d+)\s*SMS\s*\+\s*([\d.]+\s*[GM]B)\s*data\s*\|\s*(\d+)\s*days?\s*\|\s*\$([\d.]+)/gi;
  let m: RegExpExecArray | null;
  while ((m = lineRe.exec(text)) !== null) {
    plans.push({
      packageCode: m[1],
      name: `${m[4]} + ${m[2]} min + ${m[3]} SMS`,
      minutes: parseInt(m[2], 10),
      sms: parseInt(m[3], 10),
      dataAmount: m[4].toUpperCase().replace(/\s+/, " "),
      durationDays: parseInt(m[5], 10),
      priceUsd: parseFloat(m[6]),
    });
  }
  return plans;
}

// Details via the public MCP tool — fallback for codes missing from the
// country REST list (phone plans, global/regional codes).
async function getPackageDetailsMCP(packageCode: string): Promise<EsimPackage | null> {
  try {
    const raw = await callMCP("get_package_details", { packageCode }) as Record<string, unknown>;
    const text = typeof raw.__rawText === "string" ? raw.__rawText : JSON.stringify(raw);
    const price = extractUsd(text);
    if (!price) return null;

    const data = text.match(/([\d.]+)\s*(GB|MB)\b/i);
    const days = text.match(/(\d+)\s*days?\b/i);
    const isPhone = /phone|voice|sms|real (carrier )?number/i.test(text);
    const nameLine = text.split(/\r?\n/).find((l) => l.trim())?.trim() ?? packageCode;

    return {
      code: packageCode,
      name: nameLine.slice(0, 80),
      country: /global/i.test(text) ? "Global" : "",
      countryCode: /global/i.test(text) ? "GLOBAL" : "",
      dataAmount: data ? `${data[1]} ${data[2].toUpperCase()}` : "See plan",
      durationDays: days ? parseInt(days[1], 10) : 0,
      priceUsd: price,
      type: isPhone ? "phone" : "data",
      networks: [],
    };
  } catch {
    return null;
  }
}

export async function getPackageDetails(packageCode: string): Promise<EsimPackage | null> {
  try {
    const result = await apiGet<{ packages?: PikaSimPackage[] }>("/packages/all-countries");
    const pkg = (result.packages ?? []).find((p) => p.packageCode === packageCode);
    if (pkg) return normalizePikaPackage(pkg);
  } catch (error) {
    // Silent catch blocks made supplier outages invisible in the logs.
    recordSupplierError(error);
    console.error(`[PikaSim] all-countries lookup failed for ${packageCode}:`, errText(error));
  }
  // Not in the country list — try global list, then MCP details (phone plans)
  try {
    const globals = await getGlobalPackages();
    const g = globals.find((p) => p.code === packageCode);
    if (g) return g;
  } catch (error) {
    recordSupplierError(error);
    console.error(`[PikaSim] global lookup failed for ${packageCode}:`, errText(error));
  }
  return getPackageDetailsMCP(packageCode);
}

// ── Catalog resilience ─────────────────────────────────────────────────────
// Shop pages must never render blank because the supplier is offline. Every
// successful supplier read is mirrored into PostgreSQL per country, so a later
// outage can be served from the last known catalog. `data/fallback-catalog.json`
// is a committed snapshot used only when neither the supplier nor the database
// has anything for that destination. Anything served from the cache or the
// static file is flagged `stale` and the UI says so, because the authoritative
// price is always recomputed live at invoice creation.

export type CatalogSource = "supplier" | "cache" | "fallback";

export interface CatalogResult {
  packages: EsimPackage[];
  /** True when the data came from the cache or the committed snapshot. */
  stale: boolean;
  source: CatalogSource;
  error?: string;
}

const CATALOG_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

interface CatalogSnapshot {
  capturedAt: number;
  packages: EsimPackage[];
}

async function readSnapshot(scope: string): Promise<EsimPackage[] | null> {
  if (!process.env.DATABASE_URL?.trim()) return null;
  try {
    const { ledgerGet } = await import("@/lib/ledger");
    const snap = await ledgerGet<CatalogSnapshot>(`cat_${scope.toUpperCase()}`);
    if (!snap || !Array.isArray(snap.packages)) return null;
    if (!Number.isFinite(snap.capturedAt)) return null;
    if (Date.now() - snap.capturedAt > CATALOG_MAX_AGE_MS) return null;
    return snap.packages;
  } catch {
    return null;
  }
}

async function writeSnapshot(scope: string, packages: EsimPackage[]): Promise<void> {
  if (!process.env.DATABASE_URL?.trim() || packages.length === 0) return;
  try {
    const { ledgerSet } = await import("@/lib/ledger");
    await ledgerSet(`cat_${scope.toUpperCase()}`, {
      capturedAt: Date.now(),
      packages: packages.slice(0, 500),
    } satisfies CatalogSnapshot);
  } catch (error) {
    console.warn(
      "[PikaSim] could not persist catalog snapshot:",
      error instanceof Error ? error.message : "unknown error"
    );
  }
}

interface FallbackEntry {
  code: string;
  name: string;
  country: string;
  countryCode: string;
  dataAmount: string;
  durationDays: number;
  priceUsd: number;
  type: string;
  networks: string[];
}

function staticPackages(): EsimPackage[] {
  return (fallbackCatalog.packages as FallbackEntry[]).map((entry) => ({
    code: entry.code,
    name: entry.name,
    country: entry.country,
    countryCode: entry.countryCode,
    dataAmount: entry.dataAmount,
    durationDays: entry.durationDays,
    priceUsd: entry.priceUsd,
    type: entry.type === "phone" ? "phone" : "data",
    networks: entry.networks ?? [],
  }));
}

function filterType(packages: EsimPackage[], type: "data" | "phone" | "all"): EsimPackage[] {
  if (type === "all") return packages;
  return packages.filter((pkg) => pkg.type === type);
}

/**
 * Country/global catalog that degrades instead of throwing.
 * Supplier → per-country snapshot in PostgreSQL → committed static snapshot.
 */
export async function loadCatalog(
  country?: string,
  type: "data" | "phone" | "all" = "all"
): Promise<CatalogResult> {
  const scope = (country ?? "ALL").toUpperCase();
  try {
    const packages = await searchEsimPackages(country, type);
    void writeSnapshot(scope, packages);
    return { packages, stale: false, source: "supplier" };
  } catch (error) {
    const message = errText(error);
    console.error(`[PikaSim] catalog fetch failed for ${scope}:`, message);
  }

  const cached = filterType((await readSnapshot(scope)) ?? [], type);
  if (cached.length > 0) {
    return { packages: cached, stale: true, source: "cache", error: "supplier_unreachable" };
  }

  const all = staticPackages();
  const scoped = country ? all.filter((pkg) => pkg.countryCode === scope) : all;
  const fallback = filterType(scoped, type);
  return {
    packages: fallback,
    stale: fallback.length > 0,
    source: "fallback",
    error: fallback.length > 0 ? "supplier_unreachable" : "no_catalog_available",
  };
}

/** Global multi-country catalog with the same degradation ladder. */
export async function loadGlobalCatalog(): Promise<CatalogResult> {
  try {
    const packages = await getGlobalPackages();
    void writeSnapshot("GLOBAL", packages);
    return { packages, stale: false, source: "supplier" };
  } catch (error) {
    console.error("[PikaSim] global catalog fetch failed:", errText(error));
  }

  const cached = (await readSnapshot("GLOBAL")) ?? [];
  if (cached.length > 0) {
    return { packages: cached, stale: true, source: "cache", error: "supplier_unreachable" };
  }

  const fallback = staticPackages().filter((pkg) => pkg.countryCode === "GLOBAL");
  return {
    packages: fallback,
    stale: fallback.length > 0,
    source: "fallback",
    error: fallback.length > 0 ? "supplier_unreachable" : "no_catalog_available",
  };
}

export interface PackageLookup {
  pkg: EsimPackage | null;
  stale: boolean;
  source: CatalogSource | "none";
}

/**
 * Single package lookup that falls back to the cached/static catalog when the
 * supplier is unreachable. The stale flag is surfaced to the client so the UI
 * can warn that the displayed price will be re-quoted at checkout.
 */
export async function loadPackageDetails(packageCode: string): Promise<PackageLookup> {
  try {
    const pkg = await getPackageDetails(packageCode);
    if (pkg && Number.isFinite(pkg.priceUsd) && pkg.priceUsd > 0) {
      return { pkg, stale: false, source: "supplier" };
    }
  } catch (error) {
    console.error(`[PikaSim] package lookup failed for ${packageCode}:`, errText(error));
  }

  const staticMatch = staticPackages().find((pkg) => pkg.code === packageCode);
  if (staticMatch) {
    return { pkg: staticMatch, stale: true, source: "fallback" };
  }

  const scopes = [packageCode.slice(0, 2).toUpperCase(), "GLOBAL", "ALL"];
  for (const scope of scopes) {
    const cached = await readSnapshot(scope);
    const match = cached?.find((pkg) => pkg.code === packageCode);
    if (match) return { pkg: match, stale: true, source: "cache" };
  }

  return { pkg: null, stale: false, source: "none" };
}

export async function checkAgentBalance(): Promise<{ balanceUsd: number }> {
  const result = await callMCP("check_balance", {}) as {
    balanceUsd?: number; balance?: number; balance_usd?: number; __rawText?: string;
  };
  if (result.__rawText) {
    // e.g. "Wallet Balance: $10.00 USD"
    return { balanceUsd: extractUsd(result.__rawText) ?? 0 };
  }
  return { balanceUsd: result.balanceUsd ?? result.balance_usd ?? result.balance ?? 0 };
}

function normalizeStr(v: unknown): string | undefined {
  if (v == null) return undefined;
  const s = String(v).trim();
  return s || undefined;
}

function parsePurchaseResult(raw: Record<string, unknown>): PikaSimPurchaseResult {
  // Prose response — extract ICCID / LPA / order ID with regexes
  if (typeof raw.__rawText === "string") {
    const text = raw.__rawText;
    const iccid = extractIccid(text);
    const { activationCode, smDpAddress } = extractLpa(text);
    const orderId = extractOrderId(text);
    const qrCodeUrl = text.match(/https?:\/\/\S*(?:qr|install)\S*/i)?.[0];

    if (!orderId && !iccid) {
      throw new Error("eSIM supplier returned no usable order identifier");
    }
    return {
      orderId: orderId ?? "",
      iccid: iccid ?? "",
      activationCode: activationCode ?? "",
      smDpAddress: smDpAddress ?? "",
      status: iccid ? "completed" : "processing",
      qrCodeUrl,
    };
  }

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
    throw new Error("eSIM supplier returned no usable order identifier");
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

export async function purchaseEsim(packageCode: string): Promise<PikaSimPurchaseResult> {
  try {
    const raw = await callMCP("purchase_esim", { packageCode }) as Record<string, unknown>;
    return parsePurchaseResult(raw);
  } catch (err) {
    // Phone-plan codes are rejected by purchase_esim — retry with the phone tool.
    const msg = err instanceof Error ? err.message : "";
    if (/phone|not valid|invalid package/i.test(msg)) {
      const raw = await callMCP("purchase_phone_plan", { packageCode }) as Record<string, unknown>;
      return parsePurchaseResult(raw);
    }
    throw err;
  }
}

export async function purchasePhonePlan(packageCode: string): Promise<PikaSimPurchaseResult> {
  const raw = await callMCP("purchase_phone_plan", { packageCode }) as Record<string, unknown>;
  return parsePurchaseResult(raw);
}

export async function getEsimStatus(iccid: string): Promise<{
  status: string;
  dataUsedGb: number;
  dataRemainingGb: number;
  expiresAt: string;
  summary?: string;
}> {
  const result = await callMCP("get_esim_status", { iccid }) as {
    status?: string;
    dataUsed?: number;
    dataRemaining?: number;
    data_used_gb?: number;
    data_remaining_gb?: number;
    expiresAt?: string;
    expires_at?: string;
    __rawText?: string;
  };

  if (result.__rawText) {
    const text = result.__rawText;
    const gb = (label: RegExp) => {
      const m = text.match(label);
      if (!m) return 0;
      const n = parseFloat(m[1]);
      return /mb/i.test(m[2] ?? "") ? n / 1024 : n;
    };
    return {
      status: text.match(/status\s*[:=]?\s*(\w+)/i)?.[1]?.toLowerCase() ?? "active",
      dataUsedGb: gb(/used[^\d]{0,12}([\d.]+)\s*(GB|MB)/i),
      dataRemainingGb: gb(/remaining[^\d]{0,12}([\d.]+)\s*(GB|MB)/i),
      expiresAt: text.match(/expir\w*\s*[:=]?\s*([\d]{4}-[\d]{2}-[\d]{2}[^\s,]*)/i)?.[1] ?? "",
      summary: text,
    };
  }

  return {
    status: result.status ?? "unknown",
    dataUsedGb: result.dataUsed ?? result.data_used_gb ?? 0,
    dataRemainingGb: result.dataRemaining ?? result.data_remaining_gb ?? 0,
    expiresAt: result.expiresAt ?? result.expires_at ?? "",
  };
}

// List valid top-up packages for an existing eSIM. Top-up codes differ from
// new-purchase codes — always call this before topupEsim.
export async function getTopupOptions(iccid: string): Promise<{
  options: { packageCode: string; name?: string; priceUsd?: number }[];
  summary?: string;
}> {
  const result = await callMCP("get_topup_options", { iccid }) as {
    options?: { packageCode: string; name?: string; priceUsd?: number }[];
    packages?: { packageCode: string; name?: string; priceUsd?: number }[];
    __rawText?: string;
  };

  if (result.__rawText) {
    const text = result.__rawText;
    // Each option line contains its code in [brackets]; best-effort parse
    // of data amount, duration and wholesale price from the same line.
    const options: { packageCode: string; name?: string; priceUsd?: number }[] = [];
    for (const line of text.split(/\r?\n/)) {
      const code = line.match(/\[([A-Za-z0-9._+-]{3,})\]/)?.[1];
      if (!code) continue;
      const price = line.match(/\$([\d.]+)/)?.[1];
      const data = line.match(/([\d.]+\s*[GM]B)/i)?.[1];
      const days = line.match(/(\d+)\s*days?/i)?.[1];
      options.push({
        packageCode: code,
        name: [data?.toUpperCase(), days ? `${days} days` : null].filter(Boolean).join(" · ") || code,
        priceUsd: price ? parseFloat(price) : undefined,
      });
    }
    return { options, summary: text };
  }

  return { options: result.options ?? result.packages ?? [] };
}

export async function topupEsim(iccid: string, packageCode: string): Promise<{ success: boolean; summary?: string }> {
  const result = await callMCP("topup_esim", { iccid, packageCode }) as { __rawText?: string };
  return { success: true, summary: result.__rawText };
}

export async function cancelEsim(iccid: string): Promise<boolean> {
  await callMCP("cancel_esim", { iccid });
  return true;
}

export async function listAgentOrders(page = 1, limit = 50): Promise<{ orders: unknown[]; summary?: string }> {
  const result = await callMCP("list_orders", { page, limit }) as {
    orders?: unknown[];
    __rawText?: string;
  };
  if (result.__rawText) return { orders: [], summary: result.__rawText };
  return { orders: result.orders ?? [] };
}
