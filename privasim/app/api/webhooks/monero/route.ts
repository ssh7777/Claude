import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual, encryptField } from "@/lib/crypto-utils";
import { getMoneroWebhookSecret } from "@/lib/monero";
import { getInvoiceByExternalId, updateInvoiceStatus, createOrderRecord } from "@/lib/db";
import { purchaseEsim, getPackageDetails } from "@/lib/pikasim";
import { rateLimit, RATE_LIMITS } from "@/lib/rateLimit";

interface MoneroWebhookPayload {
  txId: string;
  amount: number; // in XMR
  confirmations: number;
  address: string;
  status: "confirmed" | "pending" | "failed";
  invoiceId?: string;
  txDescription?: string;
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0] ?? "unknown";
  const { allowed } = rateLimit(`webhook:monero:${ip}`, RATE_LIMITS.webhook);
  if (!allowed) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  // Verify webhook signature
  const providedSig = req.headers.get("x-monero-signature") ?? "";
  const webhookSecret = getMoneroWebhookSecret();

  if (!timingSafeEqual(providedSig, webhookSecret)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let payload: MoneroWebhookPayload;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { txId, amount, confirmations, address, status, txDescription } = payload;

  // Extract invoice ID from tx description (format: "PRIVASIM-{invoiceId}")
  const invoiceId =
    payload.invoiceId ??
    txDescription?.replace("PRIVASIM-", "") ??
    "";

  if (!invoiceId) {
    return NextResponse.json({ error: "No invoice ID found" }, { status: 400 });
  }

  // Look up the invoice
  const invoice = await getInvoiceByExternalId(invoiceId);
  if (!invoice) {
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  }

  if (invoice.status === "confirmed") {
    return NextResponse.json({ message: "Already processed" });
  }

  // Update confirmation count
  await updateInvoiceStatus(invoiceId, "pending", txId, confirmations);

  // Wait for minimum confirmations (10 for Monero)
  if (status !== "confirmed" || confirmations < 10) {
    return NextResponse.json({ message: "Awaiting confirmations", confirmations });
  }

  // Verify amount matches (within 2% tolerance)
  const tolerance = 0.02;
  const amountMatch =
    Math.abs(amount - invoice.amount_crypto) / invoice.amount_crypto <= tolerance;

  if (!amountMatch) {
    console.error(
      `Amount mismatch: received ${amount} XMR, expected ${invoice.amount_crypto} XMR`
    );
    await updateInvoiceStatus(invoiceId, "failed", txId, confirmations);
    return NextResponse.json({ error: "Amount mismatch" }, { status: 400 });
  }

  try {
    // Mark invoice as confirmed
    await updateInvoiceStatus(invoiceId, "confirmed", txId, confirmations);

    // We need to know which package to purchase — stored in the original order request
    // In production, store packageCode in the invoice record
    const packageCode = invoice.package_code ?? ""; // Add this field to schema

    if (!packageCode) {
      throw new Error("Package code not found in invoice");
    }

    // Purchase eSIM from PikaSim
    const pikaResult = await purchaseEsim(packageCode);
    const pkgDetails = await getPackageDetails(packageCode);

    // Encrypt sensitive fields before storing
    const [iccidEnc, activationEnc, smDpEnc] = await Promise.all([
      encryptField(pikaResult.iccid),
      encryptField(pikaResult.activationCode),
      encryptField(pikaResult.smDpAddress),
    ]);

    const expiresAt = new Date(
      Date.now() + (pkgDetails?.durationDays ?? 30) * 24 * 60 * 60 * 1000
    ).toISOString();

    // Create order record
    await createOrderRecord({
      wallet_id_hash: invoice.wallet_id_hash,
      order_id_external: pikaResult.orderId,
      package_code: packageCode,
      package_name: pkgDetails?.name ?? packageCode,
      product_type: pkgDetails?.type ?? "data",
      country: pkgDetails?.country ?? "",
      data_amount: pkgDetails?.dataAmount ?? "0",
      duration_days: pkgDetails?.durationDays ?? 30,
      iccid_encrypted: iccidEnc,
      activation_code_encrypted: activationEnc,
      sm_dp_address_encrypted: smDpEnc,
      cost_usd: invoice.amount_usd,
      cost_crypto: invoice.amount_crypto,
      crypto_type: "monero",
      payment_tx_hash: txId,
      data_remaining_gb: parseFloat(pkgDetails?.dataAmount ?? "0"),
      expires_at: expiresAt,
    });

    return NextResponse.json({ message: "Order created successfully" });
  } catch (err) {
    console.error("Post-payment processing failed:", err);
    // Don't return error to webhook sender — log and handle manually
    return NextResponse.json({ message: "Processing queued" });
  }
}
