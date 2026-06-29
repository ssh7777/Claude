# PRIVASIM — Claude Context

## What This Is
Privacy-first eSIM marketplace. Crypto-only payments (Monero XMR + Ethereum ETH). No email, no KYC, no database. Sources eSIMs from PikaSim reseller API.

## Stack
- Next.js 14 App Router + React 19 + TypeScript
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

## 50% Margin — Applied in 3 Places
- `lib/pikasim.ts` — never: raw price comes from API
- `components/EsimCard.tsx:75` — `pkg.priceUsd * 1.5` (display)
- `app/checkout/[packageCode]/page.tsx:107` — `pkg.priceUsd * 1.5` (display)
- `app/api/orders/create/route.ts:42` — `pkg.priceUsd * 1.5` (actual invoice)

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
- Deployed: YES — https://privasim-two.vercel.app
- Auto-deploys via GitHub Actions on push to main (.github/workflows/deploy-vercel.yml)

## What's NOT Implemented (intentional)
- No order history persistence (in-memory only, resets on redeploy)
- No automated payment confirmation → eSIM delivery pipeline (manual via PikaSim dashboard)
- No Monero full signature verification (accepted if format valid; TODO for production)
