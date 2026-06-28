import { NextRequest, NextResponse } from "next/server";
import { createHmac, timingSafeEqual as nodeTimingSafeEqual } from "crypto";
import { getInvoiceByPikaOrderId, updateInvoiceStatus, updateInvoiceEsimData } from "@/lib/db";
import { encryptField } from "@/lib/crypto-utils";

function getWebhookSecret(): string {
  return process.env.PIKASIM_WEBHOOK_SECRET ?? "";
}

function verifySignature(rawBody: string, providedSig: string): boolean {
  const secret = getWebhookSecret();
  if (!secret || !providedSig) return false;
  // Try HMAC-SHA256 hex digest
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  try {
    return nodeTimingSafeEqual(Buffer.from(providedSig.replace(/^sha256=/, "")), Buffer.from(expected));
  } catch {
    return false;
  }
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text();

  // Check common PikaSim signature header names
  const sig =
    req.headers.get("x-pikasim-signature") ??
    req.headers.get("x-webhook-signature") ??
    req.headers.get("x-signature") ??
    "";

  const secret = getWebhookSecret();
  if (secret && sig && !verifySignature(rawBody, sig)) {
    console.warn("PikaSim webhook: invalid signature");
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  console.log("PikaSim webhook received:", JSON.stringify(payload).slice(0, 500));

  // Normalise field names — PikaSim may use camelCase or snake_case
  const pikaOrderId = String(
    payload.orderId ?? payload.order_id ?? payload.id ?? ""
  );
  const status = String(payload.status ?? "");
  const iccid = String(payload.iccid ?? payload.ICCID ?? "").trim();
  const activationCode = String(
    payload.activationCode ?? payload.activation_code ?? payload.lpa ?? payload.ac ?? payload.code ?? ""
  ).trim();
  const smDpAddress = String(
    payload.smDpAddress ?? payload.sm_dp_address ?? payload.smdp ?? ""
  ).trim();

  if (!pikaOrderId) {
    return NextResponse.json({ error: "Missing order ID in payload" }, { status: 400 });
  }

  // Find our invoice by PikaSim order ID
  const invoice = await getInvoiceByPikaOrderId(pikaOrderId);
  if (!invoice) {
    // Unknown order — may have arrived after a cold start wiped the store.
    // Log and acknowledge so PikaSim doesn't retry forever.
    console.warn(`PikaSim webhook: unknown pikaOrderId ${pikaOrderId}`);
    return NextResponse.json({ received: true, warning: "Order not found in store" });
  }

  if (invoice.status === "confirmed" && invoice.iccid_encrypted) {
    return NextResponse.json({ received: true, message: "Already delivered" });
  }

  // Only process completed/active orders
  if (!["completed", "active", "success", "delivered"].includes(status.toLowerCase()) && status !== "") {
    return NextResponse.json({ received: true, message: `Status ${status} — not yet complete` });
  }

  if (!iccid || !activationCode) {
    console.warn(`PikaSim webhook for ${pikaOrderId}: status=${status} but no ICCID yet`);
    return NextResponse.json({ received: true, message: "Waiting for ICCID" });
  }

  // Encrypt and store eSIM credentials
  try {
    const [iccidEnc, codeEnc] = await Promise.all([
      encryptField(iccid),
      encryptField(activationCode),
    ]);

    await updateInvoiceStatus(invoice.invoice_id, "confirmed");
    await updateInvoiceEsimData(invoice.invoice_id, {
      iccid_encrypted: iccidEnc,
      activation_code_encrypted: codeEnc,
      sm_dp_address: smDpAddress,
      pika_order_id: pikaOrderId,
    });

    console.log("PikaSim webhook: eSIM delivered", { invoiceId: invoice.invoice_id, iccid });
    return NextResponse.json({ received: true, delivered: true });
  } catch (err) {
    console.error("PikaSim webhook: failed to store eSIM data", err);
    return NextResponse.json({ error: "Storage failed" }, { status: 500 });
  }
}
