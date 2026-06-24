// No external database — all state is in-memory (ephemeral per deployment)
// Package cache always misses → falls through to live PikaSim API
// Invoice store tracks pending payments for webhook confirmation

const invoiceStore = new Map<string, Record<string, unknown>>();

export async function queryPackageCache(
  _countryCode?: string,
  _productType?: string
) {
  return null;
}

export async function upsertPackageCache(
  _packages?: unknown[]
) {
  return true;
}

export async function createInvoiceRecord(data: {
  invoice_id: string;
  wallet_id_hash: string;
  package_code?: string;
  amount_usd: number;
  amount_crypto: number;
  crypto_type: string;
  payment_address_encrypted: string;
  expires_at: string;
}) {
  invoiceStore.set(data.invoice_id, {
    ...data,
    status: "pending",
    created_at: new Date().toISOString(),
  });
  return data;
}

export async function getInvoiceByExternalId(invoiceId: string) {
  return (invoiceStore.get(invoiceId) ?? null) as Record<string, unknown> | null;
}

export async function updateInvoiceStatus(
  invoiceId: string,
  status: string,
  txHash?: string,
  confirmations?: number
) {
  const invoice = invoiceStore.get(invoiceId);
  if (!invoice) return false;
  invoice.status = status;
  if (txHash) invoice.blockchain_tx_hash = txHash;
  if (confirmations !== undefined) invoice.received_confirmations = confirmations;
  invoiceStore.set(invoiceId, invoice);
  return true;
}

export async function createOrderRecord(data: Record<string, unknown>) {
  return data;
}

export async function getOrdersByWalletHash() {
  return [];
}

export async function getOrderById() {
  return null;
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
