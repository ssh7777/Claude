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

const BLOG_POSTS = [
  {
    id: "1",
    slug: "why-privacy-matters-esim",
    title: "Why Privacy Matters When Buying an eSIM",
    published_at: "2024-11-01T00:00:00Z",
    featured: true,
    content:
      "Traditional eSIM providers require your passport, email address, and payment card — all permanently tied to your identity. PRIVASIM changes this by accepting only Monero and Ethereum, with zero KYC requirements and no personal data stored.",
    excerpt:
      "Traditional eSIM providers require your passport, email, and payment card. PRIVASIM changes this completely.",
  },
  {
    id: "2",
    slug: "monero-vs-ethereum-payments",
    title: "Monero vs Ethereum: Which Payment Is More Private?",
    published_at: "2024-11-15T00:00:00Z",
    featured: false,
    content:
      "Monero (XMR) provides the strongest privacy guarantees with stealth addresses, ring signatures, and RingCT — transactions are unlinkable and untraceable by design. Ethereum transactions are visible on-chain but still avoid the direct identity linkage that comes with credit cards.",
    excerpt:
      "Monero provides the strongest privacy guarantees. Ethereum transactions are public but avoid identity linkage.",
  },
  {
    id: "3",
    slug: "how-esim-works-privacy",
    title: "How eSIM Technology Works and What Data It Exposes",
    published_at: "2024-12-01T00:00:00Z",
    featured: false,
    content:
      "An eSIM (embedded SIM) stores carrier profile data digitally instead of on a physical chip. Your ICCID and IMSI are known to the carrier network, but with PRIVASIM your purchase itself remains fully anonymous — we store only an encrypted ICCID, never linked to your identity.",
    excerpt:
      "An eSIM stores carrier data digitally. Your ICCID is known to the carrier, but your purchase stays anonymous.",
  },
];

export async function getBlogPosts(limit = 20, offset = 0) {
  return BLOG_POSTS.slice(offset, offset + limit);
}

export async function getBlogPostBySlug(slug: string) {
  return BLOG_POSTS.find((p) => p.slug === slug) ?? null;
}
