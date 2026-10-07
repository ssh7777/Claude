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
  { kind: "guide", title: (n) => `${n} eSIM Guide ${year}: Stay Connected`,
    intro: (n) => `Travelling to ${n}? Compare available eSIM plans and payment options before you go. Identity and registration requirements vary by jurisdiction and provider.` },
  { kind: "howmuch", title: (n) => `How Much Data Do You Need in ${n}? (${year} Guide)`,
    intro: (n) => `Working out how much mobile data you'll use in ${n} saves you money. Here's a realistic breakdown by traveller type, with current eSIM prices.` },
  { kind: "vs", title: (n) => `${n} Travel SIM vs eSIM: Which Is Better for Privacy?`,
    intro: (n) => `Local SIM and eSIM identity requirements vary in ${n}. Compare the available options and check current requirements before travel.` },
  { kind: "cheapest", title: (n) => `Cheapest ${n} eSIM in ${year} — Live Prices, No Account Needed`,
    intro: (n) => `Looking for an affordable ${n} eSIM? Catalog prices change, so compare the current live plans. Checkout does not require an identity account or email; temporary order data is retained for fulfillment.` },
  { kind: "crypto", title: (n) => `Buy a ${n} eSIM with Crypto (Monero, ETH, USDT)`,
    intro: (n) => `You can pay for ${n} mobile data entirely in cryptocurrency — Monero, Ethereum, and USDT on Ethereum mainnet are supported directly; additional assets may be available through the external Trocador swap provider. No identity account or card is required at checkout.` },
  { kind: "nokyc", title: (n) => `${n} eSIM Without an Identity Account (${year})`,
    intro: (n) => `Identity and registration requirements for SIM service vary. This guide explains plan choices in ${n}, payment options, and what the no-account checkout does and does not mean for privacy.` },
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
<p>${priceLine} Delivery begins after required chain confirmations and supplier fulfillment. A temporary server-side order record is retained for up to 30 days; checkout does not require an identity account or email.</p>
<h2>${name} eSIM plans right now</h2>
${plans.length ? `<table><tr><th>Data</th><th>Validity</th><th>Price</th><th></th></tr>${rows}</table>` : ""}
<h2>Privacy and checkout for a ${name} eSIM</h2>
<ul>
<li>Local SIM and eSIM registration requirements vary; check current rules before purchase and activation.</li>
<li><strong>No identity account is required.</strong> A temporary order record is kept server-side; no email or card is requested at checkout.</li>
<li><strong>Digital delivery.</strong> Retrieve the QR code after payment confirmation and supplier fulfillment; install it over Wi-Fi before you travel.</li>
</ul>
<h2>Frequently asked</h2>
<p><strong>Do I need an account to buy a ${name} eSIM?</strong> No identity account is required. A random invoice token saved in your browser is needed to access the temporary server-side order record.</p>
<p><strong>Which coins can I pay with?</strong> Monero, Ethereum, and USDT on Ethereum mainnet are supported directly; other assets may be available through the external Trocador swap provider.</p>
<p><strong>How fast is delivery?</strong> Delivery follows 12 Ethereum or 10 Monero confirmations, plus supplier fulfillment; timing varies.</p>
<h2>How to set it up</h2>
<ol>
<li>Pick a ${name} plan at <a href="/shop/${code}">/shop/${code}</a> and pay with crypto.</li>
<li>Open the <a href="/orders">orders page</a> in the browser that saved your invoice token after confirmations and supplier fulfillment.</li>
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
