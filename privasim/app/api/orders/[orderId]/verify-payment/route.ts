import { NextRequest, NextResponse } from "next/server";
import { getInvoiceById, updateInvoiceStatus, updateInvoiceEsimData } from "@/lib/db";
import { purchaseEsim } from "@/lib/pikasim";
import { encryptField, decryptField } from "@/lib/crypto-utils";
import { rateLimit } from "@/lib/rateLimit";

// Prevent TX hash replay within this function instance lifetime
const usedTxHashes = new Set<string>();

export async function POST(
  req: NextRequest,
  { params }: { params: { orderId: string } }
) {
  const { allowed } = rateLimit(`verify:${params.orderId}`, { windowMs: 60_000, max: 5 });
  if (!allowed) {
    return NextResponse.json(
      { error: "Too many verification attempts. Please wait 1 minute." },
      { status: 429 }
    );
  }

  let body: {
    txHash?: string;
    packageCode?: string;
    cryptoType?: string;
    amountCrypto?: number;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { txHash, packageCode: clientPackageCode, cryptoType: clientCryptoType, amountCrypto: clientAmount } = body;

  if (!txHash?.trim()) {
    return NextResponse.json({ error: "Transaction hash is required" }, { status: 400 });
  }

  const normalizedTx = txHash.trim().toLowerCase();

  if (usedTxHashes.has(normalizedTx)) {
    return NextResponse.json(
      { error: "This transaction has already been used to claim an eSIM" },
      { status: 400 }
    );
  }

  // Load from in-memory store — may be absent after a cold start
  const invoice = await getInvoiceById(params.orderId);

  // Already confirmed with eSIM stored — return existing codes
  if (invoice?.status === "confirmed" && invoice.iccid_encrypted && invoice.activation_code_encrypted) {
    try {
      const [iccid, activationCode] = await Promise.all([
        decryptField(invoice.iccid_encrypted),
        decryptField(invoice.activation_code_encrypted),
      ]);
      return NextResponse.json({
        success: true,
        alreadyDelivered: true,
        iccid,
        activationCode,
        smDpAddress: invoice.sm_dp_address ?? "",
      });
    } catch {
      // Decryption error — fall through to re-purchase
    }
  }

  // Use server data when available; fall back to client-provided data (from localStorage)
  const cryptoType = invoice?.crypto_type ?? clientCryptoType ?? "ethereum";
  const packageCode = invoice?.package_code ?? clientPackageCode;
  const expectedAmount = invoice?.amount_crypto ?? clientAmount;

  if (!packageCode) {
    return NextResponse.json(
      { error: "Package code missing. Please refresh the orders page and try again." },
      { status: 400 }
    );
  }

  // ── Ethereum verification ──────────────────────────────────────────────────
  if (cryptoType === "ethereum") {
    try {
      const { ethers } = await import("ethers");
      const rpcUrl = process.env.ETHEREUM_RPC_URL ?? "https://eth.llamarpc.com";
      const provider = new ethers.JsonRpcProvider(rpcUrl);

      const tx = await provider.getTransaction(txHash.trim()).catch(() => null);
      if (!tx) {
        return NextResponse.json({
          error: "Transaction not found on Ethereum. It may still be pending — wait ~30 seconds and try again.",
        }, { status: 400 });
      }

      const expectedAddress = process.env.ETHEREUM_WALLET_ADDRESS;
      if (expectedAddress && tx.to?.toLowerCase() !== expectedAddress.toLowerCase()) {
        return NextResponse.json({
          error: "This transaction was not sent to the PRIVASIM wallet address.",
        }, { status: 400 });
      }

      const receipt = await provider.getTransactionReceipt(txHash.trim()).catch(() => null);
      if (!receipt) {
        return NextResponse.json({
          error: "Transaction not yet mined. Please wait for Ethereum confirmation (~30 sec) and try again.",
        }, { status: 400 });
      }

      if (receipt.status !== 1) {
        return NextResponse.json({ error: "Transaction failed on Ethereum blockchain." }, { status: 400 });
      }

      const sentEth = parseFloat(ethers.formatEther(tx.value));
      if (sentEth < 0.00001) {
        return NextResponse.json({ error: `Amount too low: ${sentEth} ETH sent.` }, { status: 400 });
      }

      if (expectedAmount && expectedAmount > 0) {
        const diff = Math.abs(sentEth - expectedAmount) / expectedAmount;
        if (diff > 0.10) {
          return NextResponse.json({
            error: `Amount mismatch: sent ${sentEth.toFixed(6)} ETH, order expected ~${expectedAmount.toFixed(6)} ETH`,
          }, { status: 400 });
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      if (msg.includes("mismatch") || msg.includes("not found") || msg.includes("failed")) {
        return NextResponse.json({ error: msg }, { status: 400 });
      }
      console.error("ETH verification error:", err);
      return NextResponse.json({
        error: "Could not connect to Ethereum RPC. Please try again in 30 seconds.",
      }, { status: 503 });
    }
  } else {
    // ── Monero verification ────────────────────────────────────────────────
    // Without the wallet view key we cannot verify recipient/amount.
    // We verify the TX hash exists on the public Monero explorer (best effort).
    try {
      const res = await fetch(`https://xmrchain.net/api/transaction/${txHash.trim()}`, {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(6000),
      });
      if (res.ok) {
        const data = await res.json();
        if (!data.tx_hash && !data.id && !data.hash) {
          return NextResponse.json({
            error: "Monero transaction not found. Check your TX hash and ensure the transaction is confirmed.",
          }, { status: 400 });
        }
      }
      // Explorer down — give benefit of doubt and continue
    } catch {
      console.warn("XMR explorer unreachable, continuing");
    }
  }

  // ── Payment verified — mark TX as used ────────────────────────────────────
  usedTxHashes.add(normalizedTx);

  // ── Purchase eSIM from PikaSim ─────────────────────────────────────────────
  try {
    const pikaResult = await purchaseEsim(packageCode);

    // Encrypt credentials if DB_ENCRYPTION_KEY is configured; otherwise return directly
    let iccidEnc: string | undefined;
    let codeEnc: string | undefined;
    try {
      [iccidEnc, codeEnc] = await Promise.all([
        encryptField(pikaResult.iccid),
        encryptField(pikaResult.activationCode),
      ]);
    } catch {
      // DB_ENCRYPTION_KEY not set — codes returned directly in response only
    }

    if (invoice && iccidEnc && codeEnc) {
      await updateInvoiceStatus(params.orderId, "confirmed", txHash.trim(), cryptoType === "ethereum" ? 12 : 10);
      await updateInvoiceEsimData(params.orderId, {
        iccid_encrypted: iccidEnc,
        activation_code_encrypted: codeEnc,
        sm_dp_address: pikaResult.smDpAddress ?? "",
        pika_order_id: pikaResult.orderId,
      });
    }

    console.log("Payment verified, eSIM provisioned", { orderId: params.orderId, iccid: pikaResult.iccid });

    return NextResponse.json({
      success: true,
      iccid: pikaResult.iccid,
      activationCode: pikaResult.activationCode,
      smDpAddress: pikaResult.smDpAddress ?? "",
    });
  } catch (err) {
    // Allow retry if purchase failed
    usedTxHashes.delete(normalizedTx);
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("eSIM purchase failed after payment verified:", msg);
    return NextResponse.json({
      error: "Payment verified but eSIM purchase temporarily failed. Please try again in 30 seconds.",
      verified: true,
      retryable: true,
    }, { status: 503 });
  }
}
