# Counterintel Agency — Threat Surface Hardening Hub

A production-ready, dependency-free static single-page site (HTML + Tailwind via
CDN + vanilla JS) with an anonymized serverless ingestion gateway.

## Files

| File            | Purpose                                                              |
| --------------- | ------------------------------------------------------------------- |
| `index.html`    | The full single-page site (hero, framework, ecosystem, compliance, contact, modal). |
| `app.js`        | Vanilla JS: funnel telemetry, math captcha, async form POST, high-intent modal. |
| `worker.js`     | Cloudflare Worker that forwards leads to a destination inbox held only in env vars. |
| `wrangler.toml` | Worker config. Secrets are set out of source, never committed.       |

## Front end

Static — host on any CDN/static host (Cloudflare Pages, Netlify, S3+CloudFront,
GitHub Pages). No build step. Open `index.html` to preview locally.

Before going live, set the two endpoint constants at the top of `app.js`:

```js
var LEAD_ENDPOINT     = "https://gateway.counterintelagency.com/api/lead";
var TELEMETRY_ENDPOINT = "https://gateway.counterintelagency.com/api/telemetry";
```

## Email-hiding architecture

The destination inbox is **never** present in any client asset — not in HTML,
form `action`s, or JS. The browser only knows the gateway URL. The Worker
resolves the destination from a secret binding (`LEAD_DESTINATION`) and forwards
the lead server-side via a transactional mail API.

```
Browser (fetch POST) ──▶ /api/lead (Cloudflare Worker)
                              │  reads env.LEAD_DESTINATION (secret)
                              ▼
                         Transactional mail API ──▶ protected inbox
```

## Deploying the gateway

```bash
npm i -g wrangler
wrangler login

# Secrets (kept out of source control):
wrangler secret put LEAD_DESTINATION     # the protected operations inbox
wrangler secret put MAIL_PROVIDER_KEY    # transactional mail provider API key

# Public vars are in wrangler.toml (MAIL_FROM, ALLOWED_ORIGIN).
wrangler deploy
```

`worker.js` ships with a [Resend](https://resend.com) integration; swap the
`fetch(...)` block in `handleLead` for any provider (Postmark, SendGrid, SES,
Mailgun). Keep `MAIL_FROM` on a verified sending domain.

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
