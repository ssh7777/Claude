import { NextRequest, NextResponse } from "next/server";
import { decodeWebhookBody, readLimitedBody, verifyWebhookHmac } from "@/lib/webhook";
import { getInvoiceByPikaOrderId, markFulfillmentNeedsReview, updateInvoiceEsimData } from "@/lib/db";
import { encryptField } from "@/lib/crypto-utils";
import { rateLimit, RATE_LIMITS } from "@/lib/rateLimit";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const secret = process.env.PIKASIM_WEBHOOK_SECRET;
  if (!secret || secret.length < 32) {
    return NextResponse.json({ error: "Webhook endpoint is not configured" }, { status: 503 });
  }
  const signature = req.headers.get("x-pikasim-signature") ?? req.headers.get("x-webhook-signature") ?? "";
  let rawBody: Uint8Array;
  try {
    rawBody = await readLimitedBody(req, 64_000);
  } catch {
    return NextResponse.json({ error: "Payload too large" }, { status: 413 });
  }
  const rawText = decodeWebhookBody(rawBody);
  if (rawText === null) return NextResponse.json({ error: "Invalid UTF-8 payload" }, { status: 400 });
  if (!verifyWebhookHmac(rawBody, signature, secret)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const { allowed } = await rateLimit(`webhook:pikasim:${ip}`, RATE_LIMITS.webhook);
  if (!allowed) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

  let payload: Record<string, unknown>;
  try {
    const parsed: unknown = JSON.parse(rawText);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("Invalid object");
    payload = parsed as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
  }

  const pikaOrderId = String(payload.orderId ?? payload.order_id ?? payload.id ?? "").trim();
  const status = String(payload.status ?? "").trim().toLowerCase();
  const iccid = String(payload.iccid ?? payload.ICCID ?? "").trim();
  const activationCode = String(
    payload.activationCode ?? payload.activation_code ?? payload.lpa ?? payload.ac ?? payload.code ?? ""
  ).trim();
  const smDpAddress = String(payload.smDpAddress ?? payload.sm_dp_address ?? payload.smdp ?? "").trim();

  if (!pikaOrderId || pikaOrderId.length > 256) {
    return NextResponse.json({ error: "Missing or invalid supplier order ID" }, { status: 400 });
  }
  if (!["completed", "active", "success", "delivered"].includes(status)) {
    if (["failed", "cancelled", "canceled"].includes(status)) {
      const failedInvoice = await getInvoiceByPikaOrderId(pikaOrderId);
      if (failedInvoice && failedInvoice.status === "confirmed") {
        await markFulfillmentNeedsReview(failedInvoice.invoice_id);
      }
    }
    return NextResponse.json({ received: true, message: "Supplier order is not yet complete" });
  }
  if (!/^\d{18,22}$/.test(iccid) || !activationCode || activationCode.length > 2048 || /[\u0000-\u001f]/.test(activationCode)) {
    return NextResponse.json({ error: "Completed order has invalid eSIM credentials" }, { status: 400 });
  }

  const invoice = await getInvoiceByPikaOrderId(pikaOrderId);
  if (!invoice) return NextResponse.json({ error: "Unknown supplier order" }, { status: 404 });
  if (invoice.status !== "confirmed") {
    return NextResponse.json({ error: "Invoice payment is not confirmed" }, { status: 409 });
  }
  if (invoice.fulfillment_status === "complete") {
    return NextResponse.json({ received: true, delivered: true, duplicate: true });
  }

  try {
    const [iccidEncrypted, activationCodeEncrypted] = await Promise.all([
      encryptField(iccid),
      encryptField(activationCode),
    ]);
    const stored = await updateInvoiceEsimData(invoice.invoice_id, {
      iccid_encrypted: iccidEncrypted,
      activation_code_encrypted: activationCodeEncrypted,
      sm_dp_address: smDpAddress.slice(0, 255),
      pika_order_id: pikaOrderId,
    });
    if (!stored) throw new Error("Order record could not be updated");
    return NextResponse.json({ received: true, delivered: true });
  } catch (error) {
    console.error("PikaSim webhook credential storage failed:", error instanceof Error ? error.message : "unknown error");
    return NextResponse.json({ error: "Could not securely store eSIM credentials" }, { status: 500 });
  }
}
