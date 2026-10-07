import {
  claimPaymentTransaction,
  completeTopup,
  getInvoiceById,
  markFulfillmentNeedsReview,
  updateInvoiceEsimData,
  updateInvoicePikaOrderId,
} from "@/lib/db";
import { decryptField, encryptField } from "@/lib/crypto-utils";
import { purchaseEsim, topupEsim } from "@/lib/pikasim";

export type FulfillmentResult =
  | { kind: "delivered"; iccid: string; activationCode: string; smDpAddress: string }
  | { kind: "topup_complete"; iccid: string; message: string }
  | { kind: "processing"; pikaOrderId?: string }
  | { kind: "needs_review" }
  | { kind: "replay" }
  | { kind: "already_paid" }
  | { kind: "not_found" };

async function existingDelivery(invoiceId: string) {
  const invoice = await getInvoiceById(invoiceId);
  if (!invoice) return { kind: "not_found" } as const;
  if (invoice.topup_iccid_encrypted) {
    const iccid = await decryptField(invoice.topup_iccid_encrypted);
    return { kind: "topup_complete", iccid, message: "Top-up already applied." } as const;
  }
  if (invoice.iccid_encrypted && invoice.activation_code_encrypted) {
    return {
      kind: "delivered" as const,
      iccid: await decryptField(invoice.iccid_encrypted),
      activationCode: await decryptField(invoice.activation_code_encrypted),
      smDpAddress: invoice.sm_dp_address ?? "",
    };
  }
  return { kind: "processing" } as const;
}

export async function fulfillPaidInvoice(
  invoiceId: string,
  txHash: string,
  confirmations: number
): Promise<FulfillmentResult> {
  const claim = await claimPaymentTransaction(txHash, invoiceId, confirmations);
  if (claim.kind === "not_found") return claim;
  if (claim.kind === "replay") return { kind: "replay" };
  if (claim.kind === "already_paid") return { kind: "already_paid" };
  if (claim.kind === "complete") return existingDelivery(invoiceId);
  if (claim.kind === "needs_review") return { kind: "needs_review" };
  if (claim.kind === "processing") return { kind: "processing", pikaOrderId: claim.invoice.pika_order_id };

  const invoice = claim.invoice;
  try {
    if (invoice.topup_iccid_encrypted) {
      const iccid = await decryptField(invoice.topup_iccid_encrypted);
      const result = await topupEsim(iccid, invoice.package_code);
      if (!result.success || !(await completeTopup(invoiceId))) {
        throw new Error("Top-up fulfillment did not complete");
      }
      return { kind: "topup_complete", iccid, message: result.summary ?? "Top-up applied." };
    }

    const result = await purchaseEsim(invoice.package_code);
    if (result.orderId && !(await updateInvoicePikaOrderId(invoiceId, result.orderId))) {
      throw new Error("Supplier order ID could not be persisted for reconciliation");
    }

    if (result.iccid && result.activationCode) {
      const [iccidEncrypted, activationCodeEncrypted] = await Promise.all([
        encryptField(result.iccid),
        encryptField(result.activationCode),
      ]);
      const saved = await updateInvoiceEsimData(invoiceId, {
        iccid_encrypted: iccidEncrypted,
        activation_code_encrypted: activationCodeEncrypted,
        sm_dp_address: result.smDpAddress ?? "",
        pika_order_id: result.orderId || "",
      });
      if (!saved) throw new Error("Fulfillment record was not saved");
      return {
        kind: "delivered",
        iccid: result.iccid,
        activationCode: result.activationCode,
        smDpAddress: result.smDpAddress ?? "",
      };
    }

    if (!result.orderId) throw new Error("Supplier returned no reconciliation order ID");
    return { kind: "processing", pikaOrderId: result.orderId };
  } catch (error) {
    await markFulfillmentNeedsReview(invoiceId).catch(() => undefined);
    console.error(
      "Paid order requires fulfillment review:",
      invoiceId,
      error instanceof Error ? error.message : "unknown supplier error"
    );
    return { kind: "needs_review" };
  }
}
