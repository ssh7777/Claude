// Ethereum native ETH and USDT (ERC-20, Ethereum mainnet) payment helpers.

import QRCode from "qrcode";
import { usdToEth } from "@/lib/prices";
import { generateSecureId } from "@/lib/crypto-utils";
import { getEthereumAddress } from "@/lib/settings";

const DISPLAY_PRECISION = 100_000_000;
const WEI_PER_DISPLAY_UNIT = BigInt(10) ** BigInt(10);
const USDT_BASE_UNITS_PER_CENT = BigInt(10_000);
const ETH_MIN_CONFIRMATIONS = 12;

export interface EthereumPaymentInfo {
  address: string;
  amountEth: number;
  amountUsd: number;
  qrCode: string;
  paymentUrl: string;
  invoiceId: string;
}

function ceilToEightDecimals(value: number): number {
  return Math.ceil((value - Number.EPSILON) * DISPLAY_PRECISION) / DISPLAY_PRECISION;
}

async function addressQr(address: string): Promise<string> {
  return QRCode.toDataURL(address, {
    errorCorrectionLevel: "M",
    width: 256,
    margin: 2,
    color: { dark: "#1a1a2e", light: "#ffffff" },
  });
}

export async function generateEthereumPaymentInfo(amountUsd: number): Promise<EthereumPaymentInfo> {
  const address = await getEthereumAddress();
  const amountEth = ceilToEightDecimals(await usdToEth(amountUsd));
  if (!Number.isFinite(amountEth) || amountEth <= 0) throw new Error("Unable to quote an ETH amount");
  const invoiceId = generateSecureId();
  const amountWei = BigInt(Math.round(amountEth * DISPLAY_PRECISION)) * WEI_PER_DISPLAY_UNIT;
  const paymentUrl = `ethereum:${address}@1?value=${amountWei.toString(10)}`;
  return {
    address,
    amountEth,
    amountUsd,
    qrCode: await addressQr(address),
    paymentUrl,
    invoiceId,
  };
}

// USDT (ERC-20 on Ethereum mainnet): 6 token decimals, priced at USD cents.
export const USDT_CONTRACT = "0xdAC17F958D2ee523a2206206994597C13D831ec7";
export const USDT_TRANSFER_TOPIC = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";

export interface UsdtPaymentInfo {
  address: string;
  amountUsdt: number;
  amountUsd: number;
  qrCode: string;
  paymentUrl: string;
  invoiceId: string;
}

export async function generateUsdtPaymentInfo(amountUsd: number): Promise<UsdtPaymentInfo> {
  const address = await getEthereumAddress();
  const amountUsdt = Math.ceil(amountUsd * 100) / 100;
  const invoiceId = generateSecureId();
  const units = BigInt(Math.round(amountUsdt * 100)) * USDT_BASE_UNITS_PER_CENT;
  const paymentUrl = `ethereum:${USDT_CONTRACT}@1/transfer?address=${address}&uint256=${units.toString(10)}`;
  return { address, amountUsdt, amountUsd, qrCode: await addressQr(address), paymentUrl, invoiceId };
}

function rpcUrls(): string[] {
  return [
    process.env.ETHEREUM_RPC_URL?.trim(),
    "https://ethereum-rpc.publicnode.com",
    "https://cloudflare-eth.com",
  ].filter((url): url is string => Boolean(url));
}

async function getMainnetProvider() {
  const { ethers } = await import("ethers");
  let lastError: unknown;
  for (const url of [...new Set(rpcUrls())]) {
    let provider: InstanceType<typeof ethers.JsonRpcProvider> | undefined;
    try {
      provider = new ethers.JsonRpcProvider(url);
      const network = await provider.getNetwork();
      if (network.chainId !== BigInt(1)) {
        provider.destroy();
        continue;
      }
      return { provider };
    } catch (error) {
      provider?.destroy();
      lastError = error;
    }
  }
  throw lastError instanceof Error ? lastError : new Error("No Ethereum mainnet RPC is available");
}

async function getConfirmedTransaction(txHash: string) {
  if (!/^0x[a-fA-F0-9]{64}$/.test(txHash)) throw new Error("Invalid Ethereum transaction hash.");
  const { provider } = await getMainnetProvider();
  try {
    const transaction = await provider.getTransaction(txHash);
    if (!transaction) throw new Error("Transaction not found on Ethereum mainnet.");
    const receipt = await provider.getTransactionReceipt(txHash);
    if (!receipt) throw new Error("Transaction is not yet mined.");
    if (receipt.status !== 1) throw new Error("Transaction failed on Ethereum mainnet.");
    const blockNumber = await provider.getBlockNumber();
    const confirmations = Math.max(0, blockNumber - receipt.blockNumber + 1);
    if (confirmations < ETH_MIN_CONFIRMATIONS) {
      throw new Error(`Ethereum payment needs at least ${ETH_MIN_CONFIRMATIONS} confirmations.`);
    }
    return { provider, transaction, receipt, confirmations };
  } catch (error) {
    provider.destroy();
    throw error;
  }
}

export interface PaymentVerificationResult {
  ok: boolean;
  confirmations: number;
  error?: string;
}

function safeVerificationError(error: unknown): string {
  const message = error instanceof Error ? error.message : "Payment verification failed.";
  if (/^(Invalid|Transaction|Ethereum payment)/.test(message)) return message;
  return "Ethereum RPC verification is temporarily unavailable.";
}

export async function verifyEthereumPayment(
  txHash: string,
  expectedAmountEth: number,
  expectedAddress: string
): Promise<PaymentVerificationResult> {
  if (!/^0x[a-fA-F0-9]{40}$/.test(expectedAddress) || !Number.isFinite(expectedAmountEth) || expectedAmountEth <= 0) {
    return { ok: false, confirmations: 0, error: "Invalid invoice payment details." };
  }
  let verification: Awaited<ReturnType<typeof getConfirmedTransaction>> | undefined;
  try {
    verification = await getConfirmedTransaction(txHash);
    if (verification.transaction.to?.toLowerCase() !== expectedAddress.toLowerCase()) {
      return { ok: false, confirmations: verification.confirmations, error: "Payment was not sent to this invoice address." };
    }
    const requiredWei = BigInt(Math.round(expectedAmountEth * DISPLAY_PRECISION)) * WEI_PER_DISPLAY_UNIT;
    if (verification.transaction.value < requiredWei) {
      return { ok: false, confirmations: verification.confirmations, error: "ETH payment amount is below the invoice amount." };
    }
    return { ok: true, confirmations: verification.confirmations };
  } catch (error) {
    return { ok: false, confirmations: verification?.confirmations ?? 0, error: safeVerificationError(error) };
  } finally {
    verification?.provider.destroy();
  }
}

export async function verifyUsdtPayment(
  txHash: string,
  expectedUsdt: number,
  expectedAddress: string
): Promise<PaymentVerificationResult> {
  if (!/^0x[a-fA-F0-9]{40}$/.test(expectedAddress) || !Number.isFinite(expectedUsdt) || expectedUsdt <= 0) {
    return { ok: false, confirmations: 0, error: "Invalid invoice payment details." };
  }
  let verification: Awaited<ReturnType<typeof getConfirmedTransaction>> | undefined;
  try {
    verification = await getConfirmedTransaction(txHash);
    const receiverTopic = `0x${expectedAddress.toLowerCase().slice(2).padStart(64, "0")}`;
    let receivedUnits = BigInt(0);
    for (const log of verification.receipt.logs) {
      if (log.address.toLowerCase() !== USDT_CONTRACT.toLowerCase()) continue;
      if (log.topics[0]?.toLowerCase() !== USDT_TRANSFER_TOPIC) continue;
      if (log.topics[2]?.toLowerCase() !== receiverTopic) continue;
      receivedUnits += BigInt(log.data);
    }
    const requiredUnits = BigInt(Math.round(expectedUsdt * 100)) * USDT_BASE_UNITS_PER_CENT;
    if (receivedUnits < requiredUnits) {
      return { ok: false, confirmations: verification.confirmations, error: "USDT payment amount to this invoice address is insufficient." };
    }
    return { ok: true, confirmations: verification.confirmations };
  } catch (error) {
    return { ok: false, confirmations: verification?.confirmations ?? 0, error: safeVerificationError(error) };
  } finally {
    verification?.provider.destroy();
  }
}

export function getEthWebhookSecret(): string {
  const secret = process.env.ETHEREUM_WEBHOOK_SECRET;
  if (!secret || secret.length < 32) throw new Error("ETHEREUM_WEBHOOK_SECRET must be at least 32 chars");
  return secret;
}
