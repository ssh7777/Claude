import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Client for public read operations
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Admin client for server-side mutations (never expose to client)
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

export async function queryPackageCache(countryCode: string, productType?: string) {
  let query = supabaseAdmin
    .from("package_cache")
    .select("*")
    .eq("country_code", countryCode.toUpperCase())
    .gt("expires_at", new Date().toISOString());

  if (productType) {
    query = query.eq("product_type", productType);
  }

  const { data, error } = await query;
  if (error) return null;
  return data;
}

export async function upsertPackageCache(packages: {
  country_code: string;
  product_type: string;
  package_code: string;
  package_name: string;
  data_amount: string;
  price_usd: number;
  networks: string[];
}[]) {
  const { error } = await supabaseAdmin
    .from("package_cache")
    .upsert(packages, { onConflict: "package_code" });
  return !error;
}

export async function createInvoiceRecord(data: {
  invoice_id: string;
  wallet_id_hash: string;
  amount_usd: number;
  amount_crypto: number;
  crypto_type: string;
  payment_address_encrypted: string;
  expires_at: string;
}) {
  const { data: row, error } = await supabaseAdmin
    .from("crypto_invoices")
    .insert(data)
    .select()
    .single();
  if (error) throw new Error(`DB insert invoice failed: ${error.message}`);
  return row;
}

export async function getInvoiceByExternalId(invoiceId: string) {
  const { data, error } = await supabaseAdmin
    .from("crypto_invoices")
    .select("*")
    .eq("invoice_id", invoiceId)
    .single();
  if (error) return null;
  return data;
}

export async function updateInvoiceStatus(
  invoiceId: string,
  status: string,
  txHash?: string,
  confirmations?: number
) {
  const updates: Record<string, unknown> = { status };
  if (txHash) updates.blockchain_tx_hash = txHash;
  if (confirmations !== undefined) updates.received_confirmations = confirmations;

  const { error } = await supabaseAdmin
    .from("crypto_invoices")
    .update(updates)
    .eq("invoice_id", invoiceId);
  return !error;
}

export async function createOrderRecord(data: {
  wallet_id_hash: string;
  order_id_external: string;
  package_code: string;
  package_name: string;
  product_type: string;
  country: string;
  data_amount: string;
  duration_days: number;
  iccid_encrypted: string;
  activation_code_encrypted: string;
  sm_dp_address_encrypted: string;
  cost_usd: number;
  cost_crypto: number;
  crypto_type: string;
  payment_tx_hash?: string;
  data_remaining_gb: number;
  expires_at: string;
}) {
  const { data: row, error } = await supabaseAdmin
    .from("orders")
    .insert({ ...data, status: "completed" })
    .select()
    .single();
  if (error) throw new Error(`DB insert order failed: ${error.message}`);
  return row;
}

export async function getOrdersByWalletHash(walletHash: string) {
  const { data, error } = await supabaseAdmin
    .from("orders")
    .select(
      "id, package_code, package_name, country, data_amount, duration_days, status, cost_usd, cost_crypto, crypto_type, data_used_gb, data_remaining_gb, expires_at, activated_at, created_at"
    )
    .eq("wallet_id_hash", walletHash)
    .order("created_at", { ascending: false });
  if (error) return [];
  return data;
}

export async function getOrderById(orderId: string, walletHash: string) {
  const { data, error } = await supabaseAdmin
    .from("orders")
    .select("*")
    .eq("id", orderId)
    .eq("wallet_id_hash", walletHash)
    .single();
  if (error) return null;
  return data;
}

export async function getBlogPosts(limit = 20, offset = 0) {
  const { data, error } = await supabase
    .from("blog_posts")
    .select("id, slug, title, published_at, featured")
    .not("published_at", "is", null)
    .order("published_at", { ascending: false })
    .range(offset, offset + limit - 1);
  if (error) return [];
  return data;
}

export async function getBlogPostBySlug(slug: string) {
  const { data, error } = await supabase
    .from("blog_posts")
    .select("*")
    .eq("slug", slug)
    .not("published_at", "is", null)
    .single();
  if (error) return null;
  return data;
}
