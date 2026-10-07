import { NextRequest, NextResponse } from "next/server";
import { getInvoiceById } from "@/lib/db";
import { verifyMoneroPayment, getMoneroWebhookSecret } from "@/lib/monero";
import { fulfillPaidInvoice } from "@/lib/fulfillment";
import { decodeWebhookBody, readLimitedBody, verifyWebhookHmac } from "@/lib/webhook";
import { rateLimit, RATE_LIMITS } from "@/lib/rateLimit";

export const runtime = "nodejs";

function fulfillmentResponse(result: Awaited<ReturnType<typeof fulfillPaidInvoice>>) {
  switch (result.kind) {
    case "delivered":
      return NextResponse.json({ received: true, delivered: true });
    case "topup_complete":
      return NextResponse.json({ received: true, topupApplied: true });
    case "processing":
      return NextResponse.json({ received: true, processing: true }, { status: 202 });
    case "needs_review":
      return NextResponse.json({ received: true, needsReview: true }, { status: 202 });
    case "replay":
      return NextResponse.json({ error: "Transaction already claimed by another invoice" }, { status: 409 });
    case "already_paid":
      return NextResponse.json({ received: true, duplicatePayment: true });
    case "not_found":
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  }
}

export async function POST(req: NextRequest) {
  let secret: string;
  try {
    secret = getMoneroWebhookSecret();
  } catch {
    return NextResponse.json({ error: "Webhook endpoint is not configured" }, { status: 503 });
  }
  let rawBody: Uint8Array;
  try {
    rawBody = await readLimitedBody(req, 32_000);
  } catch {
    return NextResponse.json({ error: "Payload too large" }, { status: 413 });
  }
  const rawText = decodeWebhookBody(rawBody);
  if (rawText === null) return NextResponse.json({ error: "Invalid UTF-8 payload" }, { status: 400 });
  const signature = req.headers.get("x-monero-signature") ?? "";
  if (!verifyWebhookHmac(rawBody, signature, secret)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const { allowed } = await rateLimit(`webhook:monero:${ip}`, RATE_LIMITS.webhook);
  if (!allowed) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

  let payload: { invoiceId?: unknown; txId?: unknown; txid?: unknown };
  try {
    const parsed: unknown = JSON.parse(rawText);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("Invalid object");
    payload = parsed as typeof payload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
  }

  const invoiceId = typeof payload.invoiceId === "string" ? payload.invoiceId.trim() : "";
  const txHash = typeof (payload.txId ?? payload.txid) === "string"
    ? String(payload.txId ?? payload.txid).trim()
    : "";
  if (!/^[a-f0-9]{32}$/.test(invoiceId) || !/^[a-fA-F0-9]{64}$/.test(txHash)) {
    return NextResponse.json({ error: "Invalid invoice ID or transaction hash" }, { status: 400 });
  }

  const invoice = await getInvoiceById(invoiceId);
  if (!invoice) return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  if (invoice.crypto_type !== "monero" || invoice.monero_subaddress_index === undefined || invoice.monero_account_index === undefined) {
    return NextResponse.json({ error: "Payment type does not match this webhook" }, { status: 400 });
  }

  try {
    const verified = await verifyMoneroPayment(
      txHash,
      invoice.amount_crypto,
      invoice.monero_subaddress_index,
      invoice.monero_account_index
    );
    if (!verified.ok) {
      if (/needs at least/i.test(verified.error ?? "")) {
        return NextResponse.json({ received: true, awaitingConfirmations: true }, { status: 202 });
      }
      return NextResponse.json({ error: verified.error ?? "Payment verification failed" }, { status: 400 });
    }
    return fulfillmentResponse(await fulfillPaidInvoice(invoiceId, txHash, verified.confirmations));
  } catch (error) {
    console.error("Monero wallet verification unavailable:", error instanceof Error ? error.message : "unknown error");
    return NextResponse.json({ error: "Payment verification is temporarily unavailable" }, { status: 503 });
  }
}
