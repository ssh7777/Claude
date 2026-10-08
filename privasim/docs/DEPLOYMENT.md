# PRIVASIM — Vercel deployment & checkout runbook

This is the checklist for getting https://privasim.app serving pages and taking
payments. Work through it top to bottom; almost every "checkout is temporarily
unavailable" report traces back to one item below.

---

## 1. Vercel project settings

| Setting | Value |
|---|---|
| Framework Preset | **Next.js** |
| Root Directory | **`privasim`** ← pick one and keep it |
| Install Command | `npm ci` |
| Build Command | `npm run build` |
| Output Directory | `.next` (default) |
| Node.js Version | 22.x |
| Region | `iad1` |

> **Root Directory is the single most common cause of a confusing deploy.**
> The repo contains two Vercel config files that are kept intentionally
> consistent:
>
> * `vercel.json` (repo root) — builds with `npm ci --prefix privasim`, output
>   `privasim/.next`. Used when **Root Directory is the repository root**.
> * `privasim/vercel.json` — builds with `npm ci`, output `.next`. Used when
>   **Root Directory is `privasim`**.
>
> Both declare the same framework, region, cron, security headers and default
> wallet/URL env values, so either setting works. Do not edit one without the
> other.

### PR #34

`Update Monero wallet across system, add checkout fallback and admin controls`
(#34) is **merged into `main`**. Merging does not deploy by itself — trigger a
production deploy:

```bash
git checkout main && git pull
vercel --prod          # or: Deployments → ⋯ → Redeploy in the dashboard
```

Confirm the deployment's commit SHA matches the merge commit on `main` before
testing checkout.

---

## 2. Database (do this before anything else)

1. Create a managed PostgreSQL database (Neon, Supabase, RDS, …) with TLS.
2. Apply the schema **once**:

   ```bash
   psql "$DATABASE_URL" -f privasim/db/migrations/0001_enterprise.sql
   ```

   Expected tables: `invoices`, `payment_claims`, `app_kv`, `auth_challenges`,
   `rate_limit_buckets`.
3. Set `DB_POOL_MAX=1` on Vercel (serverless functions must not hold many
   connections). Raise it only if your provider supports a pooler.

Without the migration, `/api/orders/create` returns
`503 database_unavailable`.

---

## 3. Environment variable checklist

Set these in **Vercel → Project → Settings → Environment Variables** for
Production (and Preview if you use it). Generate every secret independently:

```bash
openssl rand -hex 32
```

### Required — checkout will not work without these

| Variable | Required value | Used by |
|---|---|---|
| `DATABASE_URL` | `postgresql://…?sslmode=require` | invoices, rate limits, coupons, settings, catalog snapshot, price cache |
| `JWT_SECRET` | ≥ 32 random bytes | invoice tokens, captcha signing, rate-limit key HMAC, wallet hashes |
| `DB_ENCRYPTION_KEY` | exactly 32 bytes (64 hex chars, or `base64:…`) | AES-256-GCM for eSIM credentials / top-up ICCIDs |
| `PAYMENT_HASH_SECRET` | ≥ 32 random bytes | HMAC of transaction hashes at rest |
| `PIKASIM_API_KEY` | provider-issued key | package catalog + order fulfilment |
| `MONERO_WALLET_PRIMARY` | `83JkvCKVybdWSFJPrT7wKdQMosgdAnR97YG9GVNdKdk3bG6Aa6EjXMD4AGb6ngyTX2M3USfG46ieyck3HvFwSoa31f2vDfr` | XMR invoices |
| `ETHEREUM_WALLET_ADDRESS` | `0x87176027Cc61d260926dAAe68551e246260dc30E` | ETH + USDT invoices |

`MONERO_WALLET_PRIMARY` and `ETHEREUM_WALLET_ADDRESS` are already set as
defaults in both `vercel.json` files. **Project-level environment variables
override `vercel.json`** — if they are also defined in the dashboard, make sure
the dashboard value is the current wallet, not an old one.

### Required for full operation

| Variable | Purpose |
|---|---|
| `ADMIN_API_KEY` | separate header for `/api/admin/*`; must not equal the supplier key. Also unlocks detailed `/api/health` probes. |
| `COUPON_SIGNING_SECRET` | signs new discount codes (independent of `JWT_SECRET`) |
| `CRON_SECRET` | protects `POST /api/cron/retention` |
| `MONERO_WEBHOOK_SECRET` | raw-body HMAC for the Monero webhook |
| `ETHEREUM_WEBHOOK_SECRET` | raw-body HMAC for the Ethereum webhook |

### Recommended

| Variable | Purpose |
|---|---|
| `MONERO_WALLET_RPC_URL` / `_USER` / `_PASSWORD` | without these, every XMR invoice reuses the static primary address instead of a fresh subaddress |
| `ETHEREUM_RPC_URL` | authenticated mainnet RPC; otherwise verification relies on public fallbacks |
| `COINGECKO_API_KEY` | lifts the free-tier rate limit on the primary price feed |
| `NEXT_PUBLIC_APP_URL` | canonical URL for metadata/sitemaps (`https://privasim.app`) |
| `NEXT_PUBLIC_SUPPORT_EMAIL` | support contact shown in the UI |

### Optional resilience knobs

| Variable | Default | Purpose |
|---|---|---|
| `FALLBACK_XMR_USD` / `FALLBACK_ETH_USD` | unset | last-resort static rates when every live feed fails. Quotes from them are logged loudly — keep them current if you set them. |
| `PRICE_FRESH_MS` | `300000` | how long a quote is reused before refreshing |
| `PRICE_MAX_STALE_MS` | `21600000` | max age of a cached quote before checkout refuses |
| `PIKASIM_REST_BASE` / `PIKASIM_MCP_BASE` | `https://pikasim.com/api` / `/mcp` | point the supplier client at a proxy or mirror |
| `PRICE_COINGECKO_BASE` / `PRICE_KRAKEN_BASE` / `PRICE_BINANCE_BASE` | public endpoints | point the price feeds at a proxy or mirror |

---

## 4. Verify the deployment

### 4.1 Configuration probe

```bash
curl -s https://privasim.app/api/health | jq
```

Expect `"ok": true`, an empty `blockingIssues` array, and
`"databaseReachable": true`. The unauthenticated response reports booleans
only — it never returns secret values.

Add the admin key for live probes of the database, the price feed and the
supplier catalog:

```bash
curl -s https://privasim.app/api/health -H "x-admin-key: $ADMIN_API_KEY" | jq .probes
```

### 4.2 Simulated purchase against production

```bash
BASE=https://privasim.app node - <<'JS'
const BASE = process.env.BASE;
const { createHash } = require("node:crypto");
const lzb = (h) => { let b = 0; for (const c of h) { const v = parseInt(c, 16);
  if (v === 0) { b += 4; continue; } if (v < 2) return b + 3; if (v < 4) return b + 2;
  if (v < 8) return b + 1; return b; } return b; };
(async () => {
  const ch = await (await fetch(`${BASE}/api/captcha`)).json();
  let nonce = 0;
  while (lzb(createHash("sha256").update(`${ch.salt}:${nonce}`).digest("hex")) < ch.difficulty) nonce++;
  const res = await fetch(`${BASE}/api/orders/create`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ packageCode: "P94JA3ZNK", cryptoType: "monero", captcha: { ...ch, nonce } }),
  });
  console.log(res.status, JSON.stringify(await res.json(), null, 2).slice(0, 900));
})();
JS
```

Grab a real `packageCode` from `https://privasim.app/shop/JP`. A `200` means
configuration, database, supplier pricing and the exchange-rate feed are all
healthy. **Do not pay the invoice** — it expires in 15 minutes and is deleted
by the retention cron after 30 days.

### 4.3 Browser check

1. `/shop/JP` lists plans with prices.
2. `/checkout/<code>` loads the plan and shows a Monero/ETH/USDT selector.
3. "Create invoice" returns a QR code, an amount and an expiry timer.
4. `/orders` shows the saved invoice after checkout.

---

## 5. Failure codes returned by `/api/orders/create`

Every error response carries `{ error, code, requestId }`. The `requestId` is
written to the structured server log line `event: invoice_creation_failed`, so
you can pull the exact stack trace from Vercel logs.

| `code` | HTTP | Meaning | Fix |
|---|---|---|---|
| `configuration_error` | 503 | An env var is missing or malformed | Check `/api/health` → `blockingIssues`; the missing keys are in the log detail |
| `database_unavailable` | 503 | `DATABASE_URL` unreachable or the rate-limit store is down | Check DB status / connection limits / `DB_POOL_MAX` |
| `pricing_unavailable` | 503 | Every exchange-rate source failed and no usable cached quote | Wait, or set `FALLBACK_XMR_USD` / `FALLBACK_ETH_USD`; check the log `reasons` array |
| `package_unavailable` | 503 | PikaSim is unreachable/unauthorised — checkout refuses rather than invoicing from a stale price | Check `PIKASIM_API_KEY` and supplier status |
| `package_not_found` | 404 | The package code is not in the supplier catalogue | Refresh the catalog URL |
| `captcha_failed` | 400 | Proof-of-work missing, expired or wrong | Refresh the checkout page |
| `rate_limited` | 429 | More than 10 order attempts/minute from one IP | Wait a minute |
| `invalid_discount` | 409 | Coupon revoked, exhausted or not activated | Re-check in `/admin` |

---

## 6. How the new resilience layers behave

* **Prices** (`lib/priceFeed.ts`) resolve CoinGecko → Kraken → Binance →
  last-known-good quote (process cache, then PostgreSQL `app_kv`) → optional
  `FALLBACK_*_USD`. Requests are single-flighted per instance, and a quote that
  moves more than 25% inside one freshness window is rejected as a bad
  provider response.
* **Catalog** (`lib/pikasim.ts`) resolves live supplier → per-country snapshot
  in PostgreSQL → committed `data/fallback-catalog.json`. Shop pages always
  render; anything not live is labelled with a banner. **Checkout never prices
  from a stale catalog** — it requires a live supplier read.
* **Settings/margin** (`lib/settings.ts`) fall back to the documented default
  (70% markup) with a logged warning if the ledger is unreachable, instead of
  500-ing every shop page.
* **Rate limiting** (`lib/rateLimit.ts`) fails closed for order creation (money
  path) and fails open for read-only catalog endpoints, so a database blip
  degrades browsing rather than breaking the site.

---

## 7. Local validation before you push

```bash
cd privasim
npm ci
npm run type-check
npm run lint
npm run build
```

No production deployment should be described as ready until these three checks
pass and `/api/health` reports `"ok": true` on the deployed URL.
