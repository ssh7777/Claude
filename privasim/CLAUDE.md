# PRIVASIM — Claude Context

## What This Is
Privacy-first eSIM marketplace. Crypto-only payments (Monero XMR + Ethereum ETH). No email, no KYC, no database. Sources eSIMs from PikaSim reseller API.

## Stack
- Next.js 16 App Router + React 19 + TypeScript (params/searchParams are Promises; proxy.ts replaces middleware.ts)
- No database (fully stateless, in-memory invoice store)
- PikaSim MCP API (JSON-RPC 2.0 at `https://pikasim.com/mcp`)
- Monero + Ethereum direct wallet payments
- JWT auth via wallet signature (stateless HMAC challenge tokens)

## Branch
`claude/privasim-esim-marketplace-3fgqim` in `ssh7777/Claude`

## Key Files
| File | Purpose |
|---|---|
| `lib/pikasim.ts` | PikaSim API wrapper — always sends auth header |
| `lib/auth.ts` | Stateless JWT auth — no DB, HMAC challenge tokens |
| `lib/db.ts` | In-memory invoice store — no Supabase |
| `lib/monero.ts` | Monero payment info generation |
| `lib/ethereum.ts` | Ethereum payment info generation |
| `lib/crypto-utils.ts` | AES-256-GCM encryption, SHA-256 wallet hashing |
| `app/api/orders/create/route.ts` | Creates payment invoice (50% markup applied here) |
| `components/WalletConnect.tsx` | MetaMask + Monero wallet auth UI |
| `components/EsimCard.tsx` | Product card (50% markup applied here) |
| `app/checkout/[packageCode]/page.tsx` | Checkout page (50% markup applied here) |

## Margin — Owner-Adjustable (default 70%)
- LIVE value: ledger key `set_margin_pct` (percent), set from Admin →
  Pricing & Wallets, read via `getRetailMargin()` in `lib/settings.ts`
  (60 s server cache). `lib/prices.ts` keeps `RETAIL_MARGIN = 1.7` as the
  compile-time DEFAULT only and stays ledger-free (client-importable).
- `retailPrice(wholesaleUsd, margin?)` — server code passes the live margin;
  client components consume server-computed `retailUsd` from API responses.
- Authoritative charge: orders/create. Display: shop pages (EsimCard margin
  prop), checkout/topup (`retailUsd` from API), chatbot, country JSON-LD.
- Blog daily-deals table renders at the DEFAULT margin (editorial/indicative).
- NEVER hardcode a multiplier anywhere else.

## API Key Security
- PikaSim API key ONLY in `process.env.PIKASIM_API_KEY`
- Never hardcoded anywhere
- `.env.local` is gitignored
- Verify: `grep -r "pk_live_" /home/user/Claude/privasim/` should return nothing

## Required Env Vars (Vercel)
```
PIKASIM_API_KEY=pk_live_...          # PikaSim reseller key
JWT_SECRET=<openssl rand -hex 32>    # 32+ chars
DB_ENCRYPTION_KEY=<openssl rand -hex 32>  # exactly 64 hex chars
MONERO_WALLET_PRIMARY=<XMR address>
ETHEREUM_WALLET_ADDRESS=<ETH address>
MONERO_WEBHOOK_SECRET=<random>
ETHEREUM_WEBHOOK_SECRET=<random>
NEXT_PUBLIC_APP_URL=https://your-app.vercel.app
```

## Build
```bash
cd /home/user/Claude/privasim
npm install --legacy-peer-deps
npm run build   # must pass clean
npm run dev     # dev server on :3000
```

## Known Limitation
PikaSim API (`pikasim.com`) is **blocked by the cloud sandbox egress proxy**. API calls return 403 here. Code is correct — works on Vercel with no restrictions. Do not waste tokens debugging this locally.

## Deployment Status
- Code: complete, builds clean, all 22 routes
- Deployed: YES — https://privasim.app
- Auto-deploys via Vercel Git integration on every push to main; .github/workflows/deploy-vercel.yml is a MANUAL fallback only (two deploy systems racing caused the queue jams)

## PikaSim MCP — Verified Facts (from live tools/list probe)
- 15 tools; our pk_live_ reseller key works as an agent-wallet key
- Purchase tools: `purchase_esim` (data ONLY) and `purchase_phone_plan`
  (phone-plan codes are INVALID in purchase_esim — lib/pikasim.ts handles both)
- `get_topup_options(iccid)` REQUIRED before `topup_esim` — top-up codes
  differ from purchase codes
- Tool results come as TEXT content blocks (prose like "Wallet Balance:
  $10.00 USD"), not JSON — lib/pikasim.ts extracts via regex (__rawText path)
- Responses are SSE (`event: message` / `data: {...}`) — parseMcpBody handles it
- Wallet balance funds purchases; top up at pikasim.com/reseller/dashboard

## What's NOT Implemented (intentional)
- No order history persistence (in-memory only, resets on redeploy);
  client keeps order data in localStorage and can re-claim via TX hash
- No Monero full signature verification (accepted if format valid; TODO for production)
