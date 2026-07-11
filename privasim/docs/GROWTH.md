# PRIVASIM — Client Acquisition Playbook (no paid ads)

Every link below carries a UTM tag. When someone clicks it, `TrackVisit`
records the source and stores it as first-touch in their browser, so a sale
days later is still attributed to the channel that brought them. Watch results
in **Admin → Analytics** (visits → checkouts → sales per source, with revenue).

Your product's edge: it is the **only** anonymous, no-KYC, no-email eSIM you
pay for with Monero. Lead with that in every post. Don't pitch "cheap data" —
pitch "buy mobile data with zero identity."

---

## 1. UTM link set (copy-paste ready)

Base: `https://privasim.app`

| Channel | Link to share |
|---|---|
| Reddit | `https://privasim.app/?utm_source=reddit&utm_medium=social&utm_campaign=launch` |
| r/Monero | `https://privasim.app/?utm_source=reddit&utm_medium=social&utm_campaign=monero` |
| Hacker News | `https://privasim.app/?utm_source=hackernews&utm_medium=social&utm_campaign=launch` |
| Nostr | `https://privasim.app/?utm_source=nostr&utm_medium=social&utm_campaign=launch` |
| X / Twitter | `https://privasim.app/?utm_source=twitter&utm_medium=social&utm_campaign=launch` |
| Telegram | `https://privasim.app/?utm_source=telegram&utm_medium=social&utm_campaign=launch` |
| Mastodon | `https://privasim.app/?utm_source=mastodon&utm_medium=social&utm_campaign=launch` |
| Product Hunt | `https://privasim.app/?utm_source=producthunt&utm_medium=social&utm_campaign=launch` |
| Dread/forums | `https://privasim.app/?utm_source=forum&utm_medium=social&utm_campaign=launch` |

You can also deep-link a specific country to a specific audience, e.g. a
digital-nomad Thailand thread → `https://privasim.app/shop/TH?utm_source=reddit&utm_campaign=nomad`.

---

## 2. Where your buyers already are (highest intent first)

These communities are full of people who *want* to pay with crypto and hate KYC.
Read each community's self-promo rules first — post value, not spam.

- **r/Monero** (~120k) — your single best audience. They hold XMR and want to spend it.
- **r/privacy** (~1.5M) — huge, strict on ads. Frame as a privacy tool, not a store.
- **r/digitalnomad** (~2M) — travelers who need data abroad; angle = no roaming, no signup.
- **r/esim**, **r/dataisbeautiful of travel**, **r/solotravel** — buyer intent for eSIM.
- **r/CryptoCurrency**, **r/ethereum** — "spend your crypto on something real."
- **Nostr** — privacy-native crowd, no ad rules. Post with #monero #privacy #esim.
- **Hacker News** — "Show HN: Anonymous eSIM you buy with Monero, no email." One shot; make it good.
- **Monero-focused Telegram / Matrix rooms**, **Simplex groups**.
- **Product Hunt** — schedule a launch; the privacy angle does well there.
- **Mastodon** (infosec.exchange, fosstodon) — privacy/FOSS crowd.

---

## 3. Ready-to-paste copy (value-first, not spammy)

**Reddit / forum (text post):**
> I got tired of every travel eSIM demanding an email, a passport photo, or a
> credit card. So the thing I've been using lets you buy data for 190+ countries
> and pay with Monero or ETH — no account, no email, QR delivered instantly.
> Sharing in case anyone else wants mobile data without handing over their identity.
> [link]

**Hacker News (Show HN):**
> Show HN: PRIVASIM – Buy an eSIM with Monero, no email or KYC
> I built an eSIM marketplace where the entire flow is anonymous: pick a country,
> pay in XMR/ETH, get the QR. No account system exists at all — orders are keyed
> to your payment, nothing personal is stored. 190+ countries. Feedback welcome.
> [link]

**X / Nostr (short):**
> Buy mobile data for 190+ countries with #Monero. No email. No KYC. No app.
> Pay → scan QR → online. The anonymous eSIM. [link]

**Telegram / Matrix:**
> Anonymous eSIM ⚡ 190+ countries, pay with XMR or ETH, no signup, instant QR.
> [link]

---

## 4. Turn on the flywheel (set-and-forget, already built)

- **Daily blog** auto-publishes a fresh article + a live "best deals today" page
  every day (GitHub Actions cron) and pings IndexNow so Google/Bing re-crawl
  within minutes. This is your organic SEO engine — it compounds without you.
- **llms.txt + JSON-LD** mean ChatGPT/Claude/Perplexity can read and recommend
  you when someone asks "anonymous eSIM" or "buy eSIM with Monero."
- Each blog post is a shareable link and a new search-indexed page targeting a
  long-tail query (e.g. "Thailand eSIM no KYC").

---

## 5. Discount codes for launch pushes

Generate a code in **Admin → Coupons** (e.g. `LAUNCH10`, 10% off, capped uses)
and attach it to one channel so you can measure lift:
> First 100 buyers: 10% off with code LAUNCH10. [link]

Codes are HMAC-signed and usage-capped server-side — they can't be reused past
the cap or forged, so it's safe to post publicly.

---

## 6. Read the scoreboard

**Admin → Analytics** shows, per source: visits → checkouts → sales + revenue.
After 2–3 days, double down on whatever source has the best
**sales ÷ visits** ratio and drop the ones that only bring lurkers. That's how
you find your best channel without spending a cent on ads.

---

### Guardrails
- Never mass-DM or spam — it gets the domain flagged and the accounts banned.
  One good post in the right community beats 100 blasts.
- Respect each subreddit's self-promotion ratio (usually 1 promo per ~9 normal
  contributions). Build a little karma first.
- Don't run paid ads yet — prove which organic channel converts first, then
  (optionally) pay to amplify only that one.
