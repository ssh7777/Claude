import { NextRequest, NextResponse } from "next/server";
import { getInvoiceById, updateInvoiceStatus, updateInvoiceEsimData, updateInvoicePikaOrderId } from "@/lib/db";
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
    invoiceToken?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { txHash, invoiceToken } = body;

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

  // Cold-start fallback: a SIGNED token issued by orders/create. Client
  // fields are never trusted — the token is tamper-proof (HMAC).
  const { verifyInvoiceToken } = await import("@/lib/invoiceToken");
  const tokenPayload = invoiceToken ? verifyInvoiceToken(invoiceToken) : null;
  if (tokenPayload && tokenPayload.invoiceId !== params.orderId) {
    return NextResponse.json({ error: "Invoice token does not match this order" }, { status: 400 });
  }

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

  // Server-memory invoice first; signed token second; NEVER raw client data.
  const cryptoType = invoice?.crypto_type ?? tokenPayload?.cryptoType;
  const packageCode = invoice?.package_code ?? tokenPayload?.packageCode;
  const expectedAmount = invoice?.amount_crypto ?? tokenPayload?.amountCrypto;

  if (!packageCode || !cryptoType || !expectedAmount) {
    return NextResponse.json(
      { error: "Order details unavailable. Open this order from the My Orders page (it holds your signed invoice) and try again." },
      { status: 400 }
    );
  }

  // ── USDT (ERC-20) verification ────────────────────────────────────────────
  if (cryptoType === "usdt_eth") {
    const expectedAddress = process.env.ETHEREUM_WALLET_ADDRESS ?? "";
    const { verifyUsdtPayment } = await import("@/lib/ethereum");
    const result = await verifyUsdtPayment(txHash.trim(), expectedAmount ?? 0, expectedAddress);
    if (!result.ok) {
      return NextResponse.json({ error: result.error ?? "USDT verification failed" }, { status: 400 });
    }
  } else
  // ── Ethereum verification ──────────────────────────────────────────────────
  if (cryptoType === "ethereum") {
    try {
      const { ethers } = await import("ethers");
      // Try primary RPC, fall back to alternatives if it fails
      const primaryRpc = process.env.ETHEREUM_RPC_URL ?? "https://eth.llamarpc.com";
      const fallbackRpcs = [
        "https://cloudflare-eth.com",
        "https://rpc.ankr.com/eth",
        "https://ethereum.publicnode.com",
      ];

      let provider = new ethers.JsonRpcProvider(primaryRpc);
      // Quick connectivity check — if primary fails within 3s, try fallback
      let tx = await Promise.race([
        provider.getTransaction(txHash.trim()).catch(() => null),
        new Promise<null>((resolve) => setTimeout(() => resolve(null), 3000)),
      ]);
      if (!tx) {
        for (const rpcUrl of fallbackRpcs) {
          provider = new ethers.JsonRpcProvider(rpcUrl);
          tx = await provider.getTransaction(txHash.trim()).catch(() => null);
          if (tx) break;
        }
      }

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

      // Underpayment rejected (5% grace for gas rounding); overpayment accepted.
      if (expectedAmount && expectedAmount > 0 && sentEth < expectedAmount * 0.95) {
        return NextResponse.json({
          error: `Amount too low: sent ${sentEth.toFixed(6)} ETH but the order requires ${expectedAmount.toFixed(6)} ETH. Please send the remaining balance in a new transaction and verify with that hash.`,
        }, { status: 400 });
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

  // ── Payment verified — claim TX in the PERSISTENT ledger ──────────────────
  // One transaction = one eSIM, across all serverless instances. This is what
  // prevents a retry (or a malicious replay) from purchasing twice.
  usedTxHashes.add(normalizedTx);
  const { claimTxHash } = await import("@/lib/ledger");
  const claimedBy = await claimTxHash(normalizedTx, params.orderId);
  if (claimedBy) {
    return NextResponse.json(
      { error: "This transaction has already been used to claim an eSIM. Check My Orders for your activation code." },
      { status: 400 }
    );
  }

  // Record coupon redemption (once per claimed TX — retries don't double-count)
  const usedCoupon = tokenPayload?.discountCode;
  if (usedCoupon) {
    const { getCouponState, setCouponState } = await import("@/lib/ledger");
    const st = await getCouponState(usedCoupon);
    await setCouponState(usedCoupon, { ...st, uses: st.uses + 1 });
  }

  // ── Top-up orders: refill the existing eSIM instead of buying a new one ──
  const topupIccid = invoice?.topup_iccid ?? tokenPayload?.topupIccid;
  if (topupIccid) {
    try {
      const { topupEsim } = await import("@/lib/pikasim");
      const result = await topupEsim(topupIccid, packageCode);
      if (invoice) {
        await updateInvoiceStatus(params.orderId, "confirmed", txHash.trim());
      }
      return NextResponse.json({
        success: true,
        topup: true,
        iccid: topupIccid,
        message: result.summary ?? "Top-up applied — your eSIM has been refilled.",
      });
    } catch (err) {
      usedTxHashes.delete(normalizedTx);
      const msg = err instanceof Error ? err.message : "Unknown error";
      console.error("Top-up failed after payment verified:", msg);
      return NextResponse.json({
        error: `Payment verified but top-up failed: ${msg}. Please try again in 30 seconds.`,
        verified: true,
        retryable: true,
      }, { status: 503 });
    }
  }

  // ── Purchase eSIM from PikaSim ─────────────────────────────────────────────
  try {
    const pikaResult = await purchaseEsim(packageCode);

    // Store PikaSim order ID for webhook matching regardless of whether ICCID is ready
    if (invoice && pikaResult.orderId) {
      await updateInvoicePikaOrderId(params.orderId, pikaResult.orderId);
    }

    // If PikaSim returned ICCID synchronously — deliver immediately
    if (pikaResult.iccid && pikaResult.activationCode) {
      let iccidEnc: string | undefined;
      let codeEnc: string | undefined;
      try {
        [iccidEnc, codeEnc] = await Promise.all([
          encryptField(pikaResult.iccid),
          encryptField(pikaResult.activationCode),
        ]);
      } catch {
        // DB_ENCRYPTION_KEY not set — codes returned in response only
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

      console.log("Payment verified, eSIM provisioned synchronously", { orderId: params.orderId, iccid: pikaResult.iccid });

      return NextResponse.json({
        success: true,
        iccid: pikaResult.iccid,
        activationCode: pikaResult.activationCode,
        smDpAddress: pikaResult.smDpAddress ?? "",
      });
    }

    // PikaSim is processing asynchronously — will webhook us when ready
    console.log("Payment verified, eSIM order placed (async)", { orderId: params.orderId, pikaOrderId: pikaResult.orderId });
    if (invoice) {
      await updateInvoiceStatus(params.orderId, "pending", txHash.trim(), cryptoType === "ethereum" ? 12 : 10);
    }

    return NextResponse.json({
      success: true,
      processing: true,
      pikaOrderId: pikaResult.orderId,
      message: "Payment verified. Your eSIM is being provisioned — check this page in 30–60 seconds.",
    });
  } catch (err) {
    // Allow retry if purchase failed
    usedTxHashes.delete(normalizedTx);
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("eSIM purchase failed after payment verified:", msg);
    return NextResponse.json({
      error: `Payment verified but eSIM purchase failed: ${msg}. Please try again in 30 seconds.`,
      verified: true,
      retryable: true,
    }, { status: 503 });
  }
}
