// Runtime-mutable settings — wallet addresses and margin can be changed by
// the owner without a redeploy. Overrides are stored in PostgreSQL; validated
// environment values are used as the baseline configuration.
//
// Security:
//  - Reads are server-side only (used to build payment invoices).
//  - Writes go through /api/admin/settings and require the dedicated
//    ADMIN_API_KEY. Address validation is conservative because a bad address
//    can misroute customer funds.

import { ledgerGet, ledgerPersistent, ledgerSet } from "@/lib/ledger";

const KEY_ETH = "set_wallet_eth";
const KEY_XMR = "set_wallet_xmr";
const KEY_MARGIN = "set_margin_pct";

// ── Profit margin (owner-adjustable, no redeploy) ───────────────────────────
// Stored as a PERCENT (70 = 70% markup on wholesale). The default matches the
// compile-time RETAIL_MARGIN in lib/prices.ts so behaviour is unchanged until
// the owner sets a custom value from the admin dashboard.
export const DEFAULT_MARGIN_PERCENT = 70;

// Short server-side cache so hot paths (shop pages, invoices) don't hit the
// ledger on every request; a margin change is live within a minute.
let marginCache: { pct: number; at: number } | null = null;
const MARGIN_CACHE_MS = 60_000;

export function isValidMarginPercent(pct: number): boolean {
  // 0% (sell at cost) to 300% — conservative bounds against typos like 7000.
  return Number.isFinite(pct) && pct >= 0 && pct <= 300;
}

export async function getMarginPercent(): Promise<number> {
  if (marginCache && Date.now() - marginCache.at < MARGIN_CACHE_MS) {
    return marginCache.pct;
  }
  if (!ledgerPersistent()) {
    marginCache = { pct: DEFAULT_MARGIN_PERCENT, at: Date.now() };
    return DEFAULT_MARGIN_PERCENT;
  }
  try {
    const stored = await ledgerGet<number>(KEY_MARGIN);
    const pct =
      typeof stored === "number" && isValidMarginPercent(stored)
        ? stored
        : DEFAULT_MARGIN_PERCENT;
    marginCache = { pct, at: Date.now() };
    return pct;
  } catch (error) {
    // A ledger outage must not take every shop page or the checkout down.
    // Falling back to the documented default margin keeps prices consistent
    // with what the owner configured by default; the error is logged so the
    // outage is visible in the platform logs.
    console.error(
      "[settings] margin lookup failed; using default margin:",
      error instanceof Error ? error.message : "unknown error"
    );
    marginCache = { pct: DEFAULT_MARGIN_PERCENT, at: Date.now() };
    return DEFAULT_MARGIN_PERCENT;
  }
}

/** Multiplier form used by retailPrice(): 70% → 1.7 */
export async function getRetailMargin(): Promise<number> {
  return 1 + (await getMarginPercent()) / 100;
}

export async function setMarginPercent(pct: number): Promise<boolean> {
  if (!isValidMarginPercent(pct)) {
    throw new Error("Margin must be a number between 0 and 300 (percent)");
  }
  const rounded = Math.round(pct * 100) / 100;
  const ok = await ledgerSet(KEY_MARGIN, rounded);
  if (ok) marginCache = { pct: rounded, at: Date.now() };
  return ok;
}

export function isValidMoneroAddress(addr: string): boolean {
  // Standard (4...) or integrated (8...) mainnet address, 95 or 106 base58 chars.
  return /^[48][0-9AB][1-9A-HJ-NP-Za-km-z]{93}([1-9A-HJ-NP-Za-km-z]{11})?$/.test(addr.trim());
}

export const DEFAULT_MONERO_WALLET_PRIMARY =
  "83JkvCKVybdWSFJPrT7wKdQMosgdAnR97YG9GVNdKdk3bG6Aa6EjXMD4AGb6ngyTX2M3USfG46ieyck3HvFwSoa31f2vDfr";

export function isValidEthAddress(addr: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(addr.trim());
}

async function safeLedgerGet<T>(key: string): Promise<T | null> {
  if (!ledgerPersistent()) return null;
  try {
    return await ledgerGet<T>(key);
  } catch (error) {
    console.error(
      `[settings] ledger read failed for ${key}; using environment default:`,
      error instanceof Error ? error.message : "unknown error"
    );
    return null;
  }
}

export async function getMoneroAddress(): Promise<string> {
  const override = await safeLedgerGet<string>(KEY_XMR);
  if (override && isValidMoneroAddress(override)) return override;
  const address = process.env.MONERO_WALLET_PRIMARY?.trim() || DEFAULT_MONERO_WALLET_PRIMARY;
  if (!address || !isValidMoneroAddress(address)) {
    throw new Error("MONERO_WALLET_PRIMARY is missing or invalid");
  }
  return address;
}

export async function setMoneroAddress(addr: string): Promise<boolean> {
  if (!isValidMoneroAddress(addr)) throw new Error("Invalid Monero address");
  return ledgerSet(KEY_XMR, addr.trim());
}

export async function getEthereumAddress(): Promise<string> {
  const override = await safeLedgerGet<string>(KEY_ETH);
  if (override && isValidEthAddress(override)) return override;
  const env = process.env.ETHEREUM_WALLET_ADDRESS;
  if (!env) throw new Error("ETHEREUM_WALLET_ADDRESS is not configured");
  return env;
}

export async function setEthereumAddress(addr: string): Promise<boolean> {
  if (!isValidEthAddress(addr)) throw new Error("Invalid Ethereum address");
  return ledgerSet(KEY_ETH, addr.trim());
}

export async function getWalletSettings(): Promise<{
  monero: string;
  ethereum: string;
  moneroSource: "custom" | "default";
  ethereumSource: "custom" | "default";
  marginPercent: number;
  marginSource: "custom" | "default";
}> {
  const xmrOverride = await safeLedgerGet<string>(KEY_XMR);
  const ethOverride = await safeLedgerGet<string>(KEY_ETH);
  const marginOverride = await safeLedgerGet<number>(KEY_MARGIN);
  return {
    monero: await getMoneroAddress(),
    ethereum: await getEthereumAddress(),
    moneroSource: xmrOverride ? "custom" : "default",
    ethereumSource: ethOverride ? "custom" : "default",
    marginPercent: await getMarginPercent(),
    marginSource:
      typeof marginOverride === "number" && isValidMarginPercent(marginOverride)
        ? "custom"
        : "default",
  };
}
