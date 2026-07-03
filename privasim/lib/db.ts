// In-memory store — ephemeral per serverless function instance.
// Sufficient for the payment → webhook → eSIM delivery window (seconds to minutes).
// For production with high traffic, replace with Vercel KV or Supabase.

export interface StoredInvoice {
  invoice_id: string;
  wallet_id_hash: string;
  package_code: string;
  package_name: string;
  country: string;
  country_code: string;
  data_amount: string;
  duration_days: number;
  amount_usd: number;
  amount_crypto: number;
  crypto_type: string;
  payment_address: string;
  expires_at: string;
  status: "pending" | "confirmed" | "failed" | "expired";
  created_at: string;
  blockchain_tx_hash?: string;
  received_confirmations?: number;
  // eSIM data — stored after successful PikaSim purchase
  iccid_encrypted?: string;
  activation_code_encrypted?: string;
  sm_dp_address?: string;
  pika_order_id?: string;
  esim_purchased_at?: string;
  // Top-up orders: the existing eSIM this invoice refills (instead of a new purchase)
  topup_iccid?: string;
}

const invoiceStore = new Map<string, StoredInvoice>();

export async function queryPackageCache(
  _countryCode?: string,
  _productType?: string
) {
  return null;
}

export async function upsertPackageCache(_packages?: unknown[]) {
  return true;
}

export async function createInvoiceRecord(data: {
  invoice_id: string;
  wallet_id_hash: string;
  package_code: string;
  package_name?: string;
  country?: string;
  country_code?: string;
  data_amount?: string;
  duration_days?: number;
  amount_usd: number;
  amount_crypto: number;
  crypto_type: string;
  payment_address: string;
  expires_at: string;
  topup_iccid?: string;
}): Promise<StoredInvoice> {
  const record: StoredInvoice = {
    invoice_id: data.invoice_id,
    wallet_id_hash: data.wallet_id_hash,
    package_code: data.package_code,
    package_name: data.package_name ?? data.package_code,
    country: data.country ?? "",
    country_code: data.country_code ?? "",
    data_amount: data.data_amount ?? "",
    duration_days: data.duration_days ?? 0,
    amount_usd: data.amount_usd,
    amount_crypto: data.amount_crypto,
    crypto_type: data.crypto_type,
    payment_address: data.payment_address,
    expires_at: data.expires_at,
    status: "pending",
    created_at: new Date().toISOString(),
    topup_iccid: data.topup_iccid,
  };
  invoiceStore.set(data.invoice_id, record);
  return record;
}

export async function getInvoiceById(invoiceId: string): Promise<StoredInvoice | null> {
  return invoiceStore.get(invoiceId) ?? null;
}

// Legacy alias
export async function getInvoiceByExternalId(invoiceId: string): Promise<StoredInvoice | null> {
  return getInvoiceById(invoiceId);
}

export async function getInvoicesByWalletHash(walletHash: string): Promise<StoredInvoice[]> {
  const results: StoredInvoice[] = [];
  for (const inv of invoiceStore.values()) {
    if (inv.wallet_id_hash === walletHash) results.push(inv);
  }
  return results.sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
}

export async function getInvoiceByPikaOrderId(pikaOrderId: string): Promise<StoredInvoice | null> {
  for (const inv of invoiceStore.values()) {
    if (inv.pika_order_id === pikaOrderId) return inv;
  }
  return null;
}

export async function updateInvoicePikaOrderId(invoiceId: string, pikaOrderId: string): Promise<boolean> {
  const invoice = invoiceStore.get(invoiceId);
  if (!invoice) return false;
  invoice.pika_order_id = pikaOrderId;
  invoiceStore.set(invoiceId, invoice);
  return true;
}

export async function updateInvoiceStatus(
  invoiceId: string,
  status: "pending" | "confirmed" | "failed" | "expired",
  txHash?: string,
  confirmations?: number
): Promise<boolean> {
  const invoice = invoiceStore.get(invoiceId);
  if (!invoice) return false;
  invoice.status = status;
  if (txHash) invoice.blockchain_tx_hash = txHash;
  if (confirmations !== undefined) invoice.received_confirmations = confirmations;
  invoiceStore.set(invoiceId, invoice);
  return true;
}

export async function updateInvoiceEsimData(
  invoiceId: string,
  data: {
    iccid_encrypted: string;
    activation_code_encrypted: string;
    sm_dp_address: string;
    pika_order_id: string;
  }
): Promise<boolean> {
  const invoice = invoiceStore.get(invoiceId);
  if (!invoice) return false;
  invoice.iccid_encrypted = data.iccid_encrypted;
  invoice.activation_code_encrypted = data.activation_code_encrypted;
  invoice.sm_dp_address = data.sm_dp_address;
  invoice.pika_order_id = data.pika_order_id;
  invoice.esim_purchased_at = new Date().toISOString();
  invoiceStore.set(invoiceId, invoice);
  return true;
}

export async function createOrderRecord(data: Record<string, unknown>) {
  return data;
}

export async function getOrdersByWalletHash(walletHash: string) {
  return getInvoicesByWalletHash(walletHash);
}

export async function getOrderById(orderId: string) {
  return getInvoiceById(orderId);
}

// Blog content lives in lib/blog.ts (static, git-versioned).
export { getBlogPosts, getBlogPostBySlug, getAllBlogSlugs } from "@/lib/blog";
