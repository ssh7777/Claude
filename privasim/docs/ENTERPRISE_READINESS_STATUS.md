# Enterprise-readiness remediation status

**Updated:** 2026-10-07  
**Scope:** Repository changes in this branch. This is not a production deployment, penetration test, compliance opinion, or provider certification.

## Decision

**No-go for production/enterprise traffic until the external prerequisites and verification items below are completed.** The repository now has safer payment and order flows and a credential-free production build, but infrastructure, secrets, wallet/provider behavior, and deployment controls cannot be verified from this checkout.

`ENTERPRISE_READINESS_REVIEW.md` is the historical baseline review that motivated the work. Its findings describe the pre-remediation source, not the current branch; use this status document and the current code for follow-up.

## Implemented in this branch

- Replaced in-memory invoice/ledger state with PostgreSQL-backed persistence and a migration under `db/migrations/0001_enterprise.sql`. Payment claims use database uniqueness/transactions; order records and fulfillment states are durable when the configured database is available.
- Bound payment checks to invoice-stored payment terms. Ethereum and Ethereum-mainnet USDT verification check destination, amount, transaction execution, and confirmation threshold; Monero uses a fresh invoice subaddress and persists its wallet account/subaddress indexes for recipient, amount, and confirmation checks. Verification outages fail closed.
- Consolidated paid-order fulfillment into an order-mediated flow with separate pending, processing, complete, and manual-review outcomes. Supplier order IDs must be persisted for reconciliation. eSIM credentials and top-up ICCIDs are encrypted at rest.
- Disabled the unauthenticated direct supplier top-up `POST` (HTTP 410). Top-ups are initiated only through a persisted invoice and paid fulfillment path.
- Made provider webhooks fail closed when secrets/signatures are absent or invalid; signatures are checked against bounded raw request bodies. Admin routes use a dedicated `ADMIN_API_KEY`, not the supplier credential. New coupons use a separate signing key, legacy JWT-signed coupons remain verifiable during migration, and coupon use-limit consumption is atomic with invoice creation; missing coupon state fails closed. Address-only wallet login returns 410; Monero wallet login is explicitly unsupported rather than accepting an unverifiable signature.
- Removed production test-purchase/diagnostic routes, analytics collection endpoints/client code, and obsolete workflows that used removed endpoints, published deployment secrets to preview targets, force-pushed a stale mirror to another repository, or could delete unrelated Vercel projects. The manual production smoke test no longer buys anything or mutates production coupons.
- Added a secret-free CI workflow for locked install, lint, type-check, article-data validation, production dependency audit, and production build. Vercel configuration and the manual deploy path use `npm ci`; manual production deploy is restricted to `main` and runs checks first. Scheduled content generation now opens/updates a review PR rather than pushing directly to `main`.
- Made storefront routes render dynamically so provider/database calls do not run during static build. Catalog display can use the documented default margin when no database is configured; invoice creation and payment/order mutations still require PostgreSQL.
- Revised public privacy, order recovery, payment, and delivery copy to disclose temporary server-side order records, token-based access, provider processing, confirmation/fulfillment delays, and limits to anonymity.

## Validation

Checks run on the final code in this branch:

- `npm ci` — passed locally.
- `npm run lint` — passed.
- `npm run type-check` — passed.
- `npm run build` — passed without `DATABASE_URL`; storefront routes no longer require database/provider access during prerender. Build success only validates compilation/prerender behavior.
- `npm audit --omit=dev` — passed with 0 production dependency findings.
- Full `npm audit` — still reports 10 development-tree findings (3 moderate, 7 high); fixes proposed by npm require major-version dependency changes and were not forced in this branch.
- `data/auto-articles.json` parsing, Vercel JSON config parsing, workflow YAML parsing, and `git diff --check` — passed.
- No unit/integration test suite is configured. No live invoice, RPC, supplier purchase, webhook, or production smoke test was run from this sandbox.

## Required before production use

1. Provision managed PostgreSQL, review/apply the migration, set TLS/backup/restore policy, and verify `DATABASE_URL`, connection limits, and the 30-day deletion job using the deployed `CRON_SECRET`.
2. Generate independent production secrets for `JWT_SECRET`, `DB_ENCRYPTION_KEY`, `PAYMENT_HASH_SECRET`, `COUPON_SIGNING_SECRET`, `ADMIN_API_KEY`, `CRON_SECRET`, and each webhook. Retain `JWT_SECRET` until any previously issued JWT-signed coupon codes have expired or been replaced. Store them only in the production environment; rotate any previously shared or preview-exposed values. Never copy production secrets into preview.
3. Configure and test the Monero Wallet RPC against the intended wallet and subaddress account; confirm `MONERO_WALLET_PRIMARY`, account index, TLS/authentication, balance/monitoring, and webhook payload/signature agreement. Confirm the Ethereum RPC is mainnet and the configured receiving address is correct.
4. Coordinate PikaSim API key and webhook signing format/secret, test catalog/purchase/reconciliation/top-up behavior in an approved sandbox, and document supplier timeout/idempotency and manual-review procedures. Sandbox egress blocked PikaSim requests in this session, so provider integration remains unverified.
5. Configure Vercel project root/config and production-only secrets, runtime/region, cron, deployment protection, rollback, and a support contact. Repository files cannot show the current Vercel project settings or confirm which of the root/subdirectory Vercel configurations is active.
6. Configure GitHub branch protection/required checks and review the generated-content PR policy. Workflows do not establish account-level branch protection by themselves.
7. Run staging tests covering exact/short/over-payments, wrong recipients, duplicate/replayed transactions, chain reorgs, RPC outages, provider timeouts, duplicate webhooks, manual-review recovery, order-token access, key rotation, data deletion, and mobile checkout.

Do not enable real paid traffic or describe deployment as production-ready until these checks pass and an operator records the evidence.
