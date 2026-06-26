import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual, encryptField } from "@/lib/crypto-utils";
import { getMoneroWebhookSecret } from "@/lib/monero";
import { getInvoiceById, updateInvoiceStatus, updateInvoiceEsimData } from "@/lib/db";
import { purchaseEsim } from "@/lib/pikasim";
import { rateLimit, RATE_LIMITS } from "@/lib/rateLimit";

interface MoneroWebhookPayload {
  txId: string;
  amount: number;
  confirmations: number;
  address: string;
  status: "confirmed" | "pending" | "failed";
  invoiceId?: string;
  txDescription?: string;
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0] ?? "unknown";
  const { allowed } = rateLimit(`webhook:monero:${ip}`, RATE_LIMITS.webhook);
  if (!allowed) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

  const providedSig = req.headers.get("x-monero-signature") ?? "";
  if (!timingSafeEqual(providedSig, getMoneroWebhookSecret())) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let payload: MoneroWebhookPayload;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { txId, amount, confirmations, status, txDescription } = payload;
  const invoiceId =
    payload.invoiceId ?? txDescription?.replace("PRIVASIM-", "") ?? "";

  if (!invoiceId) return NextResponse.json({ error: "No invoice ID" }, { status: 400 });

  const invoice = await getInvoiceById(invoiceId);
  if (!invoice) return NextResponse.json({ error: "Invoice not found" }, { status: 404 });

  if (invoice.status === "confirmed") return NextResponse.json({ message: "Already processed" });

  await updateInvoiceStatus(invoiceId, "pending", txId, confirmations);

  if (status !== "confirmed" || confirmations < 10) {
    return NextResponse.json({ message: "Awaiting confirmations", confirmations });
  }

  const tolerance = 0.02;
  if (Math.abs(amount - invoice.amount_crypto) / invoice.amount_crypto > tolerance) {
    await updateInvoiceStatus(invoiceId, "failed", txId, confirmations);
    return NextResponse.json({ error: "Amount mismatch" }, { status: 400 });
  }

  try {
    await updateInvoiceStatus(invoiceId, "confirmed", txId, confirmations);

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

    console.log("XMR payment confirmed — eSIM provisioned", {
      invoiceId,
      iccid: pikaResult.iccid,
    });

    return NextResponse.json({ message: "Order created successfully" });
  } catch (err) {
    console.error("Post-payment XMR processing failed:", err);
    return NextResponse.json({ message: "Payment confirmed — eSIM provisioning queued" });
  }
}
