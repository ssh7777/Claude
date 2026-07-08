// Ethereum/USDT payment utilities — SERVER-SIDE ONLY

import QRCode from "qrcode";
import { usdToEth } from "@/lib/prices";
import { generateSecureId } from "@/lib/crypto-utils";
import { getEthereumAddress } from "@/lib/settings";

export interface EthereumPaymentInfo {
  address: string;
  amountEth: number;
  amountUsd: number;
  qrCode: string;
  paymentUrl: string;
  invoiceId: string;
}

export async function generateEthereumPaymentInfo(
  amountUsd: number
): Promise<EthereumPaymentInfo> {
  const address = await getEthereumAddress();
  const amountEth = await usdToEth(amountUsd);
  const invoiceId = generateSecureId();
  const amountWei = BigInt(Math.floor(amountEth * 1e18)).toString(10);

  const paymentUrl = `ethereum:${address}@1?value=${amountWei}`;

  // QR encodes the PLAIN address only. EIP-681 URIs confuse several wallets
  // and generic scanners, which append the URI parts to the address.
  const qrCode = await QRCode.toDataURL(address, {
    errorCorrectionLevel: "M",
    width: 256,
    margin: 2,
    color: { dark: "#1a1a2e", light: "#ffffff" },
  });

  return {
    address,
    amountEth,
    amountUsd,
    qrCode,
    paymentUrl,
    invoiceId,
  };
}

// USDT (ERC-20 on Ethereum mainnet). Stablecoin: 1 USDT = 1 USD, 6 decimals.
export const USDT_CONTRACT = "0xdAC17F958D2ee523a2206206994597C13D831ec7";

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
  const units = BigInt(Math.round(amountUsdt * 1e6)).toString(10);

  // EIP-681 token transfer URL — wallets prefill the USDT send screen
  const paymentUrl = `ethereum:${USDT_CONTRACT}@1/transfer?address=${address}&uint256=${units}`;

  // QR encodes OUR plain address only — never the token contract, which
  // scanners would otherwise present as the destination address.
  const qrCode = await QRCode.toDataURL(address, {
    errorCorrectionLevel: "M",
    width: 256,
    margin: 2,
    color: { dark: "#1a1a2e", light: "#ffffff" },
  });

  return { address, amountUsdt, amountUsd, qrCode, paymentUrl, invoiceId };
}

// Verify a USDT transfer to our address by decoding the Transfer event
// in the transaction receipt. Works on any public RPC — no API key.
export async function verifyUsdtPayment(
  txHash: string,
  expectedUsdt: number,
  expectedAddress: string
): Promise<{ ok: boolean; error?: string }> {
  try {
    const { ethers } = await import("ethers");
    const rpcs = [
      process.env.ETHEREUM_RPC_URL ?? "https://eth.llamarpc.com",
      "https://ethereum-rpc.publicnode.com",
      "https://cloudflare-eth.com",
    ];

    let receipt = null;
    for (const url of rpcs) {
      const provider = new ethers.JsonRpcProvider(url);
      receipt = await provider.getTransactionReceipt(txHash).catch(() => null);
      if (receipt) break;
    }
    if (!receipt) return { ok: false, error: "Transaction not found or not yet mined — wait ~30s and retry." };
    if (receipt.status !== 1) return { ok: false, error: "Transaction failed on-chain." };

    const transferTopic = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
    const to = expectedAddress.toLowerCase().replace(/^0x/, "").padStart(64, "0");

    for (const log of receipt.logs) {
      if (log.address.toLowerCase() !== USDT_CONTRACT.toLowerCase()) continue;
      if (log.topics[0] !== transferTopic) continue;
      if ((log.topics[2] ?? "").toLowerCase().slice(2) !== to) continue;
      const amount = Number(BigInt(log.data)) / 1e6;
      if (amount + 0.01 >= expectedUsdt * 0.95) return { ok: true };
      return { ok: false, error: `USDT amount too low: sent $${amount.toFixed(2)}, need $${expectedUsdt.toFixed(2)}.` };
    }
    return { ok: false, error: "No USDT transfer to the PRIVASIM address found in this transaction." };
  } catch {
    return { ok: false, error: "Could not reach Ethereum RPC — try again in 30 seconds." };
  }
}

export async function verifyEthereumPayment(
  txHash: string,
  expectedAmountEth: number,
  expectedAddress: string
): Promise<boolean> {
  if (!txHash || !expectedAddress) return false;

  try {
    const { ethers } = await import("ethers");
    const rpcUrl = process.env.ETHEREUM_RPC_URL ?? "https://eth.llamarpc.com";
    const provider = new ethers.JsonRpcProvider(rpcUrl);

    const tx = await provider.getTransaction(txHash);
    if (!tx) return false;

    const receipt = await provider.getTransactionReceipt(txHash);
    if (!receipt || receipt.status !== 1) return false;

    // Verify destination address
    if (tx.to?.toLowerCase() !== expectedAddress.toLowerCase()) return false;

    // Verify amount (within 2% tolerance)
    const sentEth = parseFloat(ethers.formatEther(tx.value));
    const tolerance = 0.02;
    const withinTolerance =
      Math.abs(sentEth - expectedAmountEth) / expectedAmountEth <= tolerance;

    return withinTolerance;
  } catch {
    return false;
  }
}

export function getEthWebhookSecret(): string {
  const secret = process.env.ETHEREUM_WEBHOOK_SECRET;
  if (!secret) throw new Error("ETHEREUM_WEBHOOK_SECRET is not configured");
  return secret;
}
