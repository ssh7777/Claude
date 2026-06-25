import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "@/lib/crypto-utils";
import { getEthWebhookSecret, verifyEthereumPayment } from "@/lib/ethereum";
import { getInvoiceByExternalId, updateInvoiceStatus } from "@/lib/db";
import { purchaseEsim, getPackageDetails } from "@/lib/pikasim";
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

  const invoice = await getInvoiceByExternalId(invoiceId);
  if (!invoice) return NextResponse.json({ error: "Invoice not found" }, { status: 404 });

  if (invoice.status === "confirmed") return NextResponse.json({ message: "Already processed" });

  await updateInvoiceStatus(invoiceId, "pending", txHash, confirmations);

  if (status !== "confirmed" || confirmations < MIN_CONFIRMATIONS) {
    return NextResponse.json({ message: "Awaiting confirmations", confirmations });
  }

  const amountCrypto = invoice.amount_crypto as number;
  const verified = await verifyEthereumPayment(txHash, amountCrypto, address);
  if (!verified) {
    await updateInvoiceStatus(invoiceId, "failed", txHash, confirmations);
    return NextResponse.json({ error: "Payment verification failed" }, { status: 400 });
  }

  try {
    await updateInvoiceStatus(invoiceId, "confirmed", txHash, confirmations);

    const packageCode = (invoice.package_code as string) ?? "";
    if (!packageCode) throw new Error("Package code missing from invoice");

    const [pikaResult, pkgDetails] = await Promise.all([
      purchaseEsim(packageCode),
      getPackageDetails(packageCode),
    ]);

    console.log("Ethereum payment confirmed — eSIM purchased", {
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
