# PRIVASIM — Project Context

## Overview
Privacy-focused eSIM marketplace. Checkout does not require an identity account, email, or ID. It accepts Monero (XMR), Ethereum (ETH), USDT on Ethereum mainnet, and may offer additional assets through a separate swap provider. The application keeps temporary server-side order records for payment verification and fulfillment; do not describe orders as stateless or client-only.

## Stack and architecture
- Next.js App Router, React, TypeScript, Node.js API routes.
- PostgreSQL persistence via `postgres`; migration: `db/migrations/0001_enterprise.sql`.
- Supplier integration: PikaSim MCP JSON-RPC at `https://pikasim.com/mcp`.
- Ethereum mainnet verification uses ethers with a configured RPC and public fallbacks; Monero verification uses authenticated Wallet RPC.
- Order access is capability-based: the signed invoice token is saved in the browser and required for status/details/decryption and payment verification. A transaction hash is not a replacement for a lost invoice token.
- eSIM credentials and top-up ICCIDs are AES-256-GCM encrypted at rest. They are decrypted server-side for delivery/supplier fulfillment.
- `lib/fulfillment.ts` claims a verified payment transaction once and controls supplier fulfillment/review state.
- Coupon revocation/limits use PostgreSQL state; use consumption and invoice insertion are atomic. Coupons are rejected if their persisted state is missing.
- Monero invoices persist both wallet account and subaddress indexes; keep pending invoices verifiable when rotating the Wallet RPC configuration.
- Admin API routes require the separate `ADMIN_API_KEY` header; it must not be reused as the supplier key. Ethereum receiving address and margin can be changed in the dashboard; Monero wallet changes require coordinated Wallet RPC/environment configuration.
- `proxy.ts` applies security headers and crawler rules; do not add visitor logging or process-local security state.

## Important files
| File | Purpose |
|---|---|
| `lib/db.ts` | PostgreSQL persistence, claims, rate limits, retention |
| `db/migrations/0001_enterprise.sql` | Production schema; apply before enabling checkout |
| `lib/auth.ts`, `lib/invoiceToken.ts` | Optional wallet session and signed invoice capability tokens |
| `lib/crypto-utils.ts` | Field encryption and keyed wallet identifiers |
| `lib/ethereum.ts`, `lib/monero.ts` | Payment address generation and independent chain/wallet verification |
| `lib/fulfillment.ts`, `lib/webhook.ts` | Payment claim/fulfillment state and raw-body HMAC verification |
| `app/api/webhooks/` | PikaSim, Ethereum, and Monero webhook handlers |
| `app/api/cron/retention/route.ts` | `CRON_SECRET`-protected cleanup endpoint |
| `lib/adminAuth.ts` | Constant-time `ADMIN_API_KEY` check |
| `lib/blog.ts` | Blog records sanitized before serving |

## Configuration and deployment
Copy `.env.example` as a checklist. Production requires a managed PostgreSQL database, the migration applied, independently generated strong secrets, funded/configured supplier and wallet services, authenticated RPC endpoints, provider webhook agreements, an active retention cron, and a published support contact. Verify the actual deployed Vercel project/config; both repository root and `privasim/` contain Vercel config files.

`PAYMENT_HASH_SECRET` is a stable secret used to HMAC transaction references at rest. Rotating it without migrating old hashes can break transaction-replay matching. `DB_ENCRYPTION_KEY` must be backed up securely; changing it without re-encryption makes existing credentials unreadable. Rotate `JWT_SECRET` with awareness that wallet sessions, invoice tokens, keyed wallet hashes, rate-limit keys, and legacy JWT-signed coupons depend on it. New coupon codes use the independent `COUPON_SIGNING_SECRET`.

Webhook routes require HMAC-SHA256 over the exact raw request body. Confirm each provider supports the configured signature/header semantics before enabling webhook delivery. Provider callbacks never replace the application's independent payment verification.

## Checks
```bash
npm ci
npm run type-check
npm run lint
npm run build
```

No production deployment should be described as ready until these checks pass in CI and the external infrastructure/configuration items above have been provisioned and verified. No repository tests are currently defined.
