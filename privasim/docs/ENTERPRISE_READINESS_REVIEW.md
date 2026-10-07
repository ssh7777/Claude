# PRIVASIM Enterprise-Readiness Review

> **Historical baseline:** This review records pre-remediation findings from the initial source review. It is retained for audit context and does not describe the current branch. For current implementation, validation, and outstanding production prerequisites, see [`ENTERPRISE_READINESS_STATUS.md`](./ENTERPRISE_READINESS_STATUS.md).

**Assessment date:** 2026-10-07  
**Scope:** Checked-out `privasim/` application, repository deployment/configuration workflows, local build/type/lint/dependency checks, and read-only review of public pages on `https://privasim.app`.

## Executive decision

**Status: not ready for enterprise/high-volume paid traffic.** The public site is reachable and the code has a useful foundation (Next.js/TypeScript, server-side supplier integration, signed invoice parameters, AES-GCM helper, and some security headers). However, the current implementation has material payment-integrity and fulfillment risks, no durable transactional order store, weak/incorrect authentication paths, and no reliable release gate. Resolve the P0 items before accepting paid transactions at scale; resolve the P1 items before describing the service as enterprise-ready.

The most urgent source-code findings are:

1. The customer-facing Monero transaction-verification route does not verify the payment amount, recipient, or confirmations; it can continue when the explorer is unavailable.
2. A public `POST /api/esim/topup` directly spends the supplier balance without requiring a paid invoice.
3. The PikaSim webhook accepts payloads when its configured secret or the signature header is absent.
4. `/api/auth/connect` issues a wallet session without proving wallet ownership, and Monero “signature verification” only checks that the string is long enough.
5. Orders and fulfillment state live in a per-process `Map`; cold starts, scaling, and deploys can lose or split active order state.

These findings describe the **checked-out source**. I did not use production credentials, query private Vercel/GitHub settings, or send payment/purchase requests, so I cannot confirm which environment variables are currently set or which commit is live.

## Readiness snapshot

| Area | Status | Summary |
|---|---|---|
| Public site availability | Green for basic pages | Home, shop, privacy, and `llms.txt` responded during read-only checks. This does not validate checkout or fulfillment. |
| Payment integrity | **Red** | Monero verification and top-up authorization have release-blocking gaps; payment finality/idempotency need redesign. |
| Order durability | **Red** | The transactional order store is in-memory; Edge Config is used for some counters/settings, not as an atomic order database. |
| Authentication/admin | **Red** | Wallet ownership can be spoofed; the supplier key doubles as the admin credential. |
| Security/dependencies | **Red** | Production dependency audit reports vulnerabilities; production diagnostics/purchase routes and preview secrets need hardening. |
| Build/release controls | **Red** | Lint commands are broken, production build could not complete in this sandbox, and no automatic PR quality gate was found. |
| Privacy/customer promises | **Amber/Red** | Several published claims do not match the code’s analytics, logging, encryption, storage, and deletion behavior. |

## P0 — fix before processing paid orders

### 1. Monero manual verification can fulfill an unpaid order

`app/api/orders/[orderId]/verify-payment/route.ts` checks whether a transaction hash appears on an external explorer, but it does not verify that the transaction paid the invoice amount, paid the invoice’s address, or reached the required confirmation count. If the explorer errors or is unavailable, the handler logs a warning and continues toward fulfillment. The separate `verifyMoneroPayment` implementation in `lib/monero.ts` is explicitly a placeholder that returns `true` after basic input checks.

**Change:** Disable this manual XMR “paste a TX hash” fulfillment path until a trusted verifier is in place. Use a controlled Monero wallet/view-only node or qualified payment-monitoring provider, unique subaddresses per invoice, exact amount/address matching, confirmation/finality rules, and reorg handling. Never treat an explorer outage as payment proof. The Monero webhook must validate the invoice recipient as well as the amount and confirmations.

### 2. Public top-up endpoint can spend supplier funds without payment

`app/api/esim/topup/route.ts` has a public `POST` handler that accepts an ICCID and package code, then calls `topupEsim()` directly. It does not require an invoice, payment proof, authorization, or a signed fulfillment token. Its in-memory IP limiter is not a financial control.

**Change:** Remove/disable this `POST` route, or make it accept only a durable order ID whose payment is already verified and atomically claimed. The only top-up fulfillment path should run from the same verified, idempotent payment pipeline as new eSIM purchases.

### 3. PikaSim webhook authentication is fail-open

In `app/api/webhooks/pikasim/route.ts`, the signature is rejected only when **both** a secret and a signature header are present and the signature is invalid (`if (secret && sig && !verifySignature(...))`). If the secret is missing or the header is omitted, the payload is processed. A caller able to provide a known PikaSim order ID can attempt to supply ICCID/activation data and mark an invoice delivered.

**Change:** Fail closed: reject if the secret is not configured, reject missing/malformed signatures, verify the provider’s exact signing format against the raw body, and add timestamp/replay protection plus a unique provider event ID. Validate that the event is for a known order and an allowed state transition. Do not log the webhook body or ICCIDs.

### 4. Wallet sessions do not prove wallet ownership

`app/api/auth/connect/route.ts` accepts a supplied address and issues a JWT without a signature. `lib/auth.ts` also accepts any Monero signature with length at least 64; it does not cryptographically verify it. This permits impersonation of a wallet address and makes wallet-keyed order access untrustworthy.

**Change:** Remove `/api/auth/connect` as an authentication mechanism. For Ethereum, issue a one-time, short-lived, domain-bound challenge and validate an EIP-191/EIP-4361 signature; consume the challenge once. For Monero, implement real signature verification or do not offer Monero wallet login. Since email-free orders are a product feature, consider a high-entropy order-recovery capability instead of wallet accounts.

## P1 — required for reliable enterprise operation

### 5. Orders are ephemeral and isolated by serverless instance

`lib/db.ts` stores invoices in `new Map<string, StoredInvoice>()`. The SQL file under `supabase/schema.sql` is not connected to the runtime; `queryPackageCache()` returns `null`, `upsertPackageCache()` is a no-op, and order helpers do not persist records. Each warm serverless instance has its own map. Cold starts, deployments, or routing to another instance can make an invoice, payment status, PikaSim order ID, or eSIM credentials disappear. A PikaSim webhook can therefore be acknowledged as “unknown order,” while the customer has already paid.

**Change:** Introduce a real transactional datastore (for example, managed PostgreSQL) with versioned migrations and tested restore procedures. Persist invoice parameters, recipient address, payment state, transaction IDs, supplier order IDs, encrypted delivery data, timestamps, and recovery capability hashes. Reconcile `schema.sql` with the actual data model or remove it; it currently describes a different design.

### 6. Payment claims and fulfillment are not safely idempotent

`lib/ledger.ts::claimTxHash()` performs read → write → read-back rather than an atomic unique insert. It allows the same transaction to be reused for the same invoice ID. `verify-payment` also has only a per-process `Set`; after a supplier failure it removes the process-local entry but does not release the persisted claim. Concurrent requests, retries on another instance, or webhook/manual-verification races can therefore cause duplicate supplier purchases or leave a paid order permanently stuck. The ETH/XMR webhook routes mark an invoice confirmed before calling PikaSim; if provisioning fails, a retry can be treated as “already processed.”

**Change:** Implement a durable state machine and idempotency constraints in the database. Atomically claim each chain transaction and each order transition; save a payment event and fulfillment outbox record in one transaction; have a retryable worker provision with an idempotency key if PikaSim supports it. Keep payment-verified, provisioning, delivered, and attention-required states distinct. Reconcile supplier status after timeouts rather than guessing whether a purchase succeeded.

### 7. Ethereum/USDT verification needs finality and invoice-bound values

The manual Ethereum path accepts a mined receipt without enforcing a confirmation/finality threshold. It compares the recipient against the **currently configured** wallet address instead of the address stored on that invoice, so changing a wallet can make valid open invoices unclaimable. The Ethereum webhook passes the `address` from its request body as the expected recipient. The USDT verifier uses a 5% underpayment tolerance and converts token amounts through JavaScript `Number`.

**Change:** Persist immutable payment terms per invoice: chain ID, asset/contract, exact integer base-unit amount, and destination. Verify these—not mutable settings or untrusted webhook fields. Require confirmations/finality appropriate to the chain, verify the USDT contract and exact transfer event, and use integer arithmetic/decimal libraries. Define and test underpayment, overpayment, partial payment, reorg, and duplicate-transaction policies.

### 8. Production secrets are exposed to preview deployments

`.github/workflows/vercel-set-env.yml` and `provision-ledger.yml` set sensitive values with targets including `preview` as well as `production`. This includes the PikaSim key, JWT/encryption secrets, webhook secrets, Edge Config credentials, and a `VERCEL_API_TOKEN`. Preview branches execute application code; production supplier funds and control-plane credentials should not be available there.

**Change:** Use separate staging/sandbox credentials and data. Never place production supplier, webhook, encryption, or Vercel management credentials in previews. Give the runtime a narrowly scoped Edge Config token instead of a general Vercel API token; rotate any credential that may have been exposed to untrusted preview code. Add required environment-variable validation at startup and fail deployment/readiness if critical keys are absent.

### 9. Admin access, supplier secrets, and production test routes need separation

Admin endpoints are gated with `PIKASIM_API_KEY` rather than a dedicated admin identity. `app/api/admin/orders/route.ts`, `app/api/test/pikasim/route.ts`, and `app/api/test/buy/route.ts` accept secrets in query parameters. Query strings can land in request logs, browser history, and diagnostic output. `test/buy` is a production-capable GET endpoint that can spend real supplier balance and returns the ICCID/activation code in HTML.

**Change:** Remove production purchase/diagnostic routes or compile-disable them in production. Never perform purchases on GET. Stop accepting keys in URLs; issue a dedicated admin secret only as an interim measure, then move the dashboard to SSO/OIDC with MFA, roles, short-lived sessions, and an audit log. Separate supplier credentials from admin credentials and rotate them if they have ever been placed in URLs/logs.

### 10. Privacy policy and actual handling are inconsistent

`app/layout.tsx` loads Vercel Analytics and Speed Insights; `components/TrackVisit.tsx` records source attribution; `proxy.ts` logs a rotating hash derived from IP + user agent, the request path, and a truncated raw referrer. The path includes ICCIDs on `/esim/[iccid]`; the PikaSim webhook and fulfillment path also log ICCIDs, and the webhook logs part of the full payload. The privacy page says there are no analytics/third-party scripts and that ICCIDs are encrypted and data is deleted by a database job.

The privacy page also says activation codes can only be decrypted with a wallet signature. In the code, the server decrypts them with `DB_ENCRYPTION_KEY`; `/api/orders/[orderId]/decrypt` treats the invoice ID as a bearer secret. There is no active database cleanup because there is no runtime database. Browser `localStorage` retains orders and eSIM codes on the customer’s device.

**Change:** Decide the intended privacy model and make code, logs, retention, and wording agree. Remove or make analytics opt-in; redact ICCIDs, invoice IDs, transaction hashes, URL paths, and referrer query strings from logs; never log provider payloads or activation codes. Set an explicit, implemented retention policy for database and browser data. Describe server-side encryption accurately, or implement client-side encryption if “only the customer can decrypt” is a product requirement. Have privacy/legal counsel review the final disclosures for markets served.

### 11. Encryption key format and lifecycle need tightening

`lib/crypto-utils.ts` takes `DB_ENCRYPTION_KEY`, UTF-8 encodes only its first 32 characters, then imports that as an AES-GCM key. The example tells operators to generate 32 random bytes as 64 hex characters, but this code does not decode the hex; it uses only the first half of that text. The encryption format also has no key version for future rotation.

**Change:** Parse and validate exactly 32 raw bytes, store a key version with each encrypted value, use managed KMS/envelope encryption where practical, and document/test rotation and backup recovery. Keep JWT signing, encryption, webhook verification, and admin credentials as separate secrets.

## P1 — release and deployment readiness

### 12. Current quality commands are not a reliable gate

Checks run in this checkout:

- `npm run type-check`: **passed**.
- `npm run lint`: **failed** because it invokes `next lint`, which Next 16 no longer provides (`Invalid project directory .../lint`).
- `npx eslint .`: **failed** because the flat config extends `next/typescript`, which is not available with the installed `eslint-config-next@14.2.5`.
- `npm run build`: **did not complete**. Next warns that `experimental.serverComponentsExternalPackages` is an invalid/moved option; the build then fails fetching Google Fonts from `fonts.googleapis.com` in this sandbox. This network failure alone does not prove a Vercel build will fail, but it means the build has not been validated here.
- `npm audit --omit=dev`: **reported 6 production-tree findings (1 critical, 4 high, 1 moderate)**, including the locked direct dependency `next@16.2.10`; npm reported fixes available.
- No unit/integration test suite or automated test command was found. The production E2E workflow is manual-only; its smoke-test step prints “SOME ROUTES FAILED” but does not exit nonzero, and the ledger check does not assert its expected result.

**Change:** Update vulnerable packages promptly and commit the lockfile; align Next, `eslint-config-next`, and ESLint versions; replace the lint script with the supported ESLint CLI/config; move `serverComponentsExternalPackages` to the current supported config location or remove unused packages. Align peer versions, then switch CI/deploy to reproducible `npm ci` rather than relying on `npm install --legacy-peer-deps`. Self-host the Inter font (or use a system stack) so production builds do not depend on Google Fonts being reachable. Add tests for payment verification, webhook signatures, state transitions, idempotency, authorization, and key handling.

### 13. Production deployment paths are split and weakly gated

The repository has both a root `vercel.json` and `privasim/vercel.json` with different install/build/header behavior. The Vercel Git integration is described as the automatic production deploy path; `deploy-vercel.yml` is a manual fallback. There is no required pull-request workflow that runs type-check, lint, tests, dependency audit, and a preview smoke test before production promotion. `daily-deals.yml` pushes generated changes directly to `main`, triggering production deployment without a PR review.

`vercel-cleanup.yml` contains a destructive step that deletes every Vercel project except one named `privasim`, then deletes previous deployments. Do not dispatch this workflow as written; it could remove unrelated projects and rollback targets in the same Vercel account. The environment setup workflow deletes old values before checking whether new values were successfully written.

**Change:** Choose one canonical Vercel project root/config and one production deployment mechanism. Require protected PR checks, deploy previews with staging-only secrets, and promote a tested artifact to production with approval/rollback. Make generated content open a PR or pass validation before merge. Remove or redesign destructive cleanup with a strict allowlist, dry-run, and approval. Make secret updates non-destructive/transactional and verify each write before removing the old value.

## P2 — important platform improvements

- **Distributed limits:** `lib/rateLimit.ts` and `proxy.ts` use process-local `Map`s. Limits reset on cold start, vary across instances, and do not protect against distributed abuse. In `orders/create`, anonymous requests receive a random wallet hash before rate limiting, so the limiter key changes for each request instead of limiting by IP. Use a managed distributed limiter and a verified platform client-IP source; enforce cost/abuse budgets per route.
- **Settings/config correctness:** `app/api/admin/settings/route.ts` records “updated” without checking the boolean result from ledger writes. With Edge Config unavailable, the new wallet/margin can appear successful on one warm instance and revert later. Return an error unless persistence succeeds and read back the authoritative value. `.env.example` points to `privasim.com` rather than `.app` and omits several runtime settings (including PikaSim webhook and Edge Config credentials); make it the validated source of truth for staging/production setup.
- **Supplier/API resilience:** `callMCP()` and catalog `apiGet()` do not set explicit request timeouts. Add timeouts, bounded retries with jitter only for safe operations, circuit breakers, stale catalog fallback, and alerting for provider balance/API failures. Avoid making a 900 KB catalog fetch the critical path for purchases.
- **Operational visibility:** Add structured, redacted logs with request/correlation IDs; error/latency dashboards; alerts for failed payments, stuck provisioning, webhook failures, low supplier balance, and ledger/database outages; a readiness/health check; incident and manual-fulfillment runbooks; and backup-restore drills. Keep payment and supplier secrets out of logs.
- **Runtime/region:** The Vercel config pins functions to `iad1`. Validate latency, data-residency needs, availability targets, plan limits, and supplier/RPC connectivity for customer regions before selecting multi-region deployment. The repository cannot verify the Vercel account plan or its SLA.
- **Security headers:** Keep the existing `nosniff`, frame, and referrer protections, but remove production `unsafe-eval` from CSP, use a nonce/hash approach where feasible, add HSTS, and set explicit `Cache-Control: no-store` on order/payment/admin responses. Test CSP against wallet providers and analytics before rollout.
- **Customer recovery:** Current order list/codes depend heavily on browser `localStorage`. Preserve the email-free design if desired, but provide a durable capability-based recovery flow (high-entropy secret, hashed at rest, rate-limited, scoped to one order) and clearly communicate that the secret is the customer’s key to retrieval.
- **Test/live separation:** Run real purchase tests only in a supplier sandbox with a capped test wallet. Use contract tests and synthetic invoices for CI; never make production checkout endpoints double as diagnostics.

## Recommended target design

1. **Transactional order service:** PostgreSQL for invoices/orders/payment events/supplier fulfillment state; migrations; unique constraints for transaction hash and supplier order ID; encrypted sensitive columns; TTL deletion job with monitoring.
2. **Payment verification:** An independent verifier per supported chain/asset that binds payment to immutable invoice terms and waits for finality. Give every invoice a distinguishable payment destination/identifier where the chain supports it.
3. **Durable fulfillment:** Store verified payment + an outbox row atomically; enqueue a provisioning job; make workers idempotent; retry transient supplier failures and route permanent failures to a monitored manual queue.
4. **Capability-based customer access:** Keep no-account/no-email checkout, but issue a high-entropy recovery capability that can reveal only its own order. Store only a hash, apply rate limits, and avoid placing ICCIDs or activation secrets in URLs/logs.
5. **Separate control plane:** SSO/MFA/RBAC and an immutable audit log for admin operations; separate supplier/admin/runtime credentials; production secrets only in production; sandbox secrets only in preview/staging.
6. **Release pipeline:** `npm ci` → lint/type-check/unit/integration/security checks → preview deployment → automated smoke/browser tests → approved production promotion → post-deploy health check and documented rollback.

## Prioritized action plan

### Immediate containment

- Disable the unauthenticated top-up `POST` and remove/disable production `test/buy`.
- Disable the manual Monero claim path until amount, destination, and confirmation verification are real.
- Make PikaSim webhooks reject missing configuration/signatures.
- Remove production secrets from all preview targets; rotate potentially exposed keys.
- Do not run the Vercel cleanup workflow as currently written.

### Before the next production release

- Fix wallet authentication and separate the admin credential from the supplier API key.
- Implement durable invoices/orders and atomic idempotency/outbox-based provisioning.
- Fix chain verification and persist immutable recipient/asset/amount/confirmation terms per invoice.
- Update dependencies and repair lint/build; make PR checks mandatory.
- Reconcile privacy, data-retention, deletion, and encryption claims with implemented behavior.

### Before enterprise launch/scale

- Add recovery/runbook/support processes, monitoring/alerts, backups and restore drills, load/failure testing, accessibility/browser checkout coverage, environment approvals, secret-rotation procedures, and a documented security/privacy review.

## Limits of this review

This was a source/configuration review plus read-only page checks, not a penetration test, compliance assessment, or live payment test. I did not inspect Vercel environment values, the production database/Edge Config, GitHub secret contents, account plan, or the currently deployed commit. Validate the remediation in a staging environment using sandbox supplier credentials before enabling real transactions.
