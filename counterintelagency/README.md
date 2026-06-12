# Counterintel Agency — Threat Surface Hardening Hub

A production-ready, dependency-free static single-page site (HTML + Tailwind via
CDN + vanilla JS) with an anonymized serverless ingestion gateway.

## Files

| File               | Purpose                                                              |
| ------------------ | -------------------------------------------------------------------- |
| `index.html`       | The full single-page site (hero, framework, ecosystem, compliance, contact, modal). |
| `app.js`           | Vanilla JS: funnel telemetry, math captcha, async form POST, high-intent modal. |
| `styles.css`       | Compiled Tailwind output (built from `styles.src.css` + `tailwind.config.js`). |
| `api/lead.js`      | Vercel serverless function that forwards leads to a destination inbox held only in env vars. |
| `api/telemetry.js` | Vercel serverless telemetry sink.                                     |
| `vercel.json`      | Vercel project config (clean URLs, security headers).                 |
| `worker.js`        | OPTIONAL Cloudflare Worker alternative to the Vercel functions.       |
| `wrangler.toml`    | Worker config for the Cloudflare alternative.                         |

## Deploying to Vercel (primary path)

This directory is a self-contained Vercel project (static front end + `/api`
functions). From inside `counterintelagency/`:

```bash
npx vercel deploy --prod
```

Then set the server-side env vars (never exposed to the browser):

```bash
npx vercel env add LEAD_DESTINATION production    # protected operations inbox
npx vercel env add MAIL_PROVIDER_KEY production   # Resend API key
npx vercel env add MAIL_FROM production           # verified sender address
```

Redeploy after adding env vars. To rebuild the stylesheet after editing
markup/classes: `npx tailwindcss -c tailwind.config.js -i styles.src.css -o styles.css --minify`.

The front end posts to same-origin `/api/lead` and `/api/telemetry`
(see the constants at the top of `app.js`).

## Email-hiding architecture

The destination inbox is **never** present in any client asset — not in HTML,
form `action`s, or JS. The browser only knows the same-origin endpoint. The
serverless function resolves the destination from `LEAD_DESTINATION` (an env
var) and forwards the lead server-side via a transactional mail API.

```
Browser (fetch POST) ──▶ /api/lead (Vercel serverless function)
                              │  reads process.env.LEAD_DESTINATION
                              ▼
                         Transactional mail API ──▶ protected inbox
```

Both `api/lead.js` and `worker.js` ship with a [Resend](https://resend.com)
integration; swap the `fetch(...)` block for any provider (Postmark, SendGrid,
SES, Mailgun). Keep `MAIL_FROM` on a verified sending domain.

## Optional: Cloudflare Worker alternative

To run the gateway on Cloudflare instead of Vercel functions:

```bash
npm i -g wrangler
wrangler login
wrangler secret put LEAD_DESTINATION
wrangler secret put MAIL_PROVIDER_KEY
wrangler deploy
```

Then point `LEAD_ENDPOINT`/`TELEMETRY_ENDPOINT` in `app.js` at the worker URL.

## Features

- **Funnel telemetry** (`app.js`): scroll-depth + velocity, active session
  duration, document focus/exit, and `data-track` click events, compiled into a
  structured JSON payload and flushed via `sendBeacon`/`fetch` to the telemetry
  endpoint. Best-effort; never blocks UX.
- **High-intent modal**: opens after 15s of *active* engagement or on
  exit-intent (cursor crossing the top viewport boundary), shown once per
  session via `sessionStorage`.
- **Human verification**: client-side arithmetic captcha with refresh, plus a
  honeypot field validated again server-side.
- **Accessibility/SEO**: semantic landmarks, labelled controls, Escape-to-close
  modal, structured data, Open Graph/Twitter meta, responsive across mobile →
  wide desktop.

## Notes

A purely client-side captcha and honeypot deter casual bots but are not a
substitute for server-side abuse protection. For production volume, add Cloudflare
Turnstile (or hCaptcha) verification inside `handleLead`.
