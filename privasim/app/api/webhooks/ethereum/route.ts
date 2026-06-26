import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "@/lib/crypto-utils";
import { getEthWebhookSecret, verifyEthereumPayment } from "@/lib/ethereum";
import { getInvoiceById, updateInvoiceStatus, updateInvoiceEsimData } from "@/lib/db";
import { purchaseEsim } from "@/lib/pikasim";
import { encryptField } from "@/lib/crypto-utils";
import { rateLimit, RATE_LIMITS } from "@/lib/rateLimit";

interface EthereumWebhookPayload {
  txHash: string;
  amount: number;
  confirmations: number;
  address: string;
  status: "confirmed" | "pending" | "failed";
  invoiceId?: string;
}

const MIN_CONFIRMATIONS = 12;

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0] ?? "unknown";
  const { allowed } = rateLimit(`webhook:ethereum:${ip}`, RATE_LIMITS.webhook);
  if (!allowed) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

  const providedSig = req.headers.get("x-ethereum-signature") ?? "";
  if (!timingSafeEqual(providedSig, getEthWebhookSecret())) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let payload: EthereumWebhookPayload;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { txHash, amount, confirmations, address, status, invoiceId } = payload;

  if (!invoiceId) return NextResponse.json({ error: "No invoice ID" }, { status: 400 });

  const invoice = await getInvoiceById(invoiceId);
  if (!invoice) return NextResponse.json({ error: "Invoice not found" }, { status: 404 });

  if (invoice.status === "confirmed") return NextResponse.json({ message: "Already processed" });

  await updateInvoiceStatus(invoiceId, "pending", txHash, confirmations);

  if (status !== "confirmed" || confirmations < MIN_CONFIRMATIONS) {
    return NextResponse.json({ message: "Awaiting confirmations", confirmations });
  }

  const verified = await verifyEthereumPayment(txHash, invoice.amount_crypto, address);
  if (!verified) {
    await updateInvoiceStatus(invoiceId, "failed", txHash, confirmations);
    return NextResponse.json({ error: "Payment verification failed" }, { status: 400 });
  }

  try {
    await updateInvoiceStatus(invoiceId, "confirmed", txHash, confirmations);

    const packageCode = invoice.package_code;
    if (!packageCode) throw new Error("Package code missing from invoice");

    const pikaResult = await purchaseEsim(packageCode);

    // Encrypt and store eSIM credentials so user can retrieve them
    const [iccidEnc, codeEnc] = await Promise.all([
      encryptField(pikaResult.iccid),
      encryptField(pikaResult.activationCode),
    ]);

    await updateInvoiceEsimData(invoiceId, {
      iccid_encrypted: iccidEnc,
      activation_code_encrypted: codeEnc,
      sm_dp_address: pikaResult.smDpAddress ?? "",
      pika_order_id: pikaResult.orderId,
    });

    console.log("ETH payment confirmed — eSIM provisioned", {
      invoiceId,
      iccid: pikaResult.iccid,
    });

    return NextResponse.json({ message: "Order created successfully" });
  } catch (err) {
    console.error("Post-payment ETH processing failed:", err);
    return NextResponse.json({ message: "Payment confirmed — eSIM provisioning queued" });
  }
}
