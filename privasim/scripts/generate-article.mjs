// Daily auto-article generator — runs in CI with ZERO human input.
// The automated client-finding engine: every day it publishes THREE fresh,
// unique, buyer-intent articles (different country × template each), built
// from LIVE catalog prices. Each becomes an indexed landing page that
// captures people searching "cheapest Japan eSIM", "buy Thailand eSIM with
// crypto", "Germany eSIM no registration" — at the exact moment of purchase
// intent. The workflow pings IndexNow for each new URL so Bing/Yandex etc.
// crawl within minutes.

import fs from "node:fs";
import https from "node:https";

const OUT = "privasim/data/auto-articles.json";
const KEEP = 60; // pages persist and compound; sitemap covers them all
const PER_DAY = 3;
const MARKUP = 1.7;

function get(url) {
  return new Promise((res, rej) => {
    https.get(url, { headers: { Accept: "application/json", "User-Agent": "privasim-bot" } }, (r) => {
      let d = ""; r.on("data", (c) => (d += c)); r.on("end", () => { try { res(JSON.parse(d)); } catch (e) { rej(e); } });
    }).on("error", rej);
  });
}

const COUNTRY_NAMES = {
  JP: "Japan", US: "United States", GB: "United Kingdom", DE: "Germany", FR: "France",
  IT: "Italy", ES: "Spain", NL: "Netherlands", CH: "Switzerland", AT: "Austria",
  TH: "Thailand", SG: "Singapore", AU: "Australia", KR: "South Korea", PH: "Philippines",
  ID: "Indonesia", VN: "Vietnam", MY: "Malaysia", IN: "India", HK: "Hong Kong",
  CA: "Canada", MX: "Mexico", BR: "Brazil", AR: "Argentina", CO: "Colombia",
  AE: "United Arab Emirates", SA: "Saudi Arabia", IL: "Israel", ZA: "South Africa", TR: "Turkey",
  PL: "Poland", CZ: "Czechia", HU: "Hungary", PT: "Portugal", GR: "Greece",
  SE: "Sweden", NO: "Norway", DK: "Denmark", FI: "Finland", BE: "Belgium",
  TW: "Taiwan", NZ: "New Zealand", IE: "Ireland", EG: "Egypt", MA: "Morocco",
  KE: "Kenya", PE: "Peru", CL: "Chile", IS: "Iceland", HR: "Croatia",
};

const CODES = Object.keys(COUNTRY_NAMES);
const dayNum = Math.floor(Date.now() / 86400000);
const today = new Date().toISOString().slice(0, 10);
const year = new Date().getFullYear();

function retail(w) { return (Math.ceil(w * MARKUP * 100) / 100).toFixed(2); }

// Buyer-intent templates — each targets a query someone types when they're
// ready to purchase, not just research.
const TOPIC_TEMPLATES = [
  { kind: "guide", title: (n) => `${n} eSIM Guide ${year}: Stay Connected Anonymously`,
    intro: (n) => `Travelling to ${n}? Here's how to get online the moment you land — with a data eSIM you can buy anonymously, no SIM-registration desk, no passport photocopy, no KYC.` },
  { kind: "howmuch", title: (n) => `How Much Data Do You Need in ${n}? (${year} Guide)`,
    intro: (n) => `Working out how much mobile data you'll use in ${n} saves you money. Here's a realistic breakdown by traveller type, with current anonymous eSIM prices.` },
  { kind: "vs", title: (n) => `${n} Travel SIM vs eSIM: Which Is Better for Privacy?`,
    intro: (n) => `Buying a local tourist SIM in ${n} usually means showing ID. A travel eSIM skips that entirely. Here's the honest comparison.` },
  { kind: "cheapest", title: (n) => `Cheapest ${n} eSIM in ${year} — Live Prices, No Account Needed`,
    intro: (n) => `Looking for the cheapest ${n} eSIM today? These are the live lowest prices from carrier inventory — updated daily, purchasable in two minutes with no account, no email, no KYC.` },
  { kind: "crypto", title: (n) => `Buy a ${n} eSIM with Crypto (Monero, Bitcoin, ETH, USDT)`,
    intro: (n) => `You can pay for ${n} mobile data entirely in cryptocurrency — Monero and Ethereum natively, USDT, or 100+ other coins including Bitcoin via anonymous swap. No card, no exchange, no identity.` },
  { kind: "nokyc", title: (n) => `${n} eSIM Without ID or Registration (${year})`,
    intro: (n) => `Many countries require passport registration for local SIM cards. A prepaid ${n} travel eSIM bought anonymously online skips the registration desk entirely — here's how it works and what it costs.` },
];

function buildArticle(code, tpl, plans) {
  const name = COUNTRY_NAMES[code];
  const rows = plans.map(
    (p) => `<tr><td>${p.volumeGB} GB</td><td>${p.duration || p.validityDays || "-"} days</td><td>$${retail(p.priceUSD)}</td><td><a href="/shop/${code}">Buy →</a></td></tr>`
  ).join("");

  const priceLine = plans.length
    ? `Current cheapest ${name} plan: <strong>${plans[0].volumeGB} GB for $${retail(plans[0].priceUSD)}</strong> (${plans[0].duration || plans[0].validityDays} days).`
    : `Browse live ${name} plans at <a href="/shop/${code}">/shop/${code}</a>.`;

  const slug = `${tpl.kind}-esim-${code.toLowerCase()}-${today}`;
  return {
    id: `auto-${today}-${code}-${tpl.kind}`,
    slug,
    title: tpl.title(name),
    published_at: `${today}T07:00:00Z`,
    updated_at: `${today}T07:00:00Z`,
    featured: false,
    tags: ["esim", name.toLowerCase(), "travel", "auto"],
    excerpt: `${tpl.intro(name).replace(/<[^>]+>/g, "").slice(0, 155)}`,
    content: `
<p>${tpl.intro(name)}</p>
<p>${priceLine} All plans deliver instantly after crypto payment — pay with Monero, Ethereum, USDT, or 100+ other coins. No account, no email.</p>
<h2>${name} eSIM plans right now</h2>
${plans.length ? `<table><tr><th>Data</th><th>Validity</th><th>Price</th><th></th></tr>${rows}</table>` : ""}
<h2>Why buy your ${name} eSIM anonymously?</h2>
<ul>
<li><strong>No registration desk.</strong> Local tourist SIMs in many countries require passport registration — a travel eSIM skips it.</li>
<li><strong>No identity at checkout.</strong> Pay with crypto; we never ask for an email, name, or card.</li>
<li><strong>Instant.</strong> Install the QR code on Wi-Fi before you fly; switch it on when you land.</li>
</ul>
<h2>Frequently asked</h2>
<p><strong>Do I need an account to buy a ${name} eSIM?</strong> No — there is no signup at all. Pick a plan, pay in crypto, get the QR code.</p>
<p><strong>Which coins can I pay with?</strong> Monero (most private), Ethereum, USDT, and 100+ others including Bitcoin via anonymous swap.</p>
<p><strong>How fast is delivery?</strong> Instant after blockchain confirmation — about 30 seconds with ETH/USDT, a few minutes with Monero.</p>
<h2>How to set it up</h2>
<ol>
<li>Pick a ${name} plan at <a href="/shop/${code}">/shop/${code}</a> and pay with crypto.</li>
<li>Your QR code appears instantly on the <a href="/orders">orders page</a>.</li>
<li>Install it (<a href="/guide">step-by-step guide</a>) and enable data roaming on arrival.</li>
</ol>
<p><em>Prices update automatically every day. Last refreshed ${today}.</em> <a href="/shop/${code}">See all ${name} eSIMs →</a></p>
`,
  };
}

async function main() {
  let all = [];
  try {
    const data = await get("https://pikasim.com/api/packages/all-countries");
    all = data.packages || [];
  } catch (e) {
    console.error("catalog fetch failed:", e.message);
  }

  let existing = [];
  try { existing = JSON.parse(fs.readFileSync(OUT, "utf8")); } catch { existing = []; }

  const newSlugs = [];
  for (let i = 0; i < PER_DAY; i++) {
    const idx = dayNum * PER_DAY + i;
    const code = CODES[idx % CODES.length];
    const tpl = TOPIC_TEMPLATES[idx % TOPIC_TEMPLATES.length];
    const plans = all
      .filter((p) => (p.locationCode || p.destinationCode) === code && p.volumeGB && p.priceUSD)
      .sort((a, b) => a.priceUSD - b.priceUSD)
      .slice(0, 6);
    const article = buildArticle(code, tpl, plans);
    existing = existing.filter((a) => a.slug !== article.slug);
    existing.unshift(article);
    newSlugs.push(article.slug);
    console.log(`Generated: ${article.title} (${article.slug}), ${plans.length} live plans`);
  }

  existing = existing.slice(0, KEEP);
  fs.writeFileSync(OUT, JSON.stringify(existing, null, 1));
  // Machine-readable list of today's slugs for the IndexNow ping step.
  fs.writeFileSync("privasim/data/new-slugs.txt", newSlugs.join("\n") + "\n");
  console.log(`Total articles kept: ${existing.length}`);
}

main();
