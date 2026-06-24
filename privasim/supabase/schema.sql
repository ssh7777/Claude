-- PRIVASIM Database Schema
-- Run this entire file in Supabase SQL Editor to initialize the database
-- Project: https://app.supabase.com/project/_/sql

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =======================
-- TABLE: wallets
-- =======================
CREATE TABLE IF NOT EXISTS wallets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_address_hash TEXT NOT NULL UNIQUE,
  wallet_address_encrypted TEXT NOT NULL,
  wallet_type VARCHAR(50) CHECK (wallet_type IN ('monero', 'ethereum')),
  total_spent DECIMAL(15, 2) DEFAULT 0,
  total_orders INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_activity TIMESTAMPTZ,
  expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '90 days'
);

CREATE INDEX IF NOT EXISTS idx_wallets_address_hash ON wallets(wallet_address_hash);
CREATE INDEX IF NOT EXISTS idx_wallets_expires_at ON wallets(expires_at);

-- =======================
-- TABLE: auth_challenges
-- =======================
CREATE TABLE IF NOT EXISTS auth_challenges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_address_hash TEXT NOT NULL UNIQUE,
  challenge TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_auth_challenges_hash ON auth_challenges(wallet_address_hash);
CREATE INDEX IF NOT EXISTS idx_auth_challenges_expires ON auth_challenges(expires_at);

-- =======================
-- TABLE: crypto_invoices
-- =======================
CREATE TABLE IF NOT EXISTS crypto_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id VARCHAR(255) UNIQUE NOT NULL,
  wallet_id_hash TEXT NOT NULL,
  package_code VARCHAR(255),
  amount_usd DECIMAL(10, 2),
  amount_crypto DECIMAL(20, 8),
  crypto_type VARCHAR(50) CHECK (crypto_type IN ('monero', 'ethereum', 'usdt_eth')),
  payment_address_encrypted TEXT,
  expected_confirmations INT DEFAULT 10,
  received_confirmations INT DEFAULT 0,
  status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'expired', 'failed')),
  blockchain_tx_hash VARCHAR(255),
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_invoices_status ON crypto_invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_expires_at ON crypto_invoices(expires_at);
CREATE INDEX IF NOT EXISTS idx_invoices_wallet ON crypto_invoices(wallet_id_hash);

-- =======================
-- TABLE: orders
-- =======================
CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id_hash TEXT NOT NULL,
  order_id_external VARCHAR(255) UNIQUE NOT NULL,
  package_code VARCHAR(255) NOT NULL,
  package_name VARCHAR(255) NOT NULL,
  product_type VARCHAR(50) DEFAULT 'data' CHECK (product_type IN ('data', 'phone')),
  country VARCHAR(100),
  data_amount VARCHAR(50),
  duration_days INT,
  iccid_encrypted TEXT NOT NULL,
  activation_code_encrypted TEXT NOT NULL,
  sm_dp_address_encrypted TEXT,
  status VARCHAR(50) DEFAULT 'completed' CHECK (status IN ('pending', 'completed', 'activated', 'expired', 'cancelled')),
  cost_usd DECIMAL(10, 2),
  cost_crypto DECIMAL(20, 8),
  crypto_type VARCHAR(50),
  payment_tx_hash VARCHAR(255),
  data_used_gb DECIMAL(5, 2) DEFAULT 0,
  data_remaining_gb DECIMAL(5, 2),
  expires_at TIMESTAMPTZ,
  activated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  auto_delete_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '30 days'
);

CREATE INDEX IF NOT EXISTS idx_orders_wallet_hash ON orders(wallet_id_hash);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_auto_delete ON orders(auto_delete_at);
CREATE INDEX IF NOT EXISTS idx_orders_external_id ON orders(order_id_external);

-- =======================
-- TABLE: package_cache
-- =======================
CREATE TABLE IF NOT EXISTS package_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  country_code VARCHAR(2) NOT NULL,
  product_type VARCHAR(50),
  package_code VARCHAR(255) UNIQUE NOT NULL,
  package_name VARCHAR(255),
  data_amount VARCHAR(50),
  price_usd DECIMAL(10, 2),
  networks TEXT[],
  cached_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '24 hours'
);

CREATE INDEX IF NOT EXISTS idx_cache_country ON package_cache(country_code);
CREATE INDEX IF NOT EXISTS idx_cache_expires ON package_cache(expires_at);

-- =======================
-- TABLE: blog_posts
-- =======================
CREATE TABLE IF NOT EXISTS blog_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug VARCHAR(255) UNIQUE NOT NULL,
  title VARCHAR(255) NOT NULL,
  content TEXT NOT NULL,
  published_at TIMESTAMPTZ,
  featured BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_blog_slug ON blog_posts(slug);
CREATE INDEX IF NOT EXISTS idx_blog_published ON blog_posts(published_at);

-- =======================
-- TABLE: server_logs (aggregated, no PII)
-- =======================
CREATE TABLE IF NOT EXISTS server_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_name VARCHAR(100),
  event_data JSONB,
  country_code VARCHAR(2),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_logs_event ON server_logs(event_name);
CREATE INDEX IF NOT EXISTS idx_logs_created ON server_logs(created_at);

-- =======================
-- ROW LEVEL SECURITY
-- =======================
ALTER TABLE wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE crypto_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE auth_challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE package_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE blog_posts ENABLE ROW LEVEL SECURITY;

-- Service role bypasses RLS (used by backend only)
-- Anon key can only read public data (blog posts, package cache)
CREATE POLICY "Public read blog posts" ON blog_posts
  FOR SELECT USING (published_at IS NOT NULL AND published_at <= NOW());

CREATE POLICY "Public read package cache" ON package_cache
  FOR SELECT USING (expires_at > NOW());

-- All other tables: service role only (no client-side access)
CREATE POLICY "Service role only wallets" ON wallets
  USING (auth.role() = 'service_role');

CREATE POLICY "Service role only orders" ON orders
  USING (auth.role() = 'service_role');

CREATE POLICY "Service role only invoices" ON crypto_invoices
  USING (auth.role() = 'service_role');

CREATE POLICY "Service role only challenges" ON auth_challenges
  USING (auth.role() = 'service_role');

-- =======================
-- AUTO-CLEANUP FUNCTION
-- =======================
CREATE OR REPLACE FUNCTION cleanup_expired_data()
RETURNS void AS $$
BEGIN
  DELETE FROM orders WHERE auto_delete_at < NOW();
  DELETE FROM crypto_invoices WHERE expires_at < NOW() AND status IN ('expired', 'failed');
  DELETE FROM auth_challenges WHERE expires_at < NOW();
  DELETE FROM package_cache WHERE expires_at < NOW();
  DELETE FROM wallets WHERE expires_at < NOW() AND total_orders = 0;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Run cleanup daily via pg_cron (requires pg_cron extension)
-- SELECT cron.schedule('cleanup-expired', '0 3 * * *', 'SELECT cleanup_expired_data()');

-- =======================
-- SAMPLE BLOG POSTS
-- =======================
INSERT INTO blog_posts (slug, title, content, published_at, featured) VALUES
(
  'how-to-install-esim',
  'How to Install an eSIM on Your Phone',
  '<h2>Step 1: Get Your Activation Code</h2><p>After purchasing from PRIVASIM, connect your wallet and navigate to My Orders. Click "Reveal eSIM Codes" to decrypt your activation code.</p><h2>Step 2: Open Settings</h2><p>On iPhone: Settings → Cellular → Add eSIM. On Android: Settings → Connections → SIM Manager → Add eSIM.</p><h2>Step 3: Scan QR Code</h2><p>Choose "Scan QR code" and point your camera at the code provided. The eSIM will be downloaded in seconds.</p><h2>Step 4: Activate</h2><p>Enable the eSIM from your SIM settings and set it as your data SIM when traveling.</p>',
  NOW(),
  TRUE
),
(
  'monero-payment-guide',
  'How to Pay with Monero (XMR)',
  '<h2>Why Monero?</h2><p>Monero is the most privacy-preserving cryptocurrency available. Unlike Bitcoin, Monero hides sender, receiver, and amount on the blockchain by default.</p><h2>Getting a Monero Wallet</h2><p>We recommend <strong>Cake Wallet</strong> (iOS/Android) — it is open source and easy to use. Download from the official website, not an app store link.</p><h2>Sending a Payment</h2><p>1. Open PRIVASIM and add your Monero address<br>2. Browse and select an eSIM plan<br>3. Choose Monero as payment<br>4. Scan the QR code with Cake Wallet<br>5. Confirm the transaction<br>6. Wait 10 block confirmations (~10 minutes)</p><h2>Privacy Tips</h2><p>For maximum privacy, use a fresh Monero address for each purchase. Monero already provides strong privacy by default, but avoiding address reuse is good practice.</p>',
  NOW(),
  FALSE
)
ON CONFLICT (slug) DO NOTHING;
