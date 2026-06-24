import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual, encryptField } from "@/lib/crypto-utils";
import { getEthWebhookSecret, verifyEthereumPayment } from "@/lib/ethereum";
import { getInvoiceByExternalId, updateInvoiceStatus, createOrderRecord } from "@/lib/db";
import { purchaseEsim, getPackageDetails } from "@/lib/pikasim";
import { rateLimit, RATE_LIMITS } from "@/lib/rateLimit";

interface EthereumWebhookPayload {
  txHash: string;
  amount: number; // in ETH
  confirmations: number;
  address: string;
  status: "confirmed" | "pending" | "failed";
  invoiceId?: string;
}

const MIN_CONFIRMATIONS = 12; // Ethereum finality

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0] ?? "unknown";
  const { allowed } = rateLimit(`webhook:ethereum:${ip}`, RATE_LIMITS.webhook);
  if (!allowed) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const providedSig = req.headers.get("x-ethereum-signature") ?? "";
  const webhookSecret = getEthWebhookSecret();

  if (!timingSafeEqual(providedSig, webhookSecret)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let payload: EthereumWebhookPayload;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { txHash, amount, confirmations, address, status, invoiceId } = payload;

  if (!invoiceId) {
    return NextResponse.json({ error: "No invoice ID found" }, { status: 400 });
  }

  const invoice = await getInvoiceByExternalId(invoiceId);
  if (!invoice) {
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  }

  if (invoice.status === "confirmed") {
    return NextResponse.json({ message: "Already processed" });
  }

  await updateInvoiceStatus(invoiceId, "pending", txHash, confirmations);

  if (status !== "confirmed" || confirmations < MIN_CONFIRMATIONS) {
    return NextResponse.json({ message: "Awaiting confirmations", confirmations });
  }

  // Verify on-chain
  const verified = await verifyEthereumPayment(txHash, invoice.amount_crypto, address);
  if (!verified) {
    await updateInvoiceStatus(invoiceId, "failed", txHash, confirmations);
    return NextResponse.json({ error: "Payment verification failed" }, { status: 400 });
  }

  try {
    await updateInvoiceStatus(invoiceId, "confirmed", txHash, confirmations);

    const packageCode = invoice.package_code ?? "";
    if (!packageCode) throw new Error("Package code not found in invoice");

    const pikaResult = await purchaseEsim(packageCode);
    const pkgDetails = await getPackageDetails(packageCode);

    const [iccidEnc, activationEnc, smDpEnc] = await Promise.all([
      encryptField(pikaResult.iccid),
      encryptField(pikaResult.activationCode),
      encryptField(pikaResult.smDpAddress),
    ]);

    const expiresAt = new Date(
      Date.now() + (pkgDetails?.durationDays ?? 30) * 24 * 60 * 60 * 1000
    ).toISOString();

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
      crypto_type: "ethereum",
      payment_tx_hash: txHash,
      data_remaining_gb: parseFloat(pkgDetails?.dataAmount ?? "0"),
      expires_at: expiresAt,
    });

    return NextResponse.json({ message: "Order created successfully" });
  } catch (err) {
    console.error("Post-payment processing failed:", err);
    return NextResponse.json({ message: "Processing queued" });
  }
}
