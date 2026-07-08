// First-party, privacy-preserving analytics with source attribution.
//
// We record only aggregate counters in the persistent ledger — never PII,
// never raw IPs. For each traffic source (utm_source or referrer host) we
// keep: visits, checkouts started, and sales. This tells the owner which
// channel actually converts, so marketing effort goes where it pays.
//
// Counters are keyed by source; a small set of well-known sources plus an
// "other" bucket keeps ledger writes bounded.

import { ledgerGet, ledgerSet, ledgerList } from "@/lib/ledger";

export interface SourceStats {
  visits: number;
  checkouts: number;
  sales: number;
  revenueUsd: number;
}

const EMPTY: SourceStats = { visits: 0, checkouts: 0, sales: 0, revenueUsd: 0 };

// Normalise any referrer/utm into a small, safe bucket name.
export function normalizeSource(raw: string): string {
  const s = (raw || "").toLowerCase().trim();
  if (!s || s === "direct") return "direct";
  const known: Record<string, string> = {
    "reddit.com": "reddit", "reddit": "reddit", "old.reddit.com": "reddit",
    "t.co": "twitter", "twitter.com": "twitter", "x.com": "twitter", "twitter": "twitter",
    "news.ycombinator.com": "hackernews", "hackernews": "hackernews", "hn": "hackernews",
    "google.com": "google", "google": "google", "bing.com": "bing", "duckduckgo.com": "duckduckgo",
    "t.me": "telegram", "telegram": "telegram", "telegram.org": "telegram",
    "nostr": "nostr", "kycnot.me": "kycnotme", "monerica.com": "monerica", "cryptwerk.com": "cryptwerk",
    "youtube.com": "youtube", "facebook.com": "facebook", "instagram.com": "instagram",
  };
  // Strip protocol/path, keep host
  let host = s.replace(/^https?:\/\//, "").split("/")[0].replace(/^www\./, "");
  if (known[s]) return known[s];
  if (known[host]) return known[host];
  // Keep it short + safe
  host = host.replace(/[^a-z0-9.-]/g, "").slice(0, 24);
  return host || "other";
}

function key(source: string): string {
  return `an_${source.replace(/[^a-z0-9]/g, "").slice(0, 24) || "other"}`;
}

export async function recordEvent(
  source: string,
  type: "visit" | "checkout" | "sale",
  revenueUsd = 0
): Promise<void> {
  const src = normalizeSource(source);
  const k = key(src);
  const cur = (await ledgerGet<SourceStats>(k)) ?? { ...EMPTY };
  if (type === "visit") cur.visits += 1;
  else if (type === "checkout") cur.checkouts += 1;
  else if (type === "sale") {
    cur.sales += 1;
    cur.revenueUsd = Math.round((cur.revenueUsd + revenueUsd) * 100) / 100;
  }
  await ledgerSet(k, cur);
}

export async function getAnalytics(): Promise<
  { source: string; visits: number; checkouts: number; sales: number; revenueUsd: number; convRate: number }[]
> {
  const items = await ledgerList("an_");
  return Object.entries(items)
    .map(([k, v]) => {
      const s = v as SourceStats;
      return {
        source: k.slice(3),
        visits: s.visits ?? 0,
        checkouts: s.checkouts ?? 0,
        sales: s.sales ?? 0,
        revenueUsd: s.revenueUsd ?? 0,
        convRate: s.visits ? Math.round((s.sales / s.visits) * 10000) / 100 : 0,
      };
    })
    .sort((a, b) => b.revenueUsd - a.revenueUsd || b.visits - a.visits);
}
