// Persistent key-value ledger backed by Vercel Edge Config.
//
// Used for state that MUST survive across serverless instances:
//  - tx_<hash>   → invoiceId   (payment replay protection: one TX = one eSIM)
//  - cpn_<code>  → { uses, revoked }  (coupon usage limits + revocation)
//
// Reads use the EDGE_CONFIG connection string (read-only token).
// Writes call the Vercel API with VERCEL_API_TOKEN (server-side only).
// If neither is configured, falls back to per-instance memory so the app
// still works — with weaker (single-instance) guarantees.

const memory = new Map<string, unknown>();

function readConfig(): { id: string; readUrl: string } | null {
  const conn = process.env.EDGE_CONFIG ?? "";
  const m = conn.match(/edge-config\.vercel\.com\/(ecfg_[a-zA-Z0-9]+)\?token=([a-zA-Z0-9-]+)/);
  if (!m) return null;
  return { id: m[1], readUrl: conn };
}

function apiToken(): string | null {
  return process.env.VERCEL_API_TOKEN ?? null;
}

export function ledgerPersistent(): boolean {
  return !!(readConfig() && apiToken());
}

export async function ledgerGet<T>(key: string): Promise<T | null> {
  const cfg = readConfig();
  if (!cfg) return (memory.get(key) as T) ?? null;
  try {
    const base = cfg.readUrl.split("?")[0];
    const token = cfg.readUrl.split("token=")[1];
    const res = await fetch(`${base}/item/${encodeURIComponent(key)}?token=${token}`, {
      cache: "no-store",
      signal: AbortSignal.timeout(4000),
    });
    if (res.status === 404) return null;
    if (!res.ok) return (memory.get(key) as T) ?? null;
    return (await res.json()) as T;
  } catch {
    return (memory.get(key) as T) ?? null;
  }
}

export async function ledgerSet(key: string, value: unknown): Promise<boolean> {
  memory.set(key, value); // always keep the fast local copy
  const cfg = readConfig();
  const token = apiToken();
  if (!cfg || !token) return false;
  try {
    const res = await fetch(`https://api.vercel.com/v1/edge-config/${cfg.id}/items`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ items: [{ operation: "upsert", key, value }] }),
      signal: AbortSignal.timeout(6000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function ledgerList(prefix: string): Promise<Record<string, unknown>> {
  const cfg = readConfig();
  const token = apiToken();
  const out: Record<string, unknown> = {};
  for (const [k, v] of memory) if (k.startsWith(prefix)) out[k] = v;
  if (!cfg || !token) return out;
  try {
    const res = await fetch(`https://api.vercel.com/v1/edge-config/${cfg.id}/items`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) return out;
    const items = (await res.json()) as { key: string; value: unknown }[];
    for (const it of items) if (it.key.startsWith(prefix)) out[it.key] = it.value;
    return out;
  } catch {
    return out;
  }
}

// ── Payment replay protection ───────────────────────────────────────────────
// Returns null if the TX is unused, or the invoiceId that already claimed it.
export async function claimTxHash(txHash: string, invoiceId: string): Promise<string | null> {
  const key = `tx_${txHash.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 80)}`;
  const existing = await ledgerGet<string>(key);
  if (existing && existing !== invoiceId) return existing;
  await ledgerSet(key, invoiceId);
  // Read-back to narrow the race window between parallel requests
  const after = await ledgerGet<string>(key);
  if (after && after !== invoiceId) return after;
  return null;
}

// ── Coupon usage ────────────────────────────────────────────────────────────
export interface CouponState {
  uses: number;
  maxUses: number; // 0 = unlimited
  revoked: boolean;
}

export async function getCouponState(code: string): Promise<CouponState> {
  const state = await ledgerGet<CouponState>(`cpn_${code.toUpperCase()}`);
  return state ?? { uses: 0, maxUses: 0, revoked: false };
}

export async function setCouponState(code: string, state: CouponState): Promise<boolean> {
  return ledgerSet(`cpn_${code.toUpperCase()}`, state);
}
