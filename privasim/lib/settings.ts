// Runtime-mutable settings — wallet addresses the owner can change from the
// admin dashboard WITHOUT a redeploy. Stored in the persistent ledger
// (Vercel Edge Config) with env vars as the fallback/default.
//
// Security:
//  - Reads are public-server-side only (used to build payment invoices).
//  - Writes go through /api/admin/settings, gated by the reseller API key,
//    with strict address-format validation. A bad address can misroute
//    customer funds, so validation is conservative.

import { ledgerGet, ledgerSet } from "@/lib/ledger";

const KEY_XMR = "set_wallet_xmr";
const KEY_ETH = "set_wallet_eth";

export function isValidMoneroAddress(addr: string): boolean {
  // Standard (4...) or integrated (8...) mainnet address, 95 or 106 base58 chars.
  return /^[48][0-9AB][1-9A-HJ-NP-Za-km-z]{93}([1-9A-HJ-NP-Za-km-z]{11})?$/.test(addr.trim());
}

export function isValidEthAddress(addr: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(addr.trim());
}

export async function getMoneroAddress(): Promise<string> {
  const override = await ledgerGet<string>(KEY_XMR);
  if (override && isValidMoneroAddress(override)) return override;
  const env = process.env.MONERO_WALLET_PRIMARY;
  if (!env) throw new Error("MONERO_WALLET_PRIMARY is not configured");
  return env;
}

export async function getEthereumAddress(): Promise<string> {
  const override = await ledgerGet<string>(KEY_ETH);
  if (override && isValidEthAddress(override)) return override;
  const env = process.env.ETHEREUM_WALLET_ADDRESS;
  if (!env) throw new Error("ETHEREUM_WALLET_ADDRESS is not configured");
  return env;
}

export async function setMoneroAddress(addr: string): Promise<boolean> {
  if (!isValidMoneroAddress(addr)) throw new Error("Invalid Monero address");
  return ledgerSet(KEY_XMR, addr.trim());
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
}> {
  const xmrOverride = await ledgerGet<string>(KEY_XMR);
  const ethOverride = await ledgerGet<string>(KEY_ETH);
  return {
    monero: await getMoneroAddress(),
    ethereum: await getEthereumAddress(),
    moneroSource: xmrOverride ? "custom" : "default",
    ethereumSource: ethOverride ? "custom" : "default",
  };
}
