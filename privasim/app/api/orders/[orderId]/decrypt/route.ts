import { NextRequest, NextResponse } from "next/server";
import { getInvoiceById } from "@/lib/db";
import { decryptField } from "@/lib/crypto-utils";
import { verifyInvoiceToken } from "@/lib/invoiceToken";

export async function POST(req: NextRequest, props: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await props.params;
  let body: { invoiceToken?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const token = verifyInvoiceToken(typeof body.invoiceToken === "string" ? body.invoiceToken : "");
  if (!token || token.invoiceId !== orderId) {
    return NextResponse.json({ error: "Invalid invoice credentials" }, { status: 401 });
  }

  const invoice = await getInvoiceById(orderId);
  if (!invoice) return NextResponse.json({ error: "Order not found" }, { status: 404 });
  if (invoice.status !== "confirmed" || invoice.fulfillment_status !== "complete") {
    return NextResponse.json({ error: "eSIM is not ready yet" }, { status: 409 });
  }
  if (!invoice.iccid_encrypted || !invoice.activation_code_encrypted) {
    return NextResponse.json({ error: "No eSIM credentials are associated with this order" }, { status: 404 });
  }

  try {
    const [iccid, activationCode] = await Promise.all([
      decryptField(invoice.iccid_encrypted),
      decryptField(invoice.activation_code_encrypted),
    ]);
    return NextResponse.json({ iccid, activationCode, smDpAddress: invoice.sm_dp_address ?? "" }, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    return NextResponse.json({ error: "Could not decrypt eSIM data" }, { status: 500 });
  }
}
