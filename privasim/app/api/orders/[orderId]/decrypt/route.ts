import { NextRequest, NextResponse } from "next/server";
import { getInvoiceById } from "@/lib/db";
import { decryptField } from "@/lib/crypto-utils";

// Returns decrypted eSIM credentials for a given invoice.
// No JWT required — invoice ID is the shared secret.
export async function POST(_req: NextRequest, props: { params: Promise<{ orderId: string }> }) {
  const params = await props.params;
  const invoice = await getInvoiceById(params.orderId);
  if (!invoice) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  if (invoice.status !== "confirmed") {
    return NextResponse.json(
      { error: "eSIM not ready — payment not yet confirmed" },
      { status: 400 }
    );
  }

  if (!invoice.iccid_encrypted || !invoice.activation_code_encrypted) {
    return NextResponse.json(
      { error: "eSIM credentials not yet stored — please check back shortly" },
      { status: 404 }
    );
  }

  try {
    const [iccid, activationCode] = await Promise.all([
      decryptField(invoice.iccid_encrypted),
      decryptField(invoice.activation_code_encrypted),
    ]);

    return NextResponse.json({
      iccid,
      activationCode,
      smDpAddress: invoice.sm_dp_address ?? "",
    });
  } catch {
    return NextResponse.json({ error: "Failed to decrypt eSIM data" }, { status: 500 });
  }
}
