import postgres, { type Sql } from "postgres";
import { createHmac } from "node:crypto";
import { getBlogPosts, getBlogPostBySlug, getAllBlogSlugs } from "@/lib/blog";

export type InvoiceStatus = "pending" | "confirmed" | "failed" | "expired";
export type FulfillmentStatus = "pending" | "processing" | "complete" | "needs_review";

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
  status: InvoiceStatus;
  fulfillment_status: FulfillmentStatus;
  created_at: string;
  blockchain_tx_hash?: string;
  received_confirmations?: number;
  paid_at?: string;
  iccid_encrypted?: string;
  activation_code_encrypted?: string;
  sm_dp_address?: string;
  pika_order_id?: string;
  esim_purchased_at?: string;
  topup_iccid_encrypted?: string;
  monero_subaddress_index?: number;
  monero_account_index?: number;
}

export interface CreateInvoiceInput {
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
  topup_iccid_encrypted?: string;
  monero_subaddress_index?: number;
  monero_account_index?: number;
}

export type PaymentClaimResult =
  | { kind: "not_found" }
  | { kind: "replay"; invoiceId: string }
  | { kind: "already_paid"; invoice: StoredInvoice }
  | { kind: "claimed"; invoice: StoredInvoice }
  | { kind: "processing"; invoice: StoredInvoice }
  | { kind: "complete"; invoice: StoredInvoice }
  | { kind: "needs_review"; invoice: StoredInvoice };

interface InvoiceRow {
  invoice_id: string;
  wallet_id_hash: string;
  package_code: string;
  package_name: string;
  country: string;
  country_code: string;
  data_amount: string;
  duration_days: number;
  amount_usd: number | string;
  amount_crypto: number | string;
  crypto_type: string;
  payment_address: string;
  expires_at: Date | string;
  status: InvoiceStatus;
  fulfillment_status: FulfillmentStatus;
  created_at: Date | string;
  blockchain_tx_hash: string | null;
  received_confirmations: number | null;
  paid_at: Date | string | null;
  iccid_encrypted: string | null;
  activation_code_encrypted: string | null;
  sm_dp_address: string | null;
  pika_order_id: string | null;
  esim_purchased_at: Date | string | null;
  topup_iccid_encrypted: string | null;
  monero_subaddress_index: number | null;
  monero_account_index: number | null;
}

let pool: Sql | undefined;

export function isDatabaseConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL?.trim());
}

function hashTransactionForStorage(txHash: string): string {
  const secret = process.env.PAYMENT_HASH_SECRET ?? "";
  if (secret.length < 32) throw new Error("PAYMENT_HASH_SECRET must be at least 32 chars");
  return createHmac("sha256", secret).update(`payment-tx:${txHash}`).digest("hex");
}

export function getDatabase(): Sql {
  const connectionString = process.env.DATABASE_URL?.trim();
  if (!connectionString) {
    throw new Error("DATABASE_URL is required. Configure a managed PostgreSQL database and run the migrations.");
  }
  if (!pool) {
    pool = postgres(connectionString, {
      max: Number(process.env.DB_POOL_MAX ?? 1),
      idle_timeout: 20,
      connect_timeout: 10,
      max_lifetime: 60 * 30,
      prepare: false,
      onnotice: () => undefined,
    });
  }
  return pool;
}

function iso(value: Date | string | null): string | undefined {
  if (value == null) return undefined;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

function mapInvoice(row: InvoiceRow): StoredInvoice {
  return {
    invoice_id: row.invoice_id,
    wallet_id_hash: row.wallet_id_hash,
    package_code: row.package_code,
    package_name: row.package_name,
    country: row.country,
    country_code: row.country_code,
    data_amount: row.data_amount,
    duration_days: row.duration_days,
    amount_usd: Number(row.amount_usd),
    amount_crypto: Number(row.amount_crypto),
    crypto_type: row.crypto_type,
    payment_address: row.payment_address,
    expires_at: iso(row.expires_at)!,
    status: row.status,
    fulfillment_status: row.fulfillment_status,
    created_at: iso(row.created_at)!,
    blockchain_tx_hash: row.blockchain_tx_hash ?? undefined,
    received_confirmations: row.received_confirmations ?? undefined,
    paid_at: iso(row.paid_at),
    iccid_encrypted: row.iccid_encrypted ?? undefined,
    activation_code_encrypted: row.activation_code_encrypted ?? undefined,
    sm_dp_address: row.sm_dp_address ?? undefined,
    pika_order_id: row.pika_order_id ?? undefined,
    esim_purchased_at: iso(row.esim_purchased_at),
    topup_iccid_encrypted: row.topup_iccid_encrypted ?? undefined,
    monero_subaddress_index: row.monero_subaddress_index ?? undefined,
    monero_account_index: row.monero_account_index ?? undefined,
  };
}

export async function queryPackageCache(
  _countryCode?: string,
  _productType?: string
) {
  return null;
}

export async function upsertPackageCache(_packages?: unknown[]) {
  return true;
}

export class CouponUnavailableError extends Error {
  constructor() {
    super("Discount code is not active or its usage limit was reached");
    this.name = "CouponUnavailableError";
  }
}

export async function createInvoiceRecord(
  data: CreateInvoiceInput,
  couponCode?: string
): Promise<StoredInvoice> {
  if (!Number.isFinite(data.amount_usd) || data.amount_usd <= 0) {
    throw new Error("Invoice amount must be greater than zero");
  }
  if (!Number.isFinite(data.amount_crypto) || data.amount_crypto <= 0) {
    throw new Error("Crypto amount must be greater than zero");
  }

  const sql = getDatabase();
  const rows = await sql.begin(async (tx) => {
    if (couponCode) {
      const normalizedCode = couponCode.trim().toUpperCase();
      if (!/^[A-Z0-9]{1,12}-\d{1,2}-\d{1,6}-(?:[A-F0-9]{12}|[A-F0-9]{32})$/.test(normalizedCode)) {
        throw new CouponUnavailableError();
      }
      const consumed = await tx<{ key: string }[]>`
        UPDATE app_kv
        SET value = jsonb_set(
              value,
              '{uses}',
              to_jsonb(COALESCE((value->>'uses')::integer, 0) + 1),
              true
            ),
            updated_at = now()
        WHERE key = ${`cpn_${normalizedCode}`}
          AND COALESCE((value->>'revoked')::boolean, false) = false
          AND (
            COALESCE((value->>'maxUses')::integer, 0) = 0
            OR COALESCE((value->>'uses')::integer, 0) < COALESCE((value->>'maxUses')::integer, 0)
          )
        RETURNING key
      `;
      if (!consumed[0]) throw new CouponUnavailableError();
    }

    return tx<InvoiceRow[]>`
      INSERT INTO invoices (
        invoice_id, wallet_id_hash, package_code, package_name, country, country_code,
        data_amount, duration_days, amount_usd, amount_crypto, crypto_type,
        payment_address, expires_at, topup_iccid_encrypted, monero_subaddress_index, monero_account_index
      ) VALUES (
        ${data.invoice_id}, ${data.wallet_id_hash}, ${data.package_code},
        ${data.package_name ?? data.package_code}, ${data.country ?? ""},
        ${data.country_code ?? ""}, ${data.data_amount ?? ""}, ${data.duration_days ?? 0},
        ${data.amount_usd}, ${data.amount_crypto}, ${data.crypto_type}, ${data.payment_address},
        ${data.expires_at}, ${data.topup_iccid_encrypted ?? null},
        ${data.monero_subaddress_index ?? null}, ${data.monero_account_index ?? null}
      ) RETURNING *
    `;
  });
  return mapInvoice(rows[0]);
}

export async function getInvoiceById(invoiceId: string): Promise<StoredInvoice | null> {
  const rows = await getDatabase()<InvoiceRow[]>`
    SELECT * FROM invoices WHERE invoice_id = ${invoiceId} LIMIT 1
  `;
  return rows[0] ? mapInvoice(rows[0]) : null;
}

export async function getInvoiceByExternalId(invoiceId: string): Promise<StoredInvoice | null> {
  return getInvoiceById(invoiceId);
}

export async function getInvoicesByWalletHash(walletHash: string): Promise<StoredInvoice[]> {
  const rows = await getDatabase()<InvoiceRow[]>`
    SELECT * FROM invoices WHERE wallet_id_hash = ${walletHash}
    ORDER BY created_at DESC LIMIT 200
  `;
  return rows.map(mapInvoice);
}

export async function getInvoiceByPikaOrderId(pikaOrderId: string): Promise<StoredInvoice | null> {
  const rows = await getDatabase()<InvoiceRow[]>`
    SELECT * FROM invoices WHERE pika_order_id = ${pikaOrderId} LIMIT 1
  `;
  return rows[0] ? mapInvoice(rows[0]) : null;
}

export async function updateInvoicePikaOrderId(invoiceId: string, pikaOrderId: string): Promise<boolean> {
  const rows = await getDatabase()<InvoiceRow[]>`
    UPDATE invoices SET pika_order_id = ${pikaOrderId}
    WHERE invoice_id = ${invoiceId} RETURNING *
  `;
  return rows.length > 0;
}

export async function updateInvoiceStatus(
  invoiceId: string,
  status: InvoiceStatus,
  txHash?: string,
  confirmations?: number
): Promise<boolean> {
  const storedTxHash = txHash ? hashTransactionForStorage(txHash.trim().toLowerCase()) : null;
  const rows = await getDatabase()<InvoiceRow[]>`
    UPDATE invoices
    SET status = CASE
          WHEN invoices.status = 'confirmed' AND ${status} <> 'confirmed' THEN invoices.status
          ELSE ${status}
        END,
        blockchain_tx_hash = COALESCE(${storedTxHash}, blockchain_tx_hash),
        received_confirmations = COALESCE(${confirmations ?? null}, received_confirmations),
        paid_at = CASE WHEN ${status} = 'confirmed' THEN COALESCE(paid_at, now()) ELSE paid_at END
    WHERE invoice_id = ${invoiceId}
    RETURNING *
  `;
  return rows.length > 0;
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
  const rows = await getDatabase()<InvoiceRow[]>`
    UPDATE invoices
    SET iccid_encrypted = ${data.iccid_encrypted},
        activation_code_encrypted = ${data.activation_code_encrypted},
        sm_dp_address = ${data.sm_dp_address},
        pika_order_id = ${data.pika_order_id || null},
        esim_purchased_at = now(),
        status = 'confirmed',
        fulfillment_status = 'complete',
        paid_at = COALESCE(paid_at, now())
    WHERE invoice_id = ${invoiceId}
    RETURNING *
  `;
  return rows.length > 0;
}

export async function claimPaymentTransaction(
  txHash: string,
  invoiceId: string,
  confirmations: number
): Promise<PaymentClaimResult> {
  const normalizedHash = txHash.trim().toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(normalizedHash)) {
    throw new Error("Invalid transaction hash");
  }

  const storedTxHash = hashTransactionForStorage(normalizedHash);
  const sql = getDatabase();
  return sql.begin(async (tx) => {
    const invoices = await tx<InvoiceRow[]>`
      SELECT * FROM invoices WHERE invoice_id = ${invoiceId} FOR UPDATE
    `;
    if (!invoices[0]) return { kind: "not_found" } as const;

    const txClaim = await tx<{ tx_hash: string; invoice_id: string }[]>`
      SELECT tx_hash, invoice_id FROM payment_claims
      WHERE tx_hash = ${storedTxHash} OR invoice_id = ${invoiceId}
      FOR UPDATE
    `;
    const txForInvoice = txClaim.find((claim) => claim.invoice_id === invoiceId);
    const txForHash = txClaim.find((claim) => claim.tx_hash === storedTxHash);
    if (txForHash && txForHash.invoice_id !== invoiceId) {
      return { kind: "replay", invoiceId: txForHash.invoice_id } as const;
    }
    if (txForInvoice && txForInvoice.tx_hash !== storedTxHash) {
      return { kind: "already_paid", invoice: mapInvoice(invoices[0]) } as const;
    }

    const wasUnclaimed = txClaim.length === 0;
    if (wasUnclaimed) {
      const inserted = await tx<{ invoice_id: string }[]>`
        INSERT INTO payment_claims (tx_hash, invoice_id)
        VALUES (${storedTxHash}, ${invoiceId})
        ON CONFLICT DO NOTHING
        RETURNING invoice_id
      `;
      if (!inserted[0]) {
        const existing = await tx<{ invoice_id: string }[]>`
          SELECT invoice_id FROM payment_claims WHERE tx_hash = ${storedTxHash}
        `;
        if (existing[0]?.invoice_id !== invoiceId) {
          return { kind: "replay", invoiceId: existing[0]?.invoice_id ?? "" } as const;
        }
        return { kind: "already_paid", invoice: mapInvoice(invoices[0]) } as const;
      }
    }

    const shouldStart = invoices[0].fulfillment_status === "pending";
    const rows = await tx<InvoiceRow[]>`
      UPDATE invoices
      SET status = 'confirmed',
          blockchain_tx_hash = ${storedTxHash},
          received_confirmations = ${confirmations},
          paid_at = COALESCE(paid_at, now()),
          fulfillment_status = CASE
            WHEN fulfillment_status = 'pending' THEN 'processing'
            ELSE fulfillment_status
          END
      WHERE invoice_id = ${invoiceId}
      RETURNING *
    `;
    const invoice = mapInvoice(rows[0]);
    if (invoice.fulfillment_status === "complete") return { kind: "complete", invoice } as const;
    if (invoice.fulfillment_status === "needs_review") return { kind: "needs_review", invoice } as const;
    if (shouldStart) return { kind: "claimed", invoice } as const;
    return { kind: "processing", invoice } as const;
  });
}

export async function completeTopup(invoiceId: string): Promise<boolean> {
  const rows = await getDatabase()<InvoiceRow[]>`
    UPDATE invoices
    SET status = 'confirmed', fulfillment_status = 'complete', paid_at = COALESCE(paid_at, now())
    WHERE invoice_id = ${invoiceId} AND topup_iccid_encrypted IS NOT NULL
    RETURNING *
  `;
  return rows.length > 0;
}

export async function markFulfillmentNeedsReview(invoiceId: string): Promise<void> {
  await getDatabase()`
    UPDATE invoices SET fulfillment_status = 'needs_review'
    WHERE invoice_id = ${invoiceId} AND fulfillment_status = 'processing'
  `;
}

export async function expireInvoiceIfOverdue(invoiceId: string): Promise<void> {
  await getDatabase()`
    UPDATE invoices SET status = 'expired'
    WHERE invoice_id = ${invoiceId} AND status = 'pending' AND expires_at <= now()
  `;
}

export async function registerAuthChallenge(
  challengeId: string,
  walletAddressHash: string,
  expiresAt: Date
): Promise<void> {
  await getDatabase()`
    INSERT INTO auth_challenges (challenge_id, wallet_address_hash, expires_at)
    VALUES (${challengeId}, ${walletAddressHash}, ${expiresAt.toISOString()})
  `;
}

export async function consumeAuthChallenge(
  challengeId: string,
  walletAddressHash: string
): Promise<boolean> {
  const rows = await getDatabase()<{ challenge_id: string }[]>`
    UPDATE auth_challenges SET consumed_at = now()
    WHERE challenge_id = ${challengeId}
      AND wallet_address_hash = ${walletAddressHash}
      AND consumed_at IS NULL
      AND expires_at > now()
    RETURNING challenge_id
  `;
  return rows.length === 1;
}

export async function consumeRateLimit(
  hashedKey: string,
  windowMs: number,
  max: number
): Promise<{ allowed: boolean; remaining: number; resetAt: number }> {
  const rows = await getDatabase()<{ count: number; reset_at: Date | string }[]>`
    INSERT INTO rate_limit_buckets (bucket_key, count, reset_at)
    VALUES (
      ${hashedKey}, 1,
      now() + (${windowMs}::double precision * interval '1 millisecond')
    )
    ON CONFLICT (bucket_key) DO UPDATE
      SET count = CASE
            WHEN rate_limit_buckets.reset_at <= now() THEN 1
            ELSE rate_limit_buckets.count + 1
          END,
          reset_at = CASE
            WHEN rate_limit_buckets.reset_at <= now()
              THEN now() + (${windowMs}::double precision * interval '1 millisecond')
            ELSE rate_limit_buckets.reset_at
          END
    RETURNING count, reset_at
  `;
  const count = Number(rows[0].count);
  const resetAt = new Date(rows[0].reset_at).getTime();
  return { allowed: count <= max, remaining: Math.max(0, max - count), resetAt };
}

export async function deleteOldInvoices(): Promise<number> {
  const rows = await getDatabase()<{ invoice_id: string }[]>`
    DELETE FROM invoices
    WHERE created_at < now() - interval '30 days'
    RETURNING invoice_id
  `;
  await getDatabase()`
    DELETE FROM auth_challenges WHERE expires_at < now() OR consumed_at < now() - interval '1 day'
  `;
  await getDatabase()`
    DELETE FROM rate_limit_buckets WHERE reset_at < now() - interval '1 day'
  `;
  await getDatabase()`
    DELETE FROM app_kv WHERE left(key, 3) = 'an_'
  `;
  return rows.length;
}

// Compatibility aliases used by older pages/routes.
export async function createOrderRecord(data: Record<string, unknown>) {
  return data;
}

export async function getOrdersByWalletHash(walletHash: string) {
  return getInvoicesByWalletHash(walletHash);
}

export async function getOrderById(orderId: string) {
  return getInvoiceById(orderId);
}

// Static, git-versioned editorial content.
export { getBlogPosts, getBlogPostBySlug, getAllBlogSlugs };
