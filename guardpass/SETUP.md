# GuardPass — Setup & Configuration

## Environment Variables

Create a `.env.local` file in the `guardpass/` directory (never commit this file).

```env
# ── Supabase ─────────────────────────────────────────────────────────────────
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# ── Google Gemini ─────────────────────────────────────────────────────────────
GEMINI_API_KEY=AIza...

# ── Stripe ───────────────────────────────────────────────────────────────────
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...
NEXT_PUBLIC_STRIPE_PRICE_PROFESSIONAL=price_...
NEXT_PUBLIC_STRIPE_PRICE_ENTERPRISE=price_...

# ── App ───────────────────────────────────────────────────────────────────────
NEXT_PUBLIC_APP_URL=https://your-domain.vercel.app
```

---

## Where to Get Each Token

### Supabase
1. Go to [supabase.com](https://supabase.com) → your project
2. **Settings → API**
   - `NEXT_PUBLIC_SUPABASE_URL` → Project URL
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` → `anon` `public` key
   - `SUPABASE_SERVICE_ROLE_KEY` → `service_role` key (**keep secret**)

### Google Gemini
1. Go to [aistudio.google.com](https://aistudio.google.com)
2. Click **Get API key** → Create API key
3. Copy the `AIza...` key → `GEMINI_API_KEY`

### Stripe
1. Go to [dashboard.stripe.com](https://dashboard.stripe.com)
2. **Developers → API keys**
   - `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` → Publishable key (`pk_...`)
   - `STRIPE_SECRET_KEY` → Secret key (`sk_...`)
3. **Products → Add product** → Create two products:
   - **Professional** — e.g. $49/month → copy Price ID → `NEXT_PUBLIC_STRIPE_PRICE_PROFESSIONAL`
   - **Enterprise** — e.g. $199/month → copy Price ID → `NEXT_PUBLIC_STRIPE_PRICE_ENTERPRISE`
4. **Developers → Webhooks → Add endpoint**
   - URL: `https://your-domain.vercel.app/api/stripe/webhook`
   - Events to listen for:
     - `checkout.session.completed`
     - `customer.subscription.created`
     - `customer.subscription.updated`
     - `customer.subscription.deleted`
     - `invoice.payment_succeeded`
     - `invoice.payment_failed`
   - Copy **Signing secret** → `STRIPE_WEBHOOK_SECRET`

---

## Supabase Setup

### 1. Run the schema
In **Supabase → SQL Editor**, paste and run the full contents of `supabase/schema.sql`.

### 2. Create storage buckets
In **Supabase → Storage → New bucket**, create two **private** buckets:
- `knowledge-docs`
- `questionnaires`

### 3. Auth redirect URL
In **Supabase → Authentication → URL Configuration**, add your domain to **Redirect URLs**:
```
https://your-domain.vercel.app/auth/callback
```

---

## Vercel Deployment

### First deploy
1. Import the GitHub repo at [vercel.com/new](https://vercel.com/new)
2. Set **Root Directory** → `guardpass`
3. Add all environment variables above
4. Click **Deploy**

### Subsequent deploys
Push to `main` — Vercel deploys automatically.

---

## Plan Limits (built-in)

| Plan | Questionnaires | Documents | AI Answers/month |
|------|---------------|-----------|-----------------|
| Trial | 3 | 5 | 50 |
| Professional | Unlimited | 50 | 500 |
| Enterprise | Unlimited | Unlimited | Unlimited |

Plans are determined by `stripe_subscription_status` + `stripe_price_id` on the user's profile row.

---

## Local Development

```bash
cd guardpass
npm install
cp .env.example .env.local   # then fill in real values
npm run dev                   # → http://localhost:3000
```

---

## Key File Locations

| File | Purpose |
|------|---------|
| `src/proxy.ts` | Auth middleware — protects all dashboard routes |
| `src/lib/limits.ts` | Plan limit enforcement for all API routes |
| `src/lib/gemini.ts` | Gemini AI integration with timeout + retry |
| `src/lib/stripe.ts` | Stripe lazy singleton |
| `src/lib/supabase/server.ts` | Server-side Supabase client |
| `src/app/api/stripe/webhook/route.ts` | Stripe webhook handler |
| `supabase/schema.sql` | Full database schema with RLS policies |
