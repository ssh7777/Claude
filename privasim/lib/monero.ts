// Monero payment utilities — SERVER-SIDE ONLY

import QRCode from "qrcode";
import { usdToXmr } from "@/lib/prices";
import { generateSecureId } from "@/lib/crypto-utils";
import { getMoneroAddress } from "@/lib/settings";

export interface MoneroPaymentInfo {
  address: string;
  amountXmr: number;
  amountUsd: number;
  qrCode: string;
  paymentUrl: string;
  invoiceId: string;
}

export async function generateMoneroPaymentInfo(
  amountUsd: number
): Promise<MoneroPaymentInfo> {
  const address = await getMoneroAddress();
  const amountXmr = await usdToXmr(amountUsd);
  const invoiceId = generateSecureId();

  const paymentUrl = `monero:${address}?amount=${amountXmr.toFixed(12)}&tx_description=PRIVASIM-${invoiceId}`;

  // QR encodes the PLAIN address only — URI params confuse some wallets
  // and generic scanners into treating them as part of the address.
  const qrCode = await QRCode.toDataURL(address, {
    errorCorrectionLevel: "M",
    width: 256,
    margin: 2,
    color: { dark: "#1a1a2e", light: "#ffffff" },
  });

  return {
    address,
    amountXmr,
    amountUsd,
    qrCode,
    paymentUrl,
    invoiceId,
  };
}

export async function verifyMoneroPayment(
  txHash: string,
  expectedAmountXmr: number,
  expectedAddress: string
): Promise<boolean> {
  // In production: query Monero RPC node or use a Monero explorer API
  // to verify:
  // 1. Transaction exists and is confirmed (>= 10 blocks)
  // 2. Amount matches (within 0.1% tolerance for price fluctuation)
  // 3. Payment was sent to our address
  //
  // For MVP with webhook-based confirmation, the webhook handler does this check
  // using the blockchain data provided by the monitoring service (e.g., XMR.to, MoneroOcean)

  if (!txHash || !expectedAddress) return false;

  // Tolerance: allow ±2% price fluctuation during payment window
  const tolerance = 0.02;

  try {
    // TODO: Replace with actual Monero RPC call
    // const rpcResult = await fetch(`${process.env.MONERO_RPC_URL}/get_transfer_by_txid`, {
    //   method: "POST",
    //   headers: { "Content-Type": "application/json" },
    //   body: JSON.stringify({ txid: txHash }),
    // });
    // const data = await rpcResult.json();
    // const receivedAmount = data.result?.transfer?.amount / 1e12; // piconero to XMR
    // return Math.abs(receivedAmount - expectedAmountXmr) / expectedAmountXmr <= tolerance;
    return true; // Placeholder until RPC is configured
  } catch {
    return false;
  }
}

export function getMoneroWebhookSecret(): string {
  const secret = process.env.MONERO_WEBHOOK_SECRET;
  if (!secret) throw new Error("MONERO_WEBHOOK_SECRET is not configured");
  return secret;
}
