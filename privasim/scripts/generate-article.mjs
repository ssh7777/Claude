// Daily auto-article generator — runs in CI with ZERO human input.
// Produces a fresh, unique, SEO-targeted article each day by combining:
//   - a rotating topic template (destination guides, how-tos, comparisons)
//   - LIVE data pulled from the PikaSim catalog (real plans + prices)
// Writes to data/auto-articles.json (kept to the newest N). The blog reads
// this file, so each push redeploys with new content — keeping the site
// fresh, which search engines reward.

import fs from "node:fs";
import https from "node:https";

const OUT = "privasim/data/auto-articles.json";
const KEEP = 30;
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
  IT: "Italy", ES: "Spain", TH: "Thailand", SG: "Singapore", AU: "Australia", KR: "South Korea",
  TR: "Turkey", AE: "United Arab Emirates", MX: "Mexico", BR: "Brazil", CA: "Canada",
  IN: "India", ID: "Indonesia", VN: "Vietnam", PH: "Philippines", GR: "Greece", PT: "Portugal",
};

// Rotating destination each day (deterministic by day-of-year → predictable, no repeats within cycle)
const CODES = Object.keys(COUNTRY_NAMES);
const dayNum = Math.floor(Date.now() / 86400000);
const code = CODES[dayNum % CODES.length];
const name = COUNTRY_NAMES[code];
const today = new Date().toISOString().slice(0, 10);

function retail(w) { return (Math.ceil(w * MARKUP * 100) / 100).toFixed(2); }

const TOPIC_TEMPLATES = [
  { kind: "guide", title: (n) => `${n} eSIM Guide ${new Date().getFullYear()}: Stay Connected Anonymously`,
    intro: (n) => `Travelling to ${n}? Here's how to get online the moment you land — with a data eSIM you can buy anonymously, no SIM-registration desk, no passport photocopy, no KYC.` },
  { kind: "howmuch", title: (n) => `How Much Data Do You Need in ${n}? (${new Date().getFullYear()} Guide)`,
    intro: (n) => `Working out how much mobile data you'll use in ${n} saves you money. Here's a realistic breakdown by traveller type, with current anonymous eSIM prices.` },
  { kind: "vs", title: (n) => `${n} Travel SIM vs eSIM: Which Is Better for Privacy?`,
    intro: (n) => `Buying a local tourist SIM in ${n} usually means showing ID. A travel eSIM skips that entirely. Here's the honest comparison.` },
];

async function main() {
  let plans = [];
  try {
    const data = await get("https://pikasim.com/api/packages/all-countries");
    plans = (data.packages || [])
      .filter((p) => (p.locationCode || p.destinationCode) === code && p.volumeGB && p.priceUSD)
      .sort((a, b) => a.priceUSD - b.priceUSD)
      .slice(0, 6);
  } catch (e) {
    console.error("catalog fetch failed:", e.message);
  }

  const tpl = TOPIC_TEMPLATES[dayNum % TOPIC_TEMPLATES.length];
  const rows = plans.map(
    (p) => `<tr><td>${p.volumeGB} GB</td><td>${p.duration || p.validityDays || "-"} days</td><td>$${retail(p.priceUSD)}</td><td><a href="/shop/${code}">Buy →</a></td></tr>`
  ).join("");

  const priceLine = plans.length
    ? `Current cheapest ${name} plan: <strong>${plans[0].volumeGB} GB for $${retail(plans[0].priceUSD)}</strong> (${plans[0].duration || plans[0].validityDays} days).`
    : `Browse live ${name} plans at <a href="/shop/${code}">/shop/${code}</a>.`;

  const slug = `${tpl.kind}-esim-${code.toLowerCase()}-${today}`;
  const article = {
    id: `auto-${today}-${code}`,
    slug,
    title: tpl.title(name),
    published_at: `${today}T07:00:00Z`,
    updated_at: `${today}T07:00:00Z`,
    featured: false,
    tags: ["esim", name.toLowerCase(), "travel", "auto"],
    excerpt: `${tpl.intro(name).replace(/<[^>]+>/g, "").slice(0, 155)}`,
    content: `
<p>${tpl.intro(name)}</p>
<p>${priceLine} All plans deliver instantly after crypto payment — pay with Monero or Ethereum, no account, no email.</p>
<h2>${name} eSIM plans right now</h2>
${plans.length ? `<table><tr><th>Data</th><th>Validity</th><th>Price</th><th></th></tr>${rows}</table>` : ""}
<h2>Why buy your ${name} eSIM anonymously?</h2>
<ul>
<li><strong>No registration desk.</strong> Local tourist SIMs in many countries require passport registration — a travel eSIM skips it.</li>
<li><strong>No identity at checkout.</strong> Pay with Monero or Ethereum; we never ask for an email, name, or card.</li>
<li><strong>Instant.</strong> Install the QR code on Wi-Fi before you fly; switch it on when you land.</li>
</ul>
<h2>How to set it up</h2>
<ol>
<li>Pick a ${name} plan at <a href="/shop/${code}">/shop/${code}</a> and pay with crypto.</li>
<li>Your QR code appears instantly on the <a href="/orders">orders page</a>.</li>
<li>Install it (<a href="/guide">step-by-step guide</a>) and enable data roaming on arrival.</li>
</ol>
<p><em>Prices update automatically every day. Last refreshed ${today}.</em> <a href="/shop/${code}">See all ${name} eSIMs →</a></p>
`,
  };

  let existing = [];
  try { existing = JSON.parse(fs.readFileSync(OUT, "utf8")); } catch { existing = []; }
  existing = existing.filter((a) => a.slug !== slug);
  existing.unshift(article);
  existing = existing.slice(0, KEEP);
  fs.writeFileSync(OUT, JSON.stringify(existing, null, 1));
  console.log(`Generated: ${article.title} (${slug}), ${plans.length} live plans, ${existing.length} total`);
}

main();
