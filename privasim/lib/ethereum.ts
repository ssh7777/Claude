// Ethereum/USDT payment utilities — SERVER-SIDE ONLY

import QRCode from "qrcode";
import { usdToEth } from "@/lib/prices";
import { generateSecureId } from "@/lib/crypto-utils";

function getEthAddress(): string {
  const addr = process.env.ETHEREUM_WALLET_ADDRESS;
  if (!addr) throw new Error("ETHEREUM_WALLET_ADDRESS is not configured");
  return addr;
}

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
  const address = getEthAddress();
  const amountEth = await usdToEth(amountUsd);
  const invoiceId = generateSecureId();
  // EIP-681: value must be decimal wei
  const amountWei = BigInt(Math.floor(amountEth * 1e18)).toString(10);

  const paymentUrl = `ethereum:${address}@1?value=${amountWei}`;

  const qrCode = await QRCode.toDataURL(paymentUrl, {
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

    if (tx.to?.toLowerCase() !== expectedAddress.toLowerCase()) return false;

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
