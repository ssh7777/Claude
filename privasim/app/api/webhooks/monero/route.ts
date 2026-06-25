import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "@/lib/crypto-utils";
import { getMoneroWebhookSecret } from "@/lib/monero";
import { getInvoiceByExternalId, updateInvoiceStatus } from "@/lib/db";
import { purchaseEsim, getPackageDetails } from "@/lib/pikasim";
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

  const invoice = await getInvoiceByExternalId(invoiceId);
  if (!invoice) return NextResponse.json({ error: "Invoice not found" }, { status: 404 });

  if (invoice.status === "confirmed") return NextResponse.json({ message: "Already processed" });

  await updateInvoiceStatus(invoiceId, "pending", txId, confirmations);

  if (status !== "confirmed" || confirmations < 10) {
    return NextResponse.json({ message: "Awaiting confirmations", confirmations });
  }

  const tolerance = 0.02;
  const amountCrypto = invoice.amount_crypto as number;
  if (Math.abs(amount - amountCrypto) / amountCrypto > tolerance) {
    await updateInvoiceStatus(invoiceId, "failed", txId, confirmations);
    return NextResponse.json({ error: "Amount mismatch" }, { status: 400 });
  }

  try {
    await updateInvoiceStatus(invoiceId, "confirmed", txId, confirmations);

    const packageCode = (invoice.package_code as string) ?? "";
    if (!packageCode) throw new Error("Package code missing from invoice");

    const [pikaResult, pkgDetails] = await Promise.all([
      purchaseEsim(packageCode),
      getPackageDetails(packageCode),
    ]);

    console.log("Monero payment confirmed — eSIM purchased", {
      invoiceId,
      iccid: pikaResult.iccid,
      packageName: pkgDetails?.name,
    });

    return NextResponse.json({ message: "Order created successfully" });
  } catch (err) {
    console.error("Post-payment processing failed:", err);
    return NextResponse.json({ message: "Processing queued" });
  }
}
