// Monero invoices use one fresh Wallet-RPC subaddress per order. Manual and
// webhook verification both query our own wallet; explorer lookups and values
// supplied by clients/webhook bodies are never sufficient to release an eSIM.

import QRCode from "qrcode";
import { randomUUID } from "node:crypto";
import { usdToXmr } from "@/lib/prices";
import { generateSecureId } from "@/lib/crypto-utils";

const MONERO_ATOMIC_UNITS = BigInt(1_000_000_000_000);

export interface MoneroPaymentInfo {
  address: string;
  amountXmr: number;
  amountUsd: number;
  qrCode: string;
  paymentUrl: string;
  invoiceId: string;
  accountIndex: number;
  subaddressIndex: number;
}

interface RpcError {
  code?: number;
  message?: string;
}

interface WalletRpcResponse<T> {
  result?: T;
  error?: RpcError;
}

function walletRpcConfig(): { url: string; auth: string } {
  const configuredUrl = process.env.MONERO_WALLET_RPC_URL?.trim();
  const username = process.env.MONERO_WALLET_RPC_USER?.trim();
  const password = process.env.MONERO_WALLET_RPC_PASSWORD;
  if (!configuredUrl || !username || !password) {
    throw new Error("Monero wallet RPC URL and credentials are required");
  }
  const parsed = new URL(configuredUrl);
  const localHost = parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1";
  if (parsed.protocol !== "https:" && !(process.env.NODE_ENV !== "production" && localHost)) {
    throw new Error("Monero wallet RPC must use HTTPS in production");
  }
  return {
    url: parsed.toString().replace(/\/$/, ""),
    auth: `Basic ${Buffer.from(`${username}:${password}`).toString("base64")}`,
  };
}

async function walletRpc<T>(method: string, params: Record<string, unknown>): Promise<T> {
  const config = walletRpcConfig();
  const response = await fetch(`${config.url}/json_rpc`, {
    method: "POST",
    headers: {
      Authorization: config.auth,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({ jsonrpc: "2.0", id: randomUUID(), method, params }),
    cache: "no-store",
    signal: AbortSignal.timeout(8_000),
  });
  if (!response.ok) throw new Error(`Monero wallet RPC returned HTTP ${response.status}`);
  const data = await response.json() as WalletRpcResponse<T>;
  if (data.error) throw new Error(`Monero wallet RPC error ${data.error.code ?? "unknown"}`);
  if (!data.result) throw new Error("Monero wallet RPC returned no result");
  return data.result;
}

async function createInvoiceSubaddress(invoiceId: string): Promise<{ address: string; accountIndex: number; index: number }> {
  const accountIndex = Number(process.env.MONERO_ACCOUNT_INDEX ?? 0);
  if (!Number.isSafeInteger(accountIndex) || accountIndex < 0) {
    throw new Error("MONERO_ACCOUNT_INDEX must be a non-negative integer");
  }
  const walletAddress = await walletRpc<{ address: string }>("get_address", { account_index: accountIndex });
  const configuredPrimary = process.env.MONERO_WALLET_PRIMARY?.trim();
  if (!configuredPrimary || configuredPrimary !== walletAddress.address) {
    throw new Error("MONERO_WALLET_PRIMARY does not match the wallet loaded by Wallet RPC");
  }
  const result = await walletRpc<{ address: string; address_index: number }>("create_address", {
    account_index: accountIndex,
    label: `PRIVASIM-${invoiceId}`,
  });
  if (!result.address || !Number.isSafeInteger(result.address_index) || result.address_index < 0) {
    throw new Error("Monero wallet RPC did not return a valid subaddress");
  }
  return { address: result.address, accountIndex, index: result.address_index };
}

function ceilToEightDecimals(value: number): number {
  return Math.ceil((value - Number.EPSILON) * 100_000_000) / 100_000_000;
}

export async function generateMoneroPaymentInfo(amountUsd: number): Promise<MoneroPaymentInfo> {
  if (!Number.isFinite(amountUsd) || amountUsd <= 0) throw new Error("Invalid invoice amount");
  const invoiceId = generateSecureId();
  const [quotedAmount, subaddress] = await Promise.all([
    usdToXmr(amountUsd),
    createInvoiceSubaddress(invoiceId),
  ]);
  const amountXmr = ceilToEightDecimals(quotedAmount);
  if (!Number.isFinite(amountXmr) || amountXmr <= 0) throw new Error("Unable to quote a Monero amount");

  const paymentUrl = `monero:${subaddress.address}?tx_amount=${amountXmr.toFixed(8)}&tx_description=PRIVASIM-${invoiceId}`;
  const qrCode = await QRCode.toDataURL(paymentUrl, {
    errorCorrectionLevel: "M",
    width: 256,
    margin: 2,
    color: { dark: "#1a1a2e", light: "#ffffff" },
  });

  return {
    address: subaddress.address,
    amountXmr,
    amountUsd,
    qrCode,
    paymentUrl,
    invoiceId,
    accountIndex: subaddress.accountIndex,
    subaddressIndex: subaddress.index,
  };
}

export interface MoneroVerificationResult {
  ok: boolean;
  confirmations: number;
  error?: string;
}

export async function verifyMoneroPayment(
  txHash: string,
  expectedAmountXmr: number,
  expectedSubaddressIndex: number,
  expectedAccountIndex: number
): Promise<MoneroVerificationResult> {
  const normalizedHash = txHash.trim().toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(normalizedHash)) {
    return { ok: false, confirmations: 0, error: "Invalid Monero transaction hash." };
  }
  if (!Number.isSafeInteger(expectedSubaddressIndex) || expectedSubaddressIndex < 0 ||
      !Number.isSafeInteger(expectedAccountIndex) || expectedAccountIndex < 0) {
    return { ok: false, confirmations: 0, error: "This invoice has no verifiable Monero subaddress." };
  }

  const result = await walletRpc<{
    transfer?: {
      amount?: string | number;
      confirmations?: number;
      txid?: string;
      type?: string;
      subaddr_index?: { major?: number; minor?: number };
    };
  }>("get_transfer_by_txid", { txid: normalizedHash });
  const transfer = result.transfer;
  if (!transfer || transfer.txid?.toLowerCase() !== normalizedHash) {
    return { ok: false, confirmations: 0, error: "Transaction was not found in the receiving wallet." };
  }

  const confirmations = Number(transfer.confirmations ?? 0);
  if (!Number.isSafeInteger(confirmations) || confirmations < 0) {
    return { ok: false, confirmations: 0, error: "Monero wallet returned an invalid confirmation count." };
  }
  if (transfer.type?.toLowerCase() !== "in") {
    return { ok: false, confirmations, error: "Transaction is not an incoming payment." };
  }
  if (transfer.subaddr_index?.minor !== expectedSubaddressIndex) {
    return { ok: false, confirmations, error: "Payment was sent to a different Monero invoice address." };
  }
  if (transfer.subaddr_index?.major !== expectedAccountIndex) {
    return { ok: false, confirmations, error: "Payment was received by a different Monero account." };
  }

  let receivedAtomic: bigint;
  try {
    receivedAtomic = BigInt(transfer.amount ?? 0);
  } catch {
    return { ok: false, confirmations, error: "Monero wallet returned an invalid payment amount." };
  }
  const requiredAtomic = BigInt(Math.ceil(expectedAmountXmr * Number(MONERO_ATOMIC_UNITS)));
  if (receivedAtomic < requiredAtomic) {
    return { ok: false, confirmations, error: "Monero payment amount is below the invoice amount." };
  }
  if (confirmations < 10) {
    return { ok: false, confirmations, error: "Monero payment needs at least 10 confirmations." };
  }

  return { ok: true, confirmations };
}

export function getMoneroWebhookSecret(): string {
  const secret = process.env.MONERO_WEBHOOK_SECRET;
  if (!secret || secret.length < 32) throw new Error("MONERO_WEBHOOK_SECRET must be at least 32 chars");
  return secret;
}
