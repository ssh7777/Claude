// Daily "Privacy & Travel News" roundup — ZERO AI, zero human input.
// Pulls fresh headlines from public RSS feeds, publishes a curated daily
// roundup with short excerpts and prominent source links (curation with
// attribution — NOT republication; full-text copying is both copyright
// infringement and duplicate-content poison that search engines demote).
// Fresh daily pages with outbound links to authority sites is exactly the
// freshness + relevance signal that ranks.

import fs from "node:fs";
import https from "node:https";

const OUT = "privasim/data/auto-articles.json";
const SLUGS = "privasim/data/new-slugs.txt";
const KEEP = 60;
const today = new Date().toISOString().slice(0, 10);

const FEEDS = [
  { name: "EFF Deeplinks", url: "https://www.eff.org/rss/updates.xml" },
  { name: "Hacker News (privacy)", url: "https://hnrss.org/newest?q=privacy&points=50" },
  { name: "Hacker News (eSIM)", url: "https://hnrss.org/newest?q=esim" },
  { name: "Schneier on Security", url: "https://www.schneier.com/feed/atom/" },
];

function get(url, redirects = 3) {
  return new Promise((res, rej) => {
    https.get(url, { headers: { "User-Agent": "privasim-roundup-bot", Accept: "application/rss+xml, application/atom+xml, text/xml, */*" } }, (r) => {
      if (r.statusCode >= 301 && r.statusCode <= 308 && r.headers.location && redirects > 0) {
        r.resume();
        return res(get(new URL(r.headers.location, url).href, redirects - 1));
      }
      let d = ""; r.on("data", (c) => (d += c)); r.on("end", () => res(d));
    }).on("error", rej);
  });
}

function strip(html) {
  return (html || "")
    .replace(/<!\[CDATA\[|\]\]>/g, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function esc(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// Minimal RSS2 <item> and Atom <entry> parsing — no dependencies.
function parseFeed(xml) {
  const items = [];
  const blocks = xml.match(/<item[\s>][\s\S]*?<\/item>/g) || xml.match(/<entry[\s>][\s\S]*?<\/entry>/g) || [];
  for (const b of blocks) {
    const title = strip((b.match(/<title[^>]*>([\s\S]*?)<\/title>/) || [])[1] || "");
    let link = strip((b.match(/<link[^>]*>([\s\S]*?)<\/link>/) || [])[1] || "");
    if (!link) link = (b.match(/<link[^>]*href="([^"]+)"/) || [])[1] || "";
    let desc = strip(
      (b.match(/<description[^>]*>([\s\S]*?)<\/description>/) || b.match(/<summary[^>]*>([\s\S]*?)<\/summary>/) || b.match(/<content[^>]*>([\s\S]*?)<\/content>/) || [])[1] || ""
    );
    // HN feeds ship boilerplate ("Article URL: … Comments URL: … Points: …")
    // instead of a summary — strip it, and drop any URL-heavy leftovers so
    // the roundup never shows raw links as "excerpts".
    desc = desc
      .replace(/Article URL:\s*\S+/gi, "")
      .replace(/Comments URL:\s*\S+/gi, "")
      .replace(/Points:\s*\d+/gi, "")
      .replace(/#\s*Comments:\s*\d+/gi, "")
      .replace(/https?:\/\/\S+/g, "")
      .replace(/\s+/g, " ")
      .trim();
    if (desc.length < 40) desc = ""; // too little left to be useful
    if (title && link && /^https?:\/\//.test(link)) {
      items.push({ title, link, excerpt: desc.slice(0, 220) });
    }
  }
  return items;
}

async function main() {
  const sections = [];
  for (const feed of FEEDS) {
    try {
      const xml = await get(feed.url);
      const items = parseFeed(xml).slice(0, 4);
      if (items.length) sections.push({ name: feed.name, items });
      console.log(`${feed.name}: ${items.length} items`);
    } catch (e) {
      console.error(`${feed.name} failed: ${e.message}`);
    }
  }

  if (sections.length === 0) {
    console.log("No feeds reachable — skipping roundup today.");
    return;
  }

  const body = sections.map((s) => `
<h2>${esc(s.name)}</h2>
<ul>
${s.items.map((i) => `<li><a href="${esc(i.link)}" rel="nofollow noopener" target="_blank">${esc(i.title)}</a>${i.excerpt ? ` — ${esc(i.excerpt)}…` : ""}</li>`).join("\n")}
</ul>`).join("\n");

  const slug = `privacy-news-${today}`;
  const article = {
    id: `roundup-${today}`,
    slug,
    title: `Privacy & Digital Freedom News — ${today}`,
    published_at: `${today}T07:30:00Z`,
    updated_at: `${today}T07:30:00Z`,
    featured: false,
    tags: ["news", "privacy", "roundup", "auto"],
    excerpt: `Today's curated privacy and digital-freedom headlines from around the web — with why they matter if you care about anonymous connectivity.`,
    content: `
<p>The daily reading list for people who care about digital privacy — curated headlines with links to the original reporting. Why we track this: every new SIM-registration law, data-broker leak, and surveillance expansion is a reason <a href="/blog/why-privacy-matters-esim">anonymous connectivity</a> exists.</p>
${body}
<h2>Stay connected without the paper trail</h2>
<p>PRIVASIM sells eSIMs for 190+ countries with no email, no account, no KYC — pay with Monero, Ethereum, USDT or 100+ other coins. <a href="/shop">Browse plans →</a></p>
<p><em>This roundup is generated automatically every day from public feeds. All headlines link to and credit their original sources.</em></p>
`,
  };

  let existing = [];
  try { existing = JSON.parse(fs.readFileSync(OUT, "utf8")); } catch { existing = []; }
  existing = existing.filter((a) => a.slug !== slug);
  existing.unshift(article);
  existing = existing.slice(0, KEEP);
  fs.writeFileSync(OUT, JSON.stringify(existing, null, 1));
  try { fs.appendFileSync(SLUGS, slug + "\n"); } catch {}
  console.log(`Roundup published: ${slug} (${sections.length} sources)`);
}

main();
