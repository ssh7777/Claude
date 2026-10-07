import { NextRequest, NextResponse } from "next/server";
import { getInvoiceById } from "@/lib/db";
import { verifyInvoiceToken } from "@/lib/invoiceToken";
import { verifyMoneroPayment } from "@/lib/monero";
import { verifyEthereumPayment, verifyUsdtPayment } from "@/lib/ethereum";
import { decryptField } from "@/lib/crypto-utils";
import { fulfillPaidInvoice } from "@/lib/fulfillment";
import { rateLimit } from "@/lib/rateLimit";
import { decodeWebhookBody, readLimitedBody } from "@/lib/webhook";

export async function POST(req: NextRequest, props: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await props.params;
  if (!/^[a-f0-9]{32}$/.test(orderId)) {
    return NextResponse.json({ error: "Order not found." }, { status: 404 });
  }

  let rawBody: Uint8Array;
  try {
    rawBody = await readLimitedBody(req, 4_096);
  } catch {
    return NextResponse.json({ error: "Request body too large" }, { status: 413 });
  }
  const rawText = decodeWebhookBody(rawBody);
  if (rawText === null) return NextResponse.json({ error: "Invalid UTF-8 payload" }, { status: 400 });

  let body: { txHash?: unknown; invoiceToken?: unknown };
  try {
    const parsed: unknown = JSON.parse(rawText);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("Invalid object");
    body = parsed as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const txHash = typeof body.txHash === "string" ? body.txHash.trim() : "";
  const invoiceToken = typeof body.invoiceToken === "string" ? body.invoiceToken : "";
  if (!txHash || txHash.length > 128 || !invoiceToken) {
    return NextResponse.json({ error: "Transaction hash and invoice token are required." }, { status: 400 });
  }

  const token = verifyInvoiceToken(invoiceToken);
  if (!token || token.invoiceId !== orderId) {
    return NextResponse.json({ error: "Invalid invoice credentials." }, { status: 401 });
  }

  const { allowed } = await rateLimit(`verify:${orderId}`, { windowMs: 60_000, max: 5 });
  if (!allowed) {
    return NextResponse.json({ error: "Too many verification attempts. Please wait one minute." }, { status: 429 });
  }

  const invoice = await getInvoiceById(orderId);
  if (!invoice) return NextResponse.json({ error: "Order not found." }, { status: 404 });

  if (invoice.fulfillment_status === "complete") {
    if (invoice.topup_iccid_encrypted) {
      return NextResponse.json({
        success: true,
        topup: true,
        message: "Top-up already applied.",
      });
    }
    if (invoice.iccid_encrypted && invoice.activation_code_encrypted) {
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
    }
  }

  if (invoice.fulfillment_status === "processing") {
    return NextResponse.json({
      success: true,
      processing: true,
      message: "Payment has been accepted. Fulfillment is still processing; do not send another payment.",
    }, { status: 202 });
  }
  if (invoice.fulfillment_status === "needs_review") {
    return NextResponse.json({
      success: true,
      processing: true,
      needsReview: true,
      message: "Payment was verified, but fulfillment needs manual review. Do not send another payment.",
    }, { status: 202 });
  }

  let confirmations = 0;
  try {
    if (invoice.crypto_type === "ethereum") {
      if (!/^0x[a-fA-F0-9]{64}$/.test(txHash)) {
        return NextResponse.json({ error: "Enter a valid Ethereum transaction hash." }, { status: 400 });
      }
      const verified = await verifyEthereumPayment(txHash, invoice.amount_crypto, invoice.payment_address);
      if (!verified.ok) {
        const unavailable = /temporarily unavailable/.test(verified.error ?? "");
        return NextResponse.json({ error: verified.error ?? "Payment verification failed." }, { status: unavailable ? 503 : 400 });
      }
      confirmations = verified.confirmations;
    } else if (invoice.crypto_type === "usdt_eth") {
      if (!/^0x[a-fA-F0-9]{64}$/.test(txHash)) {
        return NextResponse.json({ error: "Enter a valid Ethereum transaction hash." }, { status: 400 });
      }
      const verified = await verifyUsdtPayment(txHash, invoice.amount_crypto, invoice.payment_address);
      if (!verified.ok) {
        const unavailable = /temporarily unavailable/.test(verified.error ?? "");
        return NextResponse.json({ error: verified.error ?? "USDT verification failed." }, { status: unavailable ? 503 : 400 });
      }
      confirmations = verified.confirmations;
    } else if (invoice.crypto_type === "monero") {
      if (!/^[a-fA-F0-9]{64}$/.test(txHash)) {
        return NextResponse.json({ error: "Enter a valid Monero transaction hash." }, { status: 400 });
      }
      if (invoice.monero_subaddress_index === undefined || invoice.monero_account_index === undefined) {
        return NextResponse.json({ error: "This Monero invoice cannot be safely verified. Contact support; do not resend payment." }, { status: 503 });
      }
      const verified = await verifyMoneroPayment(
        txHash,
        invoice.amount_crypto,
        invoice.monero_subaddress_index,
        invoice.monero_account_index
      );
      if (!verified.ok) {
        return NextResponse.json({ error: verified.error ?? "Monero payment verification failed." }, { status: 400 });
      }
      confirmations = verified.confirmations;
    } else {
      return NextResponse.json({ error: "Unsupported payment type." }, { status: 400 });
    }
  } catch (error) {
    console.error("Payment verification service unavailable:", error instanceof Error ? error.message : "unknown error");
    return NextResponse.json({ error: "Payment verification is temporarily unavailable. Please retry later." }, { status: 503 });
  }

  const result = await fulfillPaidInvoice(orderId, txHash, confirmations);
  switch (result.kind) {
    case "delivered":
      return NextResponse.json({
        success: true,
        iccid: result.iccid,
        activationCode: result.activationCode,
        smDpAddress: result.smDpAddress,
      });
    case "topup_complete":
      return NextResponse.json({ success: true, topup: true, iccid: result.iccid, message: result.message });
    case "processing":
      return NextResponse.json({
        success: true,
        processing: true,
        pikaOrderId: result.pikaOrderId,
        message: "Payment verified. Your eSIM is being provisioned. Do not send another payment.",
      }, { status: 202 });
    case "needs_review":
      return NextResponse.json({
        success: true,
        processing: true,
        needsReview: true,
        message: "Payment verified, but supplier fulfillment needs manual review. Do not send another payment.",
      }, { status: 202 });
    case "replay":
      return NextResponse.json({ error: "This blockchain transaction was already used for another invoice." }, { status: 409 });
    case "already_paid":
      return NextResponse.json({ error: "This invoice already has a payment recorded. Do not send another payment." }, { status: 409 });
    case "not_found":
      return NextResponse.json({ error: "Order not found." }, { status: 404 });
  }
}
