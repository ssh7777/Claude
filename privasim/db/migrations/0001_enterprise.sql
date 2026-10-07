-- PRIVASIM persistent state. Apply once to a managed PostgreSQL database before deployment.
-- Keep payment claims durable and unique: one blockchain transaction and one invoice
-- may be fulfilled at most once.

CREATE TABLE IF NOT EXISTS invoices (
  invoice_id TEXT PRIMARY KEY,
  wallet_id_hash TEXT NOT NULL,
  package_code TEXT NOT NULL,
  package_name TEXT NOT NULL,
  country TEXT NOT NULL DEFAULT '',
  country_code TEXT NOT NULL DEFAULT '',
  data_amount TEXT NOT NULL DEFAULT '',
  duration_days INTEGER NOT NULL DEFAULT 0 CHECK (duration_days >= 0),
  amount_usd NUMERIC(18, 2) NOT NULL CHECK (amount_usd > 0),
  amount_crypto NUMERIC(36, 18) NOT NULL CHECK (amount_crypto > 0),
  crypto_type TEXT NOT NULL CHECK (crypto_type IN ('monero', 'ethereum', 'usdt_eth')),
  payment_address TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'confirmed', 'failed', 'expired')),
  fulfillment_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (fulfillment_status IN ('pending', 'processing', 'complete', 'needs_review')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  blockchain_tx_hash TEXT,
  received_confirmations INTEGER CHECK (received_confirmations IS NULL OR received_confirmations >= 0),
  paid_at TIMESTAMPTZ,
  iccid_encrypted TEXT,
  activation_code_encrypted TEXT,
  sm_dp_address TEXT,
  pika_order_id TEXT,
  esim_purchased_at TIMESTAMPTZ,
  topup_iccid_encrypted TEXT,
  monero_subaddress_index INTEGER CHECK (monero_subaddress_index IS NULL OR monero_subaddress_index >= 0),
  monero_account_index INTEGER CHECK (monero_account_index IS NULL OR monero_account_index >= 0)
);

CREATE INDEX IF NOT EXISTS invoices_wallet_created_idx
  ON invoices (wallet_id_hash, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS invoices_pika_order_idx
  ON invoices (pika_order_id) WHERE pika_order_id IS NOT NULL AND pika_order_id <> '';
CREATE INDEX IF NOT EXISTS invoices_retention_idx
  ON invoices (created_at);

CREATE TABLE IF NOT EXISTS payment_claims (
  tx_hash TEXT PRIMARY KEY CHECK (tx_hash ~ '^[a-f0-9]{64}$'),
  invoice_id TEXT NOT NULL UNIQUE REFERENCES invoices(invoice_id) ON DELETE CASCADE,
  claimed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS app_kv (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS auth_challenges (
  challenge_id TEXT PRIMARY KEY,
  wallet_address_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  consumed_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS auth_challenges_expiry_idx ON auth_challenges (expires_at);

CREATE TABLE IF NOT EXISTS rate_limit_buckets (
  bucket_key TEXT PRIMARY KEY,
  count INTEGER NOT NULL CHECK (count >= 0),
  reset_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS rate_limit_buckets_reset_idx ON rate_limit_buckets (reset_at);
